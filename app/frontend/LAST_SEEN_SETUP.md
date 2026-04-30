# Last Seen Setup (profiles.last_seen_at)

Ce setup ajoute la colonne `last_seen_at` à la table `profiles` afin d'afficher
le statut d'activité des utilisateurs ("En ligne", "Vu il y a 5 min", "Vu
aujourd'hui à HH:mm", "Vu hier à HH:mm", "Vu le JJ/MM/AAAA").

Exécuter ce SQL dans l'éditeur SQL Supabase du projet (une seule fois).

```sql
BEGIN;

-- 1. Ajouter la colonne si elle n'existe pas
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- 2. Index pour trier/chercher par dernière activité
CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx
  ON public.profiles (last_seen_at DESC);

-- 3. Policy: chaque utilisateur peut mettre à jour sa propre ligne
--    (incluant last_seen_at). Si une policy équivalente existe déjà,
--    le CREATE POLICY peut échouer: l'ignorer.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_update_own_last_seen'
  ) THEN
    CREATE POLICY "profiles_update_own_last_seen"
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

COMMIT;
```

Après exécution, le frontend met à jour `last_seen_at` automatiquement pour
l'utilisateur connecté (throttle ~30s, également au focus de la fenêtre et
périodiquement).