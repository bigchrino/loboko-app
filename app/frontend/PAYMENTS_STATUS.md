# Paiements LOBOKO

Aucun agrégateur n’a encore été choisi pour LOBOKO/CMB. Les parcours de paiement sont préparés, mais les encaissements, versements, remboursements automatiques et la conservation des fonds restent indisponibles dans toute l’application.

Le contrat commun de l’interface couvre produits, services, abonnements et publicités. Les commandes et registres existants sont conservés. Aucun statut enregistré ne constitue à lui seul une preuve d’encaissement réel.

## Produits Marketplace

Les montants et devises n’imposent aucun fournisseur ni taux de conversion. Les fonctions de création et confirmation de paiement sont réservées au serveur et bloquées tant que la configuration de paiement est désactivée. Le suivi de livraison est préparé et protégé par les droits acheteur/vendeur.

Voir [MARKETPLACE_PAYMENTS_DELIVERY_SETUP.md](./MARKETPLACE_PAYMENTS_DELIVERY_SETUP.md) pour le raccordement futur.

## Services

Les RPC `prepare_service_payment` et `complete_service_order` restent bloquées afin d’empêcher les anciennes simulations financières. La création, l’acceptation, les contre-propositions et l’annulation des demandes restent disponibles. Les écritures directes des utilisateurs dans `service_orders` sont interdites.

## Activation future

Choisir l’agrégateur, implémenter son adaptateur serveur, définir les devises/frais/reversements, configurer les secrets serveur et tester les confirmations réelles avant activation. Les garanties affichées devront correspondre aux fonctions réellement prises en charge par le partenaire.
