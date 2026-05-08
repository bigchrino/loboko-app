import { useState } from 'react';
import Layout from '@/components/Layout';
import { Link, useNavigate } from 'react-router-dom';
import {
  Menu as MenuIcon,
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
    label: 'Mon Profil',
    desc: 'Voir et modifier votre profil',
    icon: User,
    color: '#2563eb',
  },
  {
    to: '/verification',
    label: 'Vérification',
    desc: 'Vérifier votre identité prestataire',
    icon: ShieldCheck,
    color: '#2563eb',
  },
  {
    to: '/statuses',
    label: 'Statuts',
    desc: 'Photos, vidéos et textes à partager 24h',
    icon: Circle,
    color: '#7c3aed',
  },
  {
    to: '/calls',
    label: 'Appels',
    desc: 'Historique des appels vocaux et vidéo',
    icon: Phone,
    color: '#2563eb',
    badgeKey: 'missedCalls',
  },
  {
    to: '/messages/starred',
    label: 'Messages importants',
    desc: "Retrouvez vos messages marqués d'une étoile",
    icon: Star,
    color: '#eab308',
  },
  {
    to: '/works',
    label: 'Réalisations',
    desc: 'Voir les travaux publiés par les prestataires',
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
    to: '/panier',
    label: 'Panier',
    desc: 'Vos articles à acheter',
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

export default function Menu() {
  const { logout, profile } = useAuth();
  const { unseenMissed } = useMissedCalls();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const badgeCountFor = (key?: MenuItem['badgeKey']): number => {
    if (key === 'missedCalls') return unseenMissed;
    return 0;
  };

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
    <Layout title="Menu">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center">
            <MenuIcon size={22} className="text-[#2563eb]" />
          </div>
          <h1 className="text-2xl font-bold">Menu</h1>
        </div>

        <div className="space-y-3">
          {items.map(({ to, label, desc, icon: Icon, color, badgeKey }) => {
            const badgeCount = badgeCountFor(badgeKey);
            const badgeLabel = badgeCount > 99 ? '99+' : String(badgeCount);

            return (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] hover:bg-[var(--loboko-surface-hover)] transition-all"
              >
                <div
                  className="relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}26` }}
                >
                  <Icon size={22} style={{ color }} />

                  {badgeCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-[var(--loboko-elevated)]"
                      aria-label={`${badgeCount} appels manqués`}
                    >
                      {badgeLabel}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    {label}

                    {badgeCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold">
                        {badgeLabel}
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-[var(--loboko-text-secondary)]">
                    {desc}
                  </div>
                </div>

                <ChevronRight size={20} className="text-[var(--loboko-text-muted)]" />
              </Link>
            );
          })}

          {profile?.is_admin && (
            <Link
              to="/admin/verifications"
              className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] hover:bg-[var(--loboko-surface-hover)] transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center shrink-0">
                <ShieldCheck size={22} className="text-[#2563eb]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold">Vérifications KYC</div>
                <div className="text-sm text-[var(--loboko-text-secondary)]">
                  Gérer les vérifications prestataires
                </div>
              </div>

              <ChevronRight size={20} className="text-[var(--loboko-text-muted)]" />
            </Link>
          )}

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] hover:bg-[var(--loboko-surface-hover)] transition-all text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-[rgba(239,68,68,0.15)] flex items-center justify-center shrink-0">
              <LogOut size={22} className="text-[#ef4444]" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-semibold">Déconnexion</div>
              <div className="text-sm text-[var(--loboko-text-secondary)]">
                Se déconnecter de LOBOKO
              </div>
            </div>

            <ChevronRight size={20} className="text-[var(--loboko-text-muted)]" />
          </button>
        </div>
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
