# LOBOKO — Setup base de données : profil prestataire + portfolio

Ce fichier contient le SQL à exécuter **une seule fois** dans l'éditeur SQL
Supabase. Le script est **idempotent** : vous pouvez le relancer sans casser
les comptes existants. Toutes les colonnes ajoutées ont une valeur par défaut
pour garder les comptes déjà créés parfaitement compatibles.

---

## 1. Colonnes manquantes sur `profiles`

```sql
-- Ville / localisation saisie par le prestataire (facultatif).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city text;

-- Disponibilité du prestataire pour de nouvelles missions.
-- 'available' (vert) ou 'unavailable' (rouge). Par défaut: available.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS availability_status text
  NOT NULL DEFAULT 'available';

-- Contrainte : uniquement 'available' ou 'unavailable'.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_availability_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_availability_status_check
      CHECK (availability_status IN ('available','unavailable'));
  END IF;
END $$;

-- Nombre de missions terminées (mis à jour par le backend le cas échéant).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS completed_jobs_count integer NOT NULL DEFAULT 0;

-- Badge "Vérifié" : géré par un admin (non exposé en édition utilisateur).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;
```

> Les comptes existants héritent automatiquement des valeurs par défaut
> (`availability_status='available'`, `completed_jobs_count=0`,
> `is_verified=false`). Aucun login n'est cassé.

---

## 2. Table `provider_portfolio`

```sql
CREATE TABLE IF NOT EXISTS public.provider_portfolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_key text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_portfolio_user_idx
  ON public.provider_portfolio(user_id);
CREATE INDEX IF NOT EXISTS provider_portfolio_user_created_idx
  ON public.provider_portfolio(user_id, created_at DESC);
```

### Limite 12 médias (trigger)

```sql
CREATE OR REPLACE FUNCTION public.provider_portfolio_enforce_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM public.provider_portfolio WHERE user_id = NEW.user_id) >= 12 THEN
    RAISE EXCEPTION 'Limite portfolio atteinte (12 médias maximum)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS provider_portfolio_limit_trg ON public.provider_portfolio;
CREATE TRIGGER provider_portfolio_limit_trg
  BEFORE INSERT ON public.provider_portfolio
  FOR EACH ROW EXECUTE FUNCTION public.provider_portfolio_enforce_limit();
```

### RLS — table `provider_portfolio`

La **lecture est publique pour la table d'index** (id, user_id, media_key,
media_type). Cela permet à n'importe quel visiteur de connaître la liste des
médias d'un prestataire et de demander ensuite une **signed URL** côté app.
Les fichiers eux-mêmes restent privés (cf. §3).

Si vous voulez verrouiller même la liste, remplacez la policy par un
`USING (auth.uid() IS NOT NULL)` pour n'autoriser que les utilisateurs
authentifiés.

```sql
ALTER TABLE public.provider_portfolio ENABLE ROW LEVEL SECURITY;

-- Lecture : tout le monde peut lister les médias d'un prestataire
-- (les fichiers réels restent protégés par le bucket privé + signed URL).
DROP POLICY IF EXISTS "portfolio_public_read" ON public.provider_portfolio;
CREATE POLICY "portfolio_public_read"
  ON public.provider_portfolio
  FOR SELECT
  USING (true);

-- Insertion : uniquement le propriétaire.
DROP POLICY IF EXISTS "portfolio_owner_insert" ON public.provider_portfolio;
CREATE POLICY "portfolio_owner_insert"
  ON public.provider_portfolio
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Suppression : uniquement le propriétaire.
DROP POLICY IF EXISTS "portfolio_owner_delete" ON public.provider_portfolio;
CREATE POLICY "portfolio_owner_delete"
  ON public.provider_portfolio
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

---

## 3. Bucket Storage `provider-portfolio` (PRIVÉ)

Le bucket est **privé** : les URLs publiques ne fonctionnent pas. L'app
génère une **signed URL** (durée courte) uniquement au moment de l'affichage.

```sql
-- Bucket privé (public = false). Les accès passent obligatoirement par
-- signed URL ou par client Supabase authentifié autorisé par RLS.
INSERT INTO storage.buckets (id, name, public)
VALUES ('provider-portfolio', 'provider-portfolio', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- IMPORTANT : supprimer toute ancienne policy de lecture publique
-- (héritée d'un essai précédent) avant de recréer la policy restrictive.
DROP POLICY IF EXISTS "portfolio_bucket_public_read" ON storage.objects;

-- Lecture directe via le client Supabase : uniquement le propriétaire
-- (chemin = <user_id>/...). Les autres visiteurs utilisent `createSignedUrl`.
DROP POLICY IF EXISTS "portfolio_bucket_owner_read" ON storage.objects;
CREATE POLICY "portfolio_bucket_owner_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'provider-portfolio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Upload : seulement dans son propre dossier user_id/...
DROP POLICY IF EXISTS "portfolio_bucket_owner_upload" ON storage.objects;
CREATE POLICY "portfolio_bucket_owner_upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'provider-portfolio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Suppression : seulement ses propres fichiers.
DROP POLICY IF EXISTS "portfolio_bucket_owner_delete" ON storage.objects;
CREATE POLICY "portfolio_bucket_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'provider-portfolio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

> Les visiteurs tiers (autres utilisateurs qui consultent un profil
> prestataire) **n'ont pas** d'accès direct au bucket. L'app appelle
> `supabase.storage.from('provider-portfolio').createSignedUrl(key, 60)` au
> moment de l'affichage, ce qui délivre une URL signée valable 60 secondes.

---

## Vérifications rapides

```sql
-- Colonnes présentes ?
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles'
  AND column_name IN ('city','availability_status','completed_jobs_count','is_verified');

-- Contrainte availability_status ?
SELECT conname FROM pg_constraint
WHERE conname = 'profiles_availability_status_check';

-- Table portfolio OK ?
SELECT count(*) FROM public.provider_portfolio;

-- Bucket privé ?
SELECT id, public FROM storage.buckets WHERE id='provider-portfolio';
-- public doit être = false
```

Tout le reste (avis, messages, groupes, appels, statuts, documents,
notifications push) reste inchangé.