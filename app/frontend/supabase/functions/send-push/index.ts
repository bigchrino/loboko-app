// LOBOKO Web Push. Signing keys come from env or encrypted Supabase Vault.
// Authentication, persisted-event authorization and deduplication precede delivery.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.1';
import webpush from 'https://esm.sh/web-push@3.6.7';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...headers, 'Content-Type': 'application/json' },
});
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function validPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    return url.hostname === 'fcm.googleapis.com' || url.hostname === 'web.push.apple.com'
      || url.hostname.endsWith('.push.services.mozilla.com')
      || url.hostname.endsWith('.notify.windows.com');
  } catch { return false; }
}

export function preview(raw: string): string {
  let text = raw || '';
  try {
    const payload = JSON.parse(text);
    if (payload && typeof payload === 'object') {
      const labels: Record<string, string> = { image: '📷 Photo', video: '🎬 Vidéo', audio: '🎤 Message vocal', voice: '🎤 Message vocal', file: '📎 Fichier', call_event: '📞 Appel' };
      text = payload.kind === 'text' ? String(payload.text || '') : labels[payload.kind] || 'Nouveau message';
    }
  } catch { /* Plain text is a supported message format. */ }
  return text.replace(/\s+/g, ' ').trim().slice(0, 120) || 'Nouveau message';
}

export async function handlePush(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authHeader = req.headers.get('Authorization') || '';
  if (!/^Bearer\s+\S+$/i.test(authHeader)) return json({ error: 'Unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) return json({ error: 'Server configuration unavailable' }, 503);
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') || '', {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData?.user) return json({ error: 'Invalid session' }, 401);
  const senderId = userData.user.id;
  let payload;
  try { payload = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!payload || !uuid(payload.recipient_user_id)) return json({ error: 'Invalid recipient' }, 400);
  const recipientId = payload.recipient_user_id;
  const kind = payload.kind || 'dm';
  if (!['dm', 'group', 'mention', 'urgent_order', 'test'].includes(kind)) return json({ error: 'Invalid kind' }, 400);
  if (kind === 'test' && recipientId !== senderId) return json({ error: 'Test is limited to your own account' }, 403);
  if (recipientId === senderId && kind !== 'test') return json({ skipped: 'self' });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profiles, error: profileError } = await admin.from('profile_directory')
    .select('user_id, display_name, username').in('user_id', [senderId, recipientId]);
  if (profileError) return json({ error: 'Account lookup unavailable' }, 503);
  const sender = profiles?.find(p => p.user_id === senderId);
  const recipient = profiles?.find(p => p.user_id === recipientId);
  if (!sender || !recipient) return json({ error: 'Inactive account' }, 403);
  if (kind !== 'test') {
    const { data: blocks, error } = await admin.from('blocked_users').select('id')
      .or(`and(owner_id.eq.${senderId},blocked_id.eq.${recipientId}),and(owner_id.eq.${recipientId},blocked_id.eq.${senderId})`).limit(1);
    if (error) return json({ error: 'Authorization unavailable' }, 503);
    if (blocks?.length) return json({ skipped: 'blocked' });
  }
  const recent = new Date(Date.now() - 5 * 60_000).toISOString();
  const name = sender.display_name || sender.username || 'LOBOKO';
  let title = name, body = '', eventKey = '', data: Record<string, unknown> = {};
  let groupMention = false;
  const input = payload.data && typeof payload.data === 'object' ? payload.data : {};
  if (kind === 'dm') {
    const { data: rows, error } = await admin.from('messages').select('id,content')
      .eq('user_id', senderId).eq('receiver_id', recipientId).gte('created_at', recent)
      .is('deleted_for_everyone_at', null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false }).limit(1);
    if (error) return json({ error: 'Message lookup unavailable' }, 503);
    const message = rows?.[0];
    if (!message) return json({ error: 'No authorized message' }, 403);
    eventKey = `dm:${message.id}`; body = preview(message.content);
    data = { type: 'dm', conversation_id: senderId, message_id: message.id };
  } else if (kind === 'group' || (kind === 'mention' && input.type === 'group')) {
    if (!uuid(input.conversation_id)) return json({ error: 'Invalid group' }, 400);
    const groupId = input.conversation_id;
    const { data: members, error: memberError } = await admin.from('group_members').select('user_id')
      .eq('group_id', groupId).in('user_id', [senderId, recipientId]);
    if (memberError) return json({ error: 'Membership lookup unavailable' }, 503);
    if (members?.length !== 2) return json({ error: 'Group membership required' }, 403);
    const { data: group } = await admin.from('groups').select('name').eq('id', groupId).is('deleted_at', null).maybeSingle();
    if (!group) return json({ error: 'Group unavailable' }, 403);
    const { data: rows, error } = await admin.from('group_messages').select('id,content')
      .eq('group_id', groupId).eq('user_id', senderId).gte('created_at', recent)
      .is('deleted_for_everyone_at', null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false }).limit(1);
    if (error) return json({ error: 'Message lookup unavailable' }, 503);
    const message = rows?.[0];
    if (!message) return json({ error: 'No authorized group message' }, 403);
    const escaped = String(recipient.username || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    groupMention = !!escaped && new RegExp(`@(?:${escaped}|tous|all)(?![A-Za-z0-9_.-])`, 'i').test(message.content);
    eventKey = `group:${message.id}`; title = `${name} • ${group.name}`; body = preview(message.content);
    data = { type: 'group', conversation_id: groupId, message_id: message.id };
  } else if (kind === 'urgent_order') {
    if (!uuid(input.order_id)) return json({ error: 'Invalid order' }, 400);
    const { data: order } = await admin.from('service_orders').select('id,provider_id,prestataire_id')
      .eq('id', input.order_id).eq('client_id', senderId).eq('urgency_level', 'urgent').gte('created_at', recent).maybeSingle();
    if (!order || (order.provider_id || order.prestataire_id) !== recipientId) return json({ error: 'No authorized urgent order' }, 403);
    eventKey = `urgent_order:${order.id}`; title = 'Nouvelle demande urgente'; body = `${name} a besoin de votre intervention.`;
    data = { type: 'urgent_order', order_id: order.id };
  } else if (kind === 'mention') {
    // Use an existing in-app notification, not arbitrary client-provided text.
    const findMention = () => {
      let query = admin.from('notifications').select('id,post_id,message,type').eq('user_id', recipientId)
        .eq('from_user_id', senderId).gte('created_at', recent);
      if (uuid(input.post_id)) query = query.eq('post_id', input.post_id);
      return query.order('created_at', { ascending: false }).limit(1);
    };
    let { data: rows, error } = await findMention();
    if (!error && !rows?.length) { await new Promise(resolve => setTimeout(resolve, 250)); ({ data: rows, error } = await findMention()); }
    if (error) return json({ error: 'Notification lookup unavailable' }, 503);
    const notification = rows?.[0];
    if (!notification || !String(notification.message || '').includes('mentionné')) return json({ error: 'No authorized mention' }, 403);
    eventKey = `mention:${notification.id}`; title = 'Vous avez été mentionné'; body = `${name} ${notification.message}`;
    data = notification.post_id ? { type: 'post', post_id: notification.post_id } : { type: 'notification' };
  } else {
    title = 'LOBOKO'; body = 'Les notifications push fonctionnent sur cet appareil.'; data = { type: 'test' };
    // Self-test is restricted to the authenticated account.
    eventKey = `mention:${crypto.randomUUID()}`;
  }
  const { data: pref, error: prefError } = await admin.from('push_preferences')
    .select('dm_enabled,groups_enabled,mentions_only').eq('user_id', recipientId).maybeSingle();
  if (prefError) return json({ error: 'Preferences unavailable' }, 503);
  if (kind === 'dm' && pref?.dm_enabled === false) return json({ skipped: 'dm_off' });
  if (data.type === 'group' && (pref?.groups_enabled === false || (pref?.mentions_only && !groupMention))) return json({ skipped: 'groups_off' });
  if (kind === 'mention' && data.type !== 'group' && pref?.dm_enabled === false && pref?.groups_enabled === false) return json({ skipped: 'all_off' });
  const { data: subs, error: subError } = await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', recipientId);
  if (subError) return json({ error: 'Subscriptions unavailable' }, 503);
  if (!subs?.length) return json({ delivered: 0 });
  let publicKey = Deno.env.get('VAPID_PUBLIC_KEY'), privateKey = Deno.env.get('VAPID_PRIVATE_KEY'), subject = Deno.env.get('VAPID_SUBJECT');
  if (!publicKey || !privateKey || !subject) {
    const { data: config, error } = await admin.rpc('loboko_push_configuration');
    if (error || !config) return json({ error: 'Push configuration unavailable' }, 503);
    publicKey = config.public_key; privateKey = config.private_key; subject = config.subject;
  }
  try { webpush.setVapidDetails(subject, publicKey, privateKey); } catch { return json({ error: 'Invalid push configuration' }, 503); }
  const { data: claimed, error: claimError } = await admin.rpc('loboko_claim_push_delivery', { p_event_key: eventKey, p_recipient_id: recipientId });
  if (claimError) return json({ error: 'Delivery claim unavailable' }, 503);
  if (!claimed) return json({ skipped: 'duplicate' });
  let delivered = 0, failed = 0;
  const stale: string[] = [];
  const notification = JSON.stringify({ title, body, data });
  await Promise.all(subs.slice(0, 20).map(async sub => {
    if (!validPushEndpoint(sub.endpoint)) { stale.push(sub.id); return; }
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, notification, { TTL: 300, timeout: 10_000 });
      delivered++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) stale.push(sub.id);
      else { failed++; console.error('[push] delivery failed', status || 'network'); }
    }
  }));
  if (stale.length) await admin.from('push_subscriptions').delete().in('id', stale);
  return json({ delivered, failed, cleaned: stale.length });
}

Deno.serve(handlePush);
