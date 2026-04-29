# Commentaires – Setup Supabase

Si l'envoi d'un commentaire échoue avec "Impossible d'envoyer le commentaire", c'est **presque toujours** :
1. La table `comments` n'existe pas
2. Les politiques RLS bloquent l'INSERT

Exécutez ce SQL dans **Supabase → SQL Editor** pour créer (ou corriger) la table et les politiques.

```sql
-- 1. Table comments
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists comments_post_idx on public.comments(post_id);
create index if not exists comments_user_idx on public.comments(user_id);
create index if not exists comments_created_idx on public.comments(created_at);

-- 2. RLS
alter table public.comments enable row level security;

-- Lecture: tout le monde peut lire les commentaires
drop policy if exists "comments_select_all" on public.comments;
create policy "comments_select_all"
  on public.comments for select
  using (true);

-- Insertion: un utilisateur authentifié ne peut insérer qu'avec son propre user_id
drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own"
  on public.comments for insert
  to authenticated
  with check (user_id = auth.uid());

-- Mise à jour: seulement l'auteur
drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own"
  on public.comments for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Suppression: seulement l'auteur
drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own"
  on public.comments for delete
  to authenticated
  using (user_id = auth.uid());
```

## Diagnostic rapide

Le code envoie maintenant des logs détaillés dans la console du navigateur (F12 → Console).
Cherchez les lignes commençant par `[comments]`.

Cas courants :

| Erreur console | Cause | Solution |
|---|---|---|
| `code: "42P01"` / "relation does not exist" | Table manquante | Exécutez le SQL ci-dessus |
| `code: "42501"` / "row-level security" | Politique INSERT manquante ou mauvaise | Exécutez la partie RLS ci-dessus |
| `match: false` entre `authUid` et `currentUserId` | Session désynchronisée | Déconnectez-vous et reconnectez-vous |
| "JWT expired" / 401 | Session expirée côté Vercel | Reconnectez-vous |
| `code: "23503"` / "foreign key" | `post_id` invalide | Le post a été supprimé |

## Vérifier la table existante

Si vous pensez que la table existe déjà, vérifiez les colonnes :

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'comments';
```

Le code attend ces colonnes exactement :
- `id` (uuid)
- `post_id` (uuid)
- `user_id` (uuid)
- `content` (text)
- `created_at` (timestamptz)

## Vérifier les policies

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'comments';
```

Vous devez voir au minimum :
- `comments_select_all` (SELECT, using true)
- `comments_insert_own` (INSERT, with_check `user_id = auth.uid()`)