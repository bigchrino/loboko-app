# Paiements et livraisons : préparation sans agrégateur

Aucun agrégateur n’a été choisi pour LOBOKO/CMB. Les encaissements, versements et remboursements restent désactivés dans toute l’application.

## Ce qui est préparé

- Contrat commun de paiement pour produits, services, abonnements et publicités.
- Commandes produits avec réservation/annulation du stock.
- Registres de paiements, identifiants de transaction, montants et devises côté serveur.
- Confirmation de paiement réservée au serveur, sans accès d’écriture pour le client.
- Suivi de livraison : préparation, expédition et livraison ; transporteur, numéro/lien de suivi, date prévue et historique.
- Contrôles d’accès acheteur/vendeur et protection contre les confirmations en double.

Le paiement reste indisponible tant qu’un adaptateur serveur n’est pas raccordé. Le navigateur ne redirige vers aucun fournisseur et ne crée aucune tentative de paiement.

## Raccordement futur

Après le choix du partenaire :

1. Implémenter l’adaptateur serveur d’après sa documentation officielle : initiation, vérification, notifications et erreurs.
2. Définir les devises, conversions, frais, commissions et le processus de reversement aux vendeurs.
3. Ajouter ses secrets exclusivement côté serveur.
4. Vérifier les confirmations réelles, l’idempotence, les échecs, expirations et remboursements.
5. Valider le parcours en test, puis autoriser les paiements côté serveur et interface.

La configuration serveur `payment_gateway_configuration` est désactivée et son fournisseur est vide. Elle ne contient aucune clé privée. Changer ce seul réglage ne raccorde pas un agrégateur : un adaptateur vérifié est obligatoire.

## Livraisons

Le suivi est conservé pour le futur parcours payé. Le vendeur met les étapes à jour manuellement ; la connexion à un transporteur pourra être ajoutée plus tard. Le mode, l’adresse et les frais de livraison restent à définir avec le vendeur.

## Compatibilité et historique

Les anciens points d’entrée spécifiques au fournisseur provisoire sont rendus inactifs et exigent un JWT. Ils ne font aucun appel externe ni aucune écriture financière, même si une ancienne version du navigateur les appelle. Les migrations historiques sont conservées ; une nouvelle migration retire les anciennes fonctions de paiement spécifiques et prépare les fonctions génériques.

Le test SQL `supabase/tests/product_payments_delivery.sql` valide les gardes dans une transaction annulée. Il ne simule aucun encaissement persistant.
