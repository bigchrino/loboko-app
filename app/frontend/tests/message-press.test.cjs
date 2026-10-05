const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function fixture() {
  const refs = [];
  let cursor = 0;
  let cleanup;
  const timers = new Map();
  const menus = [];
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/MessagePressable.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports: module.exports, module,
    require: name => name === 'react' ? {
      useRef: value => { const index = cursor++; return refs[index] ??= { current: value }; },
      useEffect: setup => { cleanup ??= setup(); },
    } : { jsx: (type, props) => ({ type, props }) },
    setTimeout: callback => { const id = {}; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const render = (onMenu = (...coords) => menus.push(coords), disabled = false) => {
    cursor = 0;
    return module.exports.default({ onMenu, disabled }).props;
  };
  const target = {};
  const event = (extra = {}) => ({ target, currentTarget: { contains: node => node === target },
    clientX: 20, clientY: 30, pointerId: 1, button: 0, isPrimary: true, detail: 1,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...extra });
  return { render, event, menus, flush: () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); }, unmount: () => cleanup() };
}

test('a short tap reaches the photo or audio control without opening actions', () => {
  const f = fixture(); const p = f.render();
  p.onPointerDownCapture(f.event()); p.onPointerUpCapture(f.event()); f.flush();
  const click = f.event(); p.onClickCapture(click);
  assert.equal(f.menus.length, 0); assert.equal(click.prevented, undefined);
});

test('holding opens actions once and release cannot open the viewer or play audio', () => {
  const f = fixture(); const p = f.render();
  p.onPointerDownCapture(f.event()); f.flush();
  assert.deepEqual(f.menus, [[20, 30]]);
  const context = f.event(); p.onContextMenu(context);
  p.onPointerUpCapture(f.event()); const click = f.event(); p.onClickCapture(click);
  assert.equal(f.menus.length, 1); assert.equal(context.prevented, true);
  assert.equal(click.prevented, true); assert.equal(click.stopped, true);
  const keyboardClick = f.event({ detail: 0 }); p.onClickCapture(keyboardClick);
  assert.equal(keyboardClick.prevented, undefined);
  p.onPointerDownCapture(f.event()); p.onPointerUpCapture(f.event());
  const next = f.event(); p.onClickCapture(next); assert.equal(next.prevented, undefined);
});

test('scroll, cancelled gestures and unmount clear pending holds', () => {
  for (const action of ['move', 'cancel', 'leave', 'unmount']) {
    const f = fixture(); const p = f.render(); p.onPointerDownCapture(f.event());
    if (action === 'move') p.onPointerMoveCapture(f.event({ clientY: 50 }));
    if (action === 'cancel') p.onPointerCancelCapture(f.event());
    if (action === 'leave') p.onPointerLeave(f.event());
    if (action === 'unmount') f.unmount();
    f.flush(); assert.equal(f.menus.length, 0);
  }
});

test('a rerender during the hold keeps cancellation and uses the current message action', () => {
  const f = fixture(); const first = f.render(); first.onPointerDownCapture(f.event());
  f.render(() => f.menus.push('current')); f.flush(); assert.deepEqual(f.menus, ['current']);
  const second = f.render(); second.onPointerDownCapture(f.event());
  f.render().onPointerUpCapture(f.event()); f.flush(); assert.equal(f.menus.length, 1);
});

test('fullscreen portals and deleted messages cannot trigger message actions', () => {
  const f = fixture(); const p = f.render(); const outside = f.event({ target: {} });
  p.onPointerDownCapture(outside); p.onContextMenu(outside); f.flush();
  assert.equal(f.menus.length, 0); assert.equal(outside.prevented, undefined);
  const disabled = f.render(undefined, true); disabled.onPointerDownCapture(f.event()); disabled.onContextMenu(f.event()); f.flush();
  assert.equal(f.menus.length, 0);
});
