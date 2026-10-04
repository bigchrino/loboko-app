-- Disable simulated financial transitions until a real gateway is integrated.
-- Preserve historical data and RPC signatures for cached clients.
create or replace function public.prepare_service_payment(p_order_id uuid, p_currency text)
returns public.payments
language plpgsql security invoker set search_path = ''
as $$
begin
  raise exception using errcode = '0A000',
    message = 'Le paiement en ligne est indisponible. Aucun fonds n’est encaissé par LOBOKO.';
end;
$$;

create or replace function public.complete_service_order(p_order_id uuid)
returns public.service_orders
language plpgsql security invoker set search_path = ''
as $$
begin
  raise exception using errcode = '0A000',
    message = 'La libération de fonds est indisponible : aucun prestataire de paiement n’est intégré.';
end;
$$;

revoke all on function public.prepare_service_payment(uuid, text) from public, anon;
revoke all on function public.complete_service_order(uuid) from public, anon;
grant execute on function public.prepare_service_payment(uuid, text) to authenticated;
grant execute on function public.complete_service_order(uuid) to authenticated;
