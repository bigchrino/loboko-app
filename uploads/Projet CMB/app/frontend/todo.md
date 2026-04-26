# LOBOKO - Migration React + TypeScript + Tailwind CSS

## Design Guidelines

### Design References
- Original LOBOKO HTML app (dark theme, mobile-first, Boo App inspired)
- Modern mobile social/service platform aesthetic

### Color Palette
- Primary Background: #0a0a0a (Deep Black)
- Surface: #1a1a1a (Dark Surface)
- Surface Hover: #252525
- Border: #2a2a2a
- Accent: #8b5cf6 (Purple)
- Accent Hover: #7c3aed
- Text Primary: #ffffff
- Text Secondary: #a0a0a0
- Text Muted: #666666
- Danger: #ef4444

### Typography
- Font: Inter (Google Fonts)
- Headings: 700 weight
- Body: 400-500 weight

### Key Component Styles
- Cards: Dark surface, 1px border, 16px rounded, hover lift
- Buttons: Purple accent, white text, 12px rounded
- Bottom navbar: Fixed, blur backdrop, scrollable tabs
- Stories: Horizontal scroll, gradient avatars

---

## Development Tasks

### 1. Setup React + Vite + TypeScript + Tailwind
- Convert package.json to React project
- Add vite config for React
- Setup Tailwind CSS with custom theme matching LOBOKO colors
- Setup React Router for multi-page navigation

### 2. Core Layout Components (src/components/Layout.tsx)
- AppHeader: Logo, theme toggle, profile link
- BottomNavbar: Tab navigation with notification badge
- Layout wrapper with header + navbar + content area
- Theme toggle (dark/light) with localStorage persistence

### 3. Homepage (src/pages/Accueil.tsx)
- Stories horizontal scroll
- Welcome banner with gradient
- Quick categories grid (8 categories)
- News feed with post cards (like, comment, share, save)

### 4. Auth Pages (src/pages/Login.tsx, src/pages/Register.tsx)
- Login form with username/phone + password
- Registration form with account type selection (Client/Prestataire)
- Theme toggle on auth pages

### 5. Messages & Chat (src/pages/Messages.tsx, src/pages/Chat.tsx)
- Message list with avatars, previews, timestamps
- Interactive chat with bubbles, emoji picker, typing indicator
- Auto-reply simulation, voice/image message simulation

### 6. Secondary Pages
- Decouverte, Suggestion, Notifications, Panier, Recherches
- Entreprise (with sub-pages Offres, Musala)
- Urgences (with sub-pages Hopitaux, Polices, Casernes)
- Profil, Menu (with logout modal)

### 7. Global Styles & Animations
- Page transitions (fade slide in/out)
- Card staggered animations
- Theme switching with smooth transitions
- Responsive: mobile-first, desktop sidebar nav at 1024px+

### 8. Build & Test
- Run lint and build
- CheckUI validation

## Files to Create (8 max)
1. `src/main.tsx` - Entry point with router
2. `src/App.tsx` - App with routes
3. `src/components/Layout.tsx` - Header, Navbar, Theme toggle
4. `src/pages/Accueil.tsx` - Homepage with stories, feed
5. `src/pages/Auth.tsx` - Login + Register pages
6. `src/pages/Chat.tsx` - Messages list + Chat page
7. `src/pages/Secondary.tsx` - All secondary pages (Decouverte, Suggestion, etc.)
8. `src/index.css` - Global styles with Tailwind + custom CSS