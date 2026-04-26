import Layout from '@/components/Layout';
import { Hospital, Phone, MapPin } from 'lucide-react';

const hopitaux = [
  { nom: 'Hôpital Général de Référence', ville: 'Kinshasa', tel: '+243 81 000 0001' },
  { nom: 'CHU Brazzaville', ville: 'Brazzaville', tel: '+242 06 000 0002' },
  { nom: 'Hôpital Adolphe Sicé', ville: 'Pointe-Noire', tel: '+242 05 000 0003' },
];

export default function UrgencesHopitaux() {
  return (
    <Layout title="Hôpitaux">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[rgba(239,68,68,0.15)] flex items-center justify-center">
            <Hospital size={22} className="text-[#ef4444]" />
          </div>
          <h1 className="text-2xl font-bold">Hôpitaux</h1>
        </div>

        <p className="text-[var(--loboko-text-secondary)]">
          Liste des hôpitaux disponibles près de chez vous.
        </p>

        <div className="space-y-3">
          {hopitaux.map((h, i) => (
            <div
              key={i}
              className="bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl p-4 space-y-2"
            >
              <div className="font-semibold">{h.nom}</div>
              <div className="flex items-center gap-2 text-sm text-[var(--loboko-text-secondary)]">
                <MapPin size={14} /> {h.ville}
              </div>
              <a
                href={`tel:${h.tel}`}
                className="flex items-center gap-2 text-sm font-medium text-[#2563eb]"
              >
                <Phone size={14} /> {h.tel}
              </a>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}