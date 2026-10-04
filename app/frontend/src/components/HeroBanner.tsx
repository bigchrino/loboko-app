import { Search, ArrowRight } from 'lucide-react';

// Retain the existing LOBOKO image source.
const HERO_IMG = 'https://mgx-backend-cdn.metadl.com/generate/images/1045026/2026-04-29/nruatmyaafma/hero-workers-team.png';
interface HeroBannerProps {
  onOfferServices?: () => void;
  onFindProvider?: () => void;
}

export default function HeroBanner({ onOfferServices, onFindProvider }: HeroBannerProps) {
  const handleOffer = () => {
    if (onOfferServices) return onOfferServices();
    document.getElementById('loboko-compose')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelector<HTMLTextAreaElement>('#loboko-compose textarea')?.focus({ preventScroll: true });
  };
  return (
    <section aria-label="Présentation LOBOKO" className="relative mb-3 overflow-hidden rounded-2xl border border-[var(--loboko-border)] bg-[#151515]">
      <img src={HERO_IMG} alt="" aria-hidden="true" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-right" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,10,10,0.95)_0%,rgba(10,10,10,0.8)_45%,rgba(10,10,10,0.15)_100%)]" />
      <div className="relative p-4 sm:p-6">
        <h1 className="max-w-[13rem] text-[23px] font-bold leading-tight text-white sm:max-w-sm sm:text-3xl">Un talent pour chaque projet</h1>
        <p className="mt-2 max-w-[15rem] text-xs leading-relaxed text-white/80 sm:max-w-sm sm:text-sm">Trouvez des prestataires qualifiés ou proposez vos services sur Loboko.</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
          <button type="button" onClick={() => onFindProvider ? onFindProvider() : document.getElementById('loboko-feed')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 text-xs font-semibold text-white hover:bg-[#1d4ed8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-sm">
            <Search size={17} aria-hidden="true" />Trouver un prestataire
          </button>
          <button type="button" onClick={handleOffer} className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-blue-300 hover:text-white sm:text-sm">Proposer mes services<ArrowRight size={16} aria-hidden="true" /></button>
        </div>
      </div>
    </section>
  );
}
