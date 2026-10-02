# LOBOKO Frontend

Frontend web de LOBOKO, construit avec React, TypeScript, Vite, Tailwind CSS et shadcn/ui.

## Développement

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Structure principale

- `src/main.tsx` : point d'entrée React
- `src/App.tsx` : routes principales
- `src/pages/` : pages de l'application
- `src/components/` : composants réutilisables
- `src/lib/` : services et utilitaires
- `public/` : ressources statiques
- `supabase/` : migrations et fonctions Supabase

## Configuration

Les variables publiques du frontend utilisent le préfixe `VITE_`. Les secrets serveur, notamment les clés de service Supabase, ne doivent jamais être ajoutés au bundle frontend.
