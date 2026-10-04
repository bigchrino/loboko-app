begin;
set local role anon;
do $$ begin
 if has_function_privilege('anon','public.loboko_push_configuration()','EXECUTE') then raise exception 'Anonymous secret RPC access'; end if;
 if has_function_privilege('anon','public.loboko_claim_push_delivery(text,uuid)','EXECUTE') then raise exception 'Anonymous delivery claims'; end if;
end $$;
set local role authenticated;
do $$ begin
 if has_function_privilege('authenticated','public.loboko_push_configuration()','EXECUTE') then raise exception 'Member secret RPC access'; end if;
 if has_function_privilege('authenticated','public.loboko_claim_push_delivery(text,uuid)','EXECUTE') then raise exception 'Member delivery claims'; end if;
 begin perform public.loboko_push_configuration(); raise exception 'Secret RPC callable by member'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('loboko.test.recipient',(select user_id::text from public.profile_directory order by user_id limit 1),true);
set local role service_role;
do $$ declare config jsonb; event text := 'dm:'||gen_random_uuid()::text; recipient uuid := current_setting('loboko.test.recipient')::uuid; begin
 config:=public.loboko_push_configuration();
 if length(config->>'public_key')<>87 or length(config->>'private_key')<>43 or config->>'subject'<>'https://loboko-app.vercel.app' then raise exception 'Invalid VAPID setup'; end if;
 if not public.loboko_claim_push_delivery(event,recipient) then raise exception 'First delivery claim denied'; end if;
 if public.loboko_claim_push_delivery(event,recipient) then raise exception 'Duplicate delivery claim allowed'; end if;
end $$;
rollback;
