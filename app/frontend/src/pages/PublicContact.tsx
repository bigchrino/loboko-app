import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MessageCircle, LifeBuoy } from 'lucide-react';
import Logo from '@/components/Logo';

/**
 * Page de contact PUBLIQUE — volontairement en dehors des routes protégées
 * et sans le composant Layout (qui suppose un utilisateur connecté). C'est
 * la page vers laquelle renvoie le lien "Un souci à vous connecter ?" sur
 * l'écran de connexion : elle doit rester accessible à quelqu'un qui n'a
 * justement pas réussi à se connecter.
 */
export default function PublicContact() {
  const navigate = useNavigate();

  const phoneDigits = '+243994094922';
  const whatsappLink = `https://wa.me/${phoneDigits.replace('+', '')}`;
  const email = 'cmbcorporation3@gmail.com';

  return (
    <div className="min-h-[100dvh] bg-[var(--loboko-bg)] text-[var(--loboko-text)] flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-6"
        >
          <ArrowLeft size={16} /> Retour à la connexion
        </button>

        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>

        <div className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] mb-5">
          <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center shrink-0">
            <LifeBuoy size={22} className="text-[#2563eb]" />
          </div>
          <div>
            <div className="font-semibold">Besoin d'aide pour vous connecter ?</div>
            <div className="text-sm text-[var(--loboko-text-secondary)]">
              Notre équipe vous répond directement.
            </div>
          </div>
        </div>

        <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl overflow-hidden">
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

        <p className="text-[11px] text-[var(--loboko-text-muted)] text-center mt-6">
          CMB Corporation — LOBOKO
        </p>
      </div>
    </div>
  );
}
