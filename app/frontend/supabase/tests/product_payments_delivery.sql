-- Transaction-only checks: all test orders and payments are rolled back.
begin;
do $$
declare
  v_template public.product_orders;
  v_order public.product_orders;
  v_intent public.product_payment_intents;
  v_reused public.product_payment_intents;
  v_shipment public.product_shipments;
  v_owner uuid;
  v_rejected boolean;
begin
  if has_function_privilege('authenticated', 'public.confirm_cinetpay_product_payment(text,integer,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.begin_cinetpay_product_payment(uuid,text,integer,numeric)', 'EXECUTE') then
    raise exception 'Payment confirmation must be server-only';
  end if;
  if has_table_privilege('authenticated', 'public.product_shipments', 'UPDATE')
     or has_table_privilege('authenticated', 'public.product_payment_intents', 'INSERT') then
    raise exception 'Direct client writes must be denied';
  end if;
  select * into v_template from public.product_orders limit 1;
  if not found then raise exception 'An existing order fixture is required'; end if;
  select owner_id into v_owner from public.shops where id = v_template.shop_id;
  insert into public.product_orders(client_id,shop_id,product_id,quantity,unit_price,total_price)
    values(v_template.client_id,v_template.shop_id,v_template.product_id,1,5,5) returning * into v_order;
  v_intent := public.begin_cinetpay_product_payment(v_order.id, 'LBK' || replace(gen_random_uuid()::text,'-',''), 10000, 2000);
  v_reused := public.begin_cinetpay_product_payment(v_order.id, 'LBK' || replace(gen_random_uuid()::text,'-',''), 10000, 2000);
  if v_intent.id <> v_reused.id then raise exception 'Repeated checkout created multiple payments'; end if;

  perform set_config('request.jwt.claim.sub', v_template.client_id::text, true);
  v_rejected := false;
  begin perform public.cancel_product_order(v_order.id); exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'In-progress checkout was cancellable'; end if;
  v_rejected := false;
  begin perform public.confirm_cinetpay_product_payment(v_intent.transaction_id, 9999, 'CDF'); exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'Incorrect amount was accepted'; end if;
  v_intent := public.confirm_cinetpay_product_payment(v_intent.transaction_id, 10000, 'CDF');
  v_intent := public.confirm_cinetpay_product_payment(v_intent.transaction_id, 10000, 'CDF');
  if (select count(*) from public.product_shipments where order_id = v_order.id) <> 1 then raise exception 'Duplicate shipment'; end if;
  if (select count(*) from public.product_shipment_events pse join public.product_shipments ps on ps.id = pse.shipment_id where ps.order_id = v_order.id) <> 1 then raise exception 'Duplicate payment event'; end if;

  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  v_rejected := false;
  begin perform public.update_product_shipment(v_order.id,'shipped'); exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'Another user changed delivery'; end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_rejected := false;
  begin perform public.update_product_shipment(v_order.id,'delivered'); exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'Delivery skipped shipment'; end if;
  v_shipment := public.update_product_shipment(v_order.id,'shipped','Test courier','TEST-ONLY','https://example.com/tracking');
  v_rejected := false;
  begin perform public.update_product_shipment(v_order.id,'preparing'); exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'Shipment reverted'; end if;
  v_shipment := public.update_product_shipment(v_order.id,'delivered','Test courier','TEST-ONLY','https://example.com/tracking');
  if (select status from public.product_orders where id = v_order.id) <> 'completed' then raise exception 'Delivered order not completed'; end if;
end;
$$;
rollback;
