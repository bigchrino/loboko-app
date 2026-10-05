const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

function launch(route, options = {}) {
  let url = new URL(route, 'https://loboko-app.vercel.app');
  const values = new Map(options.previousPath ? [['loboko-last-window-path', options.previousPath]] : []);
  const replacements = [];
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/app-launch.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, URL, URLSearchParams,
    document: { referrer: options.referrer || '' },
    navigator: { standalone: options.iosStandalone },
    sessionStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    performance: { getEntriesByType: () => [{ type: options.type || 'navigate' }] },
    window: { get location() { return url; }, matchMedia: () => ({ matches: Boolean(options.standalone) }),
      history: { state: { key: 'old' }, replaceState: (state, unused, route) => {
        replacements.push({ state, route }); url = new URL(route, url);
      } } },
  });
  module.exports.prepareAppLaunch();
  return { route: url.pathname + url.search + url.hash, replacements, remembered: values.get('loboko-last-window-path') };
}

test('installed app reopens on home from settings, personal chats and groups', () => {
  for (const route of ['/settings', '/messages?to=contact', '/messages/group/example']) {
    const result = launch(route, { standalone: true });
    assert.equal(result.route, '/home');
    assert.equal(result.remembered, '/home');
    assert.equal(result.replacements[0].state, null);
  }
  assert.equal(launch('/discover', { iosStandalone: true }).route, '/home');
});

test('restored browser tab returns home; a fresh shared link stays on its destination', () => {
  assert.equal(launch('/messages?to=contact', { previousPath: '/messages?to=contact', type: 'back_forward' }).route, '/home');
  assert.equal(launch('/post/example').route, '/post/example');
  assert.equal(launch('/post/example', { previousPath: '/post/example', referrer: 'https://example.com/' }).route, '/post/example');
});

test('reload and authentication or public pages retain their route', () => {
  assert.equal(launch('/settings', { standalone: true, type: 'reload' }).route, '/settings');
  for (const route of ['/', '/onboarding', '/auth/callback?code=example', '/auth/error', '/contact', '/blog/article']) {
    assert.equal(launch(route, { standalone: true }).route, route);
  }
});

test('notification launch keeps its destination and removes only the launch marker', () => {
  for (const route of ['/notifications', '/messages?to=contact', '/messages/group/example', '/my-orders/example']) {
    const marked = route + (route.includes('?') ? '&' : '?') + 'loboko_launch=notification';
    const result = launch(marked, { standalone: true });
    assert.equal(result.route, route);
    assert.equal(result.remembered, route);
    assert.equal(result.replacements[0].state.key, 'old');
  }
});

test('notification clicks mark document launches but keep in-app fallback paths clean', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8');
  for (const existing of [true, false]) {
    const handlers = {};
    let destination;
    const self = { location: { origin: 'https://loboko-app.vercel.app' },
      addEventListener: (name, handler) => { handlers[name] = handler; },
      clients: { matchAll: async () => existing ? [{ url: 'https://loboko-app.vercel.app/home',
        focus: async () => {}, navigate: async route => { destination = route; } }] : [],
        openWindow: async route => { destination = route; } } };
    vm.runInNewContext(source, { self, URL, encodeURIComponent });
    let pending;
    handlers.notificationclick({ notification: { data: { type: 'dm', conversation_id: 'contact' }, close() {} },
      waitUntil: value => { pending = value; } });
    await pending;
    assert.equal(destination, '/messages?to=contact&loboko_launch=notification');
    assert.equal(launch(destination, { standalone: true }).route, '/messages?to=contact');
  }
});
