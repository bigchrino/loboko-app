-- LOBOKO — preserve moderation report identity and evidence.
CREATE OR REPLACE FUNCTION public.enforce_report_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_admin boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 SELECT COALESCE(is_admin,false) INTO v_admin FROM public.profiles WHERE user_id=auth.uid();
 IF TG_OP='INSERT' THEN
  IF NEW.reporter_id<>auth.uid() THEN RAISE EXCEPTION 'Reporter must be authenticated user'; END IF;
  NEW.status:='pending'; NEW.reviewed_at:=NULL;
  IF NEW.reported_user_id=auth.uid() THEN RAISE EXCEPTION 'Cannot report your own profile'; END IF;
 ELSE
  IF NOT COALESCE(v_admin,false) THEN RAISE EXCEPTION 'Only administrators can update reports'; END IF;
  IF NEW.reporter_id IS DISTINCT FROM OLD.reporter_id
   OR NEW.reported_user_id IS DISTINCT FROM OLD.reported_user_id
   OR NEW.reported_message_id IS DISTINCT FROM OLD.reported_message_id
   OR NEW.reported_post_id IS DISTINCT FROM OLD.reported_post_id
   OR NEW.reason IS DISTINCT FROM OLD.reason
   OR NEW.description IS DISTINCT FROM OLD.description
   OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN RAISE EXCEPTION 'Report evidence cannot be rewritten'; END IF;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_report_integrity ON public.reports;
CREATE TRIGGER trg_report_integrity BEFORE INSERT OR UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.enforce_report_integrity();
REVOKE ALL ON FUNCTION public.enforce_report_integrity() FROM PUBLIC,anon,authenticated;
