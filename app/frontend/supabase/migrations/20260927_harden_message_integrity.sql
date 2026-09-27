-- LOBOKO messaging hardening applied to production Supabase on 2026-09-27.
-- Direct messages: enforce authenticated sender, blocking, immutable participants,
-- and separate sender/receiver update authority.
CREATE OR REPLACE FUNCTION public.enforce_message_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.user_id<>auth.uid() THEN RAISE EXCEPTION 'Sender must be authenticated user'; END IF;
    IF NEW.receiver_id=NEW.user_id THEN RAISE EXCEPTION 'Cannot message yourself'; END IF;
    IF EXISTS (SELECT 1 FROM public.blocked_users b WHERE b.owner_id=NEW.receiver_id AND b.blocked_id=NEW.user_id)
      THEN RAISE EXCEPTION 'Message not allowed'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
    THEN RAISE EXCEPTION 'Message participants cannot be changed'; END IF;
  IF auth.uid()=OLD.receiver_id THEN
    IF NEW.content IS DISTINCT FROM OLD.content OR NEW.reply_to_message_id IS DISTINCT FROM OLD.reply_to_message_id
      OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR NEW.is_ephemeral IS DISTINCT FROM OLD.is_ephemeral
      OR NEW.deleted_for_everyone_at IS DISTINCT FROM OLD.deleted_for_everyone_at
      THEN RAISE EXCEPTION 'Receiver cannot edit message content'; END IF;
  ELSIF auth.uid()=OLD.user_id THEN
    IF NEW.read IS DISTINCT FROM OLD.read OR NEW.read_at IS DISTINCT FROM OLD.read_at
      OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at
      THEN RAISE EXCEPTION 'Sender cannot change receiver read state'; END IF;
  ELSE RAISE EXCEPTION 'Not a message participant';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_message_integrity ON public.messages;
CREATE TRIGGER trg_enforce_message_integrity BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_message_integrity();
REVOKE ALL ON FUNCTION public.enforce_message_integrity() FROM PUBLIC, anon, authenticated;

-- Group messages: authorship/group identity is immutable; admins may moderate
-- deletion metadata but cannot rewrite another member's content.
CREATE OR REPLACE FUNCTION public.enforce_group_message_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.user_id<>auth.uid() THEN RAISE EXCEPTION 'Invalid group message author'; END IF;
    IF NOT public.is_group_member(NEW.group_id,auth.uid()) THEN RAISE EXCEPTION 'Not a group member'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.group_id IS DISTINCT FROM OLD.group_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN RAISE EXCEPTION 'Group message identity fields are immutable'; END IF;
  IF auth.uid()=OLD.user_id THEN RETURN NEW; END IF;
  IF public.is_group_admin(OLD.group_id,auth.uid()) THEN
    IF NEW.content IS DISTINCT FROM OLD.content OR NEW.reply_to_message_id IS DISTINCT FROM OLD.reply_to_message_id
      OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR NEW.is_ephemeral IS DISTINCT FROM OLD.is_ephemeral
      THEN RAISE EXCEPTION 'Group admins cannot edit member message content'; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Not allowed to update this group message';
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_group_message_integrity ON public.group_messages;
CREATE TRIGGER trg_enforce_group_message_integrity BEFORE INSERT OR UPDATE ON public.group_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_group_message_integrity();
REVOKE ALL ON FUNCTION public.enforce_group_message_integrity() FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "group_messages_insert_member" ON public.group_messages;
DROP POLICY IF EXISTS "group_messages_select" ON public.group_messages;
