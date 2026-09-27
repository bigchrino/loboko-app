-- LOBOKO — final identity/integrity guards for exposed user-write tables.
CREATE OR REPLACE FUNCTION public.enforce_simple_social_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF NEW.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'user_id must match authenticated user'; END IF;
 IF TG_OP='UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'user_id is immutable'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_comment_like_identity ON public.comment_likes;
CREATE TRIGGER trg_comment_like_identity BEFORE INSERT OR UPDATE ON public.comment_likes FOR EACH ROW EXECUTE FUNCTION public.enforce_simple_social_identity();
DROP TRIGGER IF EXISTS trg_post_share_identity ON public.post_shares;
CREATE TRIGGER trg_post_share_identity BEFORE INSERT OR UPDATE ON public.post_shares FOR EACH ROW EXECUTE FUNCTION public.enforce_simple_social_identity();
DROP TRIGGER IF EXISTS trg_provider_work_identity ON public.provider_works;
CREATE TRIGGER trg_provider_work_identity BEFORE INSERT OR UPDATE ON public.provider_works FOR EACH ROW EXECUTE FUNCTION public.enforce_simple_social_identity();
REVOKE ALL ON FUNCTION public.enforce_simple_social_identity() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.enforce_role_change_request_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_admin boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 SELECT COALESCE(is_admin,false) INTO v_admin FROM public.profiles WHERE user_id=auth.uid();
 IF TG_OP='INSERT' THEN
   IF NEW.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'user_id must match authenticated user'; END IF;
   NEW.status:='pending'; NEW.admin_note:=NULL; NEW.reviewed_at:=NULL; NEW.reviewed_by:=NULL;
 ELSE
   IF NOT COALESCE(v_admin,false) THEN RAISE EXCEPTION 'Only administrators can review role changes'; END IF;
   IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.old_role IS DISTINCT FROM OLD.old_role OR NEW.new_role IS DISTINCT FROM OLD.new_role OR NEW.requested_service_id IS DISTINCT FROM OLD.requested_service_id OR NEW.requested_metier IS DISTINCT FROM OLD.requested_metier OR NEW.reason IS DISTINCT FROM OLD.reason OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Role change request evidence is immutable';
   END IF;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_role_change_request_integrity ON public.role_change_requests;
CREATE TRIGGER trg_role_change_request_integrity BEFORE INSERT OR UPDATE ON public.role_change_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_role_change_request_integrity();
REVOKE ALL ON FUNCTION public.enforce_role_change_request_integrity() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.enforce_legacy_user_report_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF NEW.reporter_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'reporter_id must match authenticated user'; END IF;
 IF NEW.reported_id IS NOT NULL AND NEW.reported_id=auth.uid() THEN RAISE EXCEPTION 'Cannot report your own profile'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_legacy_user_report_integrity ON public.user_reports;
CREATE TRIGGER trg_legacy_user_report_integrity BEFORE INSERT ON public.user_reports FOR EACH ROW EXECUTE FUNCTION public.enforce_legacy_user_report_integrity();
REVOKE ALL ON FUNCTION public.enforce_legacy_user_report_integrity() FROM PUBLIC,anon,authenticated;
