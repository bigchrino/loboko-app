import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { recommendationCache, type RecommendedService } from '@/lib/service-recommendations';

export default function RecommendedServices({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<RecommendedService[]>(() => recommendationCache.get(userId) ?? []);
  const [loading, setLoading] = useState(!recommendationCache.has(userId));
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
      const { data, error } = await supabase.rpc('recommend_services');
      if (cancelled) return;
      if (!error && data) {
        const list = data as RecommendedService[];
        recommendationCache.set(userId, list);
        setItems(list);
      }
      } catch { /* Keep cached suggestions when the network is unavailable. */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const reset = async () => {
    setResetting(true);
    try {
      const { error } = await supabase.from('user_service_interests').delete().eq('user_id', userId);
      if (error) throw error;
      recommendationCache.delete(userId);
      const result = await supabase.rpc('recommend_services');
      if (result.error) throw result.error;
      const list = (result.data ?? []) as RecommendedService[];
      recommendationCache.set(userId, list);
      setItems(list);
      toast.success('Suggestions réinitialisées');
    } catch {
      toast.error('Impossible de réinitialiser les suggestions');
    } finally {
      setResetting(false);
    }
  };

  // Fixed height prevents recommendations from shifting a restored feed.
  return (
    <section aria-label="Suggestions de services" className="w-full min-w-0 max-w-full h-[244px] my-4 rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="font-semibold text-sm">Des services pour vous</h2>
        <button type="button" disabled={resetting} onClick={reset}
          className="text-xs text-[var(--loboko-text-muted)] disabled:opacity-50">Réinitialiser</button>
      </div>
      <div className="flex w-full min-w-0 gap-3 overflow-x-auto pb-2" aria-busy={loading}>
        {loading && !items.length ? [0, 1, 2].map((i) => (
          <div key={i} aria-hidden="true" className="h-[174px] w-52 shrink-0 rounded-xl bg-[var(--loboko-elevated)] motion-safe:animate-pulse" />
        )) : items.length ? items.map((item) => (
          <button key={item.service_id} type="button"
            onClick={() => navigate(`/services/${item.category_slug}?service=${item.service_id}`)}
            className="h-[174px] w-52 shrink-0 rounded-xl border border-[var(--loboko-border)] p-3 text-left hover:border-[#2563eb] flex flex-col">
            <span className="flex items-center gap-2 text-[#60a5fa] text-xs mb-2"><Briefcase size={16} />{item.reason === 'search' ? 'Selon vos intérêts' : item.reason === 'related' ? 'Un domaine similaire' : 'À découvrir'}</span>
            <span className="font-semibold text-sm line-clamp-2">{item.service_name}</span>
            <span className="text-xs text-[var(--loboko-text-muted)] truncate">{item.category_name}</span>
            <span className="text-xs text-[var(--loboko-text-secondary)] mt-auto">{item.provider_count} prestataire{item.provider_count > 1 ? 's' : ''} · {item.available_count} disponible{item.available_count > 1 ? 's' : ''}</span>
            <span className="flex items-center gap-1 text-xs font-semibold text-[#60a5fa] mt-2">Voir les prestataires <ArrowRight size={13} /></span>
          </button>
        )) : (
          <button type="button" onClick={() => navigate('/find')} className="h-[174px] w-full rounded-xl bg-[var(--loboko-elevated)] text-sm">Découvrez les services disponibles <ArrowRight size={16} className="inline" /></button>
        )}
      </div>
    </section>
  );
}
