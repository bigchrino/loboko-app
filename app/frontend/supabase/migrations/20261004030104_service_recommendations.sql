CREATE TABLE public.user_service_interests (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  score double precision NOT NULL DEFAULT 1 CHECK (score >= 0 AND score <= 50),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, service_id)
);
ALTER TABLE public.user_service_interests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_service_interests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_service_interests TO authenticated;
CREATE POLICY interests_select_own ON public.user_service_interests FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY interests_insert_own ON public.user_service_interests FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY interests_update_own ON public.user_service_interests FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY interests_delete_own ON public.user_service_interests FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE INDEX IF NOT EXISTS profiles_recommendable_service_idx ON public.profiles(service_id)
  WHERE role = 'prestataire' AND banned = false AND suspended = false
    AND deactivated_at IS NULL AND deleted_at IS NULL;

-- Only taxonomy IDs are stored, never the search text or GPS coordinates.
CREATE FUNCTION public.record_service_interest(service_ids uuid[], event_type text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  viewer uuid := auth.uid();
  event_weight double precision;
BEGIN
  IF viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF event_type NOT IN ('search','category','service') OR event_type IS NULL THEN
    RAISE EXCEPTION 'Unsupported event';
  END IF;
  IF coalesce(cardinality(service_ids),0) > 8 THEN RAISE EXCEPTION 'Too many services'; END IF;
  event_weight := CASE event_type WHEN 'service' THEN 4 WHEN 'search' THEN 2 ELSE 0.5 END;
  INSERT INTO public.user_service_interests AS previous(user_id,service_id,score,updated_at)
  SELECT viewer,s.id,event_weight,now() FROM public.services s
  JOIN public.service_categories c ON c.id = s.category_id AND c.is_active
  WHERE s.id = ANY(service_ids) AND s.is_active
  ON CONFLICT (user_id,service_id) DO UPDATE SET
    score = CASE WHEN previous.updated_at >= now() - interval '30 seconds'
      THEN greatest(previous.score, event_weight) ELSE least(50, previous.score * power(0.5,
      greatest(0,extract(epoch FROM (now()-previous.updated_at))) / 1209600.0) + event_weight) END,
    updated_at = now()
  WHERE previous.updated_at < now() - interval '30 seconds' OR previous.score < event_weight;
END;
$$;
REVOKE ALL ON FUNCTION public.record_service_interest(uuid[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_service_interest(uuid[],text) TO authenticated;

CREATE FUNCTION public.recommend_services()
RETURNS TABLE(service_id uuid, service_name text, category_id uuid,
  category_name text, category_slug text, provider_count bigint,
  available_count bigint, reason text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
WITH viewer AS (
  SELECT auth.uid() AS id
), me AS (
  SELECT p.city,p.province FROM public.profiles p,viewer v WHERE p.user_id=v.id
), interests AS (
  SELECT i.service_id,s.category_id,
    i.score * power(0.5,greatest(0,extract(epoch FROM (now()-i.updated_at))) / 1209600.0) AS strength
  FROM public.user_service_interests i JOIN public.services s ON s.id=i.service_id,viewer v
  WHERE i.user_id=v.id AND i.updated_at > now()-interval '90 days'
), category_interests AS (
  SELECT i.category_id,max(i.strength)*0.35 AS strength FROM interests i GROUP BY i.category_id
), supply AS (
  SELECT p.service_id,count(*) AS providers,
    count(*) FILTER (WHERE coalesce(p.availability_status,'available')='available') AS available,
    count(*) FILTER (WHERE p.is_verified AND p.verification_status='approved') AS verified,
    count(*) FILTER (WHERE nullif(p.city,'')=(SELECT nullif(city,'') FROM me)) AS in_city,
    count(*) FILTER (WHERE nullif(p.province,'')=(SELECT nullif(province,'') FROM me)) AS in_province
  FROM public.profiles p,viewer v
  WHERE p.role='prestataire' AND p.banned=false AND p.suspended=false
    AND p.deactivated_at IS NULL AND p.deleted_at IS NULL AND p.user_id<>v.id
    AND coalesce(p.availability_status,'available')<>'unavailable'
  GROUP BY p.service_id
), candidates AS (
  SELECT s.id,s.name,s.category_id,c.name AS cat_name,c.slug AS cat_slug,
    x.providers,x.available,
    CASE WHEN coalesce(i.strength,0)>=0.25 THEN 'search'
      WHEN coalesce(ci.strength,0)>=0.25 THEN 'related' ELSE 'discover' END AS why,
    coalesce(i.strength,0)*2+coalesce(ci.strength,0)+ln(1+x.providers)
      +x.available::double precision/x.providers
      +0.5*x.verified::double precision/x.providers
      +0.8*x.in_city::double precision/x.providers
      +0.3*x.in_province::double precision/x.providers AS rank_score
  FROM public.services s JOIN public.service_categories c ON c.id=s.category_id AND c.is_active
  JOIN supply x ON x.service_id=s.id
  LEFT JOIN interests i ON i.service_id=s.id
  LEFT JOIN category_interests ci ON ci.category_id=s.category_id
  WHERE s.is_active
), diversified AS (
  SELECT *,row_number() OVER (PARTITION BY category_id ORDER BY rank_score DESC,id) AS category_rank
  FROM candidates
), personal AS (
  SELECT *,1 AS lane FROM diversified WHERE category_rank<=2 AND why<>'discover'
  ORDER BY rank_score DESC,id LIMIT 5
), exploration AS (
  SELECT *,2 AS lane FROM diversified WHERE category_rank<=2
    AND id NOT IN (SELECT id FROM personal)
  ORDER BY (why='discover') DESC,rank_score DESC,id
  LIMIT (6-(SELECT count(*) FROM personal))
), chosen AS (
  SELECT * FROM personal UNION ALL SELECT * FROM exploration
)
SELECT id,name,chosen.category_id,cat_name,cat_slug,providers,available,why
FROM chosen ORDER BY lane,rank_score DESC,id;
$$;
REVOKE ALL ON FUNCTION public.recommend_services() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.recommend_services() TO authenticated;
