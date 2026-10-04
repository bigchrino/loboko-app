-- Requires an active legacy provider without a service and an active client fixture.
-- Run after repair_legacy_provider_service_links, always roll back fixtures.
begin;
create temporary table provider_test_ids as
select
  (select user_id from public.profiles where role='client' and deleted_at is null and deactivated_at is null and not coalesce(banned,false) and not coalesce(suspended,false) limit 1) client_id,
  (select user_id from public.profiles where role='prestataire' and service_id is null and deleted_at is null and deactivated_at is null limit 1) legacy_id,
  (select id from public.services where name='Chauffeur' and is_active limit 1) service_id,
  (select category_id from public.services where name='Chauffeur' and is_active limit 1) category_id;
grant select on provider_test_ids to authenticated;
set local role authenticated;
do $$
declare v_client uuid; v_legacy uuid; v_service uuid; v_category uuid; v_row public.profiles; v_request public.role_change_requests;
begin
  select client_id,legacy_id,service_id,category_id into v_client,v_legacy,v_service,v_category from provider_test_ids;
  if v_client is null or v_legacy is null or v_service is null then raise exception 'Missing fixture'; end if;
  perform set_config('request.jwt.claim.sub',v_client::text,true);
  begin
    insert into public.role_change_requests(user_id,old_role,new_role,requested_metier,reason)
    values(v_client,'client','prestataire','Texte libre','Rollback test');
    raise exception 'Uncatalogued role request accepted';
  exception when check_violation then null;
  end;
  insert into public.role_change_requests(user_id,old_role,new_role,requested_service_id,requested_metier,reason)
  values(v_client,'client','prestataire',v_service,'Texte non canonique','Rollback test')
  returning * into v_request;
  if v_request.requested_metier <> 'Chauffeur' or v_request.requested_service_id <> v_service then raise exception 'Official role request not normalized'; end if;

  perform set_config('request.jwt.claim.sub',v_legacy::text,true);
  -- An unrelated edit remains available to the unresolved legacy owner.
  update public.profiles set display_name=display_name where user_id=v_legacy;
  update public.profiles set service_id=v_service,service_category_id=null,metier='Texte non canonique'
  where user_id=v_legacy returning * into v_row;
  if v_row.service_category_id <> v_category or v_row.metier <> 'Chauffeur' then raise exception 'Official profile not normalized'; end if;
  if not exists(select 1 from public.profile_directory where user_id=v_legacy and service_id=v_service and service_category_id=v_category) then raise exception 'Directory not synchronized'; end if;
  begin
    update public.profiles set service_id=null where user_id=v_legacy;
    raise exception 'Valid provider lost its official service';
  exception when check_violation then null;
  end;
  begin
    update public.profiles set service_id='00000000-0000-0000-0000-000000000000' where user_id=v_legacy;
    raise exception 'Unknown service accepted';
  exception when check_violation then null;
  end;
end $$;
reset role;
select 'PASS: official choices required, category/name synchronized, legacy edits preserved, directory updated' result;
rollback;

