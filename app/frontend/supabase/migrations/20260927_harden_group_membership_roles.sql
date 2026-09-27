-- LOBOKO — protect group membership identity and privileged roles.
CREATE OR REPLACE FUNCTION public.enforce_group_member_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.user_id=auth.uid() AND NOT public.is_group_admin(NEW.group_id,auth.uid()) THEN
      NEW.role:='member';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.group_id IS DISTINCT FROM OLD.group_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
    THEN RAISE EXCEPTION 'Group membership identity cannot be changed'; END IF;
  IF NEW.role='owner' AND OLD.role IS DISTINCT FROM 'owner'
    THEN RAISE EXCEPTION 'Group ownership transfer requires a dedicated workflow'; END IF;
  IF OLD.role='owner' AND NEW.role IS DISTINCT FROM 'owner'
    THEN RAISE EXCEPTION 'Group owner role cannot be removed here'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_group_member_integrity ON public.group_members;
CREATE TRIGGER trg_enforce_group_member_integrity BEFORE INSERT OR UPDATE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_group_member_integrity();
REVOKE ALL ON FUNCTION public.enforce_group_member_integrity() FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS "group_members_insert" ON public.group_members;
DROP POLICY IF EXISTS "group_members_select_same_group_secure" ON public.group_members;
DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;
