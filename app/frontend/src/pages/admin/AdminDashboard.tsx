import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import {
  ShieldCheck,
  Flag,
  Users,
  CreditCard,
  BarChart3,
  Megaphone,
  ChevronRight,
} from 'lucide-react';

const cards = [
  {
    to: '/admin/verifications',
    title: 'Vérifications KYC',
    desc: 'Valider les prestataires',
    icon: ShieldCheck,
    color: '#2563eb',
  },
  {
    to: '/admin/reports',
    title: 'Signalements',
    desc: 'Voir les contenus signalés',
    icon: Flag,
    color: '#ef4444',
  },
  {
    to: '/admin/users',
    title: 'Utilisateurs',
    desc: 'Gérer les comptes',
    icon: Users,
    color: '#7c3aed',
  },
  {
    to: '/admin/payments',
    title: 'Paiements',
    desc: 'Transactions et remboursements',
    icon: CreditCard,
    color: '#10b981',
  },
  {
    to: '/admin/ads',
    title: 'Publicités',
    desc: 'Boosts et campagnes',
    icon: Megaphone,
    color: '#f59e0b',
  },
  {
    to: '/admin/stats',
    title: 'Statistiques',
    desc: 'Voir les chiffres de la plateforme',
    icon: BarChart3,
    color: '#06b6d4',
  },
];

export default function AdminDashboard() {
  return (
    <Layout title="Administration">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          💎 Administration
        </h1>

        <p className="text-sm text-[var(--loboko-text-muted)] mt-1">
          Centre de contrôle de LOBOKO
        </p >
      </div>

      <div className="grid gap-3">
        {cards.map(({ to, title, desc, icon: Icon, color }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb] transition-all"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}20` }}
            >
              <Icon size={24} style={{ color }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-semibold">{title}</div>

              <div className="text-sm text-[var(--loboko-text-secondary)]">
                {desc}
              </div>
            </div>

            <ChevronRight
              size={20}
              className="text-[var(--loboko-text-muted)]"
            />
          </Link>
        ))}
      </div>
    </Layout>
  );
}
