-- LOBOKO — prevent providers from forging verification badges/status.
CREATE OR REPLACE FUNCTION public.prevent_self_verification_forgery()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF auth.uid() = OLD.user_id AND COALESCE(OLD.is_admin,false) = false THEN
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
      IF NOT (
        NEW.verification_status = 'pending'
        AND NEW.is_verified = false
        AND NEW.verified_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Verification fields are managed by LOBOKO moderation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_verification_forgery ON public.profiles;
CREATE TRIGGER trg_prevent_self_verification_forgery
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_verification_forgery();

REVOKE ALL ON FUNCTION public.prevent_self_verification_forgery() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_self_verification_forgery() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_self_verification_forgery() FROM authenticated;
