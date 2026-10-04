-- Only unambiguous exact-name matches may repair legacy providers automatically.
with official as (
  select lower(btrim(s.name)) legacy_name, (array_agg(s.id))[1] service_id,
    (array_agg(s.category_id))[1] category_id
  from public.services s join public.service_categories c on c.id=s.category_id
  where s.is_active and c.is_active
  group by lower(btrim(s.name)) having count(*)=1
)
update public.profiles p set service_id=o.service_id, service_category_id=o.category_id
from official o where p.role='prestataire' and p.service_id is null
  and p.deleted_at is null and p.deactivated_at is null
  and not coalesce(p.banned,false) and not coalesce(p.suspended,false)
  and lower(btrim(p.metier))=o.legacy_name;

create or replace function public.loboko_validate_provider_service()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare v_category uuid; v_name text;
begin
  if new.role <> 'prestataire' then return new; end if;
  if new.service_id is null then
    -- Keep unresolved existing profiles editable without inventing their service.
    if tg_op='UPDATE' then
      if old.role='prestataire' and old.service_id is null then
        new.service_category_id := old.service_category_id;
        return new;
      end if;
    end if;
    raise exception using errcode='23514', message='Choisissez un service officiel pour le compte prestataire';
  end if;
  select s.category_id,s.name into v_category,v_name
  from public.services s join public.service_categories c on c.id=s.category_id
  where s.id=new.service_id and s.is_active and c.is_active;
  if not found then
    raise exception using errcode='23514', message='Le service choisi est introuvable ou inactif';
  end if;
  new.service_category_id := v_category;
  new.metier := v_name;
  return new;
end $$;
revoke all on function public.loboko_validate_provider_service() from public,anon,authenticated;
create trigger z_loboko_provider_service
before insert or update of role,service_id,service_category_id on public.profiles
for each row execute function public.loboko_validate_provider_service();

create or replace function public.loboko_validate_requested_service()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare v_name text;
begin
  if new.new_role='prestataire' then
    select s.name into v_name
    from public.services s join public.service_categories c on c.id=s.category_id
    where s.id=new.requested_service_id and s.is_active and c.is_active;
    if not found then
      raise exception using errcode='23514', message='Choisissez un service officiel pour votre demande';
    end if;
    new.requested_metier:=v_name;
  else
    new.requested_service_id:=null;
    new.requested_metier:=null;
  end if;
  return new;
end $$;
revoke all on function public.loboko_validate_requested_service() from public,anon,authenticated;
create trigger z_loboko_requested_service before insert on public.role_change_requests
for each row execute function public.loboko_validate_requested_service();
