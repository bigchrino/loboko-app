-- Storage policy integration checks only; no real file is uploaded.
-- Temporary group, object metadata and audit entries are rolled back.
begin;
select set_config('loboko.test.owner',(select user_id::text from public.profile_directory order by user_id limit 1),true);
select set_config('loboko.test.member',(select user_id::text from public.profile_directory order by user_id offset 1 limit 1),true);
select set_config('loboko.test.outsider',(select user_id::text from public.profile_directory order by user_id offset 2 limit 1),true);
select set_config('request.jwt.claim.sub',current_setting('loboko.test.owner'),true);
set local role authenticated;
do $$
declare group_id uuid; changed integer;
begin
 insert into public.groups(name,created_by) values('LOBOKO storage test: rolled back',auth.uid()) returning id into group_id;
 perform set_config('loboko.test.group',group_id::text,true);
 insert into public.group_members(group_id,user_id,role) values(group_id,auth.uid(),'owner'),(group_id,current_setting('loboko.test.member')::uuid,'member');
 insert into storage.objects(bucket_id,name) values('group-avatars',auth.uid()::text||'/loboko-test.png');
 update public.groups set avatar_key='group-avatars::'||auth.uid()::text||'/loboko-test.png' where id=group_id;
 if not exists(select 1 from storage.objects where bucket_id='group-avatars' and name=auth.uid()::text||'/loboko-test.png') then raise exception 'Uploader cannot read avatar'; end if;
 update storage.objects set metadata='{"mimetype":"image/png"}'::jsonb where bucket_id='group-avatars' and name=auth.uid()::text||'/loboko-test.png';
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'Owner avatar replacement blocked'; end if;
 begin
  insert into storage.objects(bucket_id,name) values('group-avatars',current_setting('loboko.test.outsider')||'/invalid.png');
  raise exception 'Foreign folder upload allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('loboko.test.member'),true);
do $$ declare changed integer; begin
 if not exists(select 1 from storage.objects where bucket_id='group-avatars' and name=current_setting('loboko.test.owner')||'/loboko-test.png') then raise exception 'Group member cannot read avatar'; end if;
 update public.groups set avatar_key=null where id=current_setting('loboko.test.group')::uuid;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Non-admin changed group photo'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('loboko.test.outsider'),true);
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='group-avatars' and name=current_setting('loboko.test.owner')||'/loboko-test.png') then raise exception 'Outsider reads avatar'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='group-avatars' and name=current_setting('loboko.test.owner')||'/loboko-test.png') then raise exception 'Anonymous reads private avatar'; end if;
 begin
  insert into storage.objects(bucket_id,name) values('group-avatars','anonymous/test.png');
  raise exception 'Anonymous upload allowed';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
