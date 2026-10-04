-- Run as postgres. Status changes and audit entries are rolled back.
begin;
select set_config('loboko.test.member', (select user_id::text from public.profiles where not coalesce(is_admin,false) and not coalesce(banned,false) and not coalesce(suspended,false) and deleted_at is null and deactivated_at is null order by user_id limit 1), true);
select set_config('request.jwt.claim.sub', (select user_id::text from public.profiles where is_admin=true and not coalesce(banned,false) and not coalesce(suspended,false) and deleted_at is null and deactivated_at is null order by user_id limit 1), true);
set local role authenticated;
do $$
declare target uuid := current_setting('loboko.test.member')::uuid; status text; changed integer;
begin
  if target is null or auth.uid() is null then raise exception 'Active member and administrator required'; end if;
  if not exists(select 1 from public.profile_directory where user_id=target) then raise exception 'Active member missing'; end if;
  foreach status in array array['deactivated_at','deleted_at','banned','suspended'] loop
    if status in ('deactivated_at','deleted_at') then
      execute format('update public.profiles set %I=now() where user_id=$1',status) using target;
    else
      execute format('update public.profiles set %I=true where user_id=$1',status) using target;
    end if;
    get diagnostics changed=row_count;
    if changed<>1 then raise exception 'Status update failed: %',status; end if;
    if exists(select 1 from public.profile_directory where user_id=target) then raise exception 'Inactive member still visible: %',status; end if;
    if status in ('deactivated_at','deleted_at') then
      execute format('update public.profiles set %I=null where user_id=$1',status) using target;
    else
      execute format('update public.profiles set %I=false where user_id=$1',status) using target;
    end if;
    if not exists(select 1 from public.profile_directory where user_id=target) then raise exception 'Reactivated member missing: %',status; end if;
  end loop;
  if exists(select 1 from public.profile_directory where deactivated_at is not null or deleted_at is not null or coalesce(banned,false) or coalesce(suspended,false)) then raise exception 'Inactive directory entries'; end if;
end $$;
rollback;
