import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source = readFileSync(new URL('../app/portal-path.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports });
const { portalPath } = module.exports;

test('portal home navigation includes the slash required by the server base URL', () => {
  assert.equal(portalPath(), '/portal/');
  assert.equal(portalPath('/'), '/portal/');
  assert.equal(portalPath('/portal'), '/portal/');
  assert.equal(portalPath('/portal/'), '/portal/');
});

test('portal routes keep a single base prefix', () => {
  assert.equal(portalPath('/customer/settings'), '/portal/customer/settings');
  assert.equal(portalPath('/portal/customer/settings'), '/portal/customer/settings');
  assert.equal(portalPath('https://example.com'), 'https://example.com');
});
