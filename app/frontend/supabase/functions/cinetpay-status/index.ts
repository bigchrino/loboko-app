import { authenticatedUser, cors, json, serverClient, uuid, verifyPayment } from '../_shared/cinetpay.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  try {
    const user = await authenticatedUser(req);
    if (!user) return json({ error: 'Connectez-vous pour consulter ce paiement.' }, 401);
    const payload = await req.json();
    if (!uuid(payload.order_id)) return json({ error: 'Commande invalide.' }, 400);
    const db = serverClient();
    const { data: order } = await db.from('product_orders').select('client_id,payment_status').eq('id', payload.order_id).maybeSingle();
    if (!order || order.client_id !== user.id) return json({ error: 'Commande introuvable.' }, 404);
    if (order.payment_status === 'paid') return json({ status: 'paid' });
    const { data: intent, error } = await db.from('product_payment_intents').select('transaction_id,status')
      .eq('order_id', payload.order_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!intent) return json({ status: 'not_started' });
    if (intent.status !== 'pending') return json({ status: intent.status });
    return json(await verifyPayment(intent.transaction_id));
  } catch {
    return json({ error: 'La vérification est momentanément indisponible. Réessayez plus tard.' }, 503);
  }
});
