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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const items = [
  { to: '/profile', label: 'Mon Profil', desc: 'Voir et modifier votre profil', icon: User, color: '#2563eb' },
  { to: '/recherches', label: 'Recherches', desc: 'Rechercher des personnes et contenus', icon: Search, color: '#2563eb' },
  { to: '/suggestion', label: 'Suggestion', desc: 'Suggestions personnalisées', icon: Lightbulb, color: '#eab308' },
  { to: '/entreprise', label: 'Entreprise', desc: 'Offres et services entreprise', icon: Building2, color: '#2563eb' },
  { to: '/panier', label: 'Panier', desc: 'Vos articles à acheter', icon: ShoppingCart, color: '#10b981' },
  { to: '/urgences', label: 'Urgences', desc: "Services d'urgence", icon: Siren, color: '#ef4444' },
  { to: '/settings', label: 'Paramètres', desc: 'Gérer vos préférences', icon: Settings, color: '#2563eb' },
];

export default function Menu() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
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
          {items.map(({ to, label, desc, icon: Icon, color }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] hover:bg-[var(--loboko-surface-hover)] transition-all"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}26` }}
              >
                <Icon size={22} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{label}</div>
                <div className="text-sm text-[var(--loboko-text-secondary)]">{desc}</div>
              </div>
              <ChevronRight size={20} className="text-[var(--loboko-text-muted)]" />
            </Link>
          ))}

          <button
            onClick={handleLogout}
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
    </Layout>
  );
}