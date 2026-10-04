# LOBOKO — Notifications push

LOBOKO utilise Web Push et VAPID. Le service worker `/sw.js` affiche les notifications hors de l’application et ouvre la conversation, la publication ou la demande concernée.

## Configuration en production

- Vercel, environnement Production : `VITE_VAPID_PUBLIC_KEY`.
- Supabase Vault : secret chiffré `loboko_web_push_config`, contenant `public_key`, `private_key` et `subject`.
- `subject` : `https://loboko-app.vercel.app` (à mettre à jour après l’acquisition du domaine).
- Fonction Edge `send-push`, avec vérification JWT et contrôle de session dans la fonction.

La clé publique Vercel correspond à celle de Vault. La clé privée reste exclusivement côté serveur ; elle ne doit jamais être mise dans Git, un fichier frontend ou une variable `VITE_*`.

Les migrations `push_delivery_configuration` et `push_delivery_service_policy` définissent deux RPC accessibles uniquement au rôle serveur `service_role` : lecture de la configuration et réservation d’une livraison. Les visiteurs et les membres ne peuvent appeler ni l’une ni l’autre. Les secrets eux-mêmes sont provisionnés hors des migrations, pour éviter leur présence dans l’historique Git.

Les secrets Edge `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` restent une alternative compatible. Si tous les trois sont renseignés, la fonction les utilise ; sinon, elle utilise Vault. Ne jamais changer de paire de clés sans prévoir la réinscription des appareils déjà abonnés.

## Activation sur un appareil

Dans **Paramètres → Notifications push**, choisir **Activer**, puis accepter la demande du navigateur. Le statut « Activées » nécessite à la fois un abonnement du navigateur et son enregistrement en base pour le compte courant.

Sur iPhone/iPad, installer LOBOKO sur l’écran d’accueil avant l’activation. Web Push nécessite iOS/iPadOS 16.4 ou plus récent et une application web installée. Sur Android, utiliser un navigateur compatible avec Web Push et autoriser ses notifications.

Le bouton **Envoyer une notification de test** envoie une notification uniquement au compte connecté. Il permet de vérifier le transport sans écrire de message dans une conversation.

## Protection de l’envoi

- Session vérifiée et comptes actifs obligatoires.
- Messages privés : message récent du demandeur au destinataire.
- Groupes : membres du même groupe et message récent réellement enregistré.
- Mentions : notification correspondante déjà enregistrée, sans divulguer le texte d’une conversation privée à un tiers.
- Urgences : demande récente créée par le client pour le prestataire destinataire.
- Titre, texte et destination déterminés côté serveur.
- Respect des blocages, des préférences et des mentions uniquement.
- Un événement ne peut être livré deux fois au même destinataire.
- Endpoints limités aux fournisseurs de push reconnus ; abonnements expirés 404/410 retirés.

## Vérifications

Depuis `app/frontend` :

```bash
npm run typecheck
npm run lint
npm run build
node --test supabase/tests/send_push.test.cjs supabase/tests/push_worker.test.cjs supabase/tests/push_subscription.test.cjs
```

Le fichier `supabase/tests/push_configuration.sql` vérifie les privilèges et les réservations de livraison dans une transaction annulée.

Test sur téléphone : activer les notifications, tester la réception, puis laisser LOBOKO en arrière-plan et recevoir un message depuis un second compte de test. Toucher la notification doit ouvrir la bonne conversation. Une conversation visible et au premier plan peut supprimer la notification correspondante ; une conversation en arrière-plan ne doit pas la supprimer.

Un déploiement réussi et les tests automatisés ne garantissent pas à eux seuls la réception système sur chaque appareil : l’autorisation du navigateur et les réglages du téléphone restent nécessaires.
