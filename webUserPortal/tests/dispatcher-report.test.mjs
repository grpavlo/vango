import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const jsx = require('react/jsx-runtime');
const source = readFileSync(new URL('../app/customer/reports/reports.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;

// Isolated hook scheduler: exercise the component's HTTP/state logic without a browser or stored credentials.
function harness(fetcher) {
  const states = [], effects = [];
  let index = 0;
  const pending = [];
  const react = {
    Fragment: Symbol.for('react.fragment'),
    useState(initial) {
      const slot = index++;
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial;
      return [states[slot], (value) => { states[slot] = typeof value === 'function' ? value(states[slot]) : value; }];
    },
    useEffect(callback, deps) {
      const slot = index++;
      const previous = effects[slot];
      if (!previous || deps.some((d, i) => !Object.is(d, previous.deps[i]))) {
        previous?.cleanup?.();
        pending.push(() => { effects[slot] = { deps, cleanup: callback() }; });
      }
    },
  };
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, require: (id) => {
    if (id === '../v-icon') { const iconModule = { exports: {} }; const iconCode = ts.transpileModule(readFileSync(new URL('../app/customer/v-icon.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText; vm.runInNewContext(iconCode, { module: iconModule, exports: iconModule.exports, require: () => jsx }); return iconModule.exports; }
    if (id === 'react') return react;
    if (id === 'react/jsx-runtime') return jsx;
    if (id === '../../portal-path') return { portalPath: (path) => `/portal${path}` };
    throw new Error(`Unexpected import ${id}`);
  }, fetch: fetcher, URLSearchParams, AbortController, Date, window: { setInterval: () => 1, clearInterval: () => {} }, document: { visibilityState: 'visible' } });
  vm.runInContext(compiled, context);
  let tree;
  return {
    render() { index = 0; tree = module.exports.default({ token: 'test-token' }); while (pending.length) pending.shift()(); return renderToStaticMarkup(tree); },
    nodes(type) {
      const found = [];
      function visit(element) {
        if (!element || typeof element !== 'object') return;
        if (element.type === type) found.push(element);
        const children = element.props?.children;
        (Array.isArray(children) ? children.flat(Infinity) : [children]).forEach(visit);
      }
      visit(tree); return found;
    },
    async settle() { await new Promise((resolve) => setImmediate(resolve)); return this.render(); },
    dispose() { effects.forEach((effect) => effect?.cleanup?.()); },
  };
}
const fixture = {
  dailyRows: [{ key: '2026-10-05', count: 59, revenue: 5900 }],
  drivers: [{ id: 7, name: 'Дозволений водій' }],
  driverRows: [{ driverId: 7, driver: { id: 7, name: 'Дозволений водій' }, orderCount: 60, completedCount: 59, activeCount: 1, cancelledCount: 0, totalRevenue: 6000, totalDistanceKm: 900, totalDurationMinutes: 7080, totalCargoDurationMinutes: 3540, customerRatingAverage: 4, avgDistanceKm: 15, avgTotalDurationMinutes: 120, avgCargoDurationMinutes: 60 }],
  orderRows: [{ id: 11, orderNumber: 1011, status: 'COMPLETED', createdAt: '2026-10-05T12:00:00Z', acceptedAt: null, receivedAt: null, deliveredAt: null, completedAt: null, pickupCity: 'Київ', dropoffCity: 'Львів', pickupAddress: 'A', dropoffAddress: 'B', cargoType: 'Вантаж', price: 100, finalPrice: null, revenue: 100, roadDistanceKm: 15, totalDurationMinutes: 120, cargoDurationMinutes: null, customerRating: 4, customerRatingComment: 'Реальний відгук', customerRatingCreatedAt: null, photos: ['/uploads/allowed.jpg'], driver: { id: 7, name: 'Дозволений водій' }, driverAssignment: 'assigned' }],
  totals: { averageDurationMinutes: 120, completedRevenue: 5900, orderCount: 60, completedCount: 59, activeCount: 1, cancelledCount: 0, totalRevenue: 6000, totalDistanceKm: 900 },
  pagination: { page: 1, pageSize: 50, total: 60, pages: 2 },
  customerRatings: { count: 1, average: 4, buckets: { five: 0, four: 1, threeOrLess: 0 } },
};

test('renders server totals, actual rows/details/photos and sends scoped pagination/filter requests', async () => {
  const requests = [];
  const view = harness(async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => fixture }; });
  assert.match(view.render(), /Завантаження звіту/);
  let html = await view.settle();
  assert.match(html, /Дозволений водій/);
  assert.match(html, /1011/);
  assert.match(html, /60 замовлень/);
  assert.match(html, /UTC/);
  assert.ok(requests[0].url.startsWith('/api/dispatcher/analytics/order-report?'));
  assert.equal(requests[0].options.headers.Authorization, 'Bearer test-token');
  assert.ok(requests[0].url.includes('pageSize=50'));
  view.nodes('button').find((node) => node.props.children === 'Деталі').props.onClick();
  html = view.render();
  assert.match(html, /Реальний відгук/);
  assert.match(html, /\/uploads\/allowed.jpg/);
  view.nodes('button').find((node) => node.props.children === 'Далі').props.onClick();
  view.render(); await view.settle();
  assert.ok(requests.at(-1).url.includes('page=2'));
  view.nodes('select')[0].props.onChange({ target: { value: '7' } });
  view.render(); await view.settle();
  assert.ok(requests.at(-1).url.includes('driverId=7'));
  assert.ok(requests.at(-1).url.includes('page=1'));
  assert.ok(!requests.some(({ url }) => url.includes('/admin/')));
  view.dispose();
});
test('revocation removes previously loaded report data and exposes access error', async () => {
  let revoked = false;
  const view = harness(async () => revoked ? { ok: false, status: 403, text: async () => 'Потрібне право диспетчера' } : { ok: true, json: async () => fixture });
  view.render(); assert.match(await view.settle(), /1011/);
  revoked = true;
  view.nodes('button').find((node) => node.props.children === 'Оновити').props.onClick();
  assert.ok(!view.render().includes('1011'));
  const html = await view.settle();
  assert.match(html, /Потрібне право диспетчера/);
  assert.ok(!html.includes('Дозволений водій'));
  assert.ok(!html.includes('/uploads/allowed.jpg'));
  view.dispose();
});
test('empty report renders empty states and disables pagination', async () => {
  const empty = { ...fixture, dailyRows: [], drivers: [], driverRows: [], orderRows: [], pagination: { page: 1, pageSize: 50, total: 0, pages: 0 }, totals: { orderCount: 0, completedCount: 0, activeCount: 0, cancelledCount: 0, totalRevenue: 0, totalDistanceKm: 0 } };
  const view = harness(async () => ({ ok: true, json: async () => empty }));
  view.render(); const html = await view.settle();
  assert.match(html, /Немає даних за період/);
  assert.match(html, /Немає замовлень на цій сторінці/);
  assert.equal(view.nodes('button').find((node) => node.props.children === 'Далі').props.disabled, true);
  view.dispose();
});

test('late response from an aborted filter cannot restore stale report data', async () => {
  const pending = [];
  const view = harness((url, options) => new Promise((resolve) => pending.push({ url, options, resolve })));
  view.render();
  view.nodes('select')[0].props.onChange({ target: { value: '7' } });
  view.render();
  assert.equal(pending[0].options.signal.aborted, true);
  pending[1].resolve({ ok: false, status: 403, text: async () => 'Доступ відкликано' });
  assert.match(await view.settle(), /Доступ відкликано/);
  pending[0].resolve({ ok: true, json: async () => fixture });
  const html = await view.settle();
  assert.match(html, /Доступ відкликано/);
  assert.ok(!html.includes('1011'));
  view.dispose();
});
