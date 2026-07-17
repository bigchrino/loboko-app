import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { isPremium } from '@/lib/subscription';
import { fetchMyCompany, updateCompany, COMPANY_COLORS, Company } from '@/lib/companies';
import { ArrowLeft, Building2, Lock, Check, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';

export default function CompanyManage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const userIsPremium = isPremium(profile);

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [colorKey, setColorKey] = useState('blue');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const c = await fetchMyCompany(user.id);
      if (!c) {
        toast.error("Vous n'avez pas encore d'entreprise");
        navigate('/entreprise', { replace: true });
        return;
      }
      setCompany(c);
      setName(c.name);
      setColorKey(c.color_key);
      setLoading(false);
    })();
  }, [user?.id, navigate]);

  const handleSave = async () => {
    if (!company) return;
    if (!name.trim()) {
      toast.error('Le nom ne peut pas être vide');
      return;
    }
    const chosen = COMPANY_COLORS.find((c) => c.key === colorKey);
    if (chosen?.premium && !userIsPremium) {
      toast.error('Cette couleur est réservée aux comptes Premium');
      return;
    }

    setSaving(true);
    const { data, error } = await updateCompany(company.id, {
      name: name.trim(),
      color_key: colorKey,
    });
    setSaving(false);

    if (!data) {
      toast.error(error || 'Impossible d\u2019enregistrer');
      return;
    }
    setCompany(data);
    toast.success('Entreprise mise à jour');
  };

  if (loading || !company) {
    return (
      <Layout title="Mon entreprise">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      </Layout>
    );
  }

  const activeColor = COMPANY_COLORS.find((c) => c.key === colorKey);

  return (
    <Layout title="Mon entreprise">
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
          <Building2 size={22} style={{ color: activeColor?.hex }} />
        </div>
        <h1 className="text-2xl font-bold">{company.name}</h1>
      </div>

      <button
        onClick={() => navigate('/entreprise/offres/manage')}
        className="w-full mb-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm font-semibold"
      >
        <ClipboardList size={16} />
        Gérer mes offres d'emploi
      </button>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1.5">Nom de l'entreprise</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
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
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </Layout>
  );
}
