# Groups Setup (Phase 3)

Ce SQL active les groupes de discussion sans toucher aux tables existantes
(`messages`, `profiles`, etc.). Exécutez-le dans **Supabase → SQL Editor**
(une seule fois).

```sql
BEGIN;

-- 1) Groupes
CREATE TABLE IF NOT EXISTS groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_key TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS groups_created_by_idx ON groups(created_by);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Les membres peuvent lire leurs groupes ; le créateur aussi.
DROP POLICY IF EXISTS "groups_select_members" ON groups;
CREATE POLICY "groups_select_members"
  ON groups FOR SELECT TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = groups.id
        AND gm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "groups_insert_auth" ON groups;
CREATE POLICY "groups_insert_auth"
  ON groups FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

-- Seul un admin ou le créateur peut mettre à jour (nom, avatar, deleted_at).
DROP POLICY IF EXISTS "groups_update_admins" ON groups;
CREATE POLICY "groups_update_admins"
  ON groups FOR UPDATE TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = groups.id
        AND gm.user_id = (select auth.uid())
        AND gm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (true);

-- 2) Membres de groupe
-- role: 'owner' (créateur, non supprimable), 'admin', 'member'
CREATE TABLE IF NOT EXISTS group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS group_members_group_idx ON group_members(group_id);
CREATE INDEX IF NOT EXISTS group_members_user_idx ON group_members(user_id);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Un utilisateur voit les membres des groupes auxquels il appartient.
DROP POLICY IF EXISTS "group_members_select_same_group" ON group_members;
CREATE POLICY "group_members_select_same_group"
  ON group_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm2
      WHERE gm2.group_id = group_members.group_id
        AND gm2.user_id = (select auth.uid())
    )
  );

-- Insertion : le créateur lors de la création OU un admin du groupe peut
-- ajouter des membres.
DROP POLICY IF EXISTS "group_members_insert_admin_or_self" ON group_members;
CREATE POLICY "group_members_insert_admin_or_self"
  ON group_members FOR INSERT TO authenticated
  WITH CHECK (
    -- Créateur du groupe qui s'ajoute lui-même comme owner lors du bootstrap
    (
      user_id = (select auth.uid())
      AND EXISTS (
        SELECT 1 FROM groups g
        WHERE g.id = group_members.group_id
          AND g.created_by = (select auth.uid())
      )
    )
    OR EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = (select auth.uid())
        AND gm.role IN ('owner', 'admin')
    )
  );

-- Suppression : admins peuvent retirer quelqu'un ; un membre peut se retirer
-- lui-même. L'owner ne peut PAS être retiré (garde-fou applicatif + règle ci-dessous).
DROP POLICY IF EXISTS "group_members_delete_admin_or_self" ON group_members;
CREATE POLICY "group_members_delete_admin_or_self"
  ON group_members FOR DELETE TO authenticated
  USING (
    role <> 'owner'
    AND (
      user_id = (select auth.uid())
      OR EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = group_members.group_id
          AND gm.user_id = (select auth.uid())
          AND gm.role IN ('owner', 'admin')
      )
    )
  );

-- Mise à jour du rôle : owner ou admin.
DROP POLICY IF EXISTS "group_members_update_admins" ON group_members;
CREATE POLICY "group_members_update_admins"
  ON group_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = (select auth.uid())
        AND gm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (true);

-- 3) Messages de groupe (séparés de la table `messages` 1-à-1)
-- content est encodé avec le même format que la messagerie privée
-- (@@loboko:{json} pour audio/image/video, texte brut sinon).
CREATE TABLE IF NOT EXISTS group_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  reply_to_message_id UUID,
  deleted_for_everyone_at TIMESTAMPTZ,
  deleted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS group_messages_group_idx
  ON group_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_messages_reply_to_idx
  ON group_messages(reply_to_message_id);

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- Les membres du groupe lisent les messages.
DROP POLICY IF EXISTS "group_messages_select_members" ON group_messages;
CREATE POLICY "group_messages_select_members"
  ON group_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_messages.group_id
        AND gm.user_id = (select auth.uid())
    )
  );

-- Un membre envoie ses propres messages.
DROP POLICY IF EXISTS "group_messages_insert_member" ON group_messages;
CREATE POLICY "group_messages_insert_member"
  ON group_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_messages.group_id
        AND gm.user_id = (select auth.uid())
    )
  );

-- Mise à jour : l'auteur pour son propre message OU un admin/owner du groupe
-- (pour marquer deleted_for_everyone_at par exemple).
DROP POLICY IF EXISTS "group_messages_update_own_or_admin" ON group_messages;
CREATE POLICY "group_messages_update_own_or_admin"
  ON group_messages FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_messages.group_id
        AND gm.user_id = (select auth.uid())
        AND gm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (true);

-- 4) Réactions groupe
CREATE TABLE IF NOT EXISTS group_message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS group_message_reactions_message_idx
  ON group_message_reactions(message_id);

ALTER TABLE group_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_reactions_select_auth" ON group_message_reactions;
CREATE POLICY "group_reactions_select_auth"
  ON group_message_reactions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "group_reactions_insert_own" ON group_message_reactions;
CREATE POLICY "group_reactions_insert_own"
  ON group_message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "group_reactions_delete_own" ON group_message_reactions;
CREATE POLICY "group_reactions_delete_own"
  ON group_message_reactions FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- 5) "Supprimer pour moi" et "messages importants" côté groupe
CREATE TABLE IF NOT EXISTS group_message_deletions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);
ALTER TABLE group_message_deletions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "g_del_select_own" ON group_message_deletions;
CREATE POLICY "g_del_select_own"
  ON group_message_deletions FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "g_del_insert_own" ON group_message_deletions;
CREATE POLICY "g_del_insert_own"
  ON group_message_deletions FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE TABLE IF NOT EXISTS group_starred_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);
ALTER TABLE group_starred_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "g_star_select_own" ON group_starred_messages;
CREATE POLICY "g_star_select_own"
  ON group_starred_messages FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "g_star_insert_own" ON group_starred_messages;
CREATE POLICY "g_star_insert_own"
  ON group_starred_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "g_star_delete_own" ON group_starred_messages;
CREATE POLICY "g_star_delete_own"
  ON group_starred_messages FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

COMMIT;
```

## Ce que fait ce SQL
- `groups` : métadonnées d'un groupe (nom, avatar, créateur, soft-delete).
- `group_members` : appartenance + rôle (`owner` | `admin` | `member`). L'`owner` est insupprimable (policy + garde-fou UI).
- `group_messages` : messages de groupe, indépendants de la table `messages` 1-à-1. Mêmes payloads que la messagerie privée.
- `group_message_reactions`, `group_starred_messages`, `group_message_deletions` : parités Phase 2.

## Fallback
Si ce SQL n'est pas exécuté :
- La messagerie privée continue de fonctionner normalement.
- Les actions liées aux groupes affichent un toast explicite demandant d'exécuter `GROUPS_SETUP.md`.
- Aucun crash.