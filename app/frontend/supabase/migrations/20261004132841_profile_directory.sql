-- Stage 1: a read-only directory with an explicit allowlist. No email,
-- moderation reasons or exact GPS coordinates are copied from profiles.
-- Deploy directory readers before applying profile_private_access.
create schema if not exists loboko_private;
revoke all on schema loboko_private from public, anon, authenticated;
grant usage on schema loboko_private to authenticated;

create table public.profile_directory as
  select p.id,
    p.user_id,
    p.username,
    p.display_name,
    p.bio,
    p.metier,
    p.avatar_key,
    p.role,
    p.created_at,
    p.updated_at,
    p.service_category_id,
    p.last_seen_at,
    p.city,
    p.availability_status,
    p.completed_jobs_count,
    p.is_verified,
    p.is_admin,
    p.verification_status,
    p.verified_at,
    p.service_id,
    p.subscription_type,
    p.subscription_expires_at,
    p.suspended,
    p.banned,
    p.province,
    p.commune,
    case when p.location_visibility is true then round(p.latitude::numeric,2)::double precision else null::double precision end as latitude,
    case when p.location_visibility is true then round(p.longitude::numeric,2)::double precision else null::double precision end as longitude,
    p.location_visibility,
    p.deactivated_at,
    p.deleted_at
  from public.profiles p with no data;
alter table public.profile_directory add primary key (user_id);
create index profile_directory_service on public.profile_directory(service_id);
create index profile_directory_category on public.profile_directory(service_category_id);
alter table public.profile_directory enable row level security;
revoke all on public.profile_directory from public, anon, authenticated;
grant select on public.profile_directory to authenticated;
grant all on public.profile_directory to service_role;
create policy directory_members_read on public.profile_directory
  for select to authenticated
  using ((select auth.uid()) is not null and (select public.loboko_account_is_active()));

-- Only a trigger can synchronize this generated directory. Client roles have
-- no write grant and cannot execute its function through the Data API.
create function loboko_private.sync_profile_directory()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    delete from public.profile_directory where user_id=old.user_id;
    return old;
  end if;
  delete from public.profile_directory where user_id=new.user_id;
  insert into public.profile_directory
    select p.id,
    p.user_id,
    p.username,
    p.display_name,
    p.bio,
    p.metier,
    p.avatar_key,
    p.role,
    p.created_at,
    p.updated_at,
    p.service_category_id,
    p.last_seen_at,
    p.city,
    p.availability_status,
    p.completed_jobs_count,
    p.is_verified,
    p.is_admin,
    p.verification_status,
    p.verified_at,
    p.service_id,
    p.subscription_type,
    p.subscription_expires_at,
    p.suspended,
    p.banned,
    p.province,
    p.commune,
    case when p.location_visibility is true then round(p.latitude::numeric,2)::double precision else null::double precision end as latitude,
    case when p.location_visibility is true then round(p.longitude::numeric,2)::double precision else null::double precision end as longitude,
    p.location_visibility,
    p.deactivated_at,
    p.deleted_at
    from public.profiles p where p.user_id=new.user_id and p.deleted_at is null and p.deactivated_at is null and not coalesce(p.banned,false) and not coalesce(p.suspended,false);
  return new;
end;
$$;
revoke all on function loboko_private.sync_profile_directory() from public,anon,authenticated;
create trigger loboko_sync_profile_directory after insert or update or delete
  on public.profiles for each row execute function loboko_private.sync_profile_directory();
insert into public.profile_directory
  select p.id,
    p.user_id,
    p.username,
    p.display_name,
    p.bio,
    p.metier,
    p.avatar_key,
    p.role,
    p.created_at,
    p.updated_at,
    p.service_category_id,
    p.last_seen_at,
    p.city,
    p.availability_status,
    p.completed_jobs_count,
    p.is_verified,
    p.is_admin,
    p.verification_status,
    p.verified_at,
    p.service_id,
    p.subscription_type,
    p.subscription_expires_at,
    p.suspended,
    p.banned,
    p.province,
    p.commune,
    case when p.location_visibility is true then round(p.latitude::numeric,2)::double precision else null::double precision end as latitude,
    case when p.location_visibility is true then round(p.longitude::numeric,2)::double precision else null::double precision end as longitude,
    p.location_visibility,
    p.deactivated_at,
    p.deleted_at from public.profiles p where p.deleted_at is null and p.deactivated_at is null and not coalesce(p.banned,false) and not coalesce(p.suspended,false);

comment on table public.profile_directory is 'Read-only public profile fields for signed-in users. GPS is approximate and opt-in; private contact data is never copied.';
comment on column public.profile_directory.latitude is 'Approximate latitude, rounded to 0.01 degrees only when location_visibility is true.';
comment on column public.profile_directory.longitude is 'Approximate longitude, rounded to 0.01 degrees only when location_visibility is true.';

-- Close signed-out access immediately; existing signed-in clients still work
-- until the frontend has moved its directory queries to profile_directory.
revoke all on public.profiles from public,anon;
notify pgrst,'reload schema';
