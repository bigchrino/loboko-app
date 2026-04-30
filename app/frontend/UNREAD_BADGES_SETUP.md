# Unread badges — Groups (Phase 3+)

Pour afficher un badge "messages non lus" par groupe comme WhatsApp, il faut
une table qui enregistre, pour chaque (utilisateur, groupe), la date du dernier
message lu. Les messages dont `created_at > last_read_at` sont non lus.

Les conversations privées (1-à-1) utilisent déjà la colonne `read` de la table
`messages` — aucun SQL supplémentaire requis pour elles.

> **Comment l'exécuter** : Supabase → SQL Editor → copiez tout le bloc ci-dessous → Run.
> Script **idempotent**, ne touche à aucune autre table.

```sql
BEGIN;

-- ============================================================================
-- TABLE group_reads — suit le dernier moment où un membre a lu un groupe.
-- ============================================================================

CREATE TABLE IF NOT EXISTS group_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  group_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, group_id)
);

CREATE INDEX IF NOT EXISTS group_reads_user_idx ON group_reads(user_id);
CREATE INDEX IF NOT EXISTS group_reads_group_idx ON group_reads(group_id);

ALTER TABLE group_reads ENABLE ROW LEVEL SECURITY;

-- Un utilisateur ne voit que ses propres marqueurs de lecture.
DROP POLICY IF EXISTS "group_reads_select_own" ON group_reads;
CREATE POLICY "group_reads_select_own"
  ON group_reads FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "group_reads_insert_own" ON group_reads;
CREATE POLICY "group_reads_insert_own"
  ON group_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "group_reads_update_own" ON group_reads;
CREATE POLICY "group_reads_update_own"
  ON group_reads FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

COMMIT;
```

## Ce que fait ce SQL

- `group_reads(user_id, group_id, last_read_at)` : pour chaque membre et chaque
  groupe, on stocke la date/heure du dernier message lu.
- RLS : chaque utilisateur ne peut lire/écrire que **ses propres** lignes.
- L'unicité `(user_id, group_id)` permet un upsert simple côté client.

## Comment le frontend l'utilise

- À l'ouverture d'un groupe (`/messages/group/:id`) : upsert
  `last_read_at = now()` pour `(myId, groupId)`.
- Sur la liste des conversations : on récupère l'ensemble des `group_reads` de
  l'utilisateur courant et, pour chaque groupe, on compte les
  `group_messages` dont `created_at > last_read_at` (et dont l'auteur n'est
  pas moi, et qui ne sont pas supprimés pour moi).
- Si aucune ligne `group_reads` n'existe pour un groupe, on considère que tous
  les messages dont l'auteur n'est pas l'utilisateur sont non lus.

## Fallback

Si ce SQL n'est pas exécuté :
- Les badges de non-lus pour **groupes** sont masqués (aucun crash).
- Les badges pour **messages privés** restent affichés normalement (ils ne
  dépendent pas de cette table).