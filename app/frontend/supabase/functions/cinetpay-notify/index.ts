import { json, providerConfig, verifyPayment } from '../_shared/cinetpay.ts';

Deno.serve(async (req: Request) => {
  // CinetPay pings this endpoint using GET and posts form data for events.
  if (req.method === 'GET') return json({ received: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const contentType = req.headers.get('Content-Type') || '';
    const body = contentType.includes('application/json') ? await req.json()
      : Object.fromEntries(new URLSearchParams(await req.text()));
    const transactionId = body.cpm_trans_id || body.transaction_id;
    if (typeof transactionId !== 'string' || !/^LBK[0-9a-f]{32}$/i.test(transactionId)) return json({ error: 'Invalid transaction' }, 400);
    const config = providerConfig();
    if (String(body.cpm_site_id || body.site_id) !== config.site_id) return json({ error: 'Invalid merchant' }, 400);
    // The posted status is deliberately ignored; payment/check is authoritative.
    const result = await verifyPayment(transactionId);
    return json({ received: true, status: result.status });
  } catch {
    console.error('[cinetpay-notify] verification unavailable');
    return json({ error: 'Verification unavailable' }, 503);
  }
});
