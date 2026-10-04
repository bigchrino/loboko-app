-- Run in an SQL session as postgres. All mutations are rolled back.
begin;
select set_config('loboko.test.member', (select user_id::text from public.profiles where not coalesce(is_admin,false) and not coalesce(banned,false) and not coalesce(suspended,false) and deleted_at is null and deactivated_at is null order by user_id limit 1), true);
select set_config('loboko.test.admin', (select user_id::text from public.profiles where is_admin=true and not coalesce(banned,false) and not coalesce(suspended,false) and deleted_at is null and deactivated_at is null order by user_id limit 1), true);
select set_config('loboko.test.profile_count',(select count(*)::text from public.profiles),true);

set local role anon;
do $$ begin
  begin perform count(*) from public.profiles; raise exception 'Anonymous private access allowed'; exception when insufficient_privilege then null; end;
  begin perform count(*) from public.profile_directory; raise exception 'Anonymous directory access allowed'; exception when insufficient_privilege then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('loboko.test.member'),true);
do $$ declare changed integer; begin
  if (select count(*) from public.profiles)<>1 then raise exception 'Member sees other private profiles'; end if;
  if (select count(*) from public.profile_directory)=0 then raise exception 'Directory unavailable to member'; end if;
  if exists(select 1 from public.profile_directory d where to_jsonb(d)?'email') then raise exception 'Email copied to directory'; end if;
  if has_table_privilege('authenticated','public.profile_directory','INSERT') or has_table_privilege('authenticated','public.profile_directory','UPDATE') or has_table_privilege('authenticated','public.profile_directory','DELETE') then raise exception 'Directory writable by client'; end if;
  update public.profiles set bio='LOBOKO privacy test: rolled back' where user_id=auth.uid();
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Owner cannot update own profile'; end if;
  if not exists(select 1 from public.profile_directory where user_id=auth.uid() and bio='LOBOKO privacy test: rolled back') then raise exception 'Directory synchronization failed'; end if;
  update public.profiles set latitude=-4.345678,longitude=15.123456,location_visibility=false where user_id=auth.uid();
  if exists(select 1 from public.profile_directory where user_id=auth.uid() and (latitude is not null or longitude is not null)) then raise exception 'Hidden GPS exposed'; end if;
  update public.profiles set location_visibility=true where user_id=auth.uid();
  if not exists(select 1 from public.profile_directory where user_id=auth.uid() and latitude=-4.35 and longitude=15.12) then raise exception 'Exact GPS copied to directory'; end if;
  if not exists(select 1 from public.profiles where user_id=auth.uid() and latitude=-4.345678 and longitude=15.123456) then raise exception 'Owner lost exact GPS'; end if;
  update public.profiles set bio='Unexpected cross-account write' where user_id=current_setting('loboko.test.admin')::uuid;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Member updated another profile'; end if;
  perform count(*) from public.recommend_services();
end $$;

select set_config('request.jwt.claim.sub',current_setting('loboko.test.admin'),true);
do $$ begin
  if (select count(*) from public.profiles)<>current_setting('loboko.test.profile_count')::integer then raise exception 'Admin private access broken'; end if;
  if (public.admin_overview()->>'users')::integer<>current_setting('loboko.test.profile_count')::integer then raise exception 'Admin dashboard broken'; end if;
end $$;
rollback;
