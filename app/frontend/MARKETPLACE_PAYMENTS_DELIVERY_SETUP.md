# Paiements produits et suivi de livraison LOBOKO

## État

Le parcours CinetPay Mobile Money est intégré côté serveur et interface. Son activation commerciale exige un compte marchand CinetPay autorisé en CDF, ses clés et un taux USD/CDF configuré. Aucun encaissement réel ne doit être annoncé avant ces réglages et une validation complète avec le fournisseur.

Les commandes de services gardent leur fonctionnement actuel. Cette intégration concerne les produits du Marketplace.

## Secrets Supabase Edge Functions

Dans le projet Supabase, ouvrir **Edge Functions → Secrets** et ajouter :

| Nom | Valeur attendue |
| --- | --- |
| `CINETPAY_API_KEY` | Clé API privée du compte marchand CinetPay |
| `CINETPAY_SITE_ID` | Identifiant du site marchand CinetPay |
| `USD_CDF_RATE` | Taux commercial USD→CDF approuvé, nombre positif avec au plus 4 décimales |
| `LOBOKO_APP_URL` | `https://loboko-app.vercel.app` ou le futur domaine HTTPS |

Ne jamais mettre ces clés dans `VITE_*`, le navigateur, GitHub ou une conversation. Les clés Supabase serveur sont fournies automatiquement aux Edge Functions.

## Parcours

1. La commande réserve le stock côté base.
2. « Payer par Mobile Money » ouvre le guichet hébergé CinetPay.
3. Le montant USD est converti au taux configuré puis arrondi au multiple de 5 CDF supérieur exigé par CinetPay. Le taux et le montant sont enregistrés pour cette tentative.
4. CinetPay appelle `cinetpay-notify`. Ce point d’entrée est public afin de recevoir ses notifications ; il ignore le statut reçu et demande une vérification serveur au fournisseur.
5. Un paiement est confirmé uniquement si le fournisseur le déclare accepté et si son montant et sa devise correspondent à la commande. Le retour navigateur et « Vérifier le paiement » ne peuvent pas contourner cette vérification.
6. La même notification peut être reçue plusieurs fois sans dupliquer paiement ni livraison.

Un checkout en cours bloque l’annulation de la commande. Une erreur réseau ambiguë garde le paiement en attente de vérification, afin d’éviter un double encaissement. En cas d’incident non résolu, réconcilier la transaction avec le tableau de bord CinetPay avant toute annulation ou restitution de stock.

## Livraisons

Après paiement confirmé, le vendeur dispose du suivi : préparation → expédition → livraison. Il peut renseigner livreur/transporteur, numéro et lien de suivi, date prévue et information pour le client. Les étapes sont historisées et visibles uniquement par l’acheteur et le vendeur de la commande.

Le vendeur met ce suivi à jour manuellement. Il ne s’agit pas d’un suivi GPS ni d’une connexion automatique à un transporteur. L’adresse, le mode et les frais de livraison sont convenus avec le vendeur ; les frais de livraison ne sont pas inclus dans ce paiement d’articles.

## Fonds et remboursements

Les fonds sont encaissés par le compte marchand CinetPay configuré pour LOBOKO. La répartition automatique aux vendeurs, la mise sous séquestre et les remboursements automatiques ne sont pas inclus dans ce raccordement. Définir et valider le processus de reversement aux boutiques avec CinetPay avant d’ouvrir les encaissements au public. Tout remboursement doit être effectué par le canal marchand autorisé et réconcilié avec la commande ; aucun bouton ne simule un remboursement.

## Validation avant ouverture commerciale

- Confirmer avec CinetPay l’activation RDC/CDF et les moyens Mobile Money du compte.
- Vérifier le taux commercial, les frais du compte et le traitement des reversements/remboursements.
- Tester un paiement accepté, un refus, un abandon et le retour vers LOBOKO.
- Vérifier les callbacks en double et la réception sans retour du navigateur.
- Vérifier les étapes de livraison et les accès acheteur/vendeur avec deux comptes distincts.

Le test SQL `supabase/tests/product_payments_delivery.sql` vérifie les gardes de paiement et de livraison dans une transaction entièrement annulée. Il ne déclenche aucun appel ni encaissement auprès de CinetPay.
