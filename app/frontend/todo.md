# LOBOKO — Plan de travail

## Phase actuelle : Profil prestataire enrichi + Recherche avancée

### Development Tasks
- [x] SQL idempotent : colonnes `city`, `availability_status` (CHECK), `completed_jobs_count`, `is_verified` sur `profiles`
- [x] SQL idempotent : table `provider_portfolio` (limite 12 via trigger) + RLS propriétaire
- [x] Bucket `provider-portfolio` PRIVÉ (public=false) + policies lecture propriétaire / upload owner / delete owner, suppression de toute policy de lecture publique
- [x] Étendre le type `Profile` dans AuthContext (city, availability_status, completed_jobs_count, is_verified)
- [x] Helpers `src/lib/provider-portfolio.ts` : fetch, add, delete, count, `getPortfolioSignedUrl` (signed URL 60s au rendu)
- [x] Composant `PortfolioMedia` : signed URL lazy, refresh auto avant expiration
- [x] Composant `PortfolioEditor` : upload multi-fichiers + grille + suppression (propriétaire)
- [x] Composant `PortfolioGallery` : lecture seule + lightbox (signed URL à l'ouverture)
- [x] `Profile.tsx` : champ ville + switch disponibilité + intégration du PortfolioEditor + badges (note, ville, missions, vérifié)
- [x] `UserProfile.tsx` : badges disponibilité / ville / missions / vérifié + `PortfolioGallery`
- [x] `service-categories.ts` : `fetchProviders` (filtre catégorie/ville/available/verified)
- [x] `ProvidersByCategory.tsx` : recherche avancée (ville, disponibilité, vérifié) + tri (récent / meilleure note / plus de missions)
- [x] Report flow pour messages de groupe (`GroupChat.tsx` + `ReportDialog`)
- [x] Lint + build final

### Sécurité
- Bucket privé : aucune URL publique ; toutes les lectures passent par `createSignedUrl` (60 s par défaut, 120 s pour le lightbox).
- RLS `provider_portfolio` : SELECT public sur la table d'index uniquement (les fichiers restent protégés côté storage) ; INSERT/DELETE propriétaire uniquement.
- RLS `storage.objects` : lecture directe autorisée uniquement au propriétaire ; les visiteurs tiers utilisent la signed URL.
- Contrainte `CHECK (availability_status IN ('available','unavailable'))` + défaut `available`.
- Rien n'est modifié dans les systèmes existants (messages, documents, push, groupes, appels, statuts, avis).

### Setup requis (manuel Supabase)
Exécuter une fois `PROVIDER_PROFILE_SETUP.md` dans l'éditeur SQL Supabase.