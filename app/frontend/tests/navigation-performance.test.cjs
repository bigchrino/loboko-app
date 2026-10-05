const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { module, exports: module.exports,
    require: (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' };
      return { __esModule: true, default: () => null };
    }, console, setTimeout, clearTimeout, ...globals }, { filename: file });
  return module.exports;
}

function preloadModule(connection) {
  return load('src/lib/page-preload.ts', { react: { lazy: (loader) => ({ loader }) } }, { navigator: { connection } });
}

test('intent preloading and navigation share a single request', async () => {
  const api = preloadModule();
  let calls = 0;
  const page = api.lazyPage(async () => { calls++; return { default: () => null }; });
  api.registerPageRoute('/discover', page);
  await Promise.all([api.preloadPage('/discover'), api.preloadPage('/discover?query=test'), page.loader()]);
  assert.equal(calls, 1);
});

test('dynamic routes, exact matching and missing routes', async () => {
  const api = preloadModule();
  let calls = 0;
  api.registerPageRoute('/messages/group/:groupId', api.lazyPage(async () => { calls++; return { default: () => null }; }));
  await api.preloadPage('/messages/group/test#bottom');
  assert.equal(calls, 1);
  await api.preloadPage('/messages/group/test/info');
  await api.preloadPage('/unknown');
  assert.equal(calls, 1);
  let dotted = 0;
  api.registerPageRoute('/a.b', api.lazyPage(async () => { dotted++; return { default: () => null }; }));
  await api.preloadPage('/axb');
  assert.equal(dotted, 0);
  await api.preloadPage('/a.b');
  assert.equal(dotted, 1);
});

test('failed preloading does not poison a later navigation', async () => {
  const api = preloadModule();
  let attempts = 0;
  const page = api.lazyPage(async () => {
    if (++attempts === 1) throw new Error('offline');
    return { default: () => null };
  });
  api.registerPageRoute('/home', page);
  await api.preloadPage('/home');
  await page.loader();
  assert.equal(attempts, 2);
});

test('save-data and slow networks opt out of speculative loads', () => {
  for (const connection of [{ saveData: true }, { effectiveType: '2g' }, { effectiveType: '3g' }]) {
    assert.equal(preloadModule(connection).canPreloadPages(), false);
  }
  assert.equal(preloadModule({ effectiveType: '4g' }).canPreloadPages(), true);
  assert.equal(preloadModule().canPreloadPages(), true);
});

function scrollHarness() {
  const winEvents = new Map(), docEvents = new Map();
  let effect, location = { key: 'first', pathname: '/discover', hash: '' }, navigation = 'PUSH';
  let resize;
  const win = { scrollY: 0, maxScroll: 2000, scrollTo: ({ top }) => { win.scrollY = Math.min(top, win.maxScroll); },
    addEventListener: (key, fn) => winEvents.set(key, fn), removeEventListener: (key) => winEvents.delete(key) };
  const doc = { body: {}, getElementById: () => ({}), addEventListener: (key, fn) => docEvents.set(key, fn), removeEventListener: (key) => docEvents.delete(key) };
  const api = load('src/lib/use-page-scroll.ts', {
    react: { useLayoutEffect: (fn) => { effect = fn; } },
    'react-router-dom': { useLocation: () => location, useNavigationType: () => navigation },
  }, { window: win, document: doc, ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} disconnect() { resize = undefined; } } });
  return { win, mount(owner, next, type = 'PUSH', managed = false) {
    location = next; navigation = type;
    api.usePageScroll(owner, managed);
    return effect();
  }, save() { winEvents.get('scroll')?.(); }, resize() { resize?.(); }, touch() { winEvents.get('touchstart')?.(); } };
}

test('new pages start at the top; back restores after async content grows', () => {
  const h = scrollHarness();
  const first = { key: 'first', pathname: '/discover', hash: '' };
  let cleanup = h.mount('a', first);
  h.win.scrollY = 800; h.save(); cleanup();
  cleanup = h.mount('a', { key: 'second', pathname: '/profile', hash: '' });
  assert.equal(h.win.scrollY, 0); cleanup();
  h.win.maxScroll = 50;
  cleanup = h.mount('a', first, 'POP');
  assert.equal(h.win.scrollY, 50);
  h.win.maxScroll = 2000; h.resize();
  assert.equal(h.win.scrollY, 800); cleanup();
  cleanup = h.mount('b', first, 'POP');
  assert.equal(h.win.scrollY, 0); cleanup();
});

test('feed and chat retain their own restoration; user gesture cancels a pending restore', () => {
  const h = scrollHarness();
  for (const [pathname, managed] of [['/home', false], ['/post/test', false], ['/messages', true]]) {
    h.win.scrollY = 300;
    h.mount('a', { key: pathname, pathname, hash: '' }, 'PUSH', managed);
    assert.equal(h.win.scrollY, 300);
  }
  const first = { key: 'scroll', pathname: '/discover', hash: '' };
  let cleanup = h.mount('a', first);
  h.win.scrollY = 800; h.save(); cleanup();
  h.win.maxScroll = 10; cleanup = h.mount('a', first, 'POP');
  h.touch(); h.win.scrollY = 5; h.win.maxScroll = 2000; h.resize();
  assert.equal(h.win.scrollY, 5); cleanup();
});

test('post counters and author requests start together; unmounted cards ignore late replies', async () => {
  const effects = [], updates = [], requests = [];
  let resolve;
  const response = new Promise((done) => { resolve = done; });
  const chain = () => {
    const query = { then: response.then.bind(response) };
    for (const key of ['select', 'eq', 'maybeSingle']) query[key] = () => query;
    return query;
  };
  const api = load('src/components/PostCard.tsx', {
    react: { lazy: (fn) => ({ fn }), Suspense: 'suspense',
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, (value) => updates.push(value)],
      useLayoutEffect: () => {}, useEffect: (fn) => effects.push(fn) },
    'react-router-dom': { useLocation: () => ({ state: null }), useNavigate: () => () => {} },
    '@/lib/supabase': { supabase: { from: (table) => { requests.push(table); return chain(); } } },
    '@/lib/post-view-cache': { readPostView: () => undefined, savePostView: () => {} },
    '@/lib/format-time': { formatPostTime: () => 'maintenant' },
  });
  api.default({ post: { id: 'post', user_id: 'author', content: 'test' }, currentUserId: 'viewer' });
  const cleanup = effects[0]();
  assert.equal(requests.length, 5);
  cleanup();
  resolve({ data: null, count: 10, error: null });
  await new Promise((done) => setImmediate(done));
  assert.equal(updates.length, 0);
});
