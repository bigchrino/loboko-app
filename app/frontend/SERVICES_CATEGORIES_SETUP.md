# Services Categories Setup

Ce script crée un **système de catégories de services officiel** pour LOBOKO.

Les prestataires ne peuvent plus écrire librement leur métier : ils doivent
choisir une catégorie existante dans cette table.

> ⚠️ À exécuter **une seule fois** dans le SQL Editor de Supabase.
> Idempotent : peut être relancé sans casser les données existantes.

---

## 1. Table `services_categories`

```sql
-- Table principale des catégories de services
CREATE TABLE IF NOT EXISTS public.services_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  icon        text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS services_categories_slug_idx
  ON public.services_categories (slug);
CREATE INDEX IF NOT EXISTS services_categories_active_idx
  ON public.services_categories (is_active);
```

## 2. RLS (Row Level Security)

Tout le monde peut lire les catégories actives. Les écritures sont réservées
aux administrateurs (future évolution : pour l'instant, on insère via SQL).

```sql
ALTER TABLE public.services_categories ENABLE ROW LEVEL SECURITY;

-- Lecture publique (catégories actives)
DROP POLICY IF EXISTS services_categories_read ON public.services_categories;
CREATE POLICY services_categories_read
  ON public.services_categories
  FOR SELECT
  USING (is_active = true);
```

## 3. Ajout de `service_category_id` dans `profiles`

On ajoute une colonne optionnelle qui lie un profil prestataire à sa
catégorie officielle. L'ancien champ `metier` (texte libre) reste en base
pour garder un fallback d'affichage pour les comptes historiques.

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS service_category_id uuid
  REFERENCES public.services_categories (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_service_category_idx
  ON public.profiles (service_category_id);
```

## 4. Données de base (catégories officielles)

Insertion idempotente (ON CONFLICT sur `slug`).

```sql
INSERT INTO public.services_categories (name, slug, description, icon) VALUES
  ('Électricien',                'electricien',            'Installations et dépannage électriques',           'Zap'),
  ('Plombier',                   'plombier',               'Plomberie, fuites, sanitaires',                     'Wrench'),
  ('Coiffeur',                   'coiffeur',               'Coupe, coiffure, soins capillaires',                'Scissors'),
  ('Mécanicien',                 'mecanicien',             'Réparation et entretien de véhicules',              'Car'),
  ('Réparateur téléphone',       'reparateur-telephone',   'Réparation de smartphones et tablettes',            'Smartphone'),
  ('Réparateur ordinateur',      'reparateur-ordinateur',  'Réparation PC et portables',                        'Laptop'),
  ('Développeur web',            'developpeur-web',        'Création de sites et applications web',             'Code'),
  ('Développeur mobile',         'developpeur-mobile',     'Applications Android et iOS',                       'Smartphone'),
  ('Graphiste',                  'graphiste',              'Design graphique, identité visuelle',               'Palette'),
  ('Menuisier',                  'menuisier',              'Travail du bois, meubles, portes',                  'Hammer'),
  ('Maçon',                      'macon',                  'Construction, briquetage, finition',                'Hammer'),
  ('Peintre',                    'peintre',                'Peinture intérieure et extérieure',                 'Paintbrush'),
  ('Nettoyage / ménage',         'nettoyage-menage',       'Ménage domestique et nettoyage pro',                'Sparkles'),
  ('Cuisinier',                  'cuisinier',              'Cuisine à domicile, événements',                    'ChefHat'),
  ('Chauffeur',                  'chauffeur',              'Chauffeur privé, livraison',                        'Car'),
  ('Jardinier',                  'jardinier',              'Entretien jardin, espaces verts',                   'Leaf'),
  ('Couturier',                  'couturier',              'Couture, retouches, confection',                    'Scissors'),
  ('Photographe',                'photographe',            'Photo professionnelle, événements',                 'Camera'),
  ('Vidéaste',                   'videaste',               'Vidéo, montage, production',                        'Video'),
  ('Professeur / répétiteur',    'professeur',             'Cours particuliers, soutien scolaire',              'BookOpen'),
  ('Technicien froid / climatisation', 'technicien-froid','Climatisation et réfrigération',                    'Snowflake'),
  ('Serrurier',                  'serrurier',              'Serrurerie, dépannage, ouverture de portes',        'Key'),
  ('Soudeur',                    'soudeur',                'Soudure métallique, ferronnerie',                   'Flame'),
  ('Décorateur',                 'decorateur',             'Décoration intérieure, événementiel',               'Sparkles'),
  ('Agent de sécurité',          'agent-securite',         'Gardiennage, sécurité privée',                      'Shield')
ON CONFLICT (slug) DO NOTHING;
```

## 5. Vérification

```sql
-- Nombre de catégories actives
SELECT count(*) FROM public.services_categories WHERE is_active = true;

-- Lister les catégories
SELECT name, slug FROM public.services_categories ORDER BY name;
```

---

## Compatibilité

- Les prestataires **existants** conservent leur ancien champ `metier`
  (texte libre). Le front affiche ce texte en **fallback** tant que
  `service_category_id` n'est pas défini.
- À la prochaine édition de leur profil, ils devront choisir une catégorie
  officielle.
- Aucun changement destructif : messages, groupes, appels, posts, statuts,
  commentaires et ratings ne sont pas affectés.