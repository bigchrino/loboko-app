create or replace function public.update_product_shipment(
  p_order_id uuid,
  p_status text,
  p_carrier text default null,
  p_tracking_number text default null,
  p_tracking_url text default null,
  p_expected_delivery date default null,
  p_note text default null
) returns public.product_shipments
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_order public.product_orders;
  v_shipment public.product_shipments;
  v_previous_status text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_status not in ('preparing','shipped','delivered') then raise exception 'Invalid delivery status'; end if;
  select po.* into v_order from public.product_orders po
    join public.shops s on s.id = po.shop_id
    where po.id = p_order_id and s.owner_id = v_uid for update of po;
  if not found then raise exception 'Order not found or shop access denied'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'Payment must be verified before shipping'; end if;
  select * into v_shipment from public.product_shipments where order_id = p_order_id for update;
  if not found then raise exception 'Shipment not available'; end if;
  v_previous_status := v_shipment.status;
  if v_previous_status = 'delivered' and p_status <> 'delivered' then raise exception 'Delivered shipment cannot be reverted'; end if;
  if v_previous_status = 'shipped' and p_status = 'preparing' then raise exception 'Shipped shipment cannot be reverted'; end if;
  if v_previous_status = 'preparing' and p_status = 'delivered' then raise exception 'Mark the order as shipped first'; end if;
  if length(coalesce(p_carrier, '')) > 120 or length(coalesce(p_tracking_number, '')) > 160
     or length(coalesce(p_tracking_url, '')) > 1000 or length(coalesce(p_note, '')) > 500 then
    raise exception 'Delivery details are too long';
  end if;

  update public.product_shipments set
    status = p_status,
    carrier = nullif(trim(coalesce(p_carrier, '')), ''),
    tracking_number = nullif(trim(coalesce(p_tracking_number, '')), ''),
    tracking_url = case when nullif(trim(coalesce(p_tracking_url, '')), '') ~ '^https?://' then nullif(trim(p_tracking_url), '') else null end,
    expected_delivery = p_expected_delivery,
    shipped_at = case when p_status = 'shipped' then coalesce(shipped_at, now()) else shipped_at end,
    delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
    updated_at = now()
    where order_id = p_order_id returning * into v_shipment;

  if p_status <> v_previous_status or nullif(trim(coalesce(p_note, '')), '') is not null then
    insert into public.product_shipment_events(shipment_id, status, details, created_by)
      values (v_shipment.id, p_status, nullif(trim(coalesce(p_note, '')), ''), v_uid);
  end if;
  if p_status = 'delivered' then
    update public.product_orders set status = 'completed', updated_at = now() where id = p_order_id;
  end if;
  return v_shipment;
end;
$$;
revoke all on function public.update_product_shipment(uuid, text, text, text, text, date, text) from public, anon;
grant execute on function public.update_product_shipment(uuid, text, text, text, text, date, text) to authenticated;

