# LOBOKO Backend

Backend historique de LOBOKO basé sur FastAPI.

## Démarrage local

Installez les dépendances Python du backend, configurez les variables d'environnement nécessaires, puis lancez l'application FastAPI depuis ce dossier.

Le point d'entrée principal est `main.py`. L'API expose également un endpoint `/health` pour les vérifications de disponibilité.

## Structure

- `routers/` : routes HTTP
- `models/` : modèles de données
- `schemas/` : schémas de validation
- `services/` : logique métier et intégrations
- `alembic/` : migrations du backend historique

## Architecture actuelle

Le frontend LOBOKO utilise principalement Supabase pour l'authentification, les données, le stockage, le temps réel et les fonctions Edge. Avant de modifier ou supprimer une partie de ce backend historique, vérifiez qu'aucune route frontend ou infrastructure de déploiement ne l'utilise encore.
