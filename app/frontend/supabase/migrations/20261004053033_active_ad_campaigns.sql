create or replace function public.list_active_ad_campaigns()
returns table(id uuid,title text,description text,image_url text,category_slug text)
language sql stable security invoker set search_path='' as $$
 select id,title,description,image_url,category_slug from public.loboko_ad_campaigns
 where active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())
 order by sort_order,created_at,id limit 20;
$$;
revoke all on function public.list_active_ad_campaigns() from public,anon;
grant execute on function public.list_active_ad_campaigns() to authenticated;
