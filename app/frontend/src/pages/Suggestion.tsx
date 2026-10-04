import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import RecommendedServices from '@/components/RecommendedServices';
import { useAuth } from '@/contexts/AuthContext';
import { useAppPreferences } from '@/lib/use-app-preferences';
import { supabase } from '@/lib/supabase';

interface Person { user_id: string; display_name: string | null; username: string | null; role: string; metier: string | null }

export default function Suggestion() {
  const { user } = useAuth();
  const owner = user?.id || '';
  const { personalizedServices } = useAppPreferences(owner);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setPeople([]);
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        if (!owner) return;
        const { data, error: loadError } = await supabase.from('profile_directory')
          .select('user_id,display_name,username,role,metier')
          .neq('user_id', owner).is('deleted_at', null).is('deactivated_at', null)
          .order('display_name').limit(12);
        if (loadError) throw loadError;
        if (!cancelled) setPeople((data || []) as Person[]);
      } catch { if (!cancelled) setError(true); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [owner, retry]);
  return (
    <Layout title="Suggestions">
      <h1 className="text-2xl font-bold mb-2">Suggestions</h1>
      <p className="text-sm text-[var(--loboko-text-secondary)] mb-4">Découvrez des services et des membres de la communauté LOBOKO.</p>
      {!owner ? <Link to="/" className="text-[#2563eb]">Connectez-vous pour voir vos suggestions</Link> : <>
        {personalizedServices ? <RecommendedServices userId={owner} /> : (
          <div className="rounded-2xl border border-[var(--loboko-border)] p-4 mb-4">
            <p className="text-sm mb-2">Les suggestions personnalisées sont désactivées.</p>
            <Link to="/settings" className="text-[#2563eb] text-sm">Gérer mes préférences</Link>
          </div>
        )}
        <h2 className="text-lg font-semibold mb-3">Des membres à découvrir</h2>
        {loading ? <p role="status">Chargement…</p> : error ? (
          <div role="alert"><p>Impossible de charger les membres.</p><button onClick={() => setRetry(value => value + 1)} className="text-[#2563eb] mt-2">Réessayer</button></div>
        ) : people.length === 0 ? <p className="text-sm">Aucun membre à découvrir pour le moment.</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {people.map(person => (
              <article key={person.user_id} className="rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] p-4">
                <Link to={`/u/${person.user_id}`} className="font-semibold">{person.display_name || person.username || 'Utilisateur'}</Link>
                <p className="text-sm text-[var(--loboko-text-muted)] mt-1">{person.metier || (person.role === 'prestataire' ? 'Prestataire' : 'Membre LOBOKO')}</p>
                <div className="flex gap-4 mt-3 text-sm text-[#2563eb]">
                  <Link to={`/u/${person.user_id}`}>Voir le profil</Link>
                  <Link to={`/messages?to=${person.user_id}`}>Message</Link>
                </div>
              </article>
            ))}
          </div>
        )}
        <Link to="/discover" className="inline-block mt-4 text-sm text-[#2563eb]">Explorer toute la communauté</Link>
      </>}
    </Layout>
  );
}
