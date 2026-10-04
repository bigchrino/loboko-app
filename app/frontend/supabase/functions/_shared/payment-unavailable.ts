// Provider-neutral disabled payment boundary; no external calls or financial writes.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
export function paymentUnavailable(req: Request): Response {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  return new Response(JSON.stringify({
    code: 'PAYMENT_PROVIDER_NOT_CONFIGURED', enabled: false, provider: null,
    error: 'Le paiement en ligne sera disponible après le choix et le raccordement de l’agrégateur.',
  }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });
}
