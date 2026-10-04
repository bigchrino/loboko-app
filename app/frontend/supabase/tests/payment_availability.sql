begin;
-- No fixture data survives this test.
create temporary table payment_test_users as
select
  (select user_id from public.profiles where coalesce(banned,false)=false and coalesce(suspended,false)=false and deactivated_at is null and deleted_at is null and role='client' limit 1) client_id,
  (select user_id from public.profiles where coalesce(banned,false)=false and coalesce(suspended,false)=false and deactivated_at is null and deleted_at is null and role='prestataire' limit 1) provider_id;
grant select on payment_test_users to authenticated;

do $$
begin
  if has_function_privilege('anon','public.prepare_service_payment(uuid,text)','execute')
     or has_function_privilege('anon','public.complete_service_order(uuid)','execute') then
    raise exception 'Anonymous payment RPC access';
  end if;
  if has_table_privilege('authenticated','public.service_orders','insert')
     or has_table_privilege('authenticated','public.service_orders','update')
     or has_table_privilege('authenticated','public.service_orders','truncate') then
    raise exception 'Direct order mutation remains possible';
  end if;
end $$;

set local role authenticated;
do $$
declare
  v_client uuid;
  v_provider uuid;
  v_order public.service_orders;
  v_after public.service_orders;
begin
  select client_id,provider_id into v_client,v_provider from payment_test_users;
  if v_client is null or v_provider is null then raise exception 'Active test roles missing'; end if;
  perform set_config('request.jwt.claim.sub',v_client::text,true);
  v_order := public.place_service_order(v_provider,null,'LOBOKO payment guard rollback test',25);
  if v_order.status <> 'requested' or v_order.payment_status <> 'pending' or coalesce(v_order.is_paid,false) then
    raise exception 'Creation did not preserve unpaid state';
  end if;
  v_after := public.cancel_service_order(v_order.id);
  if v_after.status <> 'cancelled' then raise exception 'Normal cancellation failed'; end if;

  v_order := public.place_service_order(v_provider,null,'LOBOKO accepted payment guard rollback test',25);
  perform set_config('request.jwt.claim.sub',v_provider::text,true);
  v_after := public.accept_service_order(v_order.id);
  if v_after.status <> 'accepted' then raise exception 'Normal acceptance failed'; end if;
  perform set_config('request.jwt.claim.sub',v_client::text,true);

  begin
    perform public.prepare_service_payment(v_order.id,'USD');
    raise exception 'Simulated payment unexpectedly succeeded';
  exception when feature_not_supported then null;
  end;
  begin
    perform public.complete_service_order(v_order.id);
    raise exception 'Simulated release unexpectedly succeeded';
  exception when feature_not_supported then null;
  end;
  select * into v_after from public.service_orders where id=v_order.id;
  if v_after.status <> 'accepted' or v_after.payment_status <> 'pending'
     or coalesce(v_after.is_paid,false) or v_after.payment_id is not null then
    raise exception 'Blocked payment changed the order';
  end if;
end $$;
reset role;
select 'PASS: direct writes blocked, normal create/cancel/accept work, payment/release rejected without state changes' result;
rollback;
