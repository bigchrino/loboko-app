import { Search, Briefcase, ShieldCheck, Zap, Star } from 'lucide-react';

/**
 * HeroBanner
 *
 * Professional, mobile-first hero banner for the LOBOKO home page.
 *
 * Goals:
 *  - Reassure users: clear value proposition + trust signals (secure, fast,
 *    verified providers).
 *  - Mobile first: large tap targets (buttons >= 48px height), readable
 *    typography on small screens, no heavy assets above the fold.
 *  - Non-intrusive: purely presentational — does NOT touch auth, messages,
 *    calls, notifications, or posts. Buttons scroll the feed or open the
 *    compose form via a safe event, with a graceful fallback.
 */

const HERO_IMG =
  'https://mgx-backend-cdn.metadl.com/generate/images/1045026/2026-04-29/nruatmyaafma/hero-workers-team.png';
const W_CONSTRUCTION =
  'https://mgx-backend-cdn.metadl.com/generate/images/1045026/2026-04-29/nruapuiaaflq/worker-construction-professional.png';
const W_ELECTRICIAN =
  'https://mgx-backend-cdn.metadl.com/generate/images/1045026/2026-04-29/nruaouaaafna/worker-electrician-female.png';
const W_PLUMBER =
  'https://mgx-backend-cdn.metadl.com/generate/images/1045026/2026-04-29/nruarhqaafnq/worker-plumber-professional.png';

interface HeroBannerProps {
  /**
   * Optional callback when the user taps "Proposer mes services".
   * Non-breaking: if absent, we just dispatch a custom event and scroll so
   * existing pages keep working without changes.
   */
  onOfferServices?: () => void;
  /**
   * Optional callback when the user taps "Trouver un prestataire".
   */
  onFindProvider?: () => void;
}

export default function HeroBanner({
  onOfferServices,
  onFindProvider,
}: HeroBannerProps) {
  const handleFind = () => {
    if (onFindProvider) {
      onFindProvider();
      return;
    }
    // Fallback: smooth-scroll to the feed area below the banner.
    const feed = document.getElementById('loboko-feed');
    if (feed) {
      feed.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleOffer = () => {
    if (onOfferServices) {
      onOfferServices();
      return;
    }
    // Fallback: notify the compose area (listened in ComposePost if present);
    // if nothing listens, we simply scroll to it.
    window.dispatchEvent(new CustomEvent('loboko:open-compose'));
    const compose = document.getElementById('loboko-compose');
    if (compose) {
      compose.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section
      className="relative overflow-hidden rounded-2xl mb-5 border border-[var(--loboko-border)] bg-[var(--loboko-surface)]"
      aria-label="Bannière de présentation LOBOKO"
    >
      {/* Background image + gradient overlay for legibility */}
      <div className="absolute inset-0">
        <img
          src={HERO_IMG}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(8,12,24,0.55) 0%, rgba(8,12,24,0.82) 55%, rgba(8,12,24,0.92) 100%)',
          }}
        />
      </div>

      <div className="relative px-5 py-7 sm:px-7 sm:py-9">
        {/* Small trust badge */}
        <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-white/90 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-3 py-1 mb-4">
          <ShieldCheck size={13} className="text-emerald-400" />
          Prestataires vérifiés
        </div>

        <h1 className="text-white text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight mb-3">
          Trouvez une main-d'œuvre qualifiée en un clic
        </h1>
        <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-6 max-w-xl">
          LOBOKO connecte clients et prestataires fiables pour des services
          rapides, sûrs et professionnels.
        </p>

        {/* Primary CTAs — large touch targets for mobile */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <button
            onClick={handleFind}
            className="inline-flex items-center justify-center gap-2 h-12 sm:h-12 px-5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white font-semibold text-[15px] shadow-lg shadow-blue-900/30 transition-colors"
          >
            <Search size={18} />
            Trouver un prestataire
          </button>
          <button
            onClick={handleOffer}
            className="inline-flex items-center justify-center gap-2 h-12 sm:h-12 px-5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 text-white font-semibold text-[15px] border border-white/20 backdrop-blur-sm transition-colors"
          >
            <Briefcase size={18} />
            Proposer mes services
          </button>
        </div>

        {/* Trust signals row */}
        <ul className="grid grid-cols-3 gap-2 sm:gap-3 text-white/85 text-[11px] sm:text-xs">
          <li className="flex items-center gap-1.5">
            <Zap size={14} className="text-yellow-400 flex-shrink-0" />
            <span>Rapide</span>
          </li>
          <li className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400 flex-shrink-0" />
            <span>Sécurisé</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Star size={14} className="text-amber-300 flex-shrink-0" />
            <span>Qualité pro</span>
          </li>
        </ul>
      </div>

      {/* Worker thumbnails strip (hidden on very small screens to keep the
          fold light, visible from sm+). */}
      <div className="relative hidden sm:flex items-center gap-3 px-7 pb-6">
        {[
          { src: W_CONSTRUCTION, label: 'Construction' },
          { src: W_ELECTRICIAN, label: 'Électricité' },
          { src: W_PLUMBER, label: 'Plomberie' },
        ].map((w) => (
          <div
            key={w.label}
            className="flex items-center gap-2 bg-white/8 border border-white/15 rounded-full pl-1 pr-3 py-1 backdrop-blur-sm"
          >
            <img
              src={w.src}
              alt={w.label}
              loading="lazy"
              className="w-8 h-8 rounded-full object-cover border border-white/20"
            />
            <span className="text-white/90 text-xs font-medium">{w.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}