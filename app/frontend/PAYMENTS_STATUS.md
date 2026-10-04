# Paiements LOBOKO

Le paiement en ligne n’est pas opérationnel. Aucun encaissement, conservation de fonds, versement ou remboursement automatique n’est assuré par LOBOKO.

La page de paiement informe les utilisateurs de cette indisponibilité. Les anciennes RPC `prepare_service_payment` et `complete_service_order` rejettent tout appel sans modifier les données, y compris depuis un ancien client. La seconde RPC associait auparavant la fin de mission à une libération fictive de fonds : ce parcours est donc suspendu. La création, l’acceptation, les contre-propositions et l’annulation des demandes restent disponibles.

Les écritures directes des utilisateurs dans `service_orders` sont interdites ; les RPC validées créent et modifient les commandes. Les anciens enregistrements de paiement sont conservés pour examen. Leur statut seul ne constitue pas une preuve de transaction réelle.

## Conditions de mise en service

- Choisir un prestataire et disposer du compte marchand, de sa documentation officielle et des accès de test puis de production. Netikash est mentionné dans l’ancien code, mais aucune intégration active n’est présente.
- Définir les devises, montants, commissions et règles de conversion côté serveur, ainsi que les fonctions réellement prises en charge par le prestataire.
- Initier les transactions côté serveur, avec des secrets exclusivement côté serveur, puis vérifier les confirmations du prestataire et traiter les notifications signées avec idempotence.
- Gérer les échecs, expirations, rapprochements, annulations et remboursements réellement confirmés. Ne proposer une conservation des fonds et leur libération que si ce fonctionnement est effectivement pris en charge.
- Tester tout le parcours en environnement de test avant d’ouvrir les paiements réels. Adapter l’aide aux garanties effectivement disponibles.

## Vérification

`supabase/tests/payment_availability.sql` vérifie dans une transaction annulée que les écritures directes sont bloquées, que la création/annulation/acceptation fonctionnent et que les RPC financières rejetées ne marquent aucune commande comme payée.
