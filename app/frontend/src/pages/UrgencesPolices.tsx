import Layout from '@/components/Layout';
import { Shield, Phone, MapPin } from 'lucide-react';

const polices = [
  { nom: 'Commissariat Central', ville: 'Kinshasa', tel: '112' },
  { nom: 'Police Secours', ville: 'Brazzaville', tel: '117' },
  { nom: 'Gendarmerie', ville: 'Pointe-Noire', tel: '118' },
];

export default function UrgencesPolices() {
  return (
    <Layout title="Polices">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center">
            <Shield size={22} className="text-[#2563eb]" />
          </div>
          <h1 className="text-2xl font-bold">Polices</h1>
        </div>

        <p className="text-[var(--loboko-text-secondary)]">
          Contactez les forces de l'ordre en cas de besoin.
        </p>

        <div className="space-y-3">
          {polices.map((p, i) => (
            <div
              key={i}
              className="bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl p-4 space-y-2"
            >
              <div className="font-semibold">{p.nom}</div>
              <div className="flex items-center gap-2 text-sm text-[var(--loboko-text-secondary)]">
                <MapPin size={14} /> {p.ville}
              </div>
              <a
                href={`tel:${p.tel}`}
                className="flex items-center gap-2 text-sm font-medium text-[#2563eb]"
              >
                <Phone size={14} /> {p.tel}
              </a>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}