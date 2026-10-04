import { supabase } from './supabase';

async function invokePayment<T>(name: string, orderId: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: { order_id: orderId } });
  if (error) {
    let message = 'Le paiement est momentanément indisponible.';
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.json();
        if (typeof payload.error === 'string') message = payload.error;
      } catch { /* Keep the readable fallback. */ }
    }
    throw new Error(message);
  }
  return data as T;
}

export async function openProductPayment(orderId: string): Promise<void> {
  const result = await invokePayment<{ payment_url: string; amount: number; currency: string }>('cinetpay-checkout', orderId);
  const url = new URL(result.payment_url);
  if (url.protocol !== 'https:' || !(url.hostname === 'cinetpay.com' || url.hostname.endsWith('.cinetpay.com') || url.hostname === 'cinetpay.co' || url.hostname.endsWith('.cinetpay.co'))) {
    throw new Error('Le lien de paiement n’est pas valide.');
  }
  window.location.assign(url.href);
}

export async function verifyProductPayment(orderId: string): Promise<string> {
  const result = await invokePayment<{ status: string }>('cinetpay-status', orderId);
  return result.status;
}
