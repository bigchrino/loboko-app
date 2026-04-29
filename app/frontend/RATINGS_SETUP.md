# Notation des Prestataires – Setup Supabase

Exécutez ce SQL dans votre console Supabase (SQL Editor) pour créer la table `ratings` et ses politiques :

```sql
-- Table ratings
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  constraint ratings_not_self check (from_user_id <> to_user_id),
  constraint ratings_unique_pair unique (from_user_id, to_user_id)
);

create index if not exists ratings_to_user_idx on public.ratings(to_user_id);
create index if not exists ratings_from_user_idx on public.ratings(from_user_id);

-- RLS
alter table public.ratings enable row level security;

-- Lecture publique (pour afficher la moyenne sur tous les profils)
drop policy if exists "ratings_select_all" on public.ratings;
create policy "ratings_select_all"
  on public.ratings for select
  using (true);

-- Insertion: seulement un client peut noter un prestataire, jamais soi-même
drop policy if exists "ratings_insert_client_to_prestataire" on public.ratings;
create policy "ratings_insert_client_to_prestataire"
  on public.ratings for insert
  to authenticated
  with check (
    from_user_id = auth.uid()
    and from_user_id <> to_user_id
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'client'
    )
    and exists (
      select 1 from public.profiles p
      where p.user_id = to_user_id and p.role = 'prestataire'
    )
  );

-- Mise à jour: seulement l'auteur peut modifier sa note
drop policy if exists "ratings_update_own" on public.ratings;
create policy "ratings_update_own"
  on public.ratings for update
  to authenticated
  using (from_user_id = auth.uid())
  with check (from_user_id = auth.uid());

-- Suppression: seulement l'auteur
drop policy if exists "ratings_delete_own" on public.ratings;
create policy "ratings_delete_own"
  on public.ratings for delete
  to authenticated
  using (from_user_id = auth.uid());
```

Après exécution, rechargez l'application et la fonctionnalité de notation sera active.