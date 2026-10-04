begin;
create temporary table forward_test_users as
with active as (
  select user_id from public.profiles where deleted_at is null and deactivated_at is null
    and not coalesce(banned,false) and not coalesce(suspended,false)
)
select sender.user_id owner,
  array(select receiver.user_id from active receiver where receiver.user_id <> sender.user_id
    and not exists(select 1 from public.blocked_users b where
      (b.owner_id=sender.user_id and b.blocked_id=receiver.user_id)
      or (b.owner_id=receiver.user_id and b.blocked_id=sender.user_id))
    limit 2) recipients
from active sender limit 1;
grant select on forward_test_users to authenticated;
set local role authenticated;
do $$
declare v_owner uuid; v_recipients uuid[]; v_count integer;
begin
  select owner,recipients into v_owner,v_recipients from forward_test_users;
  if cardinality(v_recipients) <> 2 then raise exception 'Test recipients missing'; end if;
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  insert into public.messages(user_id,receiver_id,content,read)
  select v_owner,recipient,'LOBOKO point 7 batch rollback test',false from unnest(v_recipients) recipient;
  select count(*) into v_count from public.messages where user_id=v_owner
    and receiver_id=any(v_recipients) and content='LOBOKO point 7 batch rollback test';
  if v_count <> 2 then raise exception 'Batch forwarding failed'; end if;
end $$;
reset role;
select 'PASS: authenticated direct-message batch accepted; all test messages rolled back' result;
rollback;
