# Messages éphémères — Setup SQL

Exécute ce script **une seule fois** dans Supabase (SQL Editor) pour activer la
fonctionnalité « Messages éphémères » (auto-suppression) dans LOBOKO.

Le script est **idempotent** (tout est protégé par `IF NOT EXISTS` / `IF NOT
FOUND`) : tu peux le relancer sans risque.

Il ajoute :

1. Les colonnes `expires_at` et `is_ephemeral` à la table `messages`
2. Les mêmes colonnes à la table `group_messages`
3. Une table `conversation_settings` pour mémoriser la durée choisie par
   conversation (privée ou groupe)
4. Une fonction `cleanup_expired_messages()` qui supprime définitivement les
   messages dont `expires_at` est dépassé (à planifier via un cron Supabase)
5. Des politiques RLS pour que chaque utilisateur puisse lire/écrire uniquement
   les réglages de ses propres conversations

## SQL à exécuter

```sql
BEGIN;

-- -------------------------------------------------------------------------
-- 1. Colonnes éphémères sur messages
-- -------------------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_ephemeral boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS messages_expires_at_idx
  ON public.messages (expires_at)
  WHERE expires_at IS NOT NULL;

-- -------------------------------------------------------------------------
-- 2. Colonnes éphémères sur group_messages
-- -------------------------------------------------------------------------
ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_ephemeral boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS group_messages_expires_at_idx
  ON public.group_messages (expires_at)
  WHERE expires_at IS NOT NULL;

-- -------------------------------------------------------------------------
-- 3. Table conversation_settings
--
--    scope        : 'dm' (conversation privée) ou 'group' (groupe)
--    owner_id     : propriétaire du réglage (toujours auth.uid())
--                   - pour scope = 'dm'    : l'utilisateur qui règle sa
--                     conversation 1-à-1
--                   - pour scope = 'group' : l'utilisateur qui règle le
--                     groupe (chaque membre a son propre réglage côté
--                     frontend, mais on stocke par owner_id pour respecter
--                     RLS sans casser le flux collaboratif)
--    peer_id      : pour scope = 'dm' uniquement — id de l'autre utilisateur
--    group_id     : pour scope = 'group' uniquement — id du groupe
--    ephemeral_duration_seconds : 0 = désactivé, sinon durée en secondes
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('dm', 'group')),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  peer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid,
  ephemeral_duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversation_settings_scope_target CHECK (
    (scope = 'dm'    AND peer_id IS NOT NULL AND group_id IS NULL) OR
    (scope = 'group' AND group_id IS NOT NULL AND peer_id IS NULL)
  )
);

-- Unique par (owner_id, scope, target)
CREATE UNIQUE INDEX IF NOT EXISTS conversation_settings_dm_unique
  ON public.conversation_settings (owner_id, peer_id)
  WHERE scope = 'dm';

CREATE UNIQUE INDEX IF NOT EXISTS conversation_settings_group_unique
  ON public.conversation_settings (owner_id, group_id)
  WHERE scope = 'group';

-- -------------------------------------------------------------------------
-- 4. RLS conversation_settings
-- -------------------------------------------------------------------------
ALTER TABLE public.conversation_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_settings'
      AND policyname = 'conversation_settings_select_own'
  ) THEN
    CREATE POLICY conversation_settings_select_own
      ON public.conversation_settings
      FOR SELECT
      USING (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_settings'
      AND policyname = 'conversation_settings_insert_own'
  ) THEN
    CREATE POLICY conversation_settings_insert_own
      ON public.conversation_settings
      FOR INSERT
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_settings'
      AND policyname = 'conversation_settings_update_own'
  ) THEN
    CREATE POLICY conversation_settings_update_own
      ON public.conversation_settings
      FOR UPDATE
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_settings'
      AND policyname = 'conversation_settings_delete_own'
  ) THEN
    CREATE POLICY conversation_settings_delete_own
      ON public.conversation_settings
      FOR DELETE
      USING (owner_id = auth.uid());
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- 5. Fonction de nettoyage (suppression définitive des messages expirés)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_expired_messages()
RETURNS TABLE (deleted_messages bigint, deleted_group_messages bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  d1 bigint := 0;
  d2 bigint := 0;
BEGIN
  WITH del AS (
    DELETE FROM public.messages
    WHERE expires_at IS NOT NULL
      AND expires_at < now()
    RETURNING 1
  )
  SELECT count(*) INTO d1 FROM del;

  WITH del2 AS (
    DELETE FROM public.group_messages
    WHERE expires_at IS NOT NULL
      AND expires_at < now()
    RETURNING 1
  )
  SELECT count(*) INTO d2 FROM del2;

  deleted_messages := d1;
  deleted_group_messages := d2;
  RETURN NEXT;
END;
$$;

-- Autoriser les clients authentifiés à appeler la fonction via RPC.
GRANT EXECUTE ON FUNCTION public.cleanup_expired_messages() TO authenticated;

COMMIT;
```

## Cron Supabase (optionnel mais recommandé)

Dans Supabase Studio → Database → Cron (extension `pg_cron`), crée un job
quotidien :

```sql
SELECT cron.schedule(
  'cleanup-expired-messages-daily',
  '0 3 * * *', -- tous les jours à 03:00 UTC
  $$ SELECT public.cleanup_expired_messages(); $$
);
```

Si `pg_cron` n'est pas activé sur ton projet, aucun problème : le frontend
filtre déjà les messages expirés côté client (`expires_at < now()`), donc
les utilisateurs ne les verront jamais.

## Compatibilité

- Les messages existants restent visibles : `expires_at` vaut `NULL` par défaut
  et `is_ephemeral` vaut `false`.
- La fonctionnalité marche aussi bien en conversation privée qu'en groupe.
- Elle ne casse ni les appels, ni les statuts, ni les médias, ni les mentions :
  seuls les champs `expires_at` / `is_ephemeral` sont ajoutés.