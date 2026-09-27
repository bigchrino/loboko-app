-- LOBOKO — moderation state is controlled by administration/backend only.
CREATE OR REPLACE FUNCTION public.prevent_self_moderation_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF NEW.suspended IS DISTINCT FROM OLD.suspended
 OR NEW.suspended_reason IS DISTINCT FROM OLD.suspended_reason
 OR NEW.suspended_until IS DISTINCT FROM OLD.suspended_until
 OR NEW.banned IS DISTINCT FROM OLD.banned
 OR NEW.banned_reason IS DISTINCT FROM OLD.banned_reason
 THEN RAISE EXCEPTION 'Moderation fields can only be changed by LOBOKO administration';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_prevent_self_moderation_change ON public.profiles;
CREATE TRIGGER trg_prevent_self_moderation_change BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_moderation_change();
REVOKE ALL ON FUNCTION public.prevent_self_moderation_change() FROM PUBLIC,anon,authenticated;
