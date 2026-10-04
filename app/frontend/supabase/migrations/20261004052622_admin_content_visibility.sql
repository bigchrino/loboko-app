create policy posts_admin_update on public.posts for update to authenticated using ((select public.loboko_is_active_admin())) with check ((select public.loboko_is_active_admin()));
create policy comments_admin_update on public.comments for update to authenticated using ((select public.loboko_is_active_admin())) with check ((select public.loboko_is_active_admin()));
create policy posts_visible on public.posts as restrictive for select to authenticated using (
 not coalesce(hidden_by_moderation,false) or user_id=(select auth.uid()) or (select public.loboko_is_active_admin()));
create policy comments_visible on public.comments as restrictive for select to authenticated using (
 not coalesce(hidden_by_moderation,false) or user_id=(select auth.uid()) or (select public.loboko_is_active_admin()));
create or replace function public.admin_set_content_visibility(p_type text,p_target uuid,p_hidden boolean,p_reason text default '')
returns void language plpgsql security invoker set search_path='' as $$
declare target_user uuid;
begin
 if not public.loboko_is_active_admin() then raise exception 'Accès administrateur requis' using errcode='42501'; end if;
 if p_hidden is null then raise exception 'Visibilité manquante'; end if;
 if p_hidden and length(trim(coalesce(p_reason,'')))<3 then raise exception 'Un motif est obligatoire'; end if;
 if length(coalesce(p_reason,''))>1000 then raise exception 'Motif trop long'; end if;
 if p_type='post' then
  update public.posts set hidden_by_moderation=p_hidden,moderation_reason=case when p_hidden then trim(p_reason) else null end where id=p_target returning user_id into target_user;
 elsif p_type='comment' then
  update public.comments set hidden_by_moderation=p_hidden,moderation_reason=case when p_hidden then trim(p_reason) else null end where id=p_target returning user_id into target_user;
 else raise exception 'Type de contenu invalide'; end if;
 if target_user is null then raise exception 'Contenu introuvable'; end if;
 insert into public.admin_actions(admin_id,target_user_id,action_type,reason,target_type,target_id)
 values(auth.uid(),target_user,p_type||case when p_hidden then '_hidden' else '_restored' end,
 case when p_hidden then trim(p_reason) else 'Contenu rétabli par la modération' end,p_type,p_target);
end; $$;
revoke all on function public.admin_set_content_visibility(text,uuid,boolean,text) from public,anon;
grant execute on function public.admin_set_content_visibility(text,uuid,boolean,text) to authenticated;
