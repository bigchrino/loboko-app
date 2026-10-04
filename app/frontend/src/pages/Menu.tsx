import { useState } from 'react';
import Layout from '@/components/Layout';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Search,
  Building2,
  Siren,
  Settings,
  LogOut,
  ChevronRight,
  Lightbulb,
  ShoppingCart,
  Phone,
  Circle,
  Star,
  ShieldCheck,
  Briefcase,
  Heart,
  Image,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMissedCalls } from '@/contexts/MissedCallsContext';
import LogoutConfirm from '@/components/LogoutConfirm';

interface MenuItem {
  to: string;
  label: string;
  desc: string;
  icon: typeof User;
  color: string;
  badgeKey?: 'missedCalls';
}

const items: MenuItem[] = [
  {
    to: '/profile',
    label: 'Mon profil',
    desc: 'Voir et modifier votre profil',
    icon: User,
    color: '#2563eb',
  },
  {
    to: '/verification',
    label: 'Vérification',
    desc: 'Identité prestataire',
    icon: ShieldCheck,
    color: '#2563eb',
  },
  {
    to: '/statuses',
    label: 'Statuts',
    desc: 'Photos, vidéos, textes · 24 h',
    icon: Circle,
    color: '#7c3aed',
  },
  {
    to: '/calls',
    label: 'Appels',
    desc: 'Historique vocal et vidéo',
    icon: Phone,
    color: '#2563eb',
    badgeKey: 'missedCalls',
  },
  {
    to: '/messages/starred',
    label: 'Messages importants',
    desc: 'Messages étoilés',
    icon: Star,
    color: '#eab308',
  },
  {
    to: '/works',
    label: 'Réalisations',
    desc: 'Travaux des prestataires',
    icon: Image,
    color: '#06b6d4',
  },
  {
    to: '/requests',
    label: 'Demandes de service',
    desc: 'Publier ou consulter les demandes des clients',
    icon: Briefcase,
    color: '#10b981',
  },
  {
    to: '/my-orders',
    label: 'Mes commandes',
    desc: 'Voir vos commandes de services',
    icon: ClipboardList,
    color: '#2563eb',
  },
  {
    to: '/favorites',
    label: 'Favoris',
    desc: 'Retrouver vos prestataires, services et réalisations enregistrés',
    icon: Heart,
    color: '#ef4444',
  },
 
  {
    to: '/recherches',
    label: 'Recherches',
    desc: 'Rechercher des personnes et contenus',
    icon: Search,
    color: '#2563eb',
  },
  {
    to: '/suggestion',
    label: 'Suggestion',
    desc: 'Suggestions personnalisées',
    icon: Lightbulb,
    color: '#eab308',
  },
  {
    to: '/entreprise',
    label: 'Entreprise',
    desc: 'Offres et services entreprise',
    icon: Building2,
    color: '#2563eb',
  },
  {
    to: '/marketplace',
    label: 'Marketplace',
    desc: 'Boutiques, produits, favoris et commandes',
    icon: ShoppingCart,
    color: '#10b981',
  },
  {
    to: '/urgences',
    label: 'Urgences',
    desc: "Services d'urgence",
    icon: Siren,
    color: '#ef4444',
  },
  {
    to: '/settings',
    label: 'Paramètres',
    desc: 'Gérer vos préférences',
    icon: Settings,
    color: '#2563eb',
  },
];

function sectionFor(to: string): string {
  if (['/statuses', '/calls', '/messages/starred', '/works'].includes(to)) return 'Activités';
  if (['/recherches', '/suggestion'].includes(to)) return 'Explorer';
  if (to === '/settings') return 'Mon compte';
  return 'Services';
}

function MenuCard({ item, badgeCount = 0, compact = false }: {
  item: MenuItem;
  badgeCount?: number;
  compact?: boolean;
}) {
  const { to, label, desc, icon: Icon, color } = item;
  const icon = (
    <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}26` }}>
      <Icon size={26} style={{ color }} aria-hidden="true" />
      {badgeCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-[var(--loboko-elevated)]" aria-label={`${badgeCount} appels manqués`}>
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </div>
  );
  return (
    <Link to={to} className={`min-w-0 rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] hover:border-[#2563eb] hover:bg-[var(--loboko-surface-hover)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] ${compact ? 'flex flex-col gap-3 p-4 sm:p-5' : 'flex items-center gap-4 p-4 sm:p-5'}`}>
      {compact ? (
        <div className="flex items-center justify-between gap-2">
          {icon}<ChevronRight size={20} className="text-[var(--loboko-text-muted)] shrink-0" aria-hidden="true" />
        </div>
      ) : icon}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-base sm:text-lg leading-snug break-words">{label}</div>
        <p className="mt-1 text-sm leading-relaxed text-[var(--loboko-text-secondary)]">{desc}</p>
      </div>
      {!compact && <ChevronRight size={20} className="text-[var(--loboko-text-muted)] shrink-0" aria-hidden="true" />}
    </Link>
  );
}

export default function Menu() {
  const { logout, profile } = useAuth();
  const { unseenMissed } = useMissedCalls();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const visibleItems =
    profile?.role === 'prestataire'
      ? [
          ...items,
          {
            to: '/received-orders',
            label: 'Commandes reçues',
            desc: 'Voir les commandes envoyées par les clients',
            icon: Briefcase,
            color: '#2563eb',
          },
        ]
      : items;

  const featuredItems = visibleItems.filter((item) => ['/profile', '/verification'].includes(item.to));
  const groupedItems = ['Activités', 'Services', 'Explorer', 'Mon compte'].map((title) => ({
    title,
    items: visibleItems.filter((item) => !['/profile', '/verification'].includes(item.to) && sectionFor(item.to) === title),
  }));

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/');
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  return (
    <Layout title="Menu" hideHeaderTitle>
      <div className="space-y-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Menu</h1>
        <div className="space-y-3">
          {featuredItems.map((item) => <MenuCard key={item.to} item={item} />)}
        </div>
        {groupedItems.map((section, index) => (
          <section key={section.title} aria-labelledby={`menu-${index}`}>
            <h2 id={`menu-${index}`} className="mb-3 text-xl sm:text-2xl font-bold">{section.title}</h2>
            <div className={section.title === 'Mon compte' ? 'space-y-3' : 'grid grid-cols-2 gap-3'}>
              {section.items.map((item) => (
                <MenuCard key={item.to} item={item} compact={section.title !== 'Mon compte'} badgeCount={item.badgeKey === 'missedCalls' ? unseenMissed : 0} />
              ))}
              {section.title === 'Mon compte' && (
                <>
                  {profile?.is_admin && (
                    <MenuCard item={{ to: '/admin', label: 'Administration', desc: 'Centre de contrôle LOBOKO', icon: ShieldCheck, color: '#2563eb' }} />
                  )}
                  <button type="button" onClick={() => setShowLogoutConfirm(true)}
                    className="w-full flex items-center gap-4 p-4 sm:p-5 rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] hover:bg-[var(--loboko-surface-hover)] transition-colors text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ef4444]">
                    <div className="w-12 h-12 rounded-2xl bg-[rgba(239,68,68,0.15)] flex items-center justify-center shrink-0"><LogOut size={26} className="text-[#ef4444]" aria-hidden="true" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base sm:text-lg">Déconnexion</div>
                      <p className="mt-1 text-sm text-[var(--loboko-text-secondary)]">Se déconnecter de LOBOKO</p>
                    </div>
                    <ChevronRight size={20} className="text-[var(--loboko-text-muted)] shrink-0" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </section>
        ))}
      </div>

      <LogoutConfirm
        open={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        loading={loggingOut}
      />
    </Layout>
  );
}
