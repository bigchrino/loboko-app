-- LOBOKO — reject invalid or half-filled GPS coordinates.
CREATE OR REPLACE FUNCTION public.validate_profile_coordinates()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.latitude IS NOT NULL AND (NEW.latitude < -90 OR NEW.latitude > 90) THEN RAISE EXCEPTION 'Invalid latitude'; END IF;
 IF NEW.longitude IS NOT NULL AND (NEW.longitude < -180 OR NEW.longitude > 180) THEN RAISE EXCEPTION 'Invalid longitude'; END IF;
 IF (NEW.latitude IS NULL) <> (NEW.longitude IS NULL) THEN RAISE EXCEPTION 'Latitude and longitude must be provided together'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_validate_profile_coordinates ON public.profiles;
CREATE TRIGGER trg_validate_profile_coordinates BEFORE INSERT OR UPDATE OF latitude,longitude ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_profile_coordinates();
REVOKE ALL ON FUNCTION public.validate_profile_coordinates() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.validate_service_order_coordinates()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.latitude IS NOT NULL AND (NEW.latitude < -90 OR NEW.latitude > 90) THEN RAISE EXCEPTION 'Invalid latitude'; END IF;
 IF NEW.longitude IS NOT NULL AND (NEW.longitude < -180 OR NEW.longitude > 180) THEN RAISE EXCEPTION 'Invalid longitude'; END IF;
 IF (NEW.latitude IS NULL) <> (NEW.longitude IS NULL) THEN RAISE EXCEPTION 'Latitude and longitude must be provided together'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_validate_service_order_coordinates ON public.service_orders;
CREATE TRIGGER trg_validate_service_order_coordinates BEFORE INSERT OR UPDATE OF latitude,longitude ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.validate_service_order_coordinates();
REVOKE ALL ON FUNCTION public.validate_service_order_coordinates() FROM PUBLIC,anon,authenticated;
