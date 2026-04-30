import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import ServiceCategorySelect from '@/components/ServiceCategorySelect';

export default function OnboardingProfile() {
  const { user, profile, createLobokoProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [serviceCategoryId, setServiceCategoryId] = useState<string | null>(null);
  const [serviceCategoryName, setServiceCategoryName] = useState<string>(
    user?.metier || '',
  );
  const [bio, setBio] = useState('');
  const [role, setRole] = useState<'client' | 'prestataire'>(user?.role || 'client');

  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true });
    } else if (profile) {
      navigate('/home', { replace: true });
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error("Nom d'utilisateur requis");
      return;
    }
    if (role === 'prestataire' && !serviceCategoryId) {
      toast.error('Veuillez choisir un service officiel dans la liste');
      return;
    }
    setLoading(true);
    try {
      await createLobokoProfile({
        username: username.trim(),
        display_name: displayName.trim() || username.trim(),
        metier: role === 'prestataire' ? serviceCategoryName : '',
        bio: bio.trim(),
        role,
        service_category_id: role === 'prestataire' ? serviceCategoryId : null,
      });
      toast.success('Profil créé avec succès !');
      navigate('/home', { replace: true });
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Erreur lors de la création du profil';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--loboko-bg)] text-[var(--loboko-text)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Bienvenue sur LOBOKO 👋</h1>
          <p className="text-sm text-[var(--loboko-text-secondary)]">
            {user?.email ? `Connecté en tant que ${user.email}` : 'Complétez votre profil pour continuer'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 p-6 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
        >
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-[var(--loboko-text-secondary)]">
              Je suis *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['client', 'prestataire'] as const).map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={`px-4 py-3 rounded-xl font-semibold capitalize transition ${
                    role === r
                      ? 'bg-[#2563eb] text-white'
                      : '!bg-transparent !hover:bg-transparent border border-[var(--loboko-border)] text-[var(--loboko-text-secondary)]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-[var(--loboko-text-secondary)]">
              Nom d'utilisateur *
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
              placeholder="ex: kinshasa_dev"
              className="w-full px-4 py-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-[var(--loboko-text)] placeholder:text-[var(--loboko-text-muted)] focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-[var(--loboko-text-secondary)]">
              Nom complet
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Votre nom"
              className="w-full px-4 py-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-[var(--loboko-text)] placeholder:text-[var(--loboko-text-muted)] focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          {role === 'prestataire' && (
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-[var(--loboko-text-secondary)]">
                Service que vous livrez *
              </label>
              <ServiceCategorySelect
                value={serviceCategoryId}
                onChange={(id, cat) => {
                  setServiceCategoryId(id);
                  setServiceCategoryName(cat?.name || '');
                }}
                required
                placeholder="Choisissez un service officiel…"
                legacyMetier={user?.metier}
              />
              <p className="mt-1.5 text-[11px] text-[var(--loboko-text-muted)]">
                Choisissez une catégorie officielle LOBOKO. Si votre domaine est absent, contactez-nous.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-[var(--loboko-text-secondary)]">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Parlez-nous de vous..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-[var(--loboko-text)] placeholder:text-[var(--loboko-text-muted)] focus:outline-none focus:border-[#2563eb] resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer mon profil'}
          </button>
        </form>
      </div>
    </div>
  );
}