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

### Phase 5 - Messagerie enrichie (emojis, notes vocales, appels)
- [x] Créer `src/components/EmojiPicker.tsx` - sélecteur d'emojis simple et léger
- [x] Créer `src/components/VoiceRecorder.tsx` - enregistrement audio (MediaRecorder API)
- [x] Créer `src/components/VoiceMessage.tsx` - lecteur audio pour notes vocales
- [x] Créer `src/components/CallModal.tsx` - interface d'appel vocal/vidéo plein écran (WebRTC)
- [x] Créer `src/lib/message-format.ts` - helpers pour encoder/décoder les messages (texte/audio/call)
- [x] Mettre à jour `src/pages/Messages.tsx` - intégrer emoji picker, voice recorder, boutons d'appel
- [x] Run `pnpm run lint`
- [x] Run `pnpm run build`

### Phase 6 - Catégories officielles de services
- [x] Créer `SERVICES_CATEGORIES_SETUP.md` (table `services_categories`, RLS, seed, colonne `profiles.service_category_id`)
- [x] Créer `src/lib/service-categories.ts` - helpers (fetch, counts, providers by category)
- [x] Créer `src/components/ServiceCategorySelect.tsx` - autocomplete obligatoire depuis le catalogue
- [x] Mettre à jour `src/pages/Index.tsx` (inscription) - remplacer le champ libre par le select
- [x] Mettre à jour `src/pages/OnboardingProfile.tsx` - select officiel obligatoire pour prestataire
- [x] Mettre à jour `src/pages/Profile.tsx` - édition via select, fallback legacy `metier`
- [x] Mettre à jour `src/contexts/AuthContext.tsx` - `service_category_id` dans Profile + createLobokoProfile
- [x] Créer `src/pages/FindProviders.tsx` - grille de catégories avec compteurs
- [x] Créer `src/pages/ProvidersByCategory.tsx` - liste + recherche + filtre note
- [x] Router `/find` et `/services/:slug` dans `src/App.tsx`
- [x] Wire "Trouver un prestataire" dans `HeroBanner` (via Home.tsx → /find)
- [x] Wire "Voir" dans `AdsCarousel` → `/services/:slug`
- [x] Run `pnpm run lint`
- [x] Run `pnpm run build`