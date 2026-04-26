import Layout from '@/components/Layout';
import { Flame, Phone, MapPin } from 'lucide-react';

const casernes = [
  { nom: 'Caserne des Pompiers Centre', ville: 'Kinshasa', tel: '118' },
  { nom: 'Sapeurs-Pompiers', ville: 'Brazzaville', tel: '118' },
  { nom: 'Caserne Pointe-Noire', ville: 'Pointe-Noire', tel: '118' },
];

export default function UrgencesCasernes() {
  return (
    <Layout title="Casernes">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[rgba(249,115,22,0.15)] flex items-center justify-center">
            <Flame size={22} className="text-[#f97316]" />
          </div>
          <h1 className="text-2xl font-bold">Casernes</h1>
        </div>

        <p className="text-[var(--loboko-text-secondary)]">
          Appelez les pompiers en cas d'urgence incendie ou secours.
        </p>

        <div className="space-y-3">
          {casernes.map((c, i) => (
            <div
              key={i}
              className="bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl p-4 space-y-2"
            >
              <div className="font-semibold">{c.nom}</div>
              <div className="flex items-center gap-2 text-sm text-[var(--loboko-text-secondary)]">
                <MapPin size={14} /> {c.ville}
              </div>
              <a
                href={`tel:${c.tel}`}
                className="flex items-center gap-2 text-sm font-medium text-[#f97316]"
              >
                <Phone size={14} /> {c.tel}
              </a>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}