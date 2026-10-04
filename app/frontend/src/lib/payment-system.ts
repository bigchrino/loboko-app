/** Provider-neutral contract. Activation requires a verified server adapter. */
export const PAYMENT_SYSTEM = { enabled: false, provider: null } as const;
export const PAYMENT_UNAVAILABLE_MESSAGE = 'Le paiement en ligne sera disponible après le choix et le raccordement de l’agrégateur.';
export type PaymentPurpose = 'service' | 'product' | 'subscription' | 'advertising';
export interface PaymentRequest { purpose: PaymentPurpose; orderId: string; currency: string; }
export interface PaymentCheckout { transactionId: string; amount: number; currency: string; checkoutUrl: string; }
export function assertPaymentSystemEnabled(): void {
  if (!PAYMENT_SYSTEM.enabled) throw new Error(PAYMENT_UNAVAILABLE_MESSAGE);
}
