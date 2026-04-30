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

### Phase 7 - Messages éphémères (auto-suppression)
- [x] Créer `EPHEMERAL_MESSAGES_SETUP.md` (ALTER `messages`/`group_messages`, table `conversation_settings`, fonction `cleanup_expired_messages`, cron)
- [x] Créer `src/lib/ephemeral.ts` - helpers durations, expiresAt, load/set settings (DM + groupe)
- [x] Créer `src/components/EphemeralSettingsDialog.tsx` - dialog de choix de durée (Off / 24h / 7j / 30j)
- [x] Mettre à jour `src/components/ConversationMenu.tsx` - action "Messages éphémères" avec hint
- [x] Mettre à jour `src/pages/Messages.tsx` - load/set duration DM, filtre expirés, expires_at à l'envoi, bannière + icône ⏳
- [x] Mettre à jour `src/lib/group-helpers.ts` - champs `expires_at`/`is_ephemeral`, paramètre `expiresAt` dans `sendGroupMessage`
- [x] Mettre à jour `src/pages/GroupChat.tsx` - menu groupe, dialog, filtre expirés, expires_at pour texte/voix/média, bannière + icône ⏳
- [x] Run `pnpm run lint`
- [x] Run `pnpm run build`

### Phase 8 - Envoi de documents (PDF, Word, Excel, ZIP)
- [x] Créer `DOCUMENTS_SETUP.md` (bucket `message-documents` + RLS, limite 25 Mo)
- [x] Ajouter `FilePayload` (`kind: 'file'`) dans `src/lib/message-format.ts`
- [x] Ajouter `'message-documents'` (25 Mo) dans `src/lib/storage-helpers.ts`
- [x] Créer `src/lib/file-helpers.ts` - `formatFileSize`, `fileTypeLabel`, `extensionOf`
- [x] Créer `src/components/FilePicker.tsx` - sélecteur avec validation (ext, taille, blocked types)
- [x] Créer `src/components/FilePreview.tsx` - prévisualisation avant envoi
- [x] Créer `src/components/FileMessage.tsx` - bulle document (icône + nom + taille + ouvrir)
- [x] Intégrer dans `src/pages/Messages.tsx` (DM) - preview, send, render, preview liste + reply
- [x] Intégrer dans `src/pages/GroupChat.tsx` (groupes) - preview, send, render, reply
- [x] Mettre à jour `src/contexts/MessagesContext.tsx` - compter fichiers dans unread
- [x] Run `pnpm run lint`

### Phase 9 - Sécurisation des documents (bucket privé + signed URLs)
- [x] Passer `message-documents` en bucket **privé** (DOCUMENTS_SETUP.md mis à jour)
- [x] RLS `SELECT` restreinte aux participants (DM sender/receiver, membre du groupe, uploader)
- [x] Ajouter `getSignedStorageUrl` (TTL 60s) dans `src/lib/storage-helpers.ts`
- [x] Marquer `message-documents` comme `PRIVATE_BUCKETS` dans `getMediaUrl` (retourne null)
- [x] `FileMessage.tsx` : ne génère plus l'URL au render, uniquement au clic, avec spinner
- [x] Validation MIME stricte dans `FilePicker.tsx` (allow-list + MIME prefixes bloqués)
- [x] Run `pnpm run lint`

### Phase 10 - Vrai téléchargement des documents (blob + fallback iOS)
- [x] `FileMessage.tsx` : fetch signed URL → Blob → `<a download>` pour forcer le téléchargement
- [x] Fallback iOS/iPadOS : `window.open` nouvel onglet + toast "Maintenez pour enregistrer"
- [x] États UI : idle (icône) / loading (spinner + "Téléchargement…") / done (check) / error
- [x] Fallback secondaire : `<a download target="_blank">` si le fetch Blob échoue (CORS)
- [x] Signed URL générée uniquement au clic (non au render) — TTL 60s conservé
- [x] Run `pnpm run lint`

### Phase 11 - Performance réseau faible
- [x] Créer `src/utils/mediaCompression.ts` - compressImage (≤1920px, qualité 0.82) + checkVideoSize (cap 50 Mo)
- [x] Créer `src/components/LazyMedia.tsx` - IntersectionObserver, charge les médias seulement quand visibles
- [x] `MediaMessage.tsx` : wrap dans LazyMedia, resolve URL au moment de la visibilité, `decoding="async"`
- [x] `MediaPicker.tsx` : hard cap vidéo avant décodage + compression image avant preview/send
- [x] `storage-helpers.ts` : auto-compression images dans `uploadMediaEx` (posts, avatars, statuses, groupes)
- [x] Run `pnpm run lint`
- [x] Run `pnpm run build`

### Phase 12 - Pagination progressive des messages (DM + groupes)
- [x] Créer `src/lib/message-pagination.ts` - helpers cursor-based (DM + groupes) + `mergeMessagesById`
- [x] Créer `src/components/LoadOlderTrigger.tsx` - loader haut + IntersectionObserver auto-load
- [x] `Messages.tsx` DM : réduire snapshot global de 400 → 80, store paginé `activeConvMessages` séparé
- [x] `Messages.tsx` DM : premier chargement = 40 derniers messages via `loadLatestDMPage`
- [x] `Messages.tsx` DM : scroll-up charge page suivante via `loadOlderDMPage` (cursor `created_at`)
- [x] `Messages.tsx` DM : merge des nouveaux messages temps réel (polling) sans écraser les anciennes pages
- [x] `Messages.tsx` DM : préservation du scroll après prepend + auto-scroll bas uniquement si l'utilisateur y est
- [x] `GroupChat.tsx` : premier chargement 40 messages (au lieu de 300)
- [x] `GroupChat.tsx` : scroll-up charge page suivante, merge par id, scroll preservé
- [x] `GroupChat.tsx` : polling 15s + tous les `sendGroupMessage` utilisent `mergeMessagesById` (ne discardent plus les anciennes pages)
- [x] `GroupChat.tsx` : delete-for-everyone patche localement + merge (reste cohérent avec les vieilles pages)
- [x] Run `pnpm run lint`
- [x] Run `pnpm run build`