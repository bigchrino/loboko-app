# Social Notifications Setup

Ce SQL active les compteurs de partages et les notifications sociales pour les commentaires et les partages de publications.

Exécutez ce SQL dans **Supabase → SQL Editor** (une seule fois).

```sql
BEGIN;

-- 1) Colonne shares_count sur posts (si absente)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS shares_count INTEGER NOT NULL DEFAULT 0;

-- 2) Table post_shares : un enregistrement par partage
CREATE TABLE IF NOT EXISTS post_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS post_shares_post_idx ON post_shares(post_id);
CREATE INDEX IF NOT EXISTS post_shares_user_idx ON post_shares(user_id);

-- 3) RLS
ALTER TABLE post_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_shares_read_all" ON post_shares;
CREATE POLICY "post_shares_read_all"
  ON post_shares FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "post_shares_insert_own" ON post_shares;
CREATE POLICY "post_shares_insert_own"
  ON post_shares FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- 4) Trigger pour maintenir posts.shares_count synchronisé
CREATE OR REPLACE FUNCTION bump_post_shares_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET shares_count = COALESCE(shares_count, 0) + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET shares_count = GREATEST(COALESCE(shares_count, 0) - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS post_shares_count_trg ON post_shares;
CREATE TRIGGER post_shares_count_trg
AFTER INSERT OR DELETE ON post_shares
FOR EACH ROW EXECUTE FUNCTION bump_post_shares_count();

COMMIT;
```

## Ce que le SQL fait

- Ajoute `shares_count` sur `posts` (défaut 0).
- Crée la table `post_shares` pour tracer chaque partage (une ligne par action de partage).
- RLS : lecture publique, insertion réservée à l'utilisateur authentifié.
- Un trigger maintient automatiquement `posts.shares_count` à jour.

## Types de notifications gérés côté frontend

Le frontend écrit déjà ces nouveaux types dans la table `notifications` existante :

- `post_shared` — quelqu'un a partagé votre publication
- `comment_liked` — quelqu'un a aimé votre commentaire ou votre réponse
- `comment_replied` — quelqu'un a répondu à votre commentaire ou votre réponse

Aucun changement de schéma n'est nécessaire sur la table `notifications` : elle accepte ces types comme chaînes dans la colonne `type` existante.

## Fallback si le SQL n'est pas exécuté

- Le bouton "Partager" continue de fonctionner (copie du lien / partage natif).
- L'insertion dans `post_shares` échouera silencieusement et n'incrémentera pas `shares_count`.
- Les notifications `post_shared`, `comment_liked`, `comment_replied` utilisent la table `notifications` existante, donc elles fonctionnent dès que `NOTIFICATIONS_SETUP.md` a déjà été exécuté.