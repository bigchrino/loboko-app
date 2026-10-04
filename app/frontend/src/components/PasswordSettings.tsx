import { useRef, useState, type FormEvent } from 'react';
import { KeyRound, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function PasswordSettings({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nonce, setNonce] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useRef(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const toggle = () => {
    if (busy) return;
    setOpen(!open);
    setPassword(''); setConfirm(''); setNonce(''); setMessage(''); setSuccess(false); setNeedsCode(false);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (request.current) return;
    setSuccess(false);
    if (password.length < 8) { setMessage('Choisissez un mot de passe de 8 caractères minimum.'); return; }
    if (password !== confirm) { setMessage('Les deux mots de passe ne correspondent pas.'); return; }
    request.current = true; setBusy(true); setMessage('');
    try {
      const current = await supabase.auth.getUser();
      if (current.error || current.data.user?.id !== userId) {
        setMessage('Reconnectez-vous à votre compte pour continuer.'); return;
      }
      const { error } = await supabase.auth.updateUser({ password, ...(nonce.trim() ? { nonce: nonce.trim() } : {}) });
      if (error) {
        if (error.code === 'reauthentication_needed' || error.code === 'reauthentication_not_valid') {
          setNeedsCode(true); setMessage('Vérifiez votre identité avec un code, puis réessayez.');
        } else if (error.code === 'same_password') setMessage('Choisissez un mot de passe différent du précédent.');
        else if (error.code === 'weak_password') setMessage('Ce mot de passe est trop faible. Utilisez un mot de passe plus long et varié.');
        else setMessage('Impossible de modifier le mot de passe. Vérifiez votre connexion et réessayez.');
        return;
      }
      setPassword(''); setConfirm(''); setNonce(''); setNeedsCode(false);
      setSuccess(true); setMessage('Votre mot de passe a été modifié.');
    } catch { setMessage('Impossible de modifier le mot de passe pour le moment.'); }
    finally { request.current = false; setBusy(false); }
  };
  const sendCode = async () => {
    if (request.current) return;
    request.current = true; setBusy(true); setSuccess(false);
    try {
      const current = await supabase.auth.getUser();
      if (current.error || current.data.user?.id !== userId) { setMessage('Reconnectez-vous à votre compte.'); return; }
      const { error } = await supabase.auth.reauthenticate();
      setMessage(error ? "Impossible d'envoyer le code pour le moment." : 'Un code de vérification a été envoyé à votre adresse e-mail ou à votre numéro associé au compte.');
    } catch { setMessage("Impossible d'envoyer le code pour le moment."); }
    finally { request.current = false; setBusy(false); }
  };
  const inputClass = 'mt-1 w-full rounded-xl border border-[var(--loboko-border)] bg-[var(--loboko-bg)] px-3 py-3 text-base disabled:opacity-50';
  return <div>
    <button type="button" onClick={toggle} disabled={busy} aria-expanded={open} aria-controls="password-settings"
      className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-[var(--loboko-surface-hover)]">
      <KeyRound size={18} className="text-[#2563eb] shrink-0" />
      <span className="flex-1 text-sm font-medium">Changer le mot de passe</span>
      <ChevronDown size={16} className={open ? 'rotate-180' : ''} />
    </button>
    {open && <form id="password-settings" onSubmit={save} className="space-y-3 px-4 pb-4">
      <p className="text-xs text-[var(--loboko-text-secondary)]">Utilisez un mot de passe unique, de 8 caractères minimum.</p>
      <label className="block text-sm">Nouveau mot de passe
        <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} className={inputClass} />
      </label>
      <label className="block text-sm">Confirmer le nouveau mot de passe
        <input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy} className={inputClass} />
      </label>
      {needsCode && <div className="space-y-2">
        <button type="button" disabled={busy} onClick={sendCode} className="text-sm text-[#2563eb] disabled:opacity-50">Recevoir un code de vérification</button>
        <label className="block text-sm">Code de vérification
          <input type="text" autoComplete="one-time-code" inputMode="numeric" value={nonce} onChange={e => setNonce(e.target.value)} disabled={busy} className={inputClass} />
        </label>
      </div>}
      {message && <p role="status" className={`text-sm ${success ? 'text-green-500' : 'text-[var(--loboko-text-secondary)]'}`}>{message}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#2563eb] py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Veuillez patienter…' : 'Enregistrer le mot de passe'}</button>
    </form>}
  </div>;
}
