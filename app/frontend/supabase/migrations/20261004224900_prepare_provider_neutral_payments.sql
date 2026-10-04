-- Prepare neutral payment infrastructure. Activation awaits a verified provider adapter.
create table if not exists public.payment_gateway_configuration (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  provider text,
  updated_at timestamptz not null default now(),
  check (not enabled or nullif(trim(provider), '') is not null)
);
alter table public.payment_gateway_configuration enable row level security;
revoke all on public.payment_gateway_configuration from anon, authenticated;
grant select on public.payment_gateway_configuration to authenticated;
grant all on public.payment_gateway_configuration to service_role;
create policy "Authenticated users can read payment availability"
  on public.payment_gateway_configuration for select to authenticated using (true);
insert into public.payment_gateway_configuration(singleton,enabled,provider)
  values (true,false,null) on conflict (singleton) do update set enabled=false,provider=null,updated_at=now();

drop function if exists public.begin_cinetpay_product_payment(uuid,text,integer,numeric);
drop function if exists public.confirm_cinetpay_product_payment(text,integer,text);

alter table public.product_payment_intents drop constraint if exists product_payment_intents_currency_check;
alter table public.product_payment_intents alter column amount type numeric(18,2);
alter table public.product_payment_intents alter column exchange_rate drop not null;
alter table public.product_payment_intents add column if not exists gateway text;
alter table public.product_payment_intents add constraint product_payment_intents_currency_check check (currency ~ '^[A-Z]{3}$');

create or replace function public.begin_product_payment(
  p_order_id uuid, p_transaction_id text, p_amount numeric, p_currency text, p_exchange_rate numeric default null
) returns public.product_payment_intents
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.product_orders;
  v_intent public.product_payment_intents;
  v_gateway text;
begin
  select provider into v_gateway from public.payment_gateway_configuration where singleton and enabled;
  if v_gateway is null then raise exception 'PAYMENT_PROVIDER_NOT_CONFIGURED'; end if;
  if p_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid currency'; end if;
  if p_currency <> 'USD' and (p_exchange_rate is null or p_exchange_rate <= 0) then raise exception 'A verified exchange rate is required'; end if;
  if p_currency = 'USD' and coalesce(p_exchange_rate,1) <> 1 then raise exception 'Invalid native currency exchange rate'; end if;
  if p_exchange_rate is not null and (p_exchange_rate <= 0 or p_exchange_rate <> round(p_exchange_rate,4)) then raise exception 'Invalid exchange rate precision'; end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount,2) then raise exception 'Invalid payment amount'; end if;
  select * into v_order from public.product_orders where id = p_order_id for update;
  if not found or v_order.status <> 'pending' or v_order.payment_status <> 'pending' then raise exception 'Order is no longer payable'; end if;
  if p_amount <> round(v_order.total_price * coalesce(p_exchange_rate,1),2) then raise exception 'Invalid payment amount'; end if;
  select * into v_intent from public.product_payment_intents where order_id=p_order_id and status='pending' for update;
  if found then return v_intent; end if;
  insert into public.product_payment_intents(order_id,transaction_id,amount,currency,exchange_rate,gateway)
    values(p_order_id,p_transaction_id,p_amount,p_currency,p_exchange_rate,v_gateway) returning * into v_intent;
  return v_intent;
end;
$$;
revoke all on function public.begin_product_payment(uuid,text,numeric,text,numeric) from public,anon,authenticated;
grant execute on function public.begin_product_payment(uuid,text,numeric,text,numeric) to service_role;

create or replace function public.confirm_product_payment(
  p_transaction_id text,
  p_amount numeric,
  p_currency text
) returns public.product_payment_intents
language plpgsql security definer set search_path = '' as $$
declare
  v_intent public.product_payment_intents;
  v_shipment public.product_shipments;
  v_gateway text;
begin
  select provider into v_gateway from public.payment_gateway_configuration where singleton and enabled;
  if v_gateway is null then raise exception 'PAYMENT_PROVIDER_NOT_CONFIGURED'; end if;
  -- Lock order before intent, consistently with checkout and cancellation.
  perform 1 from public.product_orders po where po.id = (
    select pi.order_id from public.product_payment_intents pi where pi.transaction_id = p_transaction_id
  ) for update;
  select * into v_intent from public.product_payment_intents
    where transaction_id = p_transaction_id for update;
  if not found then raise exception 'Payment intent not found'; end if;
  if v_intent.gateway is distinct from v_gateway then raise exception 'Payment provider mismatch'; end if;
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
revoke all on function public.confirm_product_payment(text, numeric, text) from public, anon, authenticated;
grant execute on function public.confirm_product_payment(text, numeric, text) to service_role;

