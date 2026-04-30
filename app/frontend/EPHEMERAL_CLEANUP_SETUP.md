# Nettoyage automatique des messages éphémères — Setup SQL

Ce document décrit comment activer la **suppression réelle** des messages
éphémères expirés dans la base Supabase de LOBOKO.

> 💡 Aujourd'hui, le frontend masque déjà côté UI tout message dont
> `expires_at < now()`. Ce setup ajoute la couche serveur : les messages
> expirés sont **physiquement supprimés** de la base, ce qui garantit une
> vraie confidentialité (même côté admin / dump / backup récent).

---

## 1. Ce que fait ce script

1. Crée (ou remplace) la fonction SQL `public.cleanup_expired_messages()`
   - Supprime les lignes `messages` où `is_ephemeral = true AND expires_at < now()`
   - Supprime les lignes `group_messages` où `is_ephemeral = true AND expires_at < now()`
   - Retourne le nombre de lignes supprimées (DM + groupe)
2. Donne le droit d'exécution à `authenticated` (appel via RPC possible)
3. Prévoit la planification quotidienne via `pg_cron`

Caractéristiques importantes :

- ✅ **Idempotent** : tout le script peut être relancé autant de fois que tu
  veux (`CREATE OR REPLACE FUNCTION`, `IF NOT EXISTS` sur l'index, `DO $$`
  guard sur le cron).
- ✅ **Non destructif pour les autres messages** : la clause
  `is_ephemeral = true` garantit qu'on ne touche **JAMAIS** à un message
  normal, même s'il avait accidentellement une valeur dans `expires_at`.
- ✅ **Ne touche pas aux autres modules** : groupes, appels, status, médias,
  notifications, mentions → rien n'est modifié.
- ✅ **Médias préservés pour l'instant** : on laisse volontairement les
  fichiers `message-media` / voice-notes dans le storage (cf. section 4).
  Ils deviendront orphelins mais ne casseront rien. Une passe de cleanup
  storage pourra être ajoutée plus tard.

---

## 2. SQL à exécuter

À coller dans **Supabase → SQL Editor** puis lancer une seule fois (le
relancer plus tard est sans risque).

```sql
BEGIN;

-- -------------------------------------------------------------------------
-- Index de support (accélère la suppression si beaucoup de messages)
-- Les colonnes expires_at / is_ephemeral sont déjà créées par
-- EPHEMERAL_MESSAGES_SETUP.md. On se contente d'ajouter des index partiels
-- si besoin — idempotent.
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS messages_ephemeral_expired_idx
  ON public.messages (expires_at)
  WHERE is_ephemeral = true AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS group_messages_ephemeral_expired_idx
  ON public.group_messages (expires_at)
  WHERE is_ephemeral = true AND expires_at IS NOT NULL;

-- -------------------------------------------------------------------------
-- Fonction de nettoyage
-- -------------------------------------------------------------------------
-- Règle de sécurité stricte : on ne supprime QUE les messages marqués
-- explicitement comme éphémères (is_ephemeral = true) ET dont la date
-- d'expiration est passée (expires_at < now()). Les messages non
-- éphémères sont totalement ignorés.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_expired_messages()
RETURNS TABLE (
  deleted_messages bigint,
  deleted_group_messages bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d1 bigint := 0;
  d2 bigint := 0;
BEGIN
  -- DM
  WITH del AS (
    DELETE FROM public.messages
    WHERE is_ephemeral = true
      AND expires_at IS NOT NULL
      AND expires_at < now()
    RETURNING 1
  )
  SELECT count(*) INTO d1 FROM del;

  -- Groupes
  WITH del2 AS (
    DELETE FROM public.group_messages
    WHERE is_ephemeral = true
      AND expires_at IS NOT NULL
      AND expires_at < now()
    RETURNING 1
  )
  SELECT count(*) INTO d2 FROM del2;

  deleted_messages := d1;
  deleted_group_messages := d2;
  RETURN NEXT;
END;
$$;

-- Autoriser les clients authentifiés à appeler la fonction via RPC
-- (utile pour déclencher un cleanup manuel depuis un outil d'admin).
GRANT EXECUTE ON FUNCTION public.cleanup_expired_messages() TO authenticated;

COMMIT;
```

---

## 3. Planification quotidienne (cron Supabase)

Supabase propose l'extension `pg_cron` pour planifier des jobs SQL. Active-la
dans **Database → Extensions** si ce n'est pas déjà fait, puis lance le SQL
ci-dessous (idempotent : il supprime un job précédent du même nom avant de
le recréer).

```sql
BEGIN;

-- Supprime toute planification existante du même nom (idempotent)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cleanup-expired-messages-daily';

-- Replanifie : tous les jours à 03:00 UTC
SELECT cron.schedule(
  'cleanup-expired-messages-daily',
  '0 3 * * *',
  $$ SELECT public.cleanup_expired_messages(); $$
);

COMMIT;
```

Vérification :

```sql
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'cleanup-expired-messages-daily';
```

### Fréquence plus agressive (optionnel)

Si tu veux supprimer plus vite (toutes les heures par exemple), change la
cron expression :

| Fréquence        | Expression cron |
|------------------|-----------------|
| Toutes les heures| `0 * * * *`     |
| Toutes les 15 min| `*/15 * * * *`  |
| Tous les jours 3h| `0 3 * * *` ✅   |

Un cleanup quotidien est suffisant : le frontend masque déjà les messages
expirés immédiatement côté UI, donc aucun utilisateur ne les voit jamais.

---

## 4. Médias associés (volontairement gardés pour l'instant)

Les photos, vidéos et notes vocales envoyées en message éphémère sont
stockées dans le storage Supabase (buckets `message-media` / `voice-notes`).
Quand la ligne `messages` ou `group_messages` est supprimée, le fichier dans
le storage **reste** — il devient un orphelin.

**Pourquoi on ne le supprime pas maintenant ?**

- La suppression storage depuis `pg_cron` nécessite un appel HTTP (via
  `pg_net` ou Edge Function) qui sort du périmètre d'un nettoyage SQL
  simple.
- Les fichiers orphelins n'affectent pas le fonctionnement de l'app (plus
  aucun lien ne pointe vers eux).
- On évite tout risque de supprimer un média référencé par une autre
  fonctionnalité (avatar, story, post, etc.).

Une future itération pourra ajouter une Edge Function dédiée qui :
1. extrait la liste des `object_key` des messages expirés **avant** de les
   supprimer ;
2. appelle l'API Storage pour supprimer les objets correspondants ;
3. s'exécute également via `pg_cron` (toutes les nuits).

---

## 5. Test manuel

Pour vérifier que la fonction marche :

```sql
-- Voir combien de messages sont actuellement expirés mais pas encore supprimés
SELECT count(*) AS dm_expired
FROM public.messages
WHERE is_ephemeral = true
  AND expires_at IS NOT NULL
  AND expires_at < now();

SELECT count(*) AS group_expired
FROM public.group_messages
WHERE is_ephemeral = true
  AND expires_at IS NOT NULL
  AND expires_at < now();

-- Lancer le cleanup manuellement
SELECT * FROM public.cleanup_expired_messages();
-- → retourne (deleted_messages, deleted_group_messages)
```

---

## 6. Désactivation

Pour désactiver le cron plus tard :

```sql
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cleanup-expired-messages-daily';
```

La fonction `cleanup_expired_messages()` peut être conservée (elle ne fait
rien tant qu'elle n'est pas appelée) ou supprimée :

```sql
DROP FUNCTION IF EXISTS public.cleanup_expired_messages();
```

---

## Résumé

| Élément                             | Statut           |
|-------------------------------------|------------------|
| Colonnes `expires_at` / `is_ephemeral` | Déjà créées par `EPHEMERAL_MESSAGES_SETUP.md` |
| Index partiels dédiés au cleanup    | ✅ Ajoutés ici   |
| Fonction `cleanup_expired_messages`  | ✅ Ajoutée ici   |
| Cron quotidien (03:00 UTC)          | ✅ Planifié      |
| Suppression storage des médias      | ⏳ Plus tard     |
| Impact sur messages non éphémères   | ❌ Aucun         |
| Impact sur autres modules           | ❌ Aucun         |