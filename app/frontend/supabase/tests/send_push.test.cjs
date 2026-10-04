const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
const sender = '11111111-1111-4111-8111-111111111111';
const recipient = '22222222-2222-4222-8222-222222222222';
const group = '33333333-3333-4333-8333-333333333333';
const event = '44444444-4444-4444-8444-444444444444';
const file = path.join(__dirname, '../functions/send-push/index.ts');
const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function setup(options = {}) {
  const deliveries = [], calls = [], claims = [];
  const rows = {
    profile_directory: [{ user_id: sender, display_name: 'Alice', username: 'alice' }, { user_id: recipient, username: 'bob' }],
    blocked_users: [], messages: [{ id: event, content: 'Bonjour Bob' }],
    group_members: [{ user_id: sender }, { user_id: recipient }], groups: { name: 'Équipe' },
    group_messages: [{ id: event, content: 'Salut @bob' }], notifications: [{ id: event, message: 'vous a mentionné dans un commentaire', post_id: group }],
    service_orders: { id: event, provider_id: recipient }, push_preferences: null,
    push_subscriptions: [{ id: 'device', endpoint: 'https://fcm.googleapis.com/fcm/send/test', p256dh: 'key', auth: 'auth' }], ...options.rows,
  };
  const admin = {
    from(table) {
      const query = new Proxy({}, { get(_, method) {
        if (method === 'then') return resolve => resolve({ data: rows[table], error: null });
        return (...args) => { calls.push([table, method, ...args]); return query; };
      } }); return query;
    },
    rpc: async (name, args) => {
      claims.push([name, args]);
      return { data: name === 'loboko_push_configuration' ? { subject: 'https://loboko-app.vercel.app', public_key: 'public', private_key: 'private' } : options.duplicate ? false : true, error: null };
    },
  };
  const mod = { exports: {} };
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, Request, Response, URL, Date, setTimeout, crypto: webcrypto,
    console: { error: () => {} },
    Deno: { serve: () => {}, env: { get: name => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service', SUPABASE_ANON_KEY: 'anon' })[name] } },
    require: specifier => specifier.includes('supabase-js') ? { createClient: (_, key) => key === 'service' ? admin : { auth: { getUser: async () => options.invalidSession ? { error: 'invalid' } : { data: { user: { id: sender } } } } } } : { default: { setVapidDetails: () => {}, sendNotification: async (_, payload) => { deliveries.push(JSON.parse(payload)); if (options.deliveryError) throw { statusCode: options.deliveryError }; } } },
  });
  const invoke = async body => {
    const response = await mod.exports.handlePush(new Request('https://example/send-push', { method: 'POST', headers: { Authorization: 'Bearer session' }, body: JSON.stringify({ recipient_user_id: recipient, ...body }) }));
    return { status: response.status, body: await response.json() };
  };
  return { ...mod.exports, invoke, deliveries, calls, claims };
}
test('reject unauthenticated requests and self-tests targeting another account', async () => {
  const s = setup();
  assert.equal((await s.handlePush(new Request('https://example', { method: 'POST' }))).status, 401);
  assert.equal((await setup({ invalidSession: true }).invoke({ kind: 'dm' })).status, 401);
  assert.equal((await s.invoke({ kind: 'test' })).status, 403);
  assert.equal(s.deliveries.length, 0);
});
test('DM uses stored message and sender identity, not arbitrary client body/link', async () => {
  const s = setup(); const result = await s.invoke({ kind: 'dm', title: 'Fake admin', body: 'forged', data: { conversation_id: group } });
  assert.equal(result.body.delivered, 1);
  assert.equal(s.deliveries[0].title, 'Alice'); assert.equal(s.deliveries[0].body, 'Bonjour Bob');
  assert.equal(s.deliveries[0].data.conversation_id, sender);
  assert.ok(s.calls.some(c => c[0] === 'messages' && c[1] === 'eq' && c[2] === 'receiver_id' && c[3] === recipient));
});
test('absent event, inactive account and block all prevent delivery', async () => {
  for (const rows of [{ messages: [] }, { profile_directory: [] }]) {
    const s = setup({ rows }); assert.equal((await s.invoke({ kind: 'dm' })).status, 403); assert.equal(s.deliveries.length, 0);
  }
  const s = setup({ rows: { blocked_users: [{ id: 'block' }] } });
  assert.equal((await s.invoke({ kind: 'dm' })).body.skipped, 'blocked');
});
test('preferences and duplicate claims prevent extra notifications', async () => {
  assert.equal((await setup({ rows: { push_preferences: { dm_enabled: false } } }).invoke({ kind: 'dm' })).body.skipped, 'dm_off');
  const s = setup({ duplicate: true }); assert.equal((await s.invoke({ kind: 'dm' })).body.skipped, 'duplicate'); assert.equal(s.deliveries.length, 0);
});
test('group membership and actual mentions control group delivery', async () => {
  const data = { type: 'group', conversation_id: group };
  assert.equal((await setup({ rows: { group_members: [{ user_id: sender }] } }).invoke({ kind: 'group', data })).status, 403);
  const s = setup({ rows: { push_preferences: { mentions_only: true }, group_messages: [{ id: event, content: 'Sans mention' }] } });
  assert.equal((await s.invoke({ kind: 'mention', data })).body.skipped, 'groups_off');
  const mentioned = setup({ rows: { push_preferences: { mentions_only: true } } });
  assert.equal((await mentioned.invoke({ kind: 'mention', data })).body.delivered, 1);
  assert.equal(mentioned.deliveries[0].data.type, 'group');
});
test('expired subscription cleanup and unsafe endpoint rejection', async () => {
  const expired = setup({ deliveryError: 410 });
  assert.equal((await expired.invoke({ kind: 'dm' })).body.cleaned, 1);
  assert.ok(expired.calls.some(c => c[0] === 'push_subscriptions' && c[1] === 'delete'));
  const unsafe = setup({ rows: { push_subscriptions: [{ id: 'bad', endpoint: 'https://127.0.0.1/test' }] } });
  assert.equal((await unsafe.invoke({ kind: 'dm' })).body.cleaned, 1); assert.equal(unsafe.deliveries.length, 0);
  for (const endpoint of ['http://fcm.googleapis.com/a', 'https://fcm.googleapis.com.evil.com/a', 'https://user@fcm.googleapis.com/a']) assert.equal(unsafe.validPushEndpoint(endpoint), false);
  for (const endpoint of ['https://fcm.googleapis.com/a', 'https://web.push.apple.com/a', 'https://updates.push.services.mozilla.com/a']) assert.equal(unsafe.validPushEndpoint(endpoint), true);
});
test('self-test and mention routes are server-controlled', async () => {
  const s = setup(); assert.equal((await s.invoke({ kind: 'test', recipient_user_id: sender })).body.delivered, 1);
  assert.equal(s.deliveries[0].data.type, 'test');
  const m = setup(); assert.equal((await m.invoke({ kind: 'mention', data: { type: 'post', post_id: group } })).body.delivered, 1);
  assert.equal(m.deliveries[0].data.post_id, group);
});
