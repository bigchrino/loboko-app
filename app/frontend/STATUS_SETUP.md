# LOBOKO — Statuts / Stories — Setup Supabase

Ce document contient **tout le SQL nécessaire** pour activer les Statuts
(équivalent WhatsApp / Instagram Stories) côté Supabase.

À exécuter **une seule fois** dans : Supabase Dashboard → SQL Editor.

---

## 1. Bucket Storage

Créer un bucket **`statuses`** pour stocker les photos et vidéos de statut.

Dashboard → Storage → **New bucket**
- Name: `statuses`
- Public: **Yes** (lecture publique, upload protégé par RLS)
- File size limit: 50 MB (recommandé)

Puis exécuter les policies ci-dessous dans SQL Editor :

```sql
-- Lecture publique du bucket statuses
DROP POLICY IF EXISTS "statuses_read_public" ON storage.objects;
CREATE POLICY "statuses_read_public" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'statuses');

-- Upload uniquement par l'utilisateur dans son propre dossier (premier segment = user_id)
DROP POLICY IF EXISTS "statuses_insert_own" ON storage.objects;
CREATE POLICY "statuses_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'statuses'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Suppression uniquement par le propriétaire
DROP POLICY IF EXISTS "statuses_delete_own" ON storage.objects;
CREATE POLICY "statuses_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'statuses'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## 2. Table `statuses`

```sql
CREATE TABLE IF NOT EXISTS public.statuses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('text', 'image', 'video')),
  -- Pour text : contenu texte
  -- Pour image/video : vide ou légende
  text        text,
  -- Storage key au format "bucket::path" (ex: "statuses::<uid>/abc.jpg")
  object_key  text,
  -- Durée de la vidéo en secondes (pour kind = 'video')
  duration    int,
  -- Couleur d'arrière-plan pour les statuts texte (hex)
  bg_color    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS statuses_user_idx       ON public.statuses(user_id);
CREATE INDEX IF NOT EXISTS statuses_expires_idx    ON public.statuses(expires_at);
CREATE INDEX IF NOT EXISTS statuses_created_idx    ON public.statuses(created_at DESC);

ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;

-- Tout utilisateur connecté peut lire les statuts non-expirés
DROP POLICY IF EXISTS "statuses_select_active" ON public.statuses;
CREATE POLICY "statuses_select_active" ON public.statuses
FOR SELECT TO authenticated
USING (expires_at > now());

-- Un utilisateur ne peut créer qu'un statut pour lui-même
DROP POLICY IF EXISTS "statuses_insert_own" ON public.statuses;
CREATE POLICY "statuses_insert_own" ON public.statuses
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Un utilisateur peut supprimer uniquement ses propres statuts
DROP POLICY IF EXISTS "statuses_delete_own" ON public.statuses;
CREATE POLICY "statuses_delete_own" ON public.statuses
FOR DELETE TO authenticated
USING (user_id = auth.uid());
```

---

## 3. Table `status_views`

```sql
CREATE TABLE IF NOT EXISTS public.status_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id   uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  viewer_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (status_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS status_views_status_idx ON public.status_views(status_id);
CREATE INDEX IF NOT EXISTS status_views_viewer_idx ON public.status_views(viewer_id);

ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;

-- Le viewer peut enregistrer sa propre vue
DROP POLICY IF EXISTS "status_views_insert_own" ON public.status_views;
CREATE POLICY "status_views_insert_own" ON public.status_views
FOR INSERT TO authenticated
WITH CHECK (viewer_id = auth.uid());

-- Un utilisateur peut voir ses propres vues + le propriétaire du statut peut voir toutes les vues
DROP POLICY IF EXISTS "status_views_select" ON public.status_views;
CREATE POLICY "status_views_select" ON public.status_views
FOR SELECT TO authenticated
USING (
  viewer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.statuses s
    WHERE s.id = status_views.status_id AND s.user_id = auth.uid()
  )
);
```

---

## 4. Nettoyage automatique (optionnel)

La logique de filtrage `expires_at > now()` dans les RLS fait déjà que les
statuts expirés ne sont plus visibles. Pour réellement supprimer les lignes
et les fichiers, vous pouvez programmer un Cron Supabase :

```sql
-- Supprime les statuts et les vues liées après expiration
CREATE OR REPLACE FUNCTION public.cleanup_expired_statuses()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.statuses WHERE expires_at <= now();
END;
$$;
```

Puis dans Dashboard → Database → Cron Jobs, créer un job quotidien :
```
SELECT public.cleanup_expired_statuses();
```

---

## 5. Vérification

Après exécution, vérifier :
- [ ] Bucket `statuses` existe et est public
- [ ] Policies `statuses_*` sur `storage.objects`
- [ ] Tables `statuses` et `status_views` créées
- [ ] RLS activée sur les 2 tables
- [ ] Pouvoir publier un statut depuis l'app LOBOKO

Si l'app affiche "table statuses introuvable" ou erreurs RLS, relancer le SQL ci-dessus.