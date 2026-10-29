import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync(new URL('../app/customer/order-schedule.ts', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, Date, Error });
const { buildOrderSchedule, scheduleDefaults } = module.exports;
const now = new Date(2026, 9, 29, 14, 21);
function fields(overrides = {}) {
  const fd = new FormData();
  Object.entries({ loadDate: '2026-10-30', loadTimeFrom: '10:15', loadTimeTo: '12:30', unloadDate: '2026-10-31', unloadTimeFrom: '13:00', unloadTimeTo: '17:45', ...overrides }).forEach(([key, value]) => fd.set(key, value));
  return fd;
}
test('mobile defaults use local calendar dates including month rollover', () => {
  assert.equal(scheduleDefaults(now).loadDate, '2026-10-29');
  assert.equal(scheduleDefaults(new Date(2026, 11, 31)).unloadDate, '2027-01-01');
});
test('planned order preserves all four selected times in local timezone', () => {
  const schedule = buildOrderSchedule(fields(), true, false, false, now);
  assert.equal(schedule.loadFrom.toISOString(), new Date(2026, 9, 30, 10, 15).toISOString());
  assert.equal(schedule.loadTo.toISOString(), new Date(2026, 9, 30, 12, 30).toISOString());
  assert.equal(schedule.unloadFrom.toISOString(), new Date(2026, 9, 31, 13).toISOString());
  assert.equal(schedule.unloadTo.toISOString(), new Date(2026, 9, 31, 17, 45).toISOString());
});
test('free date matches mobile seven day schedule without date inputs', () => {
  const schedule = buildOrderSchedule(new FormData(), true, true, false, now);
  assert.equal(schedule.loadFrom.getTime(), now.getTime());
  assert.equal(schedule.freeDateUntil.getTime(), now.getTime() + 7 * 86400000);
  assert.equal(schedule.unloadFrom.getTime(), schedule.freeDateUntil.getTime());
});
test('quick modes ignore hidden schedule and previously selected free date', () => {
  for (const withinHour of [false, true]) {
    const schedule = buildOrderSchedule(fields(), false, true, withinHour, now);
    assert.equal(schedule.freeDateUntil, null);
    assert.equal(schedule.loadFrom.getTime(), now.getTime() + (withinHour ? 3600000 : 0));
  }
});
test('invalid or missing scheduled windows are rejected', () => {
  assert.throws(() => buildOrderSchedule(new FormData(), true, false, false, now), /Вкажіть дати/);
  assert.throws(() => buildOrderSchedule(fields({loadTimeTo: '09:00'}), true, false, false, now), /Час до/);
  assert.throws(() => buildOrderSchedule(fields({unloadTimeTo: '12:00'}), true, false, false, now), /Час до/);
  assert.throws(() => buildOrderSchedule(fields({unloadDate: '2026-10-29'}), true, false, false, now), /Дата розвантаження/);
});

test('create form reveals schedule on click and hides it for quick modes', async () => {
  const portalSource = readFileSync(new URL('../app/customer/customer-portal.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('portal.tsx', portalSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const formSource = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'CreateForm').getText(ast);
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const jsx = require('react/jsx-runtime');
  const states = [];
  let slot = 0;
  const context = {
    ...jsx, scheduleDefaults, buildOrderSchedule,
    useState(initial) {
      const index = slot++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = value; }];
    },
    portalPath: path => `/portal${path}`,
  };
  const code = ts.transpileModule(`${formSource}\n globalThis.CreateForm = CreateForm;`, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { ...context, require: () => jsx, exports: {}, VIcon: () => null, AddressFields: () => null, CargoFields: () => null, CargoPhotoUpload: () => null, globalThis: context });
  function nodes(tree) {
    if (!tree || typeof tree !== 'object') return [];
    return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
  }
  function render() { slot = 0; return nodes(context.CreateForm({longDistance: false})); }
  let tree = render();
  assert.equal(tree.filter(node => node.type === 'input' && node.props.type === 'date').length, 0);
  tree.find(node => node.type === 'button' && node.props.children === 'Запланувати').props.onClick();
  tree = render();
  assert.equal(tree.filter(node => node.type === 'input' && node.props.type === 'date').length, 2);
  assert.equal(tree.filter(node => node.type === 'input' && node.props.type === 'time').length, 4);
  tree.find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({target: {checked: true}});
  tree = render();
  assert.equal(tree.filter(node => node.type === 'input' && node.props.type === 'date').length, 0);
  tree.find(node => node.type === 'button' && node.props.children === 'Якнайшвидше').props.onClick();
  tree = render();
  assert.equal(tree.filter(node => node.type === 'input' && node.props.type === 'checkbox').length, 0);
});
