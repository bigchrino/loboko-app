# Commentaires sociaux — SQL Supabase

Exécutez ce SQL dans **Supabase → SQL Editor** pour activer les likes sur commentaires
et les réponses (threading 1 niveau).

```sql
-- 1) Ajouter parent_comment_id aux commentaires (réponses)
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID
  REFERENCES public.comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS comments_parent_idx
  ON public.comments (parent_comment_id);

CREATE INDEX IF NOT EXISTS comments_post_created_idx
  ON public.comments (post_id, created_at);

-- 2) Table des likes de commentaires
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS comment_likes_comment_idx
  ON public.comment_likes (comment_id);
CREATE INDEX IF NOT EXISTS comment_likes_user_idx
  ON public.comment_likes (user_id);

-- 3) RLS
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comment_likes_select_all ON public.comment_likes;
CREATE POLICY comment_likes_select_all
  ON public.comment_likes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS comment_likes_insert_own ON public.comment_likes;
CREATE POLICY comment_likes_insert_own
  ON public.comment_likes FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS comment_likes_delete_own ON public.comment_likes;
CREATE POLICY comment_likes_delete_own
  ON public.comment_likes FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
```

## Notes
- Les compteurs de likes et de réponses sont calculés côté client (agrégation simple
  sur les lignes chargées). Aucun trigger n'est requis.
- Threading limité à **1 niveau visuel** : une réponse à une réponse reste affichée
  au même niveau, avec le préfixe "auteur — destinataire".
- Les politiques RLS existantes de la table `comments` continuent de s'appliquer
  pour les réponses (même `post_id`, même règle d'insertion).