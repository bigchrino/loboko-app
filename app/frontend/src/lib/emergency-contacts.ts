export type EmergencyCategory = 'hospital' | 'police' | 'fire';
export interface EmergencyContact {
  id: string;
  category: EmergencyCategory;
  name: string;
  country: 'CD';
  city: string;
  address?: string;
  phone: string;
  phoneLabel: string;
  callLabel: string;
  note: string;
  source: { name: string; url: string };
  sourceCheckedAt: string;
}

// Source pages consulted on this date; no test call was made to emergency lines.
// Keep geographic scope and general hospital contacts distinct from emergency lines.
const fcdoSource = {
  name: 'GOV.UK — FCDO',
  url: 'https://www.gov.uk/foreign-travel-advice/democratic-republic-of-the-congo/getting-help',
};
export const EMERGENCY_CONTACTS: readonly EmergencyContact[] = [
  {
    id: 'kinshasa-chu-cinquantenaire',
    category: 'hospital',
    name: 'CHU du Cinquantenaire',
    country: 'CD',
    city: 'Kinshasa',
    address: 'Avenue de la Libération, Kasa-Vubu',
    phone: '+243902720000',
    phoneLabel: '+243 902 720 000',
    callLabel: 'Appeler le contact général',
    note: 'Contact général publié par l’hôpital. Ce numéro n’est pas présenté comme une ligne d’ambulance.',
    source: { name: 'Site du CHU du Cinquantenaire', url: 'https://chu-cinquantenaire.cd/contact/' },
    sourceCheckedAt: '2026-10-04',
  },
  {
    id: 'kinshasa-police',
    category: 'police',
    name: 'Police — Kinshasa',
    country: 'CD',
    city: 'Kinshasa',
    phone: '112',
    phoneLabel: '112',
    callLabel: 'Appeler la police',
    note: 'Numéro documenté pour Kinshasa. Sa disponibilité dans les autres villes n’est pas confirmée ici.',
    source: fcdoSource,
    sourceCheckedAt: '2026-10-04',
  },
  {
    id: 'kinshasa-fire',
    category: 'fire',
    name: 'Pompiers — Kinshasa',
    country: 'CD',
    city: 'Kinshasa',
    phone: '118',
    phoneLabel: '118',
    callLabel: 'Appeler les pompiers',
    note: 'Numéro documenté pour Kinshasa. Sa disponibilité dans les autres villes n’est pas confirmée ici.',
    source: fcdoSource,
    sourceCheckedAt: '2026-10-04',
  },
];
