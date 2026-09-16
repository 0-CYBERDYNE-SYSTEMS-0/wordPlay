// test-ai-provider-routing.js
//
// Verifies FIX-01: Settings → AI provider/model actually controls all AI paths.
// Runs against a live server (`npm run dev:server`). Requires Ollama running with
// a model available (default qwen3.5:0.8b, override with OLLAMA_MODEL env).
//
// Usage:
//   node test-ai-provider-routing.js [baseURL]
//
// It exercises the endpoints that MUST honor llmProvider/llmModel and confirms:
//   1. /api/ai/slash-command with llmProvider=ollama does not fall back to OpenAI.
//   2. /api/agent/intelligent-request accepts top-level llmProvider/llmModel and
//      the nested context values win (both are checked via server logs; here we
//      just assert a 200/4xx — not a hard OpenAI 401 — for an Ollama request).
//   3. /api/ai/analyze-style with ollama returns metrics without OpenAI 401.
//   4. /api/ai/test returns per-provider status.

const BASE = (process.argv[2] || 'http://localhost:5001').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:0.8b';

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

let failures = 0;
function check(name, cond, detail = '') {
  const mark = cond ? 'PASS' : 'FAIL';
  if (!cond) failures++;
  console.log(`${mark}  ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
  console.log(`Testing AI provider routing against ${BASE} (Ollama model: ${OLLAMA_MODEL})\n`);

  // 1. slash-command → ollama
  const slash = await post('/api/ai/slash-command', {
    command: 'continue',
    content: 'The quick brown fox',
    selectionInfo: { selectedText: '', selectionStart: 0, selectionEnd: 0, beforeSelection: '', afterSelection: '' },
    llmProvider: 'ollama',
    llmModel: OLLAMA_MODEL,
  });
  const slashOk = slash.status < 500 && !/OpenAI|Invalid OpenAI/i.test(JSON.stringify(slash.json || {}));
  check('slash-command ollama routing (no OpenAI error)', slashOk, `status=${slash.status} resp=${JSON.stringify(slash.json).slice(0, 160)}`);

  // 2. agent intelligent-request → ollama (top-level + nested context)
  const agent = await post('/api/agent/intelligent-request', {
    request: 'Fix grammar in one sentence.',
    llmProvider: 'ollama',
    llmModel: OLLAMA_MODEL,
    context: { llmProvider: 'ollama', llmModel: OLLAMA_MODEL, currentDocument: { id: 1, content: 'Hello', title: 't' } },
  });
  const agentOk = agent.status < 500 && !/Invalid OpenAI/i.test(JSON.stringify(agent.json || {}));
  check('agent ollama routing (no OpenAI error)', agentOk, `status=${agent.status} resp=${JSON.stringify(agent.json).slice(0, 160)}`);

  // 3. analyze-style → ollama
  const analyze = await post('/api/ai/analyze-style', {
    content: 'The quick brown fox jumps over the lazy dog.',
    llmProvider: 'ollama',
    llmModel: OLLAMA_MODEL,
  });
  const analyzeOk = analyze.status === 200 && (analyze.json?.metrics?.formality !== undefined);
  check('analyze-style ollama routing returns metrics', analyzeOk, `status=${analyze.status}`);

  // 4. /api/ai/test status shape
  const testRes = await fetch(`${BASE}/api/ai/test`);
  const testJson = await testRes.json().catch(() => null);
  check('/api/ai/test returns openai+ollama status', !!(testJson?.openai && testJson?.ollama), JSON.stringify(testJson).slice(0, 120));

  // 5. /api/ai/test reports gemini status (added with the Gemini text provider)
  check('/api/ai/test returns gemini status', !!(testJson?.gemini), JSON.stringify(testJson?.gemini || {}).slice(0, 120));

  // 6. search with a per-request key: no key should 503 with a clear message (not fake data)
  const search = await post('/api/search', { query: 'climate change' });
  const searchOk = search.status !== 200 || !JSON.stringify(search.json).includes('example.com');
  check('search without key never returns fake sources', searchOk, `status=${search.status} resp=${JSON.stringify(search.json).slice(0, 160)}`);

  // 7. slash-command accepts gemini provider without crashing on a missing key
  const gemSlash = await post('/api/ai/slash-command', {
    command: 'continue',
    content: 'The quick brown fox',
    selectionInfo: { selectedText: '', selectionStart: 0, selectionEnd: 0, beforeSelection: '', afterSelection: '' },
    llmProvider: 'gemini',
    llmModel: 'gemini-2.5-flash',
  });
  const gemSlashOk = gemSlash.status !== 500 && !/Internal/.test(JSON.stringify(gemSlash.json || {}));
  check('slash-command gemini provider accepted (key error, not crash)', gemSlashOk, `status=${gemSlash.status} resp=${JSON.stringify(gemSlash.json).slice(0, 160)}`);

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('Script error:', e); process.exit(1); });
