-- LOBOKO — protect marketplace request/response and rating identities.
CREATE OR REPLACE FUNCTION public.enforce_marketplace_request_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.user_id<>auth.uid() THEN RAISE EXCEPTION 'Request author must be authenticated user'; END IF;
  NEW.status:='open'; NEW.closed_at:=NULL;
 ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Request author cannot be changed'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_marketplace_request_integrity ON public.service_requests;
CREATE TRIGGER trg_marketplace_request_integrity BEFORE INSERT OR UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.enforce_marketplace_request_integrity();

CREATE OR REPLACE FUNCTION public.enforce_service_response_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_status text; v_owner uuid;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.provider_id<>auth.uid() THEN RAISE EXCEPTION 'Response author must be authenticated user'; END IF;
  SELECT status,user_id INTO v_status,v_owner FROM public.service_requests WHERE id=NEW.request_id;
  IF v_status IS DISTINCT FROM 'open' THEN RAISE EXCEPTION 'Service request is not open'; END IF;
  IF v_owner=auth.uid() THEN RAISE EXCEPTION 'Cannot respond to your own request'; END IF;
 ELSE
  IF NEW.provider_id IS DISTINCT FROM OLD.provider_id OR NEW.request_id IS DISTINCT FROM OLD.request_id
   THEN RAISE EXCEPTION 'Response identity cannot be changed'; END IF;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_service_response_integrity ON public.service_request_responses;
CREATE TRIGGER trg_service_response_integrity BEFORE INSERT OR UPDATE ON public.service_request_responses FOR EACH ROW EXECUTE FUNCTION public.enforce_service_response_integrity();

CREATE OR REPLACE FUNCTION public.enforce_rating_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND NEW.from_user_id<>auth.uid() THEN RAISE EXCEPTION 'Rating author must be authenticated user'; END IF;
 IF TG_OP='UPDATE' AND (NEW.from_user_id IS DISTINCT FROM OLD.from_user_id OR NEW.to_user_id IS DISTINCT FROM OLD.to_user_id)
  THEN RAISE EXCEPTION 'Rating participants cannot be changed'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_rating_integrity ON public.ratings;
CREATE TRIGGER trg_rating_integrity BEFORE INSERT OR UPDATE ON public.ratings FOR EACH ROW EXECUTE FUNCTION public.enforce_rating_integrity();

CREATE OR REPLACE FUNCTION public.enforce_shop_rating_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_owner uuid;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.from_user_id<>auth.uid() THEN RAISE EXCEPTION 'Rating author must be authenticated user'; END IF;
  SELECT owner_id INTO v_owner FROM public.shops WHERE id=NEW.shop_id;
  IF v_owner=auth.uid() THEN RAISE EXCEPTION 'Cannot rate your own shop'; END IF;
 ELSE
  IF NEW.from_user_id IS DISTINCT FROM OLD.from_user_id OR NEW.shop_id IS DISTINCT FROM OLD.shop_id
   THEN RAISE EXCEPTION 'Shop rating identity cannot be changed'; END IF;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_shop_rating_integrity ON public.shop_ratings;
CREATE TRIGGER trg_shop_rating_integrity BEFORE INSERT OR UPDATE ON public.shop_ratings FOR EACH ROW EXECUTE FUNCTION public.enforce_shop_rating_integrity();

REVOKE ALL ON FUNCTION public.enforce_marketplace_request_integrity() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.enforce_service_response_integrity() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.enforce_rating_integrity() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.enforce_shop_rating_integrity() FROM PUBLIC,anon,authenticated;
