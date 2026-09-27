-- LOBOKO — harden product order state transitions
CREATE OR REPLACE FUNCTION public.place_product_order(
  p_client_id uuid, p_product_id uuid, p_quantity integer
)
RETURNS public.product_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_product public.shop_products;
  v_order public.product_orders;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_client_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Invalid client'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than zero'; END IF;

  UPDATE public.shop_products
  SET stock_quantity=stock_quantity-p_quantity, updated_at=now()
  WHERE id=p_product_id AND stock_quantity>=p_quantity AND is_active=true
  RETURNING * INTO v_product;
  IF v_product IS NULL THEN RAISE EXCEPTION 'Stock insuffisant ou produit indisponible'; END IF;

  INSERT INTO public.product_orders(client_id,shop_id,product_id,quantity,unit_price,total_price)
  VALUES(v_uid,v_product.shop_id,p_product_id,p_quantity,v_product.price,v_product.price*p_quantity)
  RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_product_order(p_order_id uuid)
RETURNS public.product_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.product_orders;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_order FROM public.product_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_order.client_id<>v_uid THEN RAISE EXCEPTION 'Only the client can cancel this order'; END IF;
  IF v_order.status<>'pending' THEN RAISE EXCEPTION 'Commande déjà traitée'; END IF;
  IF v_order.payment_status<>'pending' THEN RAISE EXCEPTION 'A paid order cannot be cancelled here'; END IF;

  UPDATE public.product_orders SET status='cancelled',updated_at=now()
  WHERE id=p_order_id RETURNING * INTO v_order;
  UPDATE public.shop_products SET stock_quantity=stock_quantity+v_order.quantity,updated_at=now()
  WHERE id=v_order.product_id;
  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_product_order(p_order_id uuid)
RETURNS public.product_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.product_orders;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT po.* INTO v_order
  FROM public.product_orders po JOIN public.shops s ON s.id=po.shop_id
  WHERE po.id=p_order_id AND s.owner_id=v_uid
  FOR UPDATE OF po;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found or shop access denied'; END IF;
  IF v_order.status<>'pending' THEN RAISE EXCEPTION 'Order is not pending'; END IF;

  UPDATE public.product_orders SET status='completed',updated_at=now()
  WHERE id=p_order_id RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.place_product_order(uuid,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_product_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_product_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_product_stock(uuid,integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.place_product_order(uuid,uuid,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_product_order(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_product_order(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_product_stock(uuid,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_product_stock(uuid,integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.place_product_order(uuid,uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_product_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_product_order(uuid) TO authenticated;

DROP POLICY IF EXISTS "product_orders_insert_own" ON public.product_orders;
DROP POLICY IF EXISTS "product_orders_update" ON public.product_orders;
