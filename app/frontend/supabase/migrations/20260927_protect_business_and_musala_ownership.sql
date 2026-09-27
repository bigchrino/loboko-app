-- LOBOKO — protect ownership/author identity for business and Musala records.
CREATE OR REPLACE FUNCTION public.enforce_shop_company_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND NEW.owner_id<>auth.uid() THEN RAISE EXCEPTION 'Owner must be authenticated user'; END IF;
 IF TG_OP='UPDATE' AND NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN RAISE EXCEPTION 'Owner cannot be changed'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_shops_owner_integrity ON public.shops;
CREATE TRIGGER trg_shops_owner_integrity BEFORE INSERT OR UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.enforce_shop_company_identity();
DROP TRIGGER IF EXISTS trg_companies_owner_integrity ON public.companies;
CREATE TRIGGER trg_companies_owner_integrity BEFORE INSERT OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.enforce_shop_company_identity();
REVOKE ALL ON FUNCTION public.enforce_shop_company_identity() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.enforce_musala_request_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND NEW.user_id<>auth.uid() THEN RAISE EXCEPTION 'Author must be authenticated user'; END IF;
 IF TG_OP='UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Author cannot be changed'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_musala_request_identity ON public.musala_requests;
CREATE TRIGGER trg_musala_request_identity BEFORE INSERT OR UPDATE ON public.musala_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_musala_request_identity();
REVOKE ALL ON FUNCTION public.enforce_musala_request_identity() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.enforce_job_offer_company()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.companies c WHERE c.id=NEW.company_id AND c.owner_id=auth.uid())
   THEN RAISE EXCEPTION 'You do not own this company'; END IF;
 IF TG_OP='UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id
   THEN RAISE EXCEPTION 'Offer company cannot be changed'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_job_offer_company_integrity ON public.job_offers;
CREATE TRIGGER trg_job_offer_company_integrity BEFORE INSERT OR UPDATE ON public.job_offers FOR EACH ROW EXECUTE FUNCTION public.enforce_job_offer_company();
REVOKE ALL ON FUNCTION public.enforce_job_offer_company() FROM PUBLIC,anon,authenticated;
