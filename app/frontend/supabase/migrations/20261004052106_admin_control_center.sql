-- All administrator endpoints use the caller's table permissions and RLS.
create or replace function public.loboko_account_is_active()
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.profiles p where p.user_id=(select auth.uid())
 and not coalesce(p.banned,false) and p.deleted_at is null
 and (not coalesce(p.suspended,false) or (p.suspended_until is not null and p.suspended_until<=now())));
$$;
create or replace function public.loboko_is_active_admin()
returns boolean language sql stable security invoker set search_path='' as $$
 select public.loboko_account_is_active() and exists(
 select 1 from public.profiles where user_id=(select auth.uid()) and is_admin=true);
$$;
revoke all on function public.loboko_account_is_active(), public.loboko_is_active_admin() from public,anon;
grant execute on function public.loboko_account_is_active(), public.loboko_is_active_admin() to authenticated;

create or replace function public.prevent_self_moderation_change()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then return new; end if;
 if row(new.suspended,new.suspended_reason,new.suspended_until,new.banned,new.banned_reason)
 is distinct from row(old.suspended,old.suspended_reason,old.suspended_until,old.banned,old.banned_reason) then
  if not public.loboko_is_active_admin() then raise exception 'Administration LOBOKO requise'; end if;
  if old.user_id=auth.uid() or coalesce(old.is_admin,false) then raise exception 'Compte administrateur protégé'; end if;
 end if;
 return new;
end; $$;
create or replace function public.prevent_user_admin_change()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or new.is_admin is not distinct from old.is_admin then return new; end if;
 if not public.loboko_is_active_admin() then raise exception 'Administration LOBOKO requise'; end if;
 if old.user_id=auth.uid() then raise exception 'Vous ne pouvez pas retirer votre propre accès administrateur'; end if;
 perform 1 from public.profiles where is_admin=true order by user_id for update;
 if not public.loboko_is_active_admin() then raise exception 'Administration LOBOKO requise'; end if;
 if not coalesce(new.is_admin,false) and (select count(*) from public.profiles where is_admin=true)<=1 then
  raise exception 'Le dernier administrateur doit être conservé';
 end if;
 return new;
end; $$;
-- Keep paid subscription changes backend-only; admin grants have their own guard.
create or replace function public.prevent_self_premium_change()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null and (new.subscription_type is distinct from old.subscription_type
 or new.subscription_expires_at is distinct from old.subscription_expires_at) then
  raise exception 'Les abonnements sont gérés par le backend LOBOKO';
 end if;
 return new;
end; $$;
revoke all on function public.prevent_self_moderation_change(), public.prevent_user_admin_change(), public.prevent_self_premium_change() from public,anon,authenticated;
-- Prevent creating a new self-profile with administrator/verified privileges.
alter policy profiles_insert_own on public.profiles with check (
 user_id=(select auth.uid()) and not coalesce(is_admin,false) and not coalesce(is_verified,false)
 and coalesce(completed_jobs_count,0)=0 and coalesce(subscription_type,'free')='free'
 and subscription_expires_at is null and verified_at is null
 and coalesce(verification_status,'not_submitted') in ('not_submitted','pending'));

alter table public.admin_actions add column if not exists target_type text;
alter table public.admin_actions add column if not exists target_id uuid;
alter table public.admin_actions add column if not exists details jsonb;
drop policy if exists admin_actions_admin_only on public.admin_actions;
create policy admin_actions_read on public.admin_actions for select to authenticated using ((select public.loboko_is_active_admin()));
create policy admin_actions_append on public.admin_actions for insert to authenticated with check (admin_id=(select auth.uid()) and (select public.loboko_is_active_admin()));
revoke update,delete on public.admin_actions from authenticated,anon;
grant select,insert on public.admin_actions to authenticated;
create index if not exists admin_actions_created_idx on public.admin_actions(created_at desc,id desc);
create policy payments_admin_read on public.payments for select to authenticated using ((select public.loboko_is_active_admin()));

create table public.loboko_ad_campaigns (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 120),
 description text not null default '' check(length(description)<=400),
 image_url text not null check(image_url ~ '^https://[^[:space:]]+$'),
 category_slug text not null check(category_slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
 active boolean not null default false, sort_order integer not null default 0,
 starts_at timestamptz, ends_at timestamptz,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 check(ends_at is null or starts_at is null or ends_at>starts_at)
);
alter table public.loboko_ad_campaigns enable row level security;
grant select,insert,update on public.loboko_ad_campaigns to authenticated;
create policy campaigns_read on public.loboko_ad_campaigns for select to authenticated using (
 (active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())) or (select public.loboko_is_active_admin()));
create policy campaigns_insert on public.loboko_ad_campaigns for insert to authenticated with check (
 created_by=(select auth.uid()) and (select public.loboko_is_active_admin()));
create policy campaigns_update on public.loboko_ad_campaigns for update to authenticated using (
 (select public.loboko_is_active_admin())) with check ((select public.loboko_is_active_admin()));
-- Preserve the three existing campaigns and their image URLs exactly.
insert into public.loboko_ad_campaigns(title,description,image_url,category_slug,active,sort_order) values
('Rénovation de maison','Des artisans vérifiés pour donner un coup de neuf à votre intérieur.','https://mgx-backend-cdn.metadl.com/generate/images/1045026/2026-04-29/nrusj2yaafmq/ad-home-renovation.png','macon',true,1),
('Ménage & nettoyage pro','Un logement impeccable en quelques heures. Prestataires de confiance.','https://mgx-backend-cdn.metadl.com/generate/images/1045026/2026-04-29/nrusmcyaafna/ad-cleaning-service.png','nettoyage-menage',true,2),
('Mécanicien à domicile','Réparation rapide de votre voiture chez vous, sans stress et sans remorquage.','https://mgx-backend-cdn.metadl.com/generate/images/1045026/2026-04-29/nrusk2qaafnq/ad-mobile-mechanic.png','mecanicien',true,3);

-- Automatic audit entries: the mutation fails too if its audit entry fails.
create or replace function public.loboko_audit_admin_change()
returns trigger language plpgsql security invoker set search_path='' as $$
declare previous jsonb; current_row jsonb; entry text; target_user uuid; target uuid; note text; extra jsonb;
begin
 if auth.uid() is null or not public.loboko_is_active_admin() then
  if tg_op='DELETE' then return old; else return new; end if;
 end if;
 if tg_op<>'INSERT' then previous:=to_jsonb(old); end if;
 if tg_op<>'DELETE' then current_row:=to_jsonb(new); end if;
 target:=coalesce((current_row->>'id')::uuid,(previous->>'id')::uuid);
 target_user:=coalesce((current_row->>'user_id')::uuid,(previous->>'user_id')::uuid);
 if tg_table_name='profiles' then
  if new.is_admin is distinct from old.is_admin then entry:='profile_admin'; note:='Droits administrateur modifiés';
  elsif row(new.suspended,new.suspended_until,new.banned) is distinct from row(old.suspended,old.suspended_until,old.banned) then
   entry:='profile_moderation'; note:=coalesce(new.banned_reason,new.suspended_reason,'Restrictions levées');
  elsif new.role is distinct from old.role then entry:='profile_role'; note:='Rôle modifié';
  elsif new.is_verified is distinct from old.is_verified or new.verification_status is distinct from old.verification_status then entry:='profile_verification'; note:='Vérification modifiée';
  else return new; end if;
  extra:=jsonb_build_object('before',jsonb_build_object('is_admin',old.is_admin,'role',old.role,'banned',old.banned,'suspended',old.suspended,'is_verified',old.is_verified),
   'after',jsonb_build_object('is_admin',new.is_admin,'role',new.role,'banned',new.banned,'suspended',new.suspended,'suspended_until',new.suspended_until,'is_verified',new.is_verified));
 elsif tg_op='DELETE' then entry:='delete_'||tg_table_name; note:='Contenu supprimé par la modération';
 elsif tg_table_name='loboko_ad_campaigns' then
  if tg_op='INSERT' then entry:='campaign_create'; else entry:='campaign_update'; end if;
  note:=current_row->>'title'; extra:=jsonb_build_object('active',current_row->'active');
 else
  if current_row->>'status' is not distinct from previous->>'status' then return new; end if;
  entry:=tg_table_name||'_'||(current_row->>'status');
  note:=coalesce(current_row->>'admin_note','Décision administrative');
  extra:=jsonb_build_object('status_before',previous->>'status','status_after',current_row->>'status');
 end if;
 insert into public.admin_actions(admin_id,target_user_id,action_type,reason,target_type,target_id,details)
 values(auth.uid(),target_user,entry,left(note,1000),tg_table_name,target,extra);
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function public.loboko_audit_admin_change() from public,anon,authenticated;
create trigger loboko_audit_profile after update on public.profiles for each row execute function public.loboko_audit_admin_change();
create trigger loboko_audit_post after delete on public.posts for each row execute function public.loboko_audit_admin_change();
create trigger loboko_audit_comment after delete on public.comments for each row execute function public.loboko_audit_admin_change();
create trigger loboko_audit_report after update on public.reports for each row execute function public.loboko_audit_admin_change();
create trigger loboko_audit_kyc after update on public.provider_verifications for each row execute function public.loboko_audit_admin_change();
create trigger loboko_audit_role after update on public.role_change_requests for each row execute function public.loboko_audit_admin_change();
create trigger loboko_audit_campaign after insert or update on public.loboko_ad_campaigns for each row execute function public.loboko_audit_admin_change();

create or replace function public.admin_apply_action(p_action text,p_target uuid,p_reason text default '',p_days integer default 1)
returns void language plpgsql security invoker set search_path='' as $$
declare account public.profiles; request public.role_change_requests; verification public.provider_verifications; changed uuid; category uuid;
begin
 if not public.loboko_is_active_admin() then raise exception 'Accès administrateur requis' using errcode='42501'; end if;
 if p_target is null then raise exception 'Cible manquante'; end if;
 if length(coalesce(p_reason,''))>1000 then raise exception 'Motif trop long'; end if;
 if p_action in ('suspend','ban','kyc_reject','role_reject') and length(trim(coalesce(p_reason,'')))<3 then raise exception 'Un motif est obligatoire'; end if;
 if p_action in ('suspend','unsuspend','ban','unban','grant_admin','revoke_admin') then
  if p_action in ('grant_admin','revoke_admin') then
   perform 1 from public.profiles where is_admin=true order by user_id for update;
   if not public.loboko_is_active_admin() then raise exception 'Accès administrateur requis'; end if;
  end if;
  select * into account from public.profiles where user_id=p_target for update;
  if not found then raise exception 'Compte introuvable'; end if;
  if account.user_id=auth.uid() then raise exception 'Vous ne pouvez pas modifier vos propres droits ou restrictions'; end if;
  if p_action in ('suspend','ban') and account.is_admin then raise exception 'Retirez les droits administrateur avant de restreindre ce compte'; end if;
  if p_action='suspend' then
   if p_days is null or p_days not in (1,7,30) then raise exception 'Durée invalide'; end if;
   update public.profiles set suspended=true,suspended_until=now()+make_interval(days=>p_days),suspended_reason=trim(p_reason) where user_id=p_target;
  elsif p_action='unsuspend' then update public.profiles set suspended=false,suspended_until=null,suspended_reason=null where user_id=p_target;
  elsif p_action='ban' then update public.profiles set banned=true,banned_reason=trim(p_reason) where user_id=p_target;
  elsif p_action='unban' then update public.profiles set banned=false,banned_reason=null where user_id=p_target;
  elsif p_action='grant_admin' then
   if account.banned or account.deleted_at is not null or (account.suspended and (account.suspended_until is null or account.suspended_until>now())) then raise exception 'Réactivez ce compte avant de lui accorder des droits'; end if;
   update public.profiles set is_admin=true where user_id=p_target;
  else update public.profiles set is_admin=false where user_id=p_target;
  end if;
 elsif p_action in ('role_approve','role_reject') then
  select * into request from public.role_change_requests where id=p_target for update;
  if not found or request.status<>'pending' then raise exception 'Cette demande est absente ou déjà traitée'; end if;
  if p_action='role_approve' then
   select * into account from public.profiles where user_id=request.user_id for update;
   if not found or account.role<>request.old_role then raise exception 'Le rôle du compte a changé. Actualisez la demande'; end if;
   if request.new_role='prestataire' and request.requested_service_id is not null then
    select category_id into category from public.services where id=request.requested_service_id and is_active=true;
    if not found then raise exception 'Service introuvable ou inactif'; end if;
   end if;
   update public.profiles set role=request.new_role,
    metier=case when request.new_role='prestataire' then request.requested_metier else null end,
    service_id=case when request.new_role='prestataire' then request.requested_service_id else null end,
    service_category_id=case when request.new_role='prestataire' then category else null end where user_id=request.user_id;
  end if;
  update public.role_change_requests set status=case when p_action='role_approve' then 'approved' else 'rejected' end,
   reviewed_at=now(),reviewed_by=auth.uid(),admin_note=nullif(trim(p_reason),'') where id=p_target;
 elsif p_action in ('kyc_approve','kyc_reject') then
  select * into verification from public.provider_verifications where id=p_target for update;
  if not found or verification.status<>'pending' then raise exception 'Cette vérification est absente ou déjà traitée'; end if;
  perform 1 from public.profiles where user_id=verification.user_id for update;
  if not found then raise exception 'Compte introuvable'; end if;
  if exists(select 1 from public.provider_verifications where user_id=verification.user_id and created_at>verification.created_at) then raise exception 'Une demande plus récente existe. Actualisez'; end if;
  update public.provider_verifications set status=case when p_action='kyc_approve' then 'approved' else 'rejected' end,
   reviewed_at=now(),reviewed_by=auth.uid(),admin_note=nullif(trim(p_reason),'') where id=p_target;
  update public.profiles set is_verified=(p_action='kyc_approve'),
   verification_status=case when p_action='kyc_approve' then 'approved' else 'rejected' end,
   verified_at=case when p_action='kyc_approve' then now() else null end where user_id=verification.user_id;
 elsif p_action='delete_post' then delete from public.posts where id=p_target returning id into changed;
  if changed is null then raise exception 'Publication absente ou suppression non autorisée'; end if;
 elsif p_action='delete_comment' then delete from public.comments where id=p_target returning id into changed;
  if changed is null then raise exception 'Commentaire absent ou suppression non autorisée'; end if;
 elsif p_action in ('report_pending','report_reviewed','report_resolved') then
  update public.reports set status=substring(p_action from 8),reviewed_at=case when p_action='report_pending' then null else now() end
   where id=p_target returning id into changed;
  if changed is null then raise exception 'Signalement introuvable'; end if;
 else raise exception 'Action administrative inconnue';
 end if;
end; $$;
revoke all on function public.admin_apply_action(text,uuid,text,integer) from public,anon;
grant execute on function public.admin_apply_action(text,uuid,text,integer) to authenticated;

-- Existing JWTs cannot keep writing after a suspension/ban. Backend cron jobs
-- without an end-user uid retain their existing behavior.
create or replace function public.loboko_require_active_account()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null and not public.loboko_account_is_active() then raise exception 'Compte suspendu ou banni' using errcode='42501'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function public.loboko_require_active_account() from public,anon,authenticated;
create trigger loboko_active_profile before update on public.profiles for each row execute function public.loboko_require_active_account();
do $$ declare name text; begin
 foreach name in array array['posts','comments','likes','comment_likes','post_shares','messages','message_reactions','groups','group_members','group_messages','group_message_reactions','statuses','service_requests','service_request_responses','service_orders','product_orders','payments','shop_products','shop_product_images','shops','companies','job_offers','musala_requests','reports','ratings','provider_verifications','role_change_requests'] loop
  execute format('create trigger loboko_active_account before insert or update or delete on public.%I for each row execute function public.loboko_require_active_account()',name);
 end loop;
end $$;

create or replace function public.admin_overview()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.loboko_is_active_admin() then raise exception 'Accès administrateur requis' using errcode='42501'; end if;
 return jsonb_build_object(
 'users',(select count(*) from public.profiles),
 'prestataires',(select count(*) from public.profiles where role='prestataire'),
 'admins',(select count(*) from public.profiles where is_admin=true),
 'verified',(select count(*) from public.profiles where is_verified=true),
 'restricted',(select count(*) from public.profiles where banned=true or (suspended=true and (suspended_until is null or suspended_until>now()))),
 'posts',(select count(*) from public.posts),
 'requests',(select count(*) from public.service_requests),
 'pending_reports',(select count(*) from public.reports where status='pending'),
 'pending_kyc',(select count(*) from public.provider_verifications where status='pending'),
 'pending_roles',(select count(*) from public.role_change_requests where status='pending'),
 'payments',(select count(*) from public.payments),
 'disputed_payments',(select count(*) from public.payments where status='disputed'));
end; $$;
revoke all on function public.admin_overview() from public,anon;
grant execute on function public.admin_overview() to authenticated;
