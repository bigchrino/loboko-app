-- Stage 2: apply after the directory-reading frontend is deployed.
-- RLS permits complete private profiles only to their owner or an active admin.
create function loboko_private.is_profile_admin()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
   select 1 from public.profiles p where p.user_id=(select auth.uid())
   and p.is_admin=true and not coalesce(p.banned,false)
   and p.deleted_at is null and p.deactivated_at is null
   and (not coalesce(p.suspended,false) or (p.suspended_until is not null and p.suspended_until<=now()))
 );
$$;
revoke all on function loboko_private.is_profile_admin() from public,anon;
grant execute on function loboko_private.is_profile_admin() to authenticated;

revoke all on public.profiles from public,anon,authenticated;
grant select,insert,update,delete on public.profiles to authenticated;
alter table public.profiles enable row level security;
drop policy profiles_select_all on public.profiles;
create policy profiles_select_private on public.profiles
  for select to authenticated
  using (user_id=(select auth.uid()) or (select loboko_private.is_profile_admin()));

-- Ratings still check the caller's private role, while the target's public
-- provider status comes from the safe directory.
alter policy ratings_insert_client_to_prestataire on public.ratings
  with check (
    from_user_id=(select auth.uid()) and from_user_id<>to_user_id
    and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role='client')
    and exists(select 1 from public.profile_directory p where p.user_id=ratings.to_user_id and p.role='prestataire')
  );

-- Recommendation supply must remain visible without opening private rows.
CREATE OR REPLACE FUNCTION public.recommend_services()
 RETURNS TABLE(service_id uuid, service_name text, category_id uuid, category_name text, category_slug text, provider_count bigint, available_count bigint, reason text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
  FROM public.profile_directory p,viewer v
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
$function$

notify pgrst,'reload schema';
