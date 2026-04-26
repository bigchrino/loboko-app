# LOBOKO - Plan de développement MVP

## Design (inspiré du dossier uploadé)
- **Palette de couleurs** :
  - Background primary: `#0a0a0a`
  - Surface: `#1a1a1a`
  - Surface hover: `#252525`
  - Elevated: `#111111`
  - Border: `#2a2a2a`
  - Accent (violet): `#8b5cf6` / hover `#7c3aed` / light `rgba(139, 92, 246, 0.15)`
  - Text primary: `#ffffff`, secondary: `#a0a0a0`, muted: `#666666`
- **Typographie** : Inter (Google Fonts), 300-700
- **Style** : Mobile-first, thème sombre par défaut, navbar en bas (mobile) / sidebar (desktop ≥ 1024px)
- **Radius** : 8/12/16/20px, full pour buttons pills
- **Thème clair/sombre** : Toggle persistant (localStorage)

## Backend - Tables Atoms Cloud
- `profiles` : id, user_id, username, bio, metier, avatar_key, role (client/prestataire), theme
- `posts` : id, user_id, content, image_key, likes_count, comments_count
- `likes` : id, user_id, post_id
- `comments` : id, user_id, post_id, content
- `messages` : id, sender_id, receiver_id, content, read
- `notifications` : id, user_id, type, from_user_id, post_id, message, read

## Images à générer (4)
- `hero-login.jpg` : Image d'accueil style réseau social congolais moderne
- `avatar-default.png` : Avatar par défaut stylisé
- `empty-feed.png` : Illustration feed vide
- `empty-messages.png` : Illustration messages vides

## Development Tasks

### Phase 1 - Setup & Backend
- [x] Créer les tables backend (profiles, posts, likes, comments, messages, notifications)
- [x] Créer le bucket ObjectStorage "loboko-media" pour avatars et images de posts

### Phase 2 - Core Frontend
- [x] Créer `src/contexts/AuthContext.tsx` - gestion auth + profil
- [x] Créer `src/contexts/ThemeContext.tsx` - thème clair/sombre
- [x] Créer `src/lib/atoms-client.ts` - client web-sdk
- [x] Créer `src/components/Layout.tsx` - layout avec navbar bas/sidebar + protection routes
- [x] Créer `src/pages/OnboardingProfile.tsx` - création profil + choix rôle
- [x] Modifier `src/App.tsx` - routes protégées + providers

### Phase 3 - Pages principales
- [x] Créer `src/pages/Home.tsx` - fil d'actualité (Accueil)
- [x] Créer `src/pages/Discover.tsx` - découverte prestataires
- [x] Créer `src/pages/Messages.tsx` - liste + chat temps réel
- [x] Créer `src/pages/Profile.tsx` - profil + édition + upload avatar
- [x] Créer `src/pages/Notifications.tsx` - notifications
- [x] Créer `src/pages/Settings.tsx` - paramètres + thème + déconnexion

### Phase 4 - Finalisation
- [x] Mettre à jour `src/pages/Index.tsx` (landing + redirect si connecté)
- [x] Ajouter styles globaux dans `src/index.css`
- [x] Run `pnpm run lint`
- [x] Run `pnpm run build`
- [x] CheckUI final