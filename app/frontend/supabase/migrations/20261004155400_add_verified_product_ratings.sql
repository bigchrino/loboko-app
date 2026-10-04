-- Product ratings supplement existing written/photo comments without changing old rows.
alter table public.product_comments
  add column if not exists rating smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.product_comments'::regclass
      and conname = 'product_comments_rating_range'
  ) then
    alter table public.product_comments
      add constraint product_comments_rating_range
      check (rating is null or rating between 1 and 5);
  end if;
end;
$$;

create or replace function public.loboko_validate_product_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.rating is null then
    return new;
  end if;

  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Une note doit être publiée par son auteur';
  end if;

  if not exists (
    select 1
    from public.product_orders po
    where po.client_id = auth.uid()
      and po.product_id = new.product_id
      and po.status = 'completed'
  ) then
    raise exception using errcode = '23514', message = 'Une note est réservée aux clients ayant terminé une commande de ce produit';
  end if;

  return new;
end;
$$;

revoke all on function public.loboko_validate_product_rating() from public, anon, authenticated;
drop trigger if exists z_loboko_validate_product_rating on public.product_comments;
create trigger z_loboko_validate_product_rating
before insert or update of rating, product_id, user_id on public.product_comments
for each row execute function public.loboko_validate_product_rating();
