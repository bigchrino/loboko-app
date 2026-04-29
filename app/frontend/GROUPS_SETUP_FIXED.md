# Groups Setup — FIXED (Phase 3)

Ce SQL remplace `GROUPS_SETUP.md`. Il est **idempotent** (vous pouvez l'exécuter
plusieurs fois sans erreur), il **ajoute** les colonnes manquantes si les tables
existent déjà, et il corrige les policies RLS qui bloquaient la création de
groupe.

> **Comment l'exécuter** : copiez TOUT le bloc SQL ci-dessous → Supabase →
> SQL Editor → Run. Une seule exécution suffit.

> Ce script **ne touche pas** aux tables `messages`, `profiles`, `posts`,
> `comments`, `ratings`, ni à la signalisation des appels.

---

## SQL

```sql
BEGIN;

-- ============================================================================
-- 1) TABLE groups
-- ============================================================================

CREATE TABLE IF NOT EXISTS groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_key TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Patch columns if the table pre-existed with a partial shape.
ALTER TABLE groups ADD COLUMN IF NOT EXISTS avatar_key TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE groups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS groups_created_by_idx ON groups(created_by);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 2) TABLE group_members
-- ============================================================================

CREATE TABLE IF NOT EXISTS group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE group_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS group_members_group_idx ON group_members(group_id);
CREATE INDEX IF NOT EXISTS group_members_user_idx ON group_members(user_id);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 3) TABLE group_messages
-- ============================================================================

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

-- Patch columns if the table already existed without them.
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS reply_to_message_id UUID;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS deleted_for_everyone_at TIMESTAMPTZ;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS deleted_by UUID;

CREATE INDEX IF NOT EXISTS group_messages_group_idx
  ON group_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_messages_reply_to_idx
  ON group_messages(reply_to_message_id);

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 4) TABLE group_message_reactions
-- ============================================================================

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


-- ============================================================================
-- 5) TABLE group_message_deletions ("supprimer pour moi")
-- ============================================================================

CREATE TABLE IF NOT EXISTS group_message_deletions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

ALTER TABLE group_message_deletions ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 6) TABLE group_starred_messages (favoris)
-- ============================================================================

CREATE TABLE IF NOT EXISTS group_starred_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

ALTER TABLE group_starred_messages ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 7) HELPER FUNCTIONS (SECURITY DEFINER) — contournent le RLS en interne
--    pour éviter les récursions entre policies de `groups` et `group_members`.
-- ============================================================================

-- Est-ce que l'utilisateur est membre du groupe ?
CREATE OR REPLACE FUNCTION is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
  );
$$;

-- Est-ce que l'utilisateur est admin ou owner du groupe ?
CREATE OR REPLACE FUNCTION is_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND role IN ('owner', 'admin')
  );
$$;

-- Est-ce que l'utilisateur a créé ce groupe ?
CREATE OR REPLACE FUNCTION is_group_creator(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM groups
    WHERE id = p_group_id
      AND created_by = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION is_group_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_group_admin(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_group_creator(UUID, UUID) TO authenticated;


-- ============================================================================
-- 8) POLICIES — groups
-- ============================================================================

DROP POLICY IF EXISTS "groups_select_members" ON groups;
DROP POLICY IF EXISTS "groups_insert_auth" ON groups;
DROP POLICY IF EXISTS "groups_update_admins" ON groups;

-- Les membres + le créateur peuvent lire le groupe (via helper SECURITY DEFINER).
CREATE POLICY "groups_select_members"
  ON groups FOR SELECT TO authenticated
  USING (
    created_by = (select auth.uid())
    OR is_group_member(id, (select auth.uid()))
  );

-- Tout utilisateur authentifié peut créer un groupe dont il est le créateur.
CREATE POLICY "groups_insert_auth"
  ON groups FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

-- Seul le créateur ou un admin/owner peut modifier (rename, avatar, deleted_at).
CREATE POLICY "groups_update_admins"
  ON groups FOR UPDATE TO authenticated
  USING (
    created_by = (select auth.uid())
    OR is_group_admin(id, (select auth.uid()))
  )
  WITH CHECK (true);


-- ============================================================================
-- 9) POLICIES — group_members
-- ============================================================================

DROP POLICY IF EXISTS "group_members_select_same_group" ON group_members;
DROP POLICY IF EXISTS "group_members_insert_admin_or_self" ON group_members;
DROP POLICY IF EXISTS "group_members_insert_creator_bootstrap" ON group_members;
DROP POLICY IF EXISTS "group_members_insert_creator_batch" ON group_members;
DROP POLICY IF EXISTS "group_members_insert_admin" ON group_members;
DROP POLICY IF EXISTS "group_members_delete_admin_or_self" ON group_members;
DROP POLICY IF EXISTS "group_members_update_admins" ON group_members;

-- Un utilisateur voit les membres des groupes qu'il a créés ou dont il fait partie.
CREATE POLICY "group_members_select_same_group"
  ON group_members FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR is_group_creator(group_id, (select auth.uid()))
    OR is_group_member(group_id, (select auth.uid()))
  );

-- INSERT — CORRECTION CLÉ :
-- Le créateur du groupe peut insérer N'IMPORTE QUEL membre (lui-même en owner
-- + les autres en member). Cela évite le dead-lock de la policy précédente
-- qui nécessitait une ligne préexistante dans group_members pour autoriser
-- l'insertion des autres membres dans le même batch.
CREATE POLICY "group_members_insert_creator_batch"
  ON group_members FOR INSERT TO authenticated
  WITH CHECK (
    is_group_creator(group_id, (select auth.uid()))
  );

-- Les admins/owners (autres que le créateur) peuvent ajouter des membres
-- plus tard.
CREATE POLICY "group_members_insert_admin"
  ON group_members FOR INSERT TO authenticated
  WITH CHECK (
    is_group_admin(group_id, (select auth.uid()))
  );

-- DELETE : admins peuvent retirer, membres peuvent se retirer eux-mêmes.
-- L'owner ne peut PAS être retiré (double garde-fou applicatif + policy).
CREATE POLICY "group_members_delete_admin_or_self"
  ON group_members FOR DELETE TO authenticated
  USING (
    role <> 'owner'
    AND (
      user_id = (select auth.uid())
      OR is_group_admin(group_id, (select auth.uid()))
    )
  );

-- UPDATE du rôle : owner ou admin.
CREATE POLICY "group_members_update_admins"
  ON group_members FOR UPDATE TO authenticated
  USING (
    is_group_admin(group_id, (select auth.uid()))
  )
  WITH CHECK (true);


-- ============================================================================
-- 10) POLICIES — group_messages
-- ============================================================================

DROP POLICY IF EXISTS "group_messages_select_members" ON group_messages;
DROP POLICY IF EXISTS "group_messages_insert_member" ON group_messages;
DROP POLICY IF EXISTS "group_messages_update_own_or_admin" ON group_messages;

CREATE POLICY "group_messages_select_members"
  ON group_messages FOR SELECT TO authenticated
  USING (is_group_member(group_id, (select auth.uid())));

CREATE POLICY "group_messages_insert_member"
  ON group_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND is_group_member(group_id, (select auth.uid()))
  );

-- L'auteur peut éditer son propre message ; un admin/owner peut supprimer
-- n'importe quel message du groupe (marquer deleted_for_everyone_at).
CREATE POLICY "group_messages_update_own_or_admin"
  ON group_messages FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR is_group_admin(group_id, (select auth.uid()))
  )
  WITH CHECK (true);


-- ============================================================================
-- 11) POLICIES — group_message_reactions
-- ============================================================================

DROP POLICY IF EXISTS "group_reactions_select_auth" ON group_message_reactions;
DROP POLICY IF EXISTS "group_reactions_insert_own" ON group_message_reactions;
DROP POLICY IF EXISTS "group_reactions_delete_own" ON group_message_reactions;

CREATE POLICY "group_reactions_select_auth"
  ON group_message_reactions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "group_reactions_insert_own"
  ON group_message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "group_reactions_delete_own"
  ON group_message_reactions FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));


-- ============================================================================
-- 12) POLICIES — group_message_deletions
-- ============================================================================

DROP POLICY IF EXISTS "g_del_select_own" ON group_message_deletions;
DROP POLICY IF EXISTS "g_del_insert_own" ON group_message_deletions;

CREATE POLICY "g_del_select_own"
  ON group_message_deletions FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "g_del_insert_own"
  ON group_message_deletions FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));


-- ============================================================================
-- 13) POLICIES — group_starred_messages
-- ============================================================================

DROP POLICY IF EXISTS "g_star_select_own" ON group_starred_messages;
DROP POLICY IF EXISTS "g_star_insert_own" ON group_starred_messages;
DROP POLICY IF EXISTS "g_star_delete_own" ON group_starred_messages;

CREATE POLICY "g_star_select_own"
  ON group_starred_messages FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "g_star_insert_own"
  ON group_starred_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "g_star_delete_own"
  ON group_starred_messages FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

COMMIT;
```

---

## Diagnostic du bug précédent

### Pourquoi la création de groupe échouait

Le frontend exécute **deux requêtes** lors de la création :

1. `INSERT INTO groups (name, avatar_key, created_by)` — OK, policy `groups_insert_auth` passe.
2. `INSERT INTO group_members` avec **plusieurs lignes** dans le même appel :
   - Une ligne pour le créateur (`role = 'owner'`)
   - Une ligne par membre invité (`role = 'member'`)

L'ancienne policy `group_members_insert_admin_or_self` vérifiait :
- Soit `user_id = auth.uid()` ET le user est créateur du groupe → OK pour la ligne du créateur uniquement.
- Soit il existe déjà une ligne `group_members` avec `role IN ('owner','admin')` pour ce groupe → **FAUX au moment du check**, car la ligne owner est en cours d'insertion dans le même batch. PostgreSQL évalue `WITH CHECK` ligne par ligne mais ne voit pas les lignes en cours d'insertion.

Résultat : les lignes `member` étaient rejetées → `42501 permission denied`.

### Correction

La nouvelle policy `group_members_insert_creator_batch` autorise le créateur du groupe à insérer **n'importe quel membre** (lui-même + les autres) tant que `groups.created_by = auth.uid()`. Cela élimine le deadlock.

Après création, les admins/owners utilisent la policy `group_members_insert_admin` pour ajouter d'autres membres.

### À propos de `reply_to_message_id`

L'erreur venait probablement d'un état partiel où `group_messages` existait sans la colonne `reply_to_message_id`. Le nouveau script utilise `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pour patcher la table existante sans la recréer.

---

## Vérification rapide après exécution

Dans Supabase → SQL Editor :

```sql
-- 1) Tables et colonnes
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('groups','group_members','group_messages',
                     'group_message_reactions','group_starred_messages',
                     'group_message_deletions')
ORDER BY table_name, ordinal_position;

-- 2) Policies actives
SELECT tablename, policyname FROM pg_policies
WHERE tablename LIKE 'group%' ORDER BY tablename, policyname;
```

Vous devez voir `reply_to_message_id`, `deleted_for_everyone_at`, `deleted_by`
dans `group_messages`, et toutes les policies listées ci-dessus.