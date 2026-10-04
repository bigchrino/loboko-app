export interface AuthFormValues {
  mode: 'login' | 'register'; email: string; password: string; confirmation: string;
  displayName: string; role: 'client' | 'prestataire'; serviceId: string | null;
}

export function validateAuthForm(values: AuthFormValues): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return 'Indiquez une adresse e-mail valide.';
  if (!values.password) return 'Saisissez votre mot de passe.';
  if (values.mode === 'login') return null;
  if (!values.displayName.trim()) return 'Indiquez votre nom complet.';
  if (values.password.length < 8) return 'Choisissez un mot de passe de 8 caractères minimum.';
  if (values.password !== values.confirmation) return 'Les deux mots de passe ne correspondent pas.';
  if (values.role === 'prestataire' && !values.serviceId) return 'Choisissez votre service dans la liste LOBOKO.';
  return null;
}

export function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('identifiants invalides')) return 'L’e-mail ou le mot de passe est incorrect.';
  if (lower.includes('email not confirmed')) return 'Confirmez votre adresse e-mail avec le lien reçu avant de vous connecter.';
  if (lower.includes('already registered') || lower.includes('already been registered') || lower.includes('already exists')) return 'Cette adresse e-mail est déjà utilisée. Connectez-vous à votre compte.';
  if (lower.includes('rate limit') || lower.includes('too many')) return 'Trop de tentatives. Patientez quelques instants avant de réessayer.';
  if (lower.includes('weak password') || lower.includes('password should')) return 'Choisissez un mot de passe plus long et varié.';
  if (lower.includes('fetch') || lower.includes('network')) return 'Connexion impossible. Vérifiez votre accès à Internet et réessayez.';
  if (lower.includes('banni') || lower.includes('suspendu') || lower.includes('compte supprimé')) return message;
  return 'Impossible de continuer pour le moment. Réessayez ou contactez l’assistance.';
}
