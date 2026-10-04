import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';

/**
 * AdsCarousel
 *
 * Lightweight horizontal ads carousel for the home page.
 *
 * Design goals:
 *  - Mobile-first: native horizontal scroll with snap, no dependencies.
 *  - Stable: cached campaign summaries while the server refreshes them.
 *  - Non-intrusive: does NOT touch auth, messages, calls, posts, notifications.
 *
 * Campaign visibility and schedules are evaluated by the server.
 */

interface AdItem {
  id: string;
  title: string;
  description: string;
  image: string;
  /** Slug of the target services_categories entry for the "Voir" CTA. */
  categorySlug: string;
  badge?: string;
}

let cachedAds: AdItem[] | null = null;

export default function AdsCarousel() {
  const navigate = useNavigate();
  const [ads, setAds] = useState<AdItem[]>(() => cachedAds ?? []);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
      const result = await supabase.rpc('list_active_ad_campaigns');
      if (cancelled || result.error || !result.data) return;
      const list = (result.data as {id:string;title:string;description:string;image_url:string;category_slug:string}[]).map(row=>({
        id:row.id,title:row.title,description:row.description,image:row.image_url,categorySlug:row.category_slug,badge:'Sponsorisé',
      }));
      cachedAds = list;
      setAds(list);
      } catch { /* Keep the last successful campaigns during a connection failure. */ }
    };
    void load();
    const refresh = () => { if (!document.hidden) void load(); };
    const timer = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange',refresh);
    return () => {cancelled=true;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  }, []);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Track which card is most centered so we can update the dot indicator.
  const handleScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const children = Array.from(scroller.children) as HTMLElement[];
    if (children.length === 0) return;
    const scrollCenter = scroller.scrollLeft + scroller.clientWidth / 2;
    let bestIdx = 0;
    let bestDist = Infinity;
    children.forEach((child, idx) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(childCenter - scrollCenter);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    setActiveIndex(bestIdx);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.addEventListener('scroll', handleScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', handleScroll);
  }, [handleScroll, ads.length]);

  const scrollByDir = (dir: 'left' | 'right') => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const amount = scroller.clientWidth * 0.85;
    scroller.scrollBy({
      left: dir === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  const goTo = (idx: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const child = scroller.children[idx] as HTMLElement | undefined;
    if (!child) return;
    scroller.scrollTo({
      left: child.offsetLeft - 8,
      behavior: 'smooth',
    });
  };

  if (!ads.length) return null;
  return (
    <section
      aria-label="Publicités sponsorisées"
      className="mb-5"
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--loboko-text-muted)] uppercase tracking-wider">
          <Megaphone size={13} />
          À la une
        </div>
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollByDir('left')}
            className="w-8 h-8 rounded-full bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
            aria-label="Précédent"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scrollByDir('right')}
            className="w-8 h-8 rounded-full bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
            aria-label="Suivant"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-1 px-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {ads.map((ad) => (
          <article
            key={ad.id}
            className="snap-start shrink-0 w-[85%] sm:w-[60%] md:w-[48%] lg:w-[46%] rounded-2xl overflow-hidden border border-[var(--loboko-border)] bg-[var(--loboko-surface)] shadow-sm"
          >
            <div className="relative aspect-[16/9] bg-black/30">
              <img
                src={ad.image}
                alt={ad.title}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {ad.badge && (
                <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wider bg-black/60 text-white/90 border border-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                  {ad.badge}
                </span>
              )}
            </div>
            <div className="p-3 sm:p-4">
              <h3 className="text-[15px] sm:text-base font-semibold text-[var(--loboko-text)] mb-1 leading-snug">
                {ad.title}
              </h3>
              <p className="text-xs sm:text-sm text-[var(--loboko-text-muted)] leading-relaxed mb-3 line-clamp-2">
                {ad.description}
              </p>
              <button
                type="button"
                onClick={() => navigate(`/services/${ad.categorySlug}`)}
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold transition-colors"
              >
                Voir
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Dot indicator — helpful on mobile where side arrows are hidden. */}
      <div className="flex justify-center gap-1.5 mt-2 sm:hidden">
        {ads.map((ad, idx) => (
          <button
            key={ad.id}
            type="button"
            onClick={() => goTo(idx)}
            aria-label={`Aller à la publicité ${idx + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              idx === activeIndex
                ? 'w-5 bg-[#2563eb]'
                : 'w-1.5 bg-white/25'
            }`}
          />
        ))}
      </div>
    </section>
  );
}