-- Orders are created and changed only through the validated SECURITY DEFINER RPCs.
-- Direct inserts could forge initial payment fields despite the disabled payment RPC.
drop policy if exists "Users can create service orders" on public.service_orders;
drop policy if exists "client can create orders" on public.service_orders;
revoke insert, update, delete, truncate, references, trigger
on table public.service_orders from public, anon, authenticated;
