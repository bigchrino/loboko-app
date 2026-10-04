const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function setup() {
  const events = {}, shown = [], opened = [];
  let clients = [];
  const self = { location: { origin: 'https://loboko-app.vercel.app' }, addEventListener: (name, handler) => { events[name] = handler; }, skipWaiting() {},
    registration: { showNotification: async (title, details) => shown.push({ title, ...details }) },
    clients: { claim: async () => {}, matchAll: async () => clients, openWindow: async value => opened.push(value) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../public/sw.js'), 'utf8'), { self, URL, encodeURIComponent });
  return { events, shown, opened, setClients: value => { clients = value; },
    push: async data => { let done; events.push({ data: { json: () => ({ title: 'Test', body: 'Message', data }) }, waitUntil: p => { done = p; } }); await done; },
    click: async data => { let done; events.notificationclick({ notification: { data, close() {} }, waitUntil: p => { done = p; } }); await done; } };
}
test('hidden app receives push even after reporting an active conversation', async () => {
  const s = setup(); s.events.message({ data: { type: 'active-conversation', payload: { type: 'dm', id: 'alice' } } });
  s.setClients([{ url: 'https://loboko-app.vercel.app/messages?to=alice', visibilityState: 'hidden', focused: false }]);
  await s.push({ type: 'dm', conversation_id: 'alice' }); assert.equal(s.shown.length, 1);
});
test('only the focused visible matching conversation suppresses its notification', async () => {
  const s = setup(); s.setClients([{ url: 'https://loboko-app.vercel.app/messages?to=alice', visibilityState: 'visible', focused: true }]);
  await s.push({ type: 'dm', conversation_id: 'alice' }); assert.equal(s.shown.length, 0);
  await s.push({ type: 'dm', conversation_id: 'bob' }); assert.equal(s.shown.length, 1);
  s.setClients([{ url: 'https://loboko-app.vercel.app/messages/group/team', visibilityState: 'visible', focused: true }]);
  await s.push({ type: 'group', conversation_id: 'team' }); assert.equal(s.shown.length, 1);
  s.setClients([]); await s.push({ type: 'group', conversation_id: 'team' }); assert.equal(s.shown.length, 2);
});
test('click routes match current application routes', async () => {
  const s = setup();
  for (const data of [{ type: 'dm', conversation_id: 'alice' }, { type: 'group', conversation_id: 'team' }, { type: 'post', post_id: 'publication' }, { type: 'urgent_order', order_id: 'order' }, { type: 'test' }]) await s.click(data);
  assert.deepEqual(s.opened, ['/messages?to=alice', '/messages/group/team', '/post/publication', '/my-orders/order', '/notifications']);
});
test('click focuses and navigates an existing application window', async () => {
  const s = setup(); let focused = 0, navigated;
  s.setClients([{ url: 'https://loboko-app.vercel.app/', focus: async () => focused++, navigate: async p => { navigated = p; } }]);
  await s.click({ type: 'group', conversation_id: 'team' });
  assert.equal(focused, 1); assert.equal(navigated, '/messages/group/team'); assert.equal(s.opened.length, 0);
});
