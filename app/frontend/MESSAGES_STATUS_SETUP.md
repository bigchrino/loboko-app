# Configuration SQL — Statut des messages (LOBOKO)

Ce document contient le SQL à exécuter dans l'éditeur SQL de Supabase
(https://supabase.com/dashboard → Project → SQL Editor) pour activer :

- l'horodatage de livraison (`delivered_at`)
- l'horodatage de lecture (`read_at`)
- un champ `status` indicatif (`sent` / `delivered` / `read`)

> ⚠️ Les messages existants fonctionnent toujours. Les nouvelles colonnes sont
> facultatives : le code frontend gère aussi l'ancien schéma.

## 1. Ajouter les colonnes à la table `messages`

```sql
alter table public.messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at      timestamptz,
  add column if not exists status       text
    check (status in ('sent','delivered','read'))
    default 'sent';
```

## 2. Index utiles (optionnel mais recommandé)

```sql
create index if not exists messages_receiver_unread_idx
  on public.messages (receiver_id)
  where read = false;

create index if not exists messages_conversation_idx
  on public.messages (user_id, receiver_id, created_at desc);
```

## 3. Politiques RLS

On suppose que RLS est déjà activé sur `public.messages` avec des
politiques `select/insert` standards. On ajoute une politique `update`
permettant au destinataire de marquer "delivered" / "read", et à
l'émetteur de ne PAS écraser ces valeurs.

```sql
-- Autorise le destinataire à mettre à jour les colonnes d'accusé de réception
drop policy if exists "messages_update_by_receiver" on public.messages;
create policy "messages_update_by_receiver"
  on public.messages
  for update
  to authenticated
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);
```

## 4. Nettoyage éventuel (si d'anciennes notifications "message" existent)

Les notifications de type `message` ne sont plus créées. Pour supprimer
celles déjà présentes :

```sql
delete from public.notifications where type = 'message';
```

## 5. Vérification

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'messages'
order by ordinal_position;
```

Vous devez voir au moins : `id`, `user_id`, `receiver_id`, `content`,
`read`, `created_at`, `delivered_at`, `read_at`, `status`.

Aucune autre modification n'est nécessaire pour le "typing indicator" et
le "online status" — ils utilisent Supabase Realtime (broadcast + presence)
et ne requièrent pas de schéma additionnel.