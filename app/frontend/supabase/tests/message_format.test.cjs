const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../../src/lib/message-format.ts'), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
vm.runInNewContext(code, { module: mod, exports: mod.exports });
const { decodePayload, encodePayload, isSignalRaw } = mod.exports;
const decode = (raw) => JSON.parse(JSON.stringify(decodePayload(raw)));

test('legacy unprefixed text becomes readable, including whitespace and escaped text', () => {
  const text = 'Bonjour 👋\nUne ligne avec "guillemets"';
  assert.deepEqual(decode('  ' + JSON.stringify({ kind: 'text', text }) + '\n'), { kind: 'text', text });
  assert.deepEqual(decode('{"text":"","kind":"text"}'), { kind: 'text', text: '' });
});

test('plain text and ordinary JSON remain intact', () => {
  for (const raw of ['Salut 👋', '{"text":"exemple"}', '{"kind":"text","text":"exemple","extra":true}', '[1,2]', 'null']) {
    assert.deepEqual(decode(raw), { kind: 'text', text: raw });
  }
  assert.deepEqual(decode(null), { kind: 'text', text: '' });
});

test('malformed or invalid legacy envelopes remain literal text', () => {
  for (const raw of ['{"kind":"text","text":', '{"kind":"text","text":null}', '{"kind":"text","text":42}', '{"kind":"text","text":{}}']) {
    assert.deepEqual(decode(raw), { kind: 'text', text: raw });
  }
});

test('unprefixed JSON cannot activate media or call signaling', () => {
  for (const value of [{ kind: 'image', object_key: 'image.jpg' }, { kind: 'signal', callId: 'old', mode: 'voice', signal: { type: 'hangup' } }]) {
    const raw = JSON.stringify(value);
    assert.deepEqual(decode(raw), { kind: 'text', text: raw });
    assert.equal(isSignalRaw(raw), false);
  }
});

test('current structured messages still round trip', () => {
  for (const payload of [
    { kind: 'text', text: 'Salut' },
    { kind: 'audio', object_key: 'voice.webm', duration: 4 },
    { kind: 'image', object_key: 'image.jpg', caption: 'Photo' },
    { kind: 'video', object_key: 'video.mp4', duration: 7, poster: 'data:image/jpeg;base64,test' },
    { kind: 'file', object_key: 'file.pdf', file_name: 'file.pdf', file_size: 123, file_type: 'pdf' },
    { kind: 'shared_post', post_id: 'post', preview: { text: 'Publication' } },
    { kind: 'system', system_type: 'ephemeral_setting', duration_seconds: 0, actor_id: 'user' },
    { kind: 'call_event', callId: 'call', mode: 'voice', event: 'missed' },
    { kind: 'signal', callId: 'call', mode: 'voice', signal: { type: 'ringing' } },
  ]) assert.deepEqual(decode(encodePayload(payload)), payload);
});

test('legacy text is never a signal and prefixed calls retain their detection', () => {
  assert.equal(isSignalRaw('{"kind":"text","text":"Bonjour"}'), false);
  assert.equal(isSignalRaw(encodePayload({ kind: 'call_event', callId: 'call', mode: 'voice', event: 'missed' })), true);
});
