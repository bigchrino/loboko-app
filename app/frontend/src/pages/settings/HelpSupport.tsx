import { useState } from 'react';
import { useBackNavigation } from '@/lib/use-back-navigation';
import Layout from '@/components/Layout';
import {
  ArrowLeft,
  ChevronDown,
  Mail,
  Phone,
  MessageCircle,
  HelpCircle,
} from 'lucide-react';

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'Comment trouver un prestataire près de moi ?',
    a: 'Depuis "Trouver un prestataire", choisissez une catégorie ou tapez directement un service précis (ex\u00a0: "Chauffeur"), puis touchez "Utiliser ma position actuelle" sur la liste des résultats. Chaque prestataire affiche alors sa distance, et les plus proches apparaissent en premier.',
  },
  {
    q: 'Que signifient les statuts Disponible / Occupé / Indisponible ?',
    a: '🟢 Disponible et 🟠 Occupé apparaissent tous les deux dans les recherches (les disponibles en premier). 🔴 Indisponible n\u2019apparaît jamais dans une recherche, y compris en urgence — le prestataire choisit ce statut quand il ne veut pas être sollicité.',
  },
  {
    q: 'Comment fonctionne une demande en urgence ?',
    a: 'Depuis "Urgences \u2192 Prestataires", choisissez un service et votre position (GPS ou zone), puis "Contacter maintenant" sur un prestataire. Une commande marquée 🔴 Urgent est envoyée directement et remonte en tête de sa liste de commandes reçues.',
  },
  {
    q: 'Le prestataire propose un prix différent du mien, que faire ?',
    a: 'Si le prestataire refuse pour une question de budget, votre commande passe en statut "Contre-proposition de prix". Vous pouvez alors accepter ce nouveau prix pour confirmer la mission, ou refuser pour annuler.',
  },
  {
    q: 'Comment annuler une commande ?',
    a: 'Tant qu\u2019elle est "En attente" (le prestataire n\u2019a pas encore répondu), ouvrez la commande depuis "Mes commandes" et touchez "Annuler ma demande".',
  },
  {
    q: 'Comment devenir un prestataire vérifié ?',
    a: 'Depuis "Menu \u2192 Vérification", soumettez les informations demandées pour faire vérifier votre identité. Une fois approuvé, un badge "Vérifié" apparaît sur votre profil.',
  },
  {
    q: 'Comment bloquer ou signaler quelqu\u2019un ?',
    a: 'Ouvrez la conversation avec cette personne, touchez le menu ⋮ en haut, puis "Bloquer" ou "Bloquer et signaler". Vous pouvez retrouver et débloquer vos contacts bloqués depuis Paramètres \u2192 Confidentialité.',
  },
  {
    q: 'Comment fonctionne le paiement sécurisé ?',
    a: 'Une fois la commande acceptée, le client prépare le paiement (prix, commission, devise USD/CDF). Les fonds sont mis de côté jusqu\u2019à la confirmation de fin de mission par les deux parties, puis versés au prestataire.',
  },
  {
    q: 'Puis-je changer de rôle (client ↔ prestataire) ?',
    a: 'Oui, depuis Paramètres \u2192 Changement de compte, vous pouvez faire une demande pour passer de client à prestataire ou inversement.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--loboko-border)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left hover:bg-[var(--loboko-surface-hover)] transition"
      >
        <span className="text-sm font-medium">{q}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[var(--loboko-text-muted)] transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <p className="px-4 pb-4 text-sm text-[var(--loboko-text-secondary)] whitespace-pre-wrap">
          {a}
        </p>
      )}
    </div>
  );
}

/** Settings → Aide & support. */
export default function HelpSupport() {
  const goBack = useBackNavigation('/settings');

  const phoneDigits = '+243994094922';
  const whatsappLink = `https://wa.me/${phoneDigits.replace('+', '')}`;
  const email = 'cmbcorporation3@gmail.com';

  return (
    <Layout title="Aide & support">
      <button
        onClick={goBack}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <h1 className="text-2xl font-bold mb-1 hidden lg:block">Aide & support</h1>

      <div className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] mb-4">
        <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center shrink-0">
          <HelpCircle size={22} className="text-[#2563eb]" />
        </div>
        <div>
          <div className="font-semibold">Besoin d'aide ?</div>
          <div className="text-sm text-[var(--loboko-text-secondary)]">
            Consultez les questions fréquentes ci-dessous, ou contactez-nous directement.
          </div>
        </div>
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--loboko-text-muted)] mb-2">
        Questions fréquentes
      </h2>
      <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl overflow-hidden mb-4">
        {FAQ_ITEMS.map((item) => (
          <FaqItem key={item.q} q={item.q} a={item.a} />
        ))}
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--loboko-text-muted)] mb-2">
        Nous contacter — CMB Corporation
      </h2>
      <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl overflow-hidden mb-4">
        <a
          href={`mailto:${email}`}
          className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[var(--loboko-surface-hover)] transition border-b border-[var(--loboko-border)]"
        >
          <Mail size={18} className="text-[#2563eb]" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">E-mail</div>
            <div className="text-xs text-[var(--loboko-text-muted)] truncate">{email}</div>
          </div>
        </a>
        <a
          href={`tel:${phoneDigits}`}
          className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[var(--loboko-surface-hover)] transition border-b border-[var(--loboko-border)]"
        >
          <Phone size={18} className="text-[#2563eb]" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">Téléphone</div>
            <div className="text-xs text-[var(--loboko-text-muted)]">{phoneDigits}</div>
          </div>
        </a>
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[var(--loboko-surface-hover)] transition"
        >
          <MessageCircle size={18} className="text-[#22c55e]" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">WhatsApp</div>
            <div className="text-xs text-[var(--loboko-text-muted)]">{phoneDigits}</div>
          </div>
        </a>
      </div>
    </Layout>
  );
}
