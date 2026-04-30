import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';

/**
 * AdsCarousel
 *
 * Lightweight horizontal ads carousel for the home page.
 *
 * Design goals:
 *  - Mobile-first: native horizontal scroll with snap, no dependencies.
 *  - Stable: purely presentational, hardcoded sponsored content for now.
 *  - Non-intrusive: does NOT touch auth, messages, calls, posts, notifications.
 *
 * Data is hardcoded on purpose — no Supabase table is created at this stage.
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

const ADS: AdItem[] = [
  {
    id: 'ad-renovation',
    title: 'Rénovation de maison',
    description:
      'Des artisans vérifiés pour donner un coup de neuf à votre intérieur.',
    image:
      'https://mgx-backend-cdn.metadl.com/generate/images/1045026/2026-04-29/nrusj2yaafmq/ad-home-renovation.png',
    categorySlug: 'macon',
    badge: 'Sponsorisé',
  },
  {
    id: 'ad-cleaning',
    title: 'Ménage & nettoyage pro',
    description:
      'Un logement impeccable en quelques heures. Prestataires de confiance.',
    image:
      'https://mgx-backend-cdn.metadl.com/generate/images/1045026/2026-04-29/nrusmcyaafna/ad-cleaning-service.png',
    categorySlug: 'nettoyage-menage',
    badge: 'Sponsorisé',
  },
  {
    id: 'ad-mechanic',
    title: 'Mécanicien à domicile',
    description:
      "Réparation rapide de votre voiture chez vous, sans stress et sans remorquage.",
    image:
      'https://mgx-backend-cdn.metadl.com/generate/images/1045026/2026-04-29/nrusk2qaafnq/ad-mobile-mechanic.png',
    categorySlug: 'mecanicien',
    badge: 'Sponsorisé',
  },
];

export default function AdsCarousel() {
  const navigate = useNavigate();
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
  }, [handleScroll]);

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
        {ADS.map((ad) => (
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
              <h3 className="text-[15px] sm:text-base font-semibold text-white mb-1 leading-snug">
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
        {ADS.map((ad, idx) => (
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