// Supabase Edge Function — send-push
// ---------------------------------------------------------------
// Signs a Web Push payload with VAPID and dispatches it to every
// push_subscriptions row of the recipient. Cleans up 404/410 endpoints.
//
// Required secrets (Supabase → Settings → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT        e.g. mailto:admin@loboko.app
//
// Deploy:
//   supabase functions deploy send-push
// ---------------------------------------------------------------

// @ts-nocheck — Deno runtime, types not available in this TS project.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import webpush from 'https://esm.sh/web-push@3.6.7';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type Payload = {
  recipient_user_id: string;
  kind?: 'dm' | 'group' | 'mention';
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return jsonResponse({ error: 'VAPID keys not configured' }, 500);
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return jsonResponse({ error: 'Supabase env missing' }, 500);
  }

  // Identify the caller via their JWT.
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return jsonResponse({ error: 'Unauthorized' }, 401);

  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: 'Invalid session' }, 401);
  }
  const senderId = userData.user.id;

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!payload?.recipient_user_id || !payload?.title || !payload?.body) {
    return jsonResponse({ error: 'Missing fields' }, 400);
  }
  if (payload.recipient_user_id === senderId) {
    // Never notify self.
    return jsonResponse({ skipped: 'self' }, 200);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Load preferences (defaults: all on).
  const { data: prefRow } = await admin
    .from('push_preferences')
    .select('dm_enabled, groups_enabled, mentions_only')
    .eq('user_id', payload.recipient_user_id)
    .maybeSingle();
  const pref = prefRow ?? {
    dm_enabled: true,
    groups_enabled: true,
    mentions_only: false,
  };

  const kind = payload.kind ?? 'dm';
  if (kind === 'dm' && !pref.dm_enabled) return jsonResponse({ skipped: 'dm_off' }, 200);
  if (kind === 'group') {
    if (!pref.groups_enabled) return jsonResponse({ skipped: 'groups_off' }, 200);
    if (pref.mentions_only) {
      return jsonResponse({ skipped: 'mentions_only' }, 200);
    }
  }
  // mentions always pass (unless groups fully disabled).
  if (kind === 'mention' && !pref.groups_enabled && !pref.dm_enabled) {
    return jsonResponse({ skipped: 'all_off' }, 200);
  }

  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', payload.recipient_user_id);
  if (subErr) return jsonResponse({ error: subErr.message }, 500);
  if (!subs || subs.length === 0) return jsonResponse({ delivered: 0 }, 200);

  const notificationJson = JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  });

  let delivered = 0;
  const toDelete: string[] = [];
  await Promise.all(
    subs.map(async (row) => {
      const sub = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        await webpush.sendNotification(sub, notificationJson, { TTL: 60 });
        delivered += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          toDelete.push(row.id);
        } else {
          // eslint-disable-next-line no-console
          console.error('[send-push] delivery error', status, err);
        }
      }
    }),
  );

  if (toDelete.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', toDelete);
  }

  return jsonResponse({ delivered, cleaned: toDelete.length }, 200);
});