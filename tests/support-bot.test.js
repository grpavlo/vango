const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Isolated environment: never reads .env or uses the real network.
function harness(env = {}, respond = async () => ({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'Claude' }] }) })) {
  const calls = [];
  const timers = new Set();
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/services/supportBot'), 'utf8'), {
    module, process: { env }, AbortController,
    setTimeout(fn, ms) { const timer = setTimeout(fn, ms); timers.add(timer); return timer; },
    clearTimeout(timer) { timers.delete(timer); clearTimeout(timer); },
    fetch: async (url, options) => { calls.push({ url, ...options, body: JSON.parse(options.body) }); return respond(url, options); },
  });
  return { calls, timers, ask: (options = {}) => module.exports.answerSupportQuestion({ question: 'Як створити замовлення?', ...options }) };
}
const anthropic = { SUPPORT_BOT_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test-anthropic' };

test('Anthropic Messages request, instructions, history and text-only response blocks', async () => {
  const h = harness(anthropic, async () => ({ ok: true, json: async () => ({ content: [
    { type: 'thinking', thinking: 'private' }, { type: 'text', text: ' Перша' },
    { type: 'tool_use', text: 'ignore' }, { type: 'text', text: 'Друга ' },
  ] }) }));
  const history = [{ role: 'user', text: 'Привіт' }, { role: 'assistant', content: 'Вітаю' }];
  assert.deepEqual(JSON.parse(JSON.stringify(await h.ask({ role: 'CUSTOMER', history }))), { answer: 'Перша\nДруга', source: 'ai' });
  const call = h.calls[0];
  assert.equal(call.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(call.method, 'POST');
  assert.equal(call.headers['x-api-key'], 'test-anthropic');
  assert.equal(call.headers['anthropic-version'], '2026-10-21');
  assert.equal(call.headers.Authorization, undefined);
  assert.equal(call.headers['Content-Type'], 'application/json');
  assert.equal(call.body.model, 'claude-haiku-5-5');
  assert.equal(call.body.max_tokens, 1024);
  assert.match(call.body.system, /CUSTOMER/);
  assert.match(call.body.system, /База знань/);
  assert.deepEqual(JSON.parse(JSON.stringify(call.body.messages)), [
    { role: 'user', content: 'Привіт' }, { role: 'assistant', content: 'Вітаю' },
    { role: 'user', content: 'Як створити замовлення?' },
  ]);
  assert.equal(call.body.input, undefined);
  assert.equal(h.timers.size, 0);
});

test('Anthropic history is bounded and empty entries are removed', async () => {
  const h = harness(anthropic);
  await h.ask({ history: [...Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: String(i) })), { text: ' ' }] });
  assert.equal(h.calls[0].body.messages.length, 9);
  assert.equal(h.calls[0].body.messages[0].content, '4');
});

for (const provider of ['openai', 'anthropic']) {
  for (const [name, respond] of [
    ['API error', async () => ({ ok: false })],
    ['network error', async () => { throw Error('offline'); }],
    ['invalid JSON', async () => ({ ok: true, json: async () => { throw Error('invalid'); } })],
    ['empty answer', async () => ({ ok: true, json: async () => ({ content: [{ type: 'text', text: ' ' }], output_text: ' ' }) })],
    ['timeout', (_url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Error('aborted')), { once: true }))],
  ]) {
    test(`${provider}: local fallback on ${name}`, async () => {
      const h = harness({ SUPPORT_BOT_PROVIDER: provider, SUPPORT_BOT_API_KEY: 'test', SUPPORT_BOT_TIMEOUT_MS: '5' }, respond);
      const result = await h.ask();
      assert.equal(result.source, 'local');
      assert.match(result.answer, /Щоб створити замовлення/);
      assert.equal(h.timers.size, 0);
      assert.equal(h.calls[0].signal.aborted, name === 'timeout');
    });
  }
  test(`${provider}: publicMode and allowAi=false skip fetch`, async () => {
    const h = harness({ SUPPORT_BOT_PROVIDER: provider, SUPPORT_BOT_API_KEY: 'test' });
    assert.equal((await h.ask({ publicMode: true })).source, 'local');
    assert.equal((await h.ask({ allowAi: false })).source, 'local');
    assert.equal(h.calls.length, 0);
  });
}

test('provider keys never cross; missing key and unknown provider use local fallback', async () => {
  for (const env of [{}, { ...anthropic, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: 'test-openai' },
    { ANTHROPIC_API_KEY: 'test-anthropic' }, { SUPPORT_BOT_PROVIDER: 'unknown', SUPPORT_BOT_API_KEY: 'test' }]) {
    const h = harness(env);
    assert.equal((await h.ask()).source, 'local');
    assert.equal(h.calls.length, 0);
  }
});

test('OpenAI remains the default including request format and both response formats', async () => {
  for (const data of [{ output_text: ' OpenAI ' }, { output: [{ content: [{ type: 'output_text', text: 'OpenAI' }] }] }]) {
    const h = harness({ OPENAI_API_KEY: 'test-openai', ANTHROPIC_MODEL: 'wrong' }, async () => ({ ok: true, json: async () => data }));
    assert.equal((await h.ask()).answer, 'OpenAI');
    assert.equal(h.calls[0].url, 'https://api.openai.com/v1/responses');
    assert.equal(h.calls[0].headers.Authorization, 'Bearer test-openai');
    assert.equal(h.calls[0].headers['x-api-key'], undefined);
    assert.equal(h.calls[0].body.model, 'gpt-4o-mini');
    assert.equal(h.calls[0].body.max_output_tokens, 220);
    assert.equal(h.calls[0].body.input, 'Як створити замовлення?');
    assert.match(h.calls[0].body.instructions, /База знань/);
  }
});

test('provider model and key precedence remain isolated', async () => {
  for (const provider of ['openai', 'anthropic']) {
    const base = { SUPPORT_BOT_PROVIDER: provider, OPENAI_API_KEY: 'test-openai', ANTHROPIC_API_KEY: 'test-anthropic', OPENAI_MODEL: 'openai-model', ANTHROPIC_MODEL: 'anthropic-model' };
    for (const override of [false, true]) {
      const h = harness({ ...base, ...(override ? { SUPPORT_BOT_API_KEY: 'test-override', SUPPORT_BOT_MODEL: 'override-model' } : {}) });
      await h.ask();
      const call = h.calls[0];
      assert.equal(call.body.model, override ? 'override-model' : `${provider}-model`);
      assert.equal(provider === 'anthropic' ? call.headers['x-api-key'] : call.headers.Authorization,
        provider === 'anthropic' ? (override ? 'test-override' : 'test-anthropic') : `Bearer ${override ? 'test-override' : 'test-openai'}`);
    }
  }
  const h = harness({ ...anthropic, OPENAI_MODEL: 'wrong' });
  await h.ask();
  assert.equal(h.calls[0].body.model, 'claude-haiku-5-5');
});


test('Anthropic token exhaustion falls back instead of displaying an incomplete answer', async () => {
  const h = harness(anthropic, async () => ({ ok: true, json: async () => ({
    stop_reason: 'max_tokens', content: [{ type: 'text', text: 'Незавершена відповідь, якщо' }],
  }) }));
  const result = await h.ask();
  assert.equal(result.source, 'local');
  assert.match(result.answer, /Щоб створити замовлення/);
  assert.equal(h.timers.size, 0);
});
