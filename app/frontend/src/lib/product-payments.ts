import { assertPaymentSystemEnabled, PAYMENT_UNAVAILABLE_MESSAGE } from './payment-system';
/** Stable entry points reserved for the future provider adapter. No charge or redirect. */
export async function openProductPayment(_orderId: string): Promise<void> {
  assertPaymentSystemEnabled();
  throw new Error(PAYMENT_UNAVAILABLE_MESSAGE);
}
export async function verifyProductPayment(_orderId: string): Promise<string> {
  assertPaymentSystemEnabled();
  throw new Error(PAYMENT_UNAVAILABLE_MESSAGE);
}
