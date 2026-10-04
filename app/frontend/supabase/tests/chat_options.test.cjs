const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { File } = require('node:buffer');
function load(name, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../../src/lib/', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (!(name in dependencies)) throw new Error('Unexpected import ' + name);
    return dependencies[name];
  }, ...globals });
  return module.exports;
}
const format = load('message-format');
const plain = value => JSON.parse(JSON.stringify(value));
function forwardSetup(options = {}) {
  const calls = [];
  const api = load('forward-content', {
    '@/lib/supabase': { supabase: {
      storage: { from: bucket => ({ download: async object => {
        calls.push(['download', bucket, object]);
        return { data: new Blob(['photo'], { type: 'image/jpeg' }), error: options.readError || null };
      } }) },
      from: table => ({ insert: async rows => { calls.push(['insert', table, plain(rows)]); return { error: options.insertError || null }; } }),
    } },
    '@/lib/message-format': format,
    '@/lib/storage-helpers': { uploadMediaEx: async (file, bucket, config) => {
      calls.push(['upload', bucket, file.name, file.type, plain(config)]);
      return options.uploadError ? { key: null, error: 'Upload refusé' } : { key: bucket + '::owner/copy.jpg', error: null };
    } },
    '@/lib/ephemeral': {
      loadDmEphemeralDuration: async (_, peer) => peer === 'ephemeral' ? 3600 : 0,
      computeExpiresAt: duration => duration > 0 ? '2030-01-01T01:00:00Z' : null,
    },
    '@/lib/push-trigger': { triggerPushNotification: args => calls.push(['push', args.recipientId]) },
  }, { File, Blob });
  return { ...api, calls };
}
test('private image forwarding copies the attachment and retains caption', async () => {
  const api = forwardSetup();
  const raw = format.encodePayload({ kind: 'image', object_key: 'message-media::original/photo.jpg', caption: 'Photo 👋' });
  const result = plain(format.decodePayload(await api.prepareForwardContent(raw)));
  assert.deepEqual(result, { kind: 'image', object_key: 'message-media::owner/copy.jpg', caption: 'Photo 👋' });
  assert.equal(api.calls[0][0], 'download');
  assert.deepEqual(api.calls[1], ['upload', 'message-media', 'photo.jpg', 'image/jpeg', { skipImageCompression: true }]);
});
test('read or upload failure never sends an inaccessible attachment', async () => {
  const raw = format.encodePayload({ kind: 'image', object_key: 'message-media::original/photo.jpg' });
  for (const options of [{ readError: 'denied' }, { uploadError: true }]) {
    const api = forwardSetup(options);
    await assert.rejects(api.forwardContentToContacts(raw, 'owner', ['peer']));
    assert.equal(api.calls.some(call => call[0] === 'insert'), false);
  }
});
test('system events, call signaling and foreign buckets are not forwardable', async () => {
  const api = forwardSetup();
  for (const payload of [
    { kind: 'system', system_type: 'ephemeral_setting', actor_id: 'user', duration_seconds: 0 },
    { kind: 'signal', callId: 'call', mode: 'voice', signal: { type: 'hangup' } },
    { kind: 'call_event', callId: 'call', mode: 'voice', event: 'missed' },
    { kind: 'image', object_key: 'avatars::other/photo.jpg' },
  ]) await assert.rejects(api.prepareForwardContent(format.encodePayload(payload)));
  assert.equal(api.calls.length, 0);
});
test('recipient batch is deduplicated and respects each destination expiry', async () => {
  const api = forwardSetup();
  await api.forwardContentToContacts('{"kind":"text","text":"Bonjour"}', 'owner', ['peer', 'ephemeral', 'peer']);
  const inserts = api.calls.filter(call => call[0] === 'insert');
  assert.equal(inserts.length, 1);
  assert.deepEqual(inserts[0][2], [
    { user_id: 'owner', receiver_id: 'peer', content: 'Bonjour', read: false },
    { user_id: 'owner', receiver_id: 'ephemeral', content: 'Bonjour', read: false, expires_at: '2030-01-01T01:00:00Z', is_ephemeral: true },
  ]);
  assert.equal(api.calls.filter(call => call[0] === 'push').length, 2);
});
test('failed batch never announces push delivery and invalid recipients fail before copying', async () => {
  const api = forwardSetup({ insertError: 'blocked' });
  await assert.rejects(api.forwardContentToContacts('Bonjour', 'owner', ['peer']));
  assert.equal(api.calls.some(call => call[0] === 'push'), false);
  for (const ids of [[], ['owner'], ['1','2','3','4','5','6']]) {
    const fresh = forwardSetup();
    await assert.rejects(fresh.forwardContentToContacts('Bonjour', 'owner', ids));
    assert.equal(fresh.calls.length, 0);
  }
});
test('theme preferences are scoped to owner and conversation and reject unavailable storage', () => {
  const values = new Map();
  const api = load('chat-theme', { react: {} }, { localStorage: {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  } });
  api.saveChatTheme('alice', 'dm:bob', 'blue');
  assert.equal(api.readChatTheme('alice', 'dm:bob'), 'blue');
  assert.equal(api.readChatTheme('bob', 'dm:alice'), 'default');
  assert.equal(api.readChatTheme('alice', 'group:bob'), 'default');
  assert.throws(() => api.saveChatTheme('alice', 'dm:bob', '__proto__'));
  const blocked = load('chat-theme', { react: {} }, { localStorage: { getItem: () => { throw Error(); }, setItem: () => { throw Error(); } } });
  assert.equal(blocked.readChatTheme('alice', 'dm:bob'), 'default');
  assert.throws(() => blocked.saveChatTheme('alice', 'dm:bob', 'green'));
});
