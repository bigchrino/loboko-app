-- LOBOKO — secure service order/payment workflow
-- Applied to production Supabase on 2026-09-27.
-- Keeps critical transitions atomic and prevents direct client writes to payment/order state.

CREATE OR REPLACE FUNCTION public.accept_service_order(p_order_id uuid)
RETURNS public.service_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.service_orders;
  v_provider uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_order FROM public.service_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  v_provider := COALESCE(v_order.provider_id, v_order.prestataire_id);
  IF v_uid <> v_provider THEN RAISE EXCEPTION 'Only the provider can accept this order'; END IF;
  IF v_order.status <> 'requested' THEN RAISE EXCEPTION 'Order is not awaiting provider response'; END IF;

  UPDATE public.service_orders SET status='accepted', updated_at=now()
  WHERE id=p_order_id RETURNING * INTO v_order;
  UPDATE public.profiles SET availability_status='busy', updated_at=now()
  WHERE user_id=v_provider;
  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_service_order(
  p_order_id uuid, p_reason text, p_requested_budget numeric DEFAULT NULL
)
RETURNS public.service_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.service_orders;
  v_provider uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NULLIF(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF p_requested_budget IS NOT NULL AND p_requested_budget <= 0 THEN
    RAISE EXCEPTION 'Requested budget must be greater than zero';
  END IF;

  SELECT * INTO v_order FROM public.service_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  v_provider := COALESCE(v_order.provider_id, v_order.prestataire_id);
  IF v_uid <> v_provider THEN RAISE EXCEPTION 'Only the provider can respond to this order'; END IF;
  IF v_order.status <> 'requested' THEN RAISE EXCEPTION 'Order is not awaiting provider response'; END IF;

  UPDATE public.service_orders SET
    status=CASE WHEN p_requested_budget IS NULL THEN 'refused' ELSE 'counter_price' END,
    decline_reason=btrim(p_reason),
    decline_is_budget_related=(p_requested_budget IS NOT NULL),
    provider_requested_budget=p_requested_budget,
    declined_at=now(),
    updated_at=now()
  WHERE id=p_order_id RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_service_counter_price(p_order_id uuid)
RETURNS public.service_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.service_orders;
  v_provider uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_order FROM public.service_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_uid <> v_order.client_id THEN RAISE EXCEPTION 'Only the client can accept a counter price'; END IF;
  IF v_order.status <> 'counter_price' OR v_order.provider_requested_budget IS NULL OR v_order.provider_requested_budget <= 0 THEN
    RAISE EXCEPTION 'No valid counter price is pending';
  END IF;

  v_provider := COALESCE(v_order.provider_id, v_order.prestataire_id);
  UPDATE public.service_orders SET
    status='accepted', proposed_budget=provider_requested_budget, updated_at=now()
  WHERE id=p_order_id RETURNING * INTO v_order;
  UPDATE public.profiles SET availability_status='busy', updated_at=now()
  WHERE user_id=v_provider;
  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_service_order(p_order_id uuid)
RETURNS public.service_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.service_orders;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_order FROM public.service_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_uid <> v_order.client_id THEN RAISE EXCEPTION 'Only the client can cancel this order'; END IF;
  IF v_order.status NOT IN ('requested','counter_price') THEN
    RAISE EXCEPTION 'This order can no longer be cancelled';
  END IF;

  UPDATE public.service_orders SET status='cancelled', updated_at=now()
  WHERE id=p_order_id RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_service_payment(p_order_id uuid, p_currency text)
RETURNS public.payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.service_orders;
  v_payment public.payments;
  v_provider uuid;
  v_amount numeric;
  v_commission numeric;
  v_total numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_currency NOT IN ('USD','CDF') THEN RAISE EXCEPTION 'Unsupported currency'; END IF;

  SELECT * INTO v_order FROM public.service_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_uid <> v_order.client_id THEN RAISE EXCEPTION 'Only the client can prepare payment'; END IF;
  IF v_order.status <> 'accepted' THEN RAISE EXCEPTION 'Order must be accepted before payment'; END IF;
  IF v_order.payment_status <> 'pending' OR v_order.payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Payment has already been prepared';
  END IF;

  v_provider := COALESCE(v_order.provider_id, v_order.prestataire_id);
  v_amount := v_order.proposed_budget;
  IF v_provider IS NULL THEN RAISE EXCEPTION 'Provider not found'; END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'Order amount must be greater than zero'; END IF;

  v_commission := round(v_amount * 0.10, 2);
  v_total := round(v_amount + v_commission, 2);

  INSERT INTO public.payments(
    order_id,client_id,provider_id,amount,commission_amount,total_amount,currency,status,paid_at
  ) VALUES (
    v_order.id,v_order.client_id,v_provider,v_amount,v_commission,v_total,p_currency,'held',now()
  ) RETURNING * INTO v_payment;

  UPDATE public.service_orders SET
    payment_id=v_payment.id, payment_status='held', is_paid=true, paid_at=now(), updated_at=now()
  WHERE id=v_order.id;

  RETURN v_payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_service_order(p_order_id uuid)
RETURNS public.service_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.service_orders;
  v_payment public.payments;
  v_provider uuid;
  v_was_counted boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_order FROM public.service_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_uid <> v_order.client_id THEN RAISE EXCEPTION 'Only the client can confirm completion'; END IF;
  IF v_order.status <> 'accepted' THEN RAISE EXCEPTION 'Order is not active'; END IF;
  IF v_order.payment_status <> 'held' OR v_order.payment_id IS NULL THEN
    RAISE EXCEPTION 'Payment must be held before completion';
  END IF;

  v_provider := COALESCE(v_order.provider_id, v_order.prestataire_id);
  v_was_counted := COALESCE(v_order.mission_counted,false);

  SELECT * INTO v_payment FROM public.payments
  WHERE id=v_order.payment_id AND order_id=v_order.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_payment.status <> 'held' THEN RAISE EXCEPTION 'Payment is not held'; END IF;

  UPDATE public.payments SET
    status='released', provider_confirmed=true, provider_confirmed_at=now(),
    released_at=now(), updated_at=now()
  WHERE id=v_payment.id;

  UPDATE public.service_orders SET
    status='completed', payment_status='paid', completed_at=now(),
    mission_counted=true, updated_at=now()
  WHERE id=v_order.id RETURNING * INTO v_order;

  UPDATE public.profiles SET
    availability_status='available',
    completed_jobs_count=CASE
      WHEN v_was_counted THEN COALESCE(completed_jobs_count,0)
      ELSE COALESCE(completed_jobs_count,0)+1
    END,
    updated_at=now()
  WHERE user_id=v_provider;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_service_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_service_order(uuid,text,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_service_counter_price(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_service_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_service_payment(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_service_order(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.accept_service_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_service_order(uuid,text,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_service_counter_price(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_service_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_service_payment(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_service_order(uuid) TO authenticated;

DROP POLICY IF EXISTS "Service orders update by client or provider" ON public.service_orders;
DROP POLICY IF EXISTS "Clients can update pending payments" ON public.payments;
DROP POLICY IF EXISTS "Clients can create payments" ON public.payments;


-- Explicitly keep anonymous users out of these SECURITY DEFINER RPCs.
REVOKE EXECUTE ON FUNCTION public.accept_service_order(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_service_order(uuid,text,numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_service_counter_price(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_service_order(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.prepare_service_payment(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_service_order(uuid) FROM anon;

-- The legacy counter RPC must not let providers forge completed-job totals.
REVOKE EXECUTE ON FUNCTION public.increment_completed_jobs(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_completed_jobs(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_completed_jobs(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.prevent_self_completed_jobs_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() = OLD.user_id
     AND NEW.completed_jobs_count IS DISTINCT FROM OLD.completed_jobs_count THEN
    RAISE EXCEPTION 'completed_jobs_count is managed by LOBOKO';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_completed_jobs_change ON public.profiles;
CREATE TRIGGER trg_prevent_self_completed_jobs_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_completed_jobs_change();

REVOKE EXECUTE ON FUNCTION public.prevent_self_completed_jobs_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_self_completed_jobs_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_self_completed_jobs_change() FROM authenticated;
