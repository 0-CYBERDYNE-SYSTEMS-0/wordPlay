// test-ship-readiness.js — Ship-readiness e2e verification (QA pass, pre-ship)
// Run against a live dev server: npm run dev, then `node test-ship-readiness.js`
// Exercises: CRUD, all slash commands (Ollama qwen3.5:0.8b), streaming,
// image generation (local mflux), agent tool loop, search honesty, text ops.

const BASE = process.env.BASE_URL || "http://localhost:5001";
const MODEL = process.env.QA_MODEL || "qwen3.5:0.8b";
let scratchDocId = null;
const results = [];

function log(name, status, detail = "", ms = 0) {
  results.push({ name, status, detail, ms });
  console.log(`${status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️ "} ${name} (${ms}ms)${detail ? " — " + detail : ""}`);
}

async function req(path, opts = {}, timeoutMs = 120000) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
  return { status: res.status, body };
}

const sel = (content) => ({
  selectedText: content,
  selectionStart: 0,
  selectionEnd: content.length,
  beforeSelection: "",
  afterSelection: "",
});

async function slash(command, content, extra = {}, timeoutMs = 120000) {
  const t0 = Date.now();
  const r = await req(
    "/api/ai/slash-command",
    {
      method: "POST",
      body: JSON.stringify({
        command,
        content,
        selectionInfo: sel(content),
        llmProvider: "ollama",
        llmModel: MODEL,
        projectId: 1,
        userId: 1,
        ...extra,
      }),
    },
    timeoutMs
  );
  return { ...r, ms: Date.now() - t0 };
}

const SAMPLE =
  "The lighthouse keeper climbed the spiral stairs each dawn. The lamp needed oil before the fog rolled in from the sea.";

async function main() {
  // ── 1. Baseline health ────────────────────────────────────────────────
  {
    const t0 = Date.now();
    const r = await req("/api/projects", {}, 10000);
    log("GET /api/projects", r.status === 200 && Array.isArray(r.body) ? "PASS" : "FAIL",
      `${r.status}, ${Array.isArray(r.body) ? r.body.length + " projects" : String(r.body).slice(0, 80)}`, Date.now() - t0);
  }

  // ── 2. Document CRUD (scratch doc only; user data untouched) ─────────
  {
    const t0 = Date.now();
    const r = await req("/api/documents", {
      method: "POST",
      body: JSON.stringify({ title: "SHIP-QA scratch (safe to delete)", content: SAMPLE, projectId: 1 }),
    }, 15000);
    scratchDocId = r.body?.id ?? null;
    log("POST /api/documents", r.status === 201 && scratchDocId ? "PASS" : "FAIL",
      `${r.status} id=${scratchDocId}`, Date.now() - t0);
  }
  {
    const t0 = Date.now();
    const r = await req(`/api/documents/${scratchDocId}`, {
      method: "PUT",
      body: JSON.stringify({ content: SAMPLE + "\n\nEdited by QA." }),
    }, 15000);
    const saved = typeof r.body?.content === "string" ? r.body.content.includes("Edited by QA") : true;
    log("PUT /api/documents/:id (autosave path)", r.status === 200 && saved ? "PASS" : "FAIL", `${r.status}`, Date.now() - t0);
  }

  // ── 3. Core slash commands via Ollama ────────────────────────────────
  const coreCases = [
    ["continue", SAMPLE + " The fog thickened"],
    ["improve", SAMPLE],
    ["fix", "Their going to the store tomorrow, dont forget."],
    ["bullets", "Points to summarize: oil the lamp, check the foghorn, log the weather."],
    ["format", "# Title\n\nSome  messy   spacing\nhere"],
  ];
  for (const [cmd, content] of coreCases) {
    try {
      const r = await slash(cmd, content);
      const out = r.body?.result ?? r.body?.behavior?.result ?? "";
      const ok = r.status === 200 && typeof out === "string" && out.trim().length > 0;
      const errish = /error|failed|cannot|unable/i.test(out) && out.length < 400;
      log(`/api/ai/slash-command /${cmd}`, ok && !errish ? "PASS" : "FAIL",
        ok ? `${out.length} chars: ${JSON.stringify(out.slice(0, 90))}` : `HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 160)}`, r.ms);
    } catch (e) {
      log(`/api/ai/slash-command /${cmd}`, "FAIL", e.name === "TimeoutError" ? "TIMEOUT >120s" : String(e).slice(0, 120), 0);
    }
  }

  // ── 4. Streaming endpoint (/continue, ndjson) ─────────────────────────
  try {
    const t0 = Date.now();
    const res = await fetch(BASE + "/api/ai/slash-command/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "continue", content: SAMPLE, selectionInfo: sel(SAMPLE), llmModel: MODEL, projectId: 1 }),
      signal: AbortSignal.timeout(120000),
    });
    const text = await res.text();
    const lines = text.trim().split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } });
    const chunks = lines.filter((l) => l.chunk !== undefined);
    const done = lines.find((l) => l.done);
    const streamed = res.status === 200 && chunks.length >= 2 && done?.behavior?.result?.trim()?.length > 0;
    log("STREAM /continue (ndjson)", streamed ? "PASS" : "FAIL",
      `${res.status}, ${chunks.length} chunks, final ${done?.behavior?.result?.length ?? 0} chars`, Date.now() - t0);
  } catch (e) {
    log("STREAM /continue (ndjson)", "FAIL", String(e).slice(0, 120));
  }

  // ── 5. Content commands: table, chart, image ─────────────────────────
  try {
    const r = await slash("table",
      "Character sheet for the keeper: name Elias, age 61, years of service 40, fears the dark sea.",
      { style: {} }, 180000);
    const out = r.body?.result ?? "";
    const hasTable = /\|.*\|/.test(out) || /<table/i.test(out);
    log("/table (markdown/html table)", r.status === 200 && hasTable ? "PASS" : "FAIL",
      r.status === 200 ? JSON.stringify(out.slice(0, 120)) : `HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 140)}`, r.ms);
  } catch (e) { log("/table", "FAIL", e.name === "TimeoutError" ? "TIMEOUT" : String(e).slice(0, 120)); }

  try {
    const r = await slash("chart",
      "Weekly writing output: Mon 800 words, Tue 1200, Wed 450, Thu 1600, Fri 900.", { style: {} }, 180000);
    const out = r.body?.result ?? "";
    const looksChart = /chart|recharts|echarts|```json|\{/.test(out);
    log("/chart (artifact config)", r.status === 200 && looksChart ? "PASS" : "FAIL",
      r.status === 200 ? JSON.stringify(out.slice(0, 140)) : `HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 140)}`, r.ms);
  } catch (e) { log("/chart", "FAIL", e.name === "TimeoutError" ? "TIMEOUT" : String(e).slice(0, 120)); }

  try {
    const r = await slash("image",
      "A lonely lighthouse in dense morning fog, warm lamplight, painterly.", { style: { steps: 1 } }, 240000);
    const out = r.body?.result ?? "";
    const md = /!\[([^\]]*)\]\(([^)]+)\)/.exec(out);
    let imgOk = false, imgNote = "", altText = "";
    if (md) {
      altText = md[1];
      const url = md[2].startsWith("http") ? md[2] : BASE + md[2];
      const head = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10000) }).catch((e) => ({ status: 0, note: String(e) }));
      imgOk = head.status === 200;
      imgNote = `${md[2]} → HTTP ${head.status}`;
    } else imgNote = "no markdown image in result: " + out.slice(0, 100);
    log("/image (local mflux)", r.status === 200 && imgOk ? "PASS" : "FAIL", imgNote, r.ms);
    if (md) log("/image alt-text ≤ ~8 words (FIX-11)", altText.split(/\s+/).length <= 10 ? "PASS" : "WARN", `alt: "${altText}" (${altText.split(/\s+/).length} words)`);
  } catch (e) { log("/image", "FAIL", e.name === "TimeoutError" ? "TIMEOUT >240s" : String(e).slice(0, 120)); }

  // ── 6. Agent tool loop ────────────────────────────────────────────────
  try {
    const t0 = Date.now();
    const r = await req("/api/agent/intelligent-request", {
      method: "POST",
      body: JSON.stringify({
        request: "Analyze the word count and structure of my current document, then tell me one concrete way to improve it.",
        context: { projectId: 1, documentId: scratchDocId },
        autonomyLevel: "conservative",
        maxExecutionTime: 120000,
        llmProvider: "ollama",
        llmModel: MODEL,
      }),
    }, 150000);
    const content = r.body?.content ?? r.body?.response ?? "";
    const tools = r.body?.toolsExecuted?.length ?? r.body?.toolResults?.length ?? r.body?.toolExecutions?.length;
    log("AGENT /intelligent-request (ollama, conservative)", r.status === 200 && String(content).trim().length > 20 ? "PASS" : "FAIL",
      `HTTP ${r.status}, tools used: ${tools ?? "?"}, content: ${String(content).slice(0, 110)}`, Date.now() - t0);
  } catch (e) { log("AGENT /intelligent-request", "FAIL", e.name === "TimeoutError" ? "TIMEOUT >150s" : String(e).slice(0, 120)); }

  // ── 7. Search honesty (FIX-05): no fake sources on provider failure ──
  try {
    const t0 = Date.now();
    const r = await req("/api/search", { method: "POST", body: JSON.stringify({ query: "lighthouse history" }) }, 60000);
    const srcs = Array.isArray(r.body?.sources) ? r.body.sources : Array.isArray(r.body) ? r.body : [];
    const fake = srcs.some((s) => /example\.com|simulated|placeholder/i.test(JSON.stringify(s)));
    const honest = r.status >= 400 || r.body?.error || !srcs.length || (r.body?.demo === true);
    log("SEARCH /api/search honesty (FIX-05)", fake && !honest ? "FAIL" : honest ? "PASS" : "WARN",
      `HTTP ${r.status}, sources: ${srcs.length}${fake ? " (contains simulated/example.com!)" : ""}${r.body?.error ? ", error field: " + String(r.body.error).slice(0, 80) : ""}`, Date.now() - t0);
  } catch (e) { log("SEARCH /api/search", "FAIL", String(e).slice(0, 120)); }

  // ── 8. Text analysis ops ──────────────────────────────────────────────
  for (const [name, path] of [["TEXT /analyze", "/api/text/analyze"], ["TEXT /structure", "/api/text/structure"]]) {
    try {
      const t0 = Date.now();
      const r = await req(path, { method: "POST", body: JSON.stringify({ text: SAMPLE }) }, 15000);
      log(name, r.status === 200 ? "PASS" : "FAIL", `HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 90)}`, Date.now() - t0);
    } catch (e) { log(name, "FAIL", String(e).slice(0, 100)); }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────
  if (scratchDocId) {
    const r = await req(`/api/documents/${scratchDocId}`, { method: "DELETE" }, 15000);
    log("CLEANUP delete scratch doc", r.status === 200 || r.status === 204 ? "PASS" : "FAIL", `HTTP ${r.status} id=${scratchDocId}`);
  }

  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  console.log(`\n═══ SUMMARY: ${pass} PASS / ${fail} FAIL / ${warn} WARN of ${results.length} ═══`);
}

main().catch((e) => { console.error("Suite crashed:", e); process.exit(1); });
