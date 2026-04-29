# Messaging Phase 2 Setup

Ce SQL active les fonctionnalités **Phase 2** de la messagerie :
- Réactions emoji sur un message
- Messages importants (étoile)
- Suppression pour moi (soft-delete par utilisateur)
- Suppression pour tout le monde (contenu remplacé)
- Réponse citée (reply-to)

Exécutez ce SQL dans **Supabase → SQL Editor** (une seule fois).

```sql
BEGIN;

-- 1) Colonnes additionnelles sur la table messages (idempotent)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID,
  ADD COLUMN IF NOT EXISTS deleted_for_everyone_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS messages_reply_to_idx
  ON messages(reply_to_message_id);

-- 2) Réactions emoji
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS message_reactions_message_idx
  ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS message_reactions_user_idx
  ON message_reactions(user_id);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactions_select_all_auth" ON message_reactions;
CREATE POLICY "reactions_select_all_auth"
  ON message_reactions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "reactions_insert_own" ON message_reactions;
CREATE POLICY "reactions_insert_own"
  ON message_reactions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "reactions_delete_own" ON message_reactions;
CREATE POLICY "reactions_delete_own"
  ON message_reactions FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- 3) Messages importants (par utilisateur)
CREATE TABLE IF NOT EXISTS starred_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

CREATE INDEX IF NOT EXISTS starred_messages_user_idx
  ON starred_messages(user_id);
CREATE INDEX IF NOT EXISTS starred_messages_message_idx
  ON starred_messages(message_id);

ALTER TABLE starred_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "starred_select_own" ON starred_messages;
CREATE POLICY "starred_select_own"
  ON starred_messages FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "starred_insert_own" ON starred_messages;
CREATE POLICY "starred_insert_own"
  ON starred_messages FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "starred_delete_own" ON starred_messages;
CREATE POLICY "starred_delete_own"
  ON starred_messages FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- 4) "Supprimer pour moi" : une ligne par utilisateur + message masqué
CREATE TABLE IF NOT EXISTS message_deletions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

CREATE INDEX IF NOT EXISTS message_deletions_user_idx
  ON message_deletions(user_id);

ALTER TABLE message_deletions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deletions_select_own" ON message_deletions;
CREATE POLICY "deletions_select_own"
  ON message_deletions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "deletions_insert_own" ON message_deletions;
CREATE POLICY "deletions_insert_own"
  ON message_deletions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "deletions_delete_own" ON message_deletions;
CREATE POLICY "deletions_delete_own"
  ON message_deletions FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- 5) "Supprimer pour tout le monde" : autorise le sender à marquer
-- deleted_for_everyone_at sur ses propres messages.
-- Ajuste la policy UPDATE existante sur messages si nécessaire.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND policyname = 'messages_update_own_sender'
  ) THEN
    CREATE POLICY "messages_update_own_sender"
      ON messages FOR UPDATE TO authenticated
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END$$;

COMMIT;
```

## Ce que fait ce SQL

- **`messages.reply_to_message_id`** : référence vers le message cité.
- **`messages.deleted_for_everyone_at`** : timestamp de suppression globale (contenu remplacé côté client).
- **`message_reactions`** : une réaction emoji par (message, user, emoji). Unique → un même emoji ne peut être ajouté qu'une fois par utilisateur sur un message.
- **`starred_messages`** : liste des messages marqués importants par chaque utilisateur.
- **`message_deletions`** : "Supprimer pour moi" — masqué uniquement pour l'utilisateur qui a supprimé.
- **RLS** : chaque utilisateur ne voit que ses propres suppressions / étoiles ; les réactions sont publiques entre utilisateurs authentifiés (pour afficher les compteurs).

## Fallback

Si ce SQL n'est pas encore exécuté :
- La messagerie continue de fonctionner normalement.
- Les actions Phase 2 (réactions, étoiles, suppressions, réponse) affichent un toast d'erreur explicite demandant d'exécuter ce SQL.
- Aucun crash.