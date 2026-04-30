# LOBOKO — Notifications Push (Web Push + VAPID)

Ce guide explique comment activer les **notifications push** (Web Push standard, compatible Chrome / Firefox / Edge / Safari 16.4+ PWA) sur LOBOKO.

Aucun service tiers payant n'est nécessaire : la signature utilise VAPID et la livraison passe directement par les push services des navigateurs (FCM, Mozilla autopush, Apple).

---

## 1. Générer une paire de clés VAPID (une seule fois)

En local :

```bash
npx web-push generate-vapid-keys
```

Vous obtenez une `publicKey` et une `privateKey`. Notez aussi un `subject` qui est un `mailto:` ou une URL (ex: `mailto:admin@loboko.app`).

---

## 2. Variables d'environnement

### Frontend (`.env.local`)

```
VITE_VAPID_PUBLIC_KEY=<la publicKey ci-dessus>
```

### Supabase (Project → Settings → Edge Functions → Secrets)

```
VAPID_PUBLIC_KEY=<même publicKey>
VAPID_PRIVATE_KEY=<la privateKey>
VAPID_SUBJECT=mailto:admin@loboko.app
```

> ⚠️ Ne mettez **jamais** la `privateKey` dans le frontend.

---

## 3. SQL (à exécuter dans Supabase → SQL Editor)

```sql
-- =====================================================================
-- Table des abonnements push (un user peut avoir plusieurs devices)
-- =====================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- Un utilisateur ne voit / modifie que ses propres subscriptions.
drop policy if exists "push_sub_select_own" on public.push_subscriptions;
create policy "push_sub_select_own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "push_sub_insert_own" on public.push_subscriptions;
create policy "push_sub_insert_own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_sub_update_own" on public.push_subscriptions;
create policy "push_sub_update_own"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push_sub_delete_own" on public.push_subscriptions;
create policy "push_sub_delete_own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- =====================================================================
-- Table des préférences push par utilisateur
-- =====================================================================
create table if not exists public.push_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dm_enabled boolean not null default true,
  groups_enabled boolean not null default true,
  mentions_only boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.push_preferences enable row level security;

-- Chaque utilisateur voit / modifie ses propres préférences.
drop policy if exists "push_pref_select_own" on public.push_preferences;
create policy "push_pref_select_own"
  on public.push_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "push_pref_upsert_own" on public.push_preferences;
create policy "push_pref_upsert_own"
  on public.push_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_pref_update_own" on public.push_preferences;
create policy "push_pref_update_own"
  on public.push_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- La fonction edge utilise la `service_role key` et contourne la RLS,
-- donc pas de policy supplémentaire nécessaire pour la lecture côté serveur.
```

---

## 4. Fonction edge `send-push`

Le code est fourni dans `supabase/functions/send-push/index.ts`.

### Déploiement (une fois Supabase CLI installé et lié au projet)

```bash
# À la racine du projet (ou dans app/frontend)
supabase functions deploy send-push --no-verify-jwt=false
```

> `verify-jwt=true` est important : seule la session utilisateur authentifiée peut déclencher un push.

### Vérification

Après déploiement, la fonction est accessible à :
```
https://<project-ref>.supabase.co/functions/v1/send-push
```

Le frontend l'appelle automatiquement à chaque message envoyé.

---

## 5. Payload envoyé

```json
{
  "recipient_user_id": "<uuid>",
  "kind": "dm" | "group" | "mention",
  "title": "Nom de l'expéditeur",
  "body": "Aperçu du message",
  "data": {
    "conversation_id": "<uuid>",
    "type": "dm" | "group"
  }
}
```

La fonction edge applique :
- Vérification de `auth.uid()` (l'émetteur = utilisateur connecté).
- Lecture de `push_preferences` du destinataire (DM / groupes / mentions_only).
- Lecture de toutes les `push_subscriptions` du destinataire.
- Envoi HTTP Web Push signé VAPID à chaque endpoint.
- Suppression automatique des endpoints retournant `404` ou `410 Gone` (désabonnés).

---

## 6. iOS — Note importante

Sur iOS / iPadOS, les notifications push web **ne fonctionnent que si l'utilisateur a installé le site comme PWA** (Partager → Sur l'écran d'accueil). C'est une restriction Apple, pas un bug de l'app. Un message adapté s'affiche dans les paramètres.

Android et desktop (Chrome/Firefox/Edge) fonctionnent sans installation.

---

## 7. Test rapide

1. `npm run build && npm run preview` (le service worker ne s'active qu'en production ou via preview).
2. Ouvrir l'app, aller dans **Paramètres → Notifications push**, cliquer **Activer**.
3. Accepter la permission du navigateur.
4. Depuis un autre compte, envoyer un message DM ou un message de groupe.
5. La notification doit apparaître immédiatement (même onglet en arrière-plan).
6. Cliquer la notif → la bonne conversation doit s'ouvrir.