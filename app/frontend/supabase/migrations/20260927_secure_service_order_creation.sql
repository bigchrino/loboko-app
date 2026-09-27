-- Secure server-side creation of normal and urgent service orders.
-- Applied to Supabase as migration secure_service_order_creation.
create or replace function public.place_service_order(
  p_provider_id uuid, p_service_id uuid, p_description text,
  p_proposed_budget numeric default null, p_address_text text default null,
  p_latitude double precision default null, p_longitude double precision default null,
  p_urgency_level text default 'normal'
) returns public.service_orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_provider public.profiles%rowtype;
  v_order public.service_orders%rowtype;
  v_desc text := btrim(coalesce(p_description,''));
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_provider_id = v_user then raise exception 'You cannot order your own service'; end if;
  if v_desc = '' or char_length(v_desc) > 5000 then raise exception 'Invalid description'; end if;
  if p_proposed_budget is not null and p_proposed_budget <= 0 then raise exception 'Invalid budget'; end if;
  if p_urgency_level not in ('normal','urgent') then raise exception 'Invalid urgency level'; end if;
  if (p_latitude is null) <> (p_longitude is null) then raise exception 'Latitude and longitude must be provided together'; end if;
  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180) then raise exception 'Invalid coordinates'; end if;
  select * into v_provider from public.profiles
  where user_id=p_provider_id and role='prestataire'
    and coalesce(banned,false)=false and coalesce(suspended,false)=false
    and deactivated_at is null and deleted_at is null;
  if not found then raise exception 'Provider unavailable'; end if;
  if p_service_id is not null and v_provider.service_id is distinct from p_service_id then raise exception 'Service does not match provider'; end if;
  if p_urgency_level='urgent' and coalesce(v_provider.availability_status,'unavailable') not in ('available','busy') then raise exception 'Provider unavailable for urgent request'; end if;
  insert into public.service_orders(client_id,prestataire_id,provider_id,service_id,title,description,proposed_budget,address_text,latitude,longitude,urgency_level,status,payment_status)
  values(v_user,p_provider_id,p_provider_id,coalesce(p_service_id,v_provider.service_id),left(v_desc,80),v_desc,p_proposed_budget,nullif(btrim(coalesce(p_address_text,'')),''),p_latitude,p_longitude,p_urgency_level,'requested','pending')
  returning * into v_order;
  return v_order;
end $$;
revoke all on function public.place_service_order(uuid,uuid,text,numeric,text,double precision,double precision,text) from public, anon;
grant execute on function public.place_service_order(uuid,uuid,text,numeric,text,double precision,double precision,text) to authenticated;