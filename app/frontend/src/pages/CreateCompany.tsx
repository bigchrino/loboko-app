import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { isPremium } from '@/lib/subscription';
import { createCompany, COMPANY_COLORS } from '@/lib/companies';
import { ArrowLeft, Building2, Lock, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateCompany() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const userIsPremium = isPremium(profile);

  const [name, setName] = useState('');
  const [colorKey, setColorKey] = useState('blue');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (!name.trim()) {
      toast.error('Donnez un nom à votre entreprise');
      return;
    }
    const chosen = COMPANY_COLORS.find((c) => c.key === colorKey);
    if (chosen?.premium && !userIsPremium) {
      toast.error('Cette couleur est réservée aux comptes Premium');
      return;
    }

    setSubmitting(true);
    const { data, error } = await createCompany({
      owner_id: user.id,
      name: name.trim(),
      color_key: colorKey,
    });
    setSubmitting(false);

    if (!data) {
      toast.error(error || "Impossible de créer l'entreprise");
      return;
    }

    toast.success('Entreprise créée \ud83c\udf89');
    navigate('/entreprise/manage');
  };

  return (
    <Layout title="Ajouter mon entreprise">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${COMPANY_COLORS.find((c) => c.key === colorKey)?.hex}26` }}
        >
          <Building2 size={22} style={{ color: COMPANY_COLORS.find((c) => c.key === colorKey)?.hex }} />
        </div>
        <h1 className="text-2xl font-bold">Ajouter mon entreprise</h1>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1.5">Nom de l'entreprise</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Tech Congo SARL"
            maxLength={60}
            className="w-full px-4 py-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Couleur de l'entreprise</label>
          <div className="grid grid-cols-5 gap-3">
            {COMPANY_COLORS.map((c) => {
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
          {!userIsPremium && (
            <p className="mt-2 text-xs text-[var(--loboko-text-muted)]">
              🔒 Les couleurs verrouillées sont réservées aux comptes Premium.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold disabled:opacity-50"
        >
          {submitting ? 'Création…' : 'Créer mon entreprise'}
        </button>
      </div>
    </Layout>
  );
}
