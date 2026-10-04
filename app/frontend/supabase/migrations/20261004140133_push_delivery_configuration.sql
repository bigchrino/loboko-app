-- VAPID material stays encrypted in Supabase Vault, never in git/frontend.
create or replace function public.loboko_push_configuration()
returns jsonb language sql security definer set search_path=''
as $$
 select decrypted_secret::jsonb from vault.decrypted_secrets
 where name='loboko_web_push_config' limit 1;
$$;
revoke all on function public.loboko_push_configuration() from public,anon,authenticated;
grant execute on function public.loboko_push_configuration() to service_role;

create table loboko_private.push_delivery_claims (
 event_key text not null,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(event_key,recipient_id)
);
alter table loboko_private.push_delivery_claims enable row level security;
revoke all on loboko_private.push_delivery_claims from public,anon,authenticated;

create function public.loboko_claim_push_delivery(p_event_key text,p_recipient_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare inserted integer;
begin
 if p_event_key !~ '^(dm|group|mention|urgent_order):[0-9a-f-]{36}$' then
  raise exception 'Invalid event key';
 end if;
 delete from loboko_private.push_delivery_claims where created_at<now()-interval '2 days';
 insert into loboko_private.push_delivery_claims(event_key,recipient_id)
 values(p_event_key,p_recipient_id) on conflict do nothing;
 get diagnostics inserted=row_count;
 return inserted=1;
end;
$$;
revoke all on function public.loboko_claim_push_delivery(text,uuid) from public,anon,authenticated;
grant execute on function public.loboko_claim_push_delivery(text,uuid) to service_role;
notify pgrst,'reload schema';
