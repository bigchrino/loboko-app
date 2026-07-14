import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { isPremium } from '@/lib/subscription';
import { fetchMyShop, updateShop, SHOP_COLORS, Shop } from '@/lib/shops';
import { ArrowLeft, Store, Lock, Check, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function ShopManage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const userIsPremium = isPremium(profile);

  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [colorKey, setColorKey] = useState('blue');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const s = await fetchMyShop(user.id);
      if (!s) {
        toast.error("Vous n'avez pas encore de boutique");
        navigate('/panier', { replace: true });
        return;
      }
      setShop(s);
      setName(s.name);
      setColorKey(s.color_key);
      setLoading(false);
    })();
  }, [user?.id, navigate]);

  const handleSave = async () => {
    if (!shop) return;
    if (!name.trim()) {
      toast.error('Le nom ne peut pas être vide');
      return;
    }
    const chosen = SHOP_COLORS.find((c) => c.key === colorKey);
    if (chosen?.premium && !userIsPremium) {
      toast.error('Cette couleur est réservée aux comptes Premium');
      return;
    }

    setSaving(true);
    const { data, error } = await updateShop(shop.id, {
      name: name.trim(),
      color_key: colorKey,
    });
    setSaving(false);

    if (!data) {
      toast.error(error || 'Impossible d\u2019enregistrer');
      return;
    }
    setShop(data);
    toast.success('Boutique mise à jour');
  };

  if (loading || !shop) {
    return (
      <Layout title="Ma boutique">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      </Layout>
    );
  }

  const activeColor = SHOP_COLORS.find((c) => c.key === colorKey);

  return (
    <Layout title="Ma boutique">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${activeColor?.hex}26` }}
        >
          <Store size={22} style={{ color: activeColor?.hex }} />
        </div>
        <h1 className="text-2xl font-bold">{shop.name}</h1>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1.5">Nom de la boutique</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="w-full px-4 py-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Couleur de la boutique</label>
          <div className="grid grid-cols-5 gap-3">
            {SHOP_COLORS.map((c) => {
              const locked = c.premium && !userIsPremium;
              const selected = colorKey === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    if (locked) {
                      toast.error('Couleur réservée aux comptes Premium');
                      return;
                    }
                    setColorKey(c.key);
                  }}
                  title={locked ? `${c.label} (Premium)` : c.label}
                  className={`relative aspect-square rounded-2xl flex items-center justify-center transition ${
                    selected ? 'ring-2 ring-offset-2 ring-offset-[var(--loboko-bg)] ring-[var(--loboko-text)]' : ''
                  } ${locked ? 'opacity-50' : ''}`}
                  style={{ backgroundColor: c.hex }}
                >
                  {selected && !locked && <Check size={18} className="text-white drop-shadow" />}
                  {locked && <Lock size={16} className="text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>

        <div className="pt-4 border-t border-[var(--loboko-border)]">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Package size={18} /> Produits
          </h2>
          <div className="text-center py-8 px-4 bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl">
            <p className="text-sm text-[var(--loboko-text-muted)]">
              Bientôt : ajoutez vos produits ici pour qu'ils apparaissent dans
              votre boutique.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
