import { Link } from 'react-router-dom';
import { useAdminOverview } from '@/lib/use-admin-overview';
import { AdminError } from '@/components/AdminTools';
import Layout from '@/components/Layout';
import {
  ShieldCheck,
  Flag,
  Users,
  CreditCard,
  BarChart3,
  Megaphone,
  ChevronRight,
  FileText,
  History,
  RefreshCw,
} from 'lucide-react';

const cards = [
  {to:'/admin/journal',title:'Journal des actions',desc:'Suivre les décisions et leurs auteurs',icon:History,color:'#60a5fa'},
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
    to: '/admin/role-requests',
    title: 'Demandes rôles',
    desc: 'Changer client/prestataire',
    icon: ShieldCheck,
    color: '#06b6d4',
  },
  {
    to: '/admin/payments',
    title: 'Paiements',
    desc: 'Registre des transactions et litiges',
    icon: CreditCard,
    color: '#10b981',
  },
  {
    to: '/admin/ads',
    title: 'Publicités',
    desc: 'Créer, planifier et désactiver les campagnes',
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
  {
    to: '/admin/posts',
    title: 'Publications',
    desc: 'Publications et commentaires',
    icon: FileText,
    color: '#ef4444',
  },
];

export default function AdminDashboard() {
  const {data,loading,failed,refresh}=useAdminOverview();
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

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">À traiter</h2><button type="button" onClick={refresh} disabled={loading} aria-label="Actualiser les compteurs" className="p-2"><RefreshCw size={16} className={loading?'animate-spin':''} /></button></div>
        {failed?<AdminError retry={refresh} />:loading?<p role="status" className="text-sm">Chargement des compteurs…</p>:data&&<div className="grid grid-cols-3 gap-2">{[['Signalements',data.pending_reports,'/admin/reports'],['KYC',data.pending_kyc,'/admin/verifications'],['Rôles',data.pending_roles,'/admin/role-requests']].map(([label,count,path])=><Link key={path} to={String(path)} className="rounded-xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] p-3"><span className="block text-xl font-bold">{count}</span><span className="text-xs">{label}</span></Link>)}</div>}
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
