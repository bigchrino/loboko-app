import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

// sessionStorage (pas localStorage) : la mémorisation ne dure que le temps
// de l'onglet/de la session en cours. Rouvrir l'app plus tard (nouvel
// onglet, navigateur relancé) fait réapparaître le message — voulu tant que
// l'app est en construction. À remplacer par localStorage plus tard, une
// fois le développement terminé, pour ne plus l'afficher qu'une fois.
const STORAGE_KEY = 'loboko-dev-notice-seen';

/**
 * Petit message rappelant que l'app est encore en construction, réaffiché
 * à chaque nouvelle connexion/session tant qu'on n'a pas retiré ce
 * composant — et redirigeant vers Aide & support en cas de souci.
 */
export default function DevNoticeDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      // sessionStorage indisponible (rare) — on ignore simplement le message.
    }
  }, []);

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Rien de grave si ça échoue — au pire le message réapparaît.
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-5">
        <div className="w-12 h-12 rounded-full bg-[rgba(245,158,11,0.15)] flex items-center justify-center mb-4">
          <AlertTriangle size={22} className="text-[#f59e0b]" />
        </div>

        <h3 className="font-bold text-lg mb-2">Application en construction</h3>

        <p className="text-sm text-[var(--loboko-text-secondary)] mb-5 leading-relaxed">
          LOBOKO est actuellement en cours de conception. Si vous rencontrez un
          problème, rendez-vous dans{' '}
          <strong className="text-[var(--loboko-text)]">
            Paramètres → Aide &amp; support
          </strong>{' '}
          pour nous contacter et nous décrire le problème exact.
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold"
        >
          Ok, c'est compris
        </button>
      </div>
    </div>
  );
}
