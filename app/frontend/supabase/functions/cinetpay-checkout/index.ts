import { authenticatedUser, cors, json, providerConfig, serverClient, uuid } from '../_shared/cinetpay.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  try {
    const user = await authenticatedUser(req);
    if (!user) return json({ error: 'Connectez-vous pour payer.' }, 401);
    const payload = await req.json();
    if (!uuid(payload.order_id)) return json({ error: 'Commande invalide.' }, 400);
    const config = providerConfig();
    const exchangeRate = Number(Deno.env.get('USD_CDF_RATE'));
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw new Error('PAYMENT_NOT_CONFIGURED');
    const appUrl = new URL(Deno.env.get('LOBOKO_APP_URL') || 'https://loboko-app.vercel.app');
    if (appUrl.protocol !== 'https:') throw new Error('PAYMENT_NOT_CONFIGURED');
    const db = serverClient();
    const { data: order, error } = await db.from('product_orders')
      .select('id,client_id,total_price,status,payment_status').eq('id', payload.order_id).maybeSingle();
    if (error || !order || order.client_id !== user.id) return json({ error: 'Commande introuvable.' }, 404);
    if (order.status !== 'pending' || order.payment_status !== 'pending') {
      return json({ error: 'Cette commande ne peut plus être payée.' }, 409);
    }
    const amount = Math.ceil(Number(order.total_price) * exchangeRate / 5) * 5;
    if (!Number.isSafeInteger(amount) || amount <= 0) return json({ error: 'Montant non valide.' }, 400);
    const transactionId = `LBK${crypto.randomUUID().replaceAll('-', '')}`;
    const { data: intent, error: beginError } = await db.rpc('begin_cinetpay_product_payment', {
      p_order_id: order.id, p_transaction_id: transactionId, p_amount: amount, p_exchange_rate: exchangeRate,
    });
    if (beginError || !intent) return json({ error: 'Impossible de préparer ce paiement.' }, 409);
    if (intent.transaction_id !== transactionId) {
      if (intent.checkout_url) return json({ payment_url: intent.checkout_url, amount: intent.amount, currency: intent.currency });
      return json({ error: 'Un paiement est déjà en cours de vérification. Utilisez « Vérifier le paiement ».' }, 409);
    }
    const response = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...config, transaction_id: transactionId, amount, currency: 'CDF',
        description: `Commande LOBOKO ${order.id.slice(0, 8)}`,
        notify_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/cinetpay-notify`,
        return_url: `${appUrl.origin}/my-product-orders?payment=return&order_id=${order.id}`,
        channels: 'MOBILE_MONEY', lang: 'fr', metadata: order.id,
      }), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('PROVIDER_UNAVAILABLE');
    const result = await response.json();
    const paymentUrl = result.data?.payment_url;
    if (String(result.code) !== '201' || typeof paymentUrl !== 'string') {
      // An explicit initialization failure permits retry/cancellation. Network uncertainty does not.
      await db.from('product_payment_intents').update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', intent.id).eq('status', 'pending');
      return json({ error: 'Le fournisseur n’a pas pu ouvrir le paiement. Réessayez plus tard.' }, 502);
    }
    const checkout = new URL(paymentUrl);
    if (checkout.protocol !== 'https:' || !(checkout.hostname === 'cinetpay.com' || checkout.hostname.endsWith('.cinetpay.com') || checkout.hostname === 'cinetpay.co' || checkout.hostname.endsWith('.cinetpay.co'))) {
      throw new Error('PROVIDER_UNAVAILABLE');
    }
    const { error: saveError } = await db.from('product_payment_intents')
      .update({ checkout_url: paymentUrl, updated_at: new Date().toISOString() }).eq('id', intent.id);
    if (saveError) throw new Error('PROVIDER_UNAVAILABLE');
    return json({ payment_url: paymentUrl, amount, currency: 'CDF' });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    console.error('[checkout]', ['PAYMENT_NOT_CONFIGURED','PROVIDER_UNAVAILABLE'].includes(code) ? code : 'REQUEST_FAILED');
    return json({ error: code === 'PAYMENT_NOT_CONFIGURED'
      ? 'Le paiement électronique sera disponible après activation du compte marchand LOBOKO.'
      : 'Le paiement est momentanément indisponible. Votre commande reste accessible dans Mes commandes.' }, 503);
  }
});
