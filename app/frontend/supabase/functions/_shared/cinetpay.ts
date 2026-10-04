import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.1';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});
export const uuid = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function serverClient() {
  return createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function providerConfig() {
  const apikey = Deno.env.get('CINETPAY_API_KEY');
  const site_id = Deno.env.get('CINETPAY_SITE_ID');
  if (!apikey || !site_id) throw new Error('PAYMENT_NOT_CONFIGURED');
  return { apikey, site_id };
}
export async function authenticatedUser(req: Request) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await serverClient().auth.getUser(token);
  return error ? null : data.user;
}

/** Only a server-to-server CinetPay verification can confirm a payment. */
export async function verifyPayment(transactionId: string) {
  const config = providerConfig();
  const db = serverClient();
  const { data: intent, error } = await db.from('product_payment_intents')
    .select('id,order_id,amount,currency,status').eq('transaction_id', transactionId).maybeSingle();
  if (error || !intent) throw new Error('PAYMENT_NOT_FOUND');
  if (intent.status === 'paid') return { status: 'paid' };
  const response = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...config, transaction_id: transactionId }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('PROVIDER_UNAVAILABLE');
  const verified = await response.json();
  const payment = verified.data;
  if (payment?.status === 'ACCEPTED' && String(verified.code) === '00') {
    if (Number(payment.amount) !== intent.amount || payment.currency !== intent.currency) {
      throw new Error('PAYMENT_MISMATCH');
    }
    const { error: confirmError } = await db.rpc('confirm_cinetpay_product_payment', {
      p_transaction_id: transactionId, p_amount: Number(payment.amount), p_currency: payment.currency,
    });
    if (confirmError) throw new Error('PAYMENT_CONFIRMATION_FAILED');
    return { status: 'paid' };
  }
  // Refusal/expiry is authoritative only when the verification API returns it.
  if (payment && ['REFUSED', 'EXPIRED'].includes(payment.status)) {
    const status = payment.status === 'EXPIRED' ? 'expired' : 'failed';
    const { error: updateError } = await db.from('product_payment_intents')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', intent.id).eq('status', 'pending');
    if (updateError) throw new Error('PAYMENT_UPDATE_FAILED');
    return { status };
  }
  return { status: intent.status };
}
