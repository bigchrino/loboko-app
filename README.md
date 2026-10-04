# LOBOKO

Plateforme de mise en relation et de services en RDC : découverte de prestataires, publications, messagerie, groupes, appels et marketplace.

## Structure

- `app/frontend/` : application web React, TypeScript et Vite, déployée sur Vercel.
- `app/frontend/supabase/` : migrations, fonctions Edge et vérifications de la base.
- `app/backend/` : API FastAPI historique, distincte du backend Supabase utilisé par l’application web.
- `assets/` et `uploads/` : ressources conservées du projet.
- `supabase_schema.sql` : référence historique du schéma ; consulter les migrations pour les évolutions suivantes.

## Développement

Depuis `app/frontend/` :

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm run dev
```

Renseigner l’URL Supabase et la clé publique dans `.env.local`. Les secrets serveur ne doivent pas être inclus dans les variables `VITE_` ni versionnés.

```bash
pnpm run typecheck
pnpm run lint
pnpm run build
```

Le fichier `pnpm-lock.yaml` fixe les versions des dépendances. Les instructions propres aux fonctionnalités se trouvent dans les documents de `app/frontend/`.

## Services externes

Supabase assure l’authentification, la base de données, le stockage et le temps réel. Les appels utilisent WebRTC ; la configuration TURN figure dans `.env.example`. La configuration des notifications est décrite dans `PUSH_NOTIFICATIONS_SETUP.md`.

Les paiements en ligne sont préparés mais désactivés jusqu’au choix et au raccordement d’un agrégateur. Voir `PAYMENTS_STATUS.md` et `MARKETPLACE_PAYMENTS_DELIVERY_SETUP.md`.

## Compatibilité

Avant de retirer une partie de l’API historique, vérifier ses consommateurs et son déploiement. Ses noms de colonnes historiques sont conservés pour éviter une rupture de compatibilité avec les bases existantes.
