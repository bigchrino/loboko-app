const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function setup(options = {}) {
  const calls = []; let existing = options.existing || null;
  const subscription = { endpoint: 'https://fcm.googleapis.com/test', toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/test', keys: { p256dh: 'public', auth: 'auth' } }), unsubscribe: async () => true };
  const registration = { pushManager: { getSubscription: async () => existing, subscribe: async () => { calls.push('subscribe'); existing = subscription; return subscription; } } };
  const serviceWorker = { getRegistration: async () => options.registered ? registration : null, register: async () => { calls.push('register'); return registration; }, ready: Promise.resolve(registration) };
  const supabase = { auth: { getUser: async () => { calls.push('auth'); return { data: { user: options.noUser ? null : { id: 'user' } } }; } },
    from: () => { const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: options.saved ? { id: 'saved' } : null, error: null }), upsert: async () => { calls.push('save'); return { error: options.saveError ? 'denied' : null }; } }; return query; } };
  const source = fs.readFileSync(path.join(__dirname, '../../src/lib/push-notifications.ts'), 'utf8').replace("(import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || ''", JSON.stringify(Buffer.alloc(65, 1).toString('base64url')));
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: () => ({ supabase }), window: { PushManager: function(){}, Notification: function(){}, matchMedia: () => ({ matches: false }) }, navigator: { serviceWorker, userAgent: 'Chrome' }, Notification: { permission: options.denied ? 'denied' : 'default', requestPermission: async () => { calls.push('permission'); return 'granted'; } }, Date, Uint8Array, atob, console: { error: () => {} } });
  return { ...mod.exports, calls, subscription };
}
test('permission retains button gesture and subscription waits for worker before saving', async () => {
  const s = setup(); assert.equal((await s.subscribeCurrentUser()).ok, true);
  assert.deepEqual(s.calls, ['permission', 'auth', 'register', 'subscribe', 'save']);
});
test('registration requires both browser subscription and own database row', async () => {
  const a = setup({ registered: true, existing: { endpoint: 'endpoint' }, saved: false }); assert.equal(await a.isSubscribed(), false);
  const b = setup({ registered: true, existing: { endpoint: 'endpoint' }, saved: true }); assert.equal(await b.isSubscribed(), true);
});
test('denied permission, missing session and failed database save do not report enabled', async () => {
  assert.equal((await setup({ denied: true }).subscribeCurrentUser()).reason, 'denied');
  assert.equal((await setup({ noUser: true }).subscribeCurrentUser()).reason, 'not-authed');
  assert.equal((await setup({ saveError: true }).subscribeCurrentUser()).reason, 'error');
});
