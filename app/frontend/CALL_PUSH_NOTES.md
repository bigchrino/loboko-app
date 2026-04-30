# Notifications d'appels — état actuel et pistes

## Ce qui est implémenté côté client (MVP)

1. **Historique des appels** — nouvelle page `/calls` (composant
   `src/pages/Calls.tsx`). Elle lit les événements `call_event` existants
   stockés dans la table `messages` (pas de nouvelle table requise) et
   affiche :
   - Direction (entrant / sortant / manqué / refusé)
   - Mode (vocal / vidéo)
   - Durée pour les appels terminés
   - Actions "Rappeler" et "Ouvrir la conversation"
   Des filtres `Tous / Manqués / Entrants / Sortants` sont disponibles.

2. **Notification système à la réception d'un appel** — `CallContext` :
   - Demande une seule fois la permission `Notification` après connexion.
   - Lorsque la page n'est pas visible et qu'un `call-invite` arrive, une
     notification système est envoyée ("Appel vocal/vidéo entrant").
   - Cliquer la notification ramène la fenêtre au premier plan ;
     l'interface d'acceptation reste gérée par `CallModal`.

3. **Voice notes** — améliorations livrées :
   - Waveform cliquable (seek) et barre de progression.
   - Affichage `temps écoulé / durée totale`.
   - Sélecteur de vitesse 1x / 1.5x / 2x.
   - Limite d'enregistrement centralisée
     (`src/lib/voice-config.ts::MAX_VOICE_NOTE_SECONDS`).
   - Messages d'erreur micro plus clairs (refus, absent, occupé).

## Limite connue du MVP

La Notification API fonctionne uniquement **quand l'onglet LOBOKO est
ouvert** (même en arrière-plan). Si le navigateur / l'application est
complètement fermé, aucune notification ne peut être déclenchée côté
client seul.

## Pour de vraies push notifications hors-ligne (optionnel)

Cela nécessite du backend :

1. Service Worker (`public/sw.js`) abonné aux Web Push.
2. Paire de clés **VAPID** (à générer avec `web-push`), clé publique
   injectée via `VITE_VAPID_PUBLIC_KEY`.
3. Table `push_subscriptions` (user_id, endpoint, keys) dans Supabase.
4. Edge Function qui, à chaque `call-invite`, envoie un push signé aux
   abonnements du destinataire.
5. Sur mobile Android (Chrome), cela fonctionne via FCM ; sur iOS, seule
   la Web Push standardisée (iOS 16.4+) est supportée et uniquement si
   l'utilisateur a "ajouté à l'écran d'accueil" la PWA.

Ces étapes sont hors scope du MVP. Le front est prêt à consommer
`VITE_VAPID_PUBLIC_KEY` dès qu'il sera fourni.