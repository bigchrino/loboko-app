# Messaging Phase 1 Setup

Ce SQL active les fonctionnalités **Phase 1** pour la messagerie :
- Archivage des conversations (par utilisateur, non destructif)
- Suppression d'une conversation côté utilisateur (soft delete par utilisateur)
- Blocage d'un contact
- Signalement d'un contact

Exécutez ce SQL dans **Supabase → SQL Editor** (une seule fois).

```sql
BEGIN;

-- 1) conversation_states : état par utilisateur et par "autre utilisateur"
-- Chaque ligne représente l'état d'une conversation (1-à-1) du point de vue
-- de owner_id avec peer_id. On ne modifie pas la table `messages`.
CREATE TABLE IF NOT EXISTS conversation_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  peer_id UUID NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  cleared_at TIMESTAMPTZ, -- tous les messages antérieurs sont masqués pour owner_id
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_id, peer_id)
);

CREATE INDEX IF NOT EXISTS conversation_states_owner_idx
  ON conversation_states(owner_id);
CREATE INDEX IF NOT EXISTS conversation_states_owner_archived_idx
  ON conversation_states(owner_id, archived);

ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_states_select_own" ON conversation_states;
CREATE POLICY "conv_states_select_own"
  ON conversation_states FOR SELECT TO authenticated
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "conv_states_insert_own" ON conversation_states;
CREATE POLICY "conv_states_insert_own"
  ON conversation_states FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "conv_states_update_own" ON conversation_states;
CREATE POLICY "conv_states_update_own"
  ON conversation_states FOR UPDATE TO authenticated
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "conv_states_delete_own" ON conversation_states;
CREATE POLICY "conv_states_delete_own"
  ON conversation_states FOR DELETE TO authenticated
  USING ((select auth.uid()) = owner_id);

-- 2) blocked_users : owner_id a bloqué blocked_id
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS blocked_users_owner_idx ON blocked_users(owner_id);
CREATE INDEX IF NOT EXISTS blocked_users_blocked_idx ON blocked_users(blocked_id);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_select_own" ON blocked_users;
CREATE POLICY "blocked_select_own"
  ON blocked_users FOR SELECT TO authenticated
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "blocked_insert_own" ON blocked_users;
CREATE POLICY "blocked_insert_own"
  ON blocked_users FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "blocked_delete_own" ON blocked_users;
CREATE POLICY "blocked_delete_own"
  ON blocked_users FOR DELETE TO authenticated
  USING ((select auth.uid()) = owner_id);

-- 3) user_reports : signalements
CREATE TABLE IF NOT EXISTS user_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  reported_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_reports_reporter_idx ON user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS user_reports_reported_idx ON user_reports(reported_id);

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert_own" ON user_reports;
CREATE POLICY "reports_insert_own"
  ON user_reports FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = reporter_id);

DROP POLICY IF EXISTS "reports_select_own" ON user_reports;
CREATE POLICY "reports_select_own"
  ON user_reports FOR SELECT TO authenticated
  USING ((select auth.uid()) = reporter_id);

COMMIT;
```

## Ce que fait ce SQL

- **`conversation_states`** : une ligne par (propriétaire, contact). Stocke l'état d'archivage et la date de "clear" (suppression locale d'une conversation). Aucune modification de la table `messages`.
- **`blocked_users`** : liste des utilisateurs bloqués par `owner_id`.
- **`user_reports`** : historique des signalements.
- **RLS** : chaque utilisateur ne voit et ne modifie que ses propres lignes.

## Fallback

Si ce SQL n'est pas exécuté :
- La page Messages continue de fonctionner normalement (liste et envoi de messages).
- Les actions "Archiver", "Supprimer la discussion", "Bloquer", "Signaler" afficheront un toast d'erreur explicite indiquant qu'il faut exécuter ce SQL.
- Aucun crash, aucun impact sur les messages existants.