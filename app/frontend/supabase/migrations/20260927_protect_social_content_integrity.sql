-- LOBOKO — protect social content identity and server-managed counters.
CREATE OR REPLACE FUNCTION public.enforce_post_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.user_id<>auth.uid() THEN RAISE EXCEPTION 'Post author must be authenticated user'; END IF;
  NEW.likes_count:=0; NEW.comments_count:=0; NEW.shares_count:=0;
 ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Post author cannot be changed';
 ELSIF NEW.likes_count IS DISTINCT FROM OLD.likes_count OR NEW.comments_count IS DISTINCT FROM OLD.comments_count OR NEW.shares_count IS DISTINCT FROM OLD.shares_count
  THEN RAISE EXCEPTION 'Post counters are managed by LOBOKO'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_post_integrity ON public.posts;
CREATE TRIGGER trg_post_integrity BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.enforce_post_integrity();

CREATE OR REPLACE FUNCTION public.enforce_comment_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND NEW.user_id<>auth.uid() THEN RAISE EXCEPTION 'Comment author must be authenticated user'; END IF;
 IF TG_OP='UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.post_id IS DISTINCT FROM OLD.post_id)
  THEN RAISE EXCEPTION 'Comment identity cannot be changed'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_comment_integrity ON public.comments;
CREATE TRIGGER trg_comment_integrity BEFORE INSERT OR UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_integrity();

CREATE OR REPLACE FUNCTION public.enforce_like_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NEW.user_id<>auth.uid() THEN RAISE EXCEPTION 'Like owner must be authenticated user'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_like_identity ON public.likes;
CREATE TRIGGER trg_like_identity BEFORE INSERT OR UPDATE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.enforce_like_identity();

CREATE OR REPLACE FUNCTION public.enforce_notification_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND NEW.from_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Notification actor must be authenticated user'; END IF;
 IF TG_OP='UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.from_user_id IS DISTINCT FROM OLD.from_user_id OR NEW.type IS DISTINCT FROM OLD.type OR NEW.post_id IS DISTINCT FROM OLD.post_id OR NEW.message IS DISTINCT FROM OLD.message)
  THEN RAISE EXCEPTION 'Notification content cannot be rewritten'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notification_integrity ON public.notifications;
CREATE TRIGGER trg_notification_integrity BEFORE INSERT OR UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.enforce_notification_integrity();

REVOKE ALL ON FUNCTION public.enforce_post_integrity() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.enforce_comment_integrity() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.enforce_like_identity() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.enforce_notification_integrity() FROM PUBLIC,anon,authenticated;
