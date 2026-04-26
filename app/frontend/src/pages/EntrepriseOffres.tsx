import Layout from '@/components/Layout';
import { ClipboardList } from 'lucide-react';

const offres = [
  {
    title: 'Développeur Full-Stack',
    company: 'Tech Congo',
    location: 'Kinshasa',
    type: 'CDI',
  },
  {
    title: 'Community Manager',
    company: 'Musala Media',
    location: 'Brazzaville',
    type: 'CDD',
  },
  {
    title: 'Livreur indépendant',
    company: 'LOBOKO Delivery',
    location: 'Pointe-Noire',
    type: 'Freelance',
  },
];

export default function EntrepriseOffres() {
  return (
    <Layout title="Offres">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center">
            <ClipboardList size={22} className="text-[#2563eb]" />
          </div>
          <h1 className="text-2xl font-bold">Offres</h1>
        </div>

        <p className="text-[var(--loboko-text-secondary)]">
          Consultez les dernières offres disponibles sur LOBOKO.
        </p>

        <div className="space-y-3">
          {offres.map((offre, i) => (
            <div
              key={i}
              className="bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{offre.title}</div>
                  <div className="text-sm text-[var(--loboko-text-secondary)]">
                    {offre.company} · {offre.location}
                  </div>
                </div>
                <span className="px-2 py-1 rounded-md text-xs font-medium bg-[rgba(37,99,235,0.15)] text-[#2563eb] shrink-0">
                  {offre.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}