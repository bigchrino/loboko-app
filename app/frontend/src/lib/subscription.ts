import type { Profile } from '@/contexts/AuthContext';

/**
 * Subscription helpers.
 *
 * A provider is considered premium when:
 *   - `subscription_type === 'premium'`, AND
 *   - either `subscription_expires_at` is null (open-ended) or in the future.
 *
 * Older accounts without these columns default to `free` server-side, so
 * the check degrades gracefully.
 */

export interface PremiumCapableProfile {
  subscription_type?: 'free' | 'premium';
  subscription_expires_at?: string | null;
}

export function isPremium(profile?: PremiumCapableProfile | null): boolean {
  if (!profile) return false;
  if (profile.subscription_type !== 'premium') return false;
  if (!profile.subscription_expires_at) return true;
  return new Date(profile.subscription_expires_at).getTime() > Date.now();
}

/**
 * Comparator that sorts a provider list by:
 *   1. premium first
 *   2. then by the original order (server-provided), preserved via `keyFn`
 *
 * The second dimension stays implicit — we only flip equal items so the
 * caller-decided ordering (rating, recent, jobs…) stays intact.
 */
export function premiumFirst<T extends PremiumCapableProfile>(
  a: T,
  b: T,
): number {
  const ap = isPremium(a) ? 1 : 0;
  const bp = isPremium(b) ? 1 : 0;
  return bp - ap;
}

/** Nice human-readable expiry (e.g. "expire dans 12 jours") or null. */
export function describePremiumExpiry(
  profile?: PremiumCapableProfile | null,
): string | null {
  if (!isPremium(profile)) return null;
  const exp = profile?.subscription_expires_at;
  if (!exp) return 'Premium — illimité';
  const ms = new Date(exp).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (days <= 1) return 'Premium — expire dans 1 jour';
  if (days < 30) return `Premium — expire dans ${days} jours`;
  const months = Math.round(days / 30);
  return months <= 1
    ? 'Premium — environ 1 mois restant'
    : `Premium — environ ${months} mois restants`;
}