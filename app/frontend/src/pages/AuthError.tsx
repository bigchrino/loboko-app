import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

export default function AuthErrorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const errorMessage = searchParams.get('msg') || 'Votre lien de connexion est invalide ou a expiré. Réessayez de vous connecter.';
  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-[var(--loboko-bg)] p-6 text-center text-[var(--loboko-text)]">
      <section className="w-full max-w-md rounded-3xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] p-6 space-y-5">
        <AlertCircle size={44} className="mx-auto text-red-500" aria-hidden="true" />
        <h1 className="text-2xl font-bold">Connexion impossible</h1>
        <p role="alert" className="text-sm leading-relaxed text-[var(--loboko-text-secondary)]">{errorMessage}</p>
        <button type="button" onClick={() => navigate('/', { replace: true })} className="min-h-12 w-full rounded-xl bg-[#2563eb] px-4 py-3 font-semibold text-white">Retour à la connexion</button>
      </section>
    </main>
  );
}
