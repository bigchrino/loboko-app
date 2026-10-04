create table if not exists public.product_payment_intents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.product_orders(id) on delete restrict,
  transaction_id text not null unique,
  amount integer not null check (amount > 0),
  currency text not null check (currency = 'CDF'),
  exchange_rate numeric(14,4) not null check (exchange_rate > 0),
  status text not null default 'pending' check (status in ('pending','paid','failed','expired')),
  checkout_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_payment_intents_order_id_idx
  on public.product_payment_intents(order_id, created_at desc);
create unique index if not exists product_payment_intents_one_pending_idx
  on public.product_payment_intents(order_id) where status = 'pending';
create unique index if not exists product_payment_intents_one_paid_idx
  on public.product_payment_intents(order_id) where status = 'paid';

create table if not exists public.product_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.product_orders(id) on delete restrict,
  status text not null default 'preparing' check (status in ('preparing','shipped','delivered')),
  carrier text,
  tracking_number text,
  tracking_url text,
  expected_delivery date,
  shipped_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.product_shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.product_shipments(id) on delete cascade,
  status text not null check (status in ('preparing','shipped','delivered')),
  details text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists product_shipment_events_timeline_idx
  on public.product_shipment_events(shipment_id, created_at);

alter table public.product_payment_intents enable row level security;
alter table public.product_shipments enable row level security;
alter table public.product_shipment_events enable row level security;
revoke all on public.product_payment_intents, public.product_shipments, public.product_shipment_events from anon, authenticated;
grant select on public.product_payment_intents, public.product_shipments, public.product_shipment_events to authenticated;
grant all on public.product_payment_intents, public.product_shipments, public.product_shipment_events to service_role;

drop policy if exists "Order parties can view product payment intents" on public.product_payment_intents;
create policy "Order parties can view product payment intents"
  on public.product_payment_intents for select to authenticated
  using (
    exists (
      select 1 from public.product_orders po
      left join public.shops s on s.id = po.shop_id
      where po.id = order_id and (po.client_id = (select auth.uid()) or s.owner_id = (select auth.uid()))
    )
  );

drop policy if exists "Order parties can view product shipments" on public.product_shipments;
create policy "Order parties can view product shipments"
  on public.product_shipments for select to authenticated
  using (
    exists (
      select 1 from public.product_orders po
      left join public.shops s on s.id = po.shop_id
      where po.id = order_id and (po.client_id = (select auth.uid()) or s.owner_id = (select auth.uid()))
    )
  );

drop policy if exists "Order parties can view shipment events" on public.product_shipment_events;
create policy "Order parties can view shipment events"
  on public.product_shipment_events for select to authenticated
  using (
    exists (
      select 1 from public.product_shipments ps
      join public.product_orders po on po.id = ps.order_id
      left join public.shops s on s.id = po.shop_id
      where ps.id = shipment_id and (po.client_id = (select auth.uid()) or s.owner_id = (select auth.uid()))
    )
  );

create or replace function public.begin_cinetpay_product_payment(
  p_order_id uuid, p_transaction_id text, p_amount integer, p_exchange_rate numeric
) returns public.product_payment_intents
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.product_orders;
  v_intent public.product_payment_intents;
begin
  select * into v_order from public.product_orders where id = p_order_id for update;
  if not found or v_order.status <> 'pending' or v_order.payment_status <> 'pending' then
    raise exception 'Order is no longer payable';
  end if;
  if p_amount <> ceil(v_order.total_price * p_exchange_rate / 5) * 5 then
    raise exception 'Invalid payment amount';
  end if;
  select * into v_intent from public.product_payment_intents
    where order_id = p_order_id and status = 'pending' for update;
  if found then return v_intent; end if;
  insert into public.product_payment_intents(order_id, transaction_id, amount, currency, exchange_rate)
    values (p_order_id, p_transaction_id, p_amount, 'CDF', p_exchange_rate) returning * into v_intent;
  return v_intent;
end;
$$;
revoke all on function public.begin_cinetpay_product_payment(uuid, text, integer, numeric) from public, anon, authenticated;
grant execute on function public.begin_cinetpay_product_payment(uuid, text, integer, numeric) to service_role;

create or replace function public.confirm_cinetpay_product_payment(
  p_transaction_id text,
  p_amount integer,
  p_currency text
) returns public.product_payment_intents
language plpgsql security definer set search_path = '' as $$
declare
  v_intent public.product_payment_intents;
  v_shipment public.product_shipments;
begin
  -- Lock order before intent, consistently with checkout and cancellation.
  perform 1 from public.product_orders po where po.id = (
    select pi.order_id from public.product_payment_intents pi where pi.transaction_id = p_transaction_id
  ) for update;
  select * into v_intent from public.product_payment_intents
    where transaction_id = p_transaction_id for update;
  if not found then raise exception 'Payment intent not found'; end if;
  if v_intent.amount <> p_amount or v_intent.currency <> p_currency then
    raise exception 'Verified payment does not match the order';
  end if;
  if v_intent.status = 'paid' then return v_intent; end if;
  if v_intent.status <> 'pending' then raise exception 'Payment intent is not pending'; end if;

  update public.product_orders set payment_status = 'paid', updated_at = now()
    where id = v_intent.order_id and status = 'pending' and payment_status = 'pending';
  if not found then raise exception 'Order is no longer payable'; end if;

  update public.product_payment_intents set status = 'paid', paid_at = now(), updated_at = now()
    where id = v_intent.id returning * into v_intent;
  insert into public.product_shipments(order_id, status)
    values (v_intent.order_id, 'preparing')
    on conflict (order_id) do nothing returning * into v_shipment;
  if found then
    insert into public.product_shipment_events(shipment_id, status, details)
      values (v_shipment.id, 'preparing', 'Paiement confirmé, commande en préparation.');
  end if;
  return v_intent;
end;
$$;
revoke all on function public.confirm_cinetpay_product_payment(text, integer, text) from public, anon, authenticated;
grant execute on function public.confirm_cinetpay_product_payment(text, integer, text) to service_role;

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

  if p_status <> v_previous_status then
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

create or replace function public.complete_product_order(p_order_id uuid)
returns public.product_orders
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_order public.product_orders;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select po.* into v_order from public.product_orders po
    join public.shops s on s.id = po.shop_id
    where po.id = p_order_id and s.owner_id = v_uid for update of po;
  if not found then raise exception 'Order not found or shop access denied'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'Payment is not confirmed'; end if;
  if not exists (select 1 from public.product_shipments ps where ps.order_id = p_order_id and ps.status = 'delivered') then
    raise exception 'Mark the shipment delivered before completing the order';
  end if;
  update public.product_orders set status = 'completed', updated_at = now() where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;
revoke all on function public.complete_product_order(uuid) from public, anon;
grant execute on function public.complete_product_order(uuid) to authenticated;

create or replace function public.cancel_product_order(p_order_id uuid)
returns public.product_orders
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_order public.product_orders;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_order from public.product_orders where id = p_order_id for update;
  if not found then raise exception 'Commande introuvable'; end if;
  if v_order.client_id <> v_uid then raise exception 'Only the client can cancel this order'; end if;
  if v_order.status <> 'pending' or v_order.payment_status <> 'pending' then
    raise exception 'Cette commande ne peut plus être annulée ici';
  end if;
  if exists (select 1 from public.product_payment_intents pi where pi.order_id = p_order_id and pi.status = 'pending') then
    raise exception 'Vérifiez le paiement en cours avant toute annulation';
  end if;
  update public.product_orders set status = 'cancelled', updated_at = now()
    where id = p_order_id returning * into v_order;
  update public.shop_products set stock_quantity = stock_quantity + v_order.quantity, updated_at = now()
    where id = v_order.product_id;
  return v_order;
end;
$$;
revoke all on function public.cancel_product_order(uuid) from public, anon;
grant execute on function public.cancel_product_order(uuid) to authenticated;
