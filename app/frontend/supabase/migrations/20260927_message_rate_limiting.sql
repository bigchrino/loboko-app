-- LOBOKO — database-level anti-spam guard for direct messages.
-- WebRTC signalling uses the same table, so it gets a separate burst allowance.
CREATE OR REPLACE FUNCTION public.enforce_message_rate_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE v_recent_10s integer; v_recent_60s integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF NEW.content LIKE '@@loboko:%"kind":"signal"%' THEN
    SELECT count(*) INTO v_recent_10s FROM public.messages
    WHERE user_id=auth.uid() AND created_at>now()-interval '10 seconds'
      AND content LIKE '@@loboko:%"kind":"signal"%';
    IF v_recent_10s>=40 THEN RAISE EXCEPTION 'Too many signalling messages'; END IF;
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_recent_10s FROM public.messages
  WHERE user_id=auth.uid() AND created_at>now()-interval '10 seconds'
    AND content NOT LIKE '@@loboko:%"kind":"signal"%';
  IF v_recent_10s>=12 THEN RAISE EXCEPTION 'Vous envoyez des messages trop rapidement'; END IF;

  SELECT count(*) INTO v_recent_60s FROM public.messages
  WHERE user_id=auth.uid() AND created_at>now()-interval '60 seconds'
    AND content NOT LIKE '@@loboko:%"kind":"signal"%';
  IF v_recent_60s>=45 THEN RAISE EXCEPTION 'Limite temporaire de messages atteinte'; END IF;

  IF length(NEW.content)>20000 THEN RAISE EXCEPTION 'Message trop volumineux'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_message_rate_limit ON public.messages;
CREATE TRIGGER trg_message_rate_limit BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_message_rate_limit();
REVOKE ALL ON FUNCTION public.enforce_message_rate_limit() FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_messages_user_created_at ON public.messages(user_id,created_at DESC);
