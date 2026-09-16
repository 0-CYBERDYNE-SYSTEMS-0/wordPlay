# wordPlay — Remediation Plan (Audit "Now" Phase)

**Produced by:** Lead Agent + 3-specialist team (Fix-Plan-Builder → E2E-Runner → Plan-Adversary), 2026-09-14
**Source:** Independent audit (`wordplay-audit.html`), Now-phase findings
**Baseline:** `node test-ship-readiness.js` → **18/18 PASS** (2m19s, exit 0) against a fresh dev server on this branch. See §Verification.
**Rule for every step:** `npm run check` gates each fix; the e2e gate re-runs after every server-touching fix (5, 8, 1, 9, 10). Fixes 2/3/4/7 get manual editor verification.

## ✅ IMPLEMENTED — 2026-09-14 (same day as planning)

All 10 fixes landed in the order below, by the 3-specialist implementation team (S1 Server-Surgeon-A: 6+5+8 · S2 Client-Surgeon-B: 2+3+4 · S3 Server-Surgeon-C: 1+9 · Lead: 7, 10, integration, verification).

**Verification record:**
| Gate | Result |
|---|---|
| `npm run check` (after each wave) | ✅ clean ×4 |
| SVG → 415 / PNG → 201 probe | ✅ |
| SSRF (`localhost`, `169.254.169.254`) refused | ✅ honest errors |
| ReDoS `(a+)+$` over 200k chars | ✅ instant (re2) |
| e2e gate after fixes 5+8+7 | ✅ 18/18 |
| e2e gate after fixes 1+9 | ✅ 18/18 |
| `test-agent-authz.js` (multi-user, AUTH_PASSWORD on :5002) | ✅ **11/11** — cross-user reads/writes and both `context.userId` spoofs now fail; own-work control passes |
| Final e2e after fix 10 | ✅ 18/18 |
| `npm run build` | ✅ green |

**Deviations accepted during implementation** (details in the sections below): fix 3 anchors its single history entry at first preview write (observable contract unchanged); fix 5's body-cap mechanism adapted to node-fetch v3 (installed); non-streaming slash-command custom-command context defaults to userId 1 in `slash-commands-new.ts` (pre-existing gap, unchanged behavior — belongs with the `/api/available-commands` hardcode in the Next phase); fix 1's acceptance probe is committed as `test-agent-authz.js`; fix 10's server-file deletions were pulled forward into fix 1 (as the plan allowed).


## Implementation order

**6 → 2 → 3 → 4 → 7 → 5 → 8 → 1 → 9 → 10**

Rationale: trivial/independent first (6), client-craft cluster next (2/3/4, with 3 before 4 so the restore path can reuse the new raw-set API), then sanitize (7), SSRF (5), ReDoS (8), then the storage-authz root fix (1) before the telemetry cleanup in the same route region (9), deletions last (10). Pre-implementation check: confirm the dev DB's project 1 is owned by user 1 (`db-migrate.ts:52-69` seeds user id=1 first) — fix 1's e2e gate depends on it on an existing DB.

---

### 6. SVG upload XSS (high) — trivial, independent
- **Target:** `server/upload.ts:18,26` (svg in `ALLOWED_MIME` + `EXT_BY_MIME`), 415 message at `:44`.
- **Change:** Remove `image/svg+xml` from both maps; update the 415 message to list png/jpeg/webp/gif only. Existing `.svg` files on disk stay served; only new uploads are rejected.
- **Accept:** `curl -F file=@x.svg /api/uploads` → 415; png upload → 201; paste-image flow unchanged.

### 2. Slash keystroke theft (critical)
- **Target:** `client/src/components/UltraMinimalEditor.tsx:326-330`; popup consume-guard `SlashCommandsPopup.tsx:691-698` (+ `openedAtRef` 142/188) stays as-is.
- **Change:** In `handleTextareaKeyDown`, read `e.currentTarget.selectionStart`/`value`; open the menu only if the `/` is at position 0 or the preceding char matches `/\s/`; otherwise `return` (default insertion). Verified safe (adversary pass): at a word boundary the handler still `preventDefault()`s as today, and mid-word the popup listener is unmounted so the 50ms guard still swallows the opening key — no double-insert path.
- **Accept:** `and/or` inserts both slashes; `/ ` at a word boundary opens the menu; Escape closes with document byte-identical; all existing slash flows still open the menu.

### 3. Streaming vs undo (high)
- **Target:** `SlashCommandsPopup.tsx:255-268` (`applyChunk` → `setContent` prop bound to `applyWithHistory` at `UltraMinimalEditor.tsx:692`); `use-document.ts:116-120` (force-push), `:103` (cap 100).
- **Change:** Accumulate chunks in `streamedText`; render live through a new `setContentWithoutHistory` (equivalent to the already-exported raw `setContent` at `use-document.ts:421` — verified to add **no** second history mechanism; the one stack in `use-document.ts` stays the only history). On `done`/natural end: apply once via `applyWithHistory(final)` — exactly one forced entry. **On abort/error:** apply once via `applyWithHistory(preStreamOriginal)` so the pre-AI text is one ⌘Z away (partial buffer must never land without a history entry). Mid-stream user typing aborts the stream via the existing controller — but exempt modifier shortcuts (⌘S/⌘Z/⌘Y are handled at `UltraMinimalEditor.tsx:306-324` and must not cancel a running stream). Caret pinning applies only to raw preview writes.
- **Accept:** Streamed `/continue` over a 500-word doc grows `undoStackRef` by exactly 1; one ⌘Z restores pre-AI text; ⌘S mid-stream doesn't abort; typing mid-stream cancels cleanly. NDJSON e2e check stays green.

### 4. Autosave durability (high)
- **Target:** `use-document.ts:62, 283-289, 405-415`; conflict flow `:229-298`.
- **Change:** (a) Mirror `{title, content, updatedAt}` to `localStorage['wp-doc-mirror:'+docId]` on every change; clear on successful save. Restore-on-mount runs **inside/after the server-data init effect** (`:149-160` — earlier restore would be overwritten) with the dirty flag set synchronously, so the 15s adoption effect (`:164-178`) can't silently drop restored edits; restore applies via `applyWithHistory`. Post-restore autosave sends `ifUpdatedAt`, so a teammate edit since last save surfaces the 409 dialog on mount — deliberate, documented. (b) Flush transport: **`fetch(PUT, {keepalive:true})` is primary** — `navigator.sendBeacon` always issues POST (cannot hit `app.put('/api/documents/:id')`, and its `true` return only means queued, so the plan's beacon-as-primary would 404 silently). `beforeunload` keeps only the unsaved-changes warning. (c) Replace `setAutoSaveEnabled(false)` after 3 failures with backoff `min(30s, 2^n × 2s)`; never permanently disable; clear on any success or edit.
- **Accept:** Kill server → type → close tab → restart → reload: restore toast offers the lost text. Throttled network: autosave retries with backoff (no "Autosave disabled" toast). Conflict flow unaffected.

### 7. HTML sanitization (high)
- **Target:** `MarkdownRenderer.tsx:59-61` (`[rehypeRaw, rehypeKatex]`); `export-utils.ts:121`.
- **Change:** Add dep `rehype-sanitize`; shared schema in `client/src/lib/sanitize-schema.ts`. **Schema must explicitly allow the math input element**: sanitize runs *before* rehype-katex, so it sees remark-math's `<math className="math-inline|math-display">` — extend `tagNames` with `math` + the MathML subtree and those classNames, or math silently vanishes before KaTeX ever runs. GFM tables/`input[type=checkbox]`/`img src` (http(s) + relative `/uploads/`) allowed; `svg` omitted. Plugin order `[rehypeRaw, rehypeSanitize(schema), rehypeKatex]`. Charts/mermaid are safe: they render via the custom `code` component (`:144-194`), and `defaultSchema` preserves `code` className `language-*` — add a `/chart`, mermaid, and KaTeX smoke render to the manual gate anyway. Export: strip `on*` attributes, `javascript:` URIs, and `iframe/object/embed/form` across the clone before `buildStandaloneDocument`.
- **Accept:** `<img src=x onerror=alert(1)>` + `<script>` render inert; tables, checkboxes, math, charts, mermaid all still render; `grep 'on\*=' exported.html` → zero hits.

### 5. SSRF in scrapeWebpage (high)
- **Target:** `server/web-search.ts:181-296` (fetch `:194-203`, `response.text()` `:209`); backs agent tool `scrape_webpage` (`ai-agent.ts:324-344`).
- **Change:** Protocol allowlist http/https; `dns.promises.lookup(hostname,{all:true})` → reject loopback/private/link-local/0.0.0.0 on any resolved address; `AbortSignal.timeout(10_000)`; `redirect:'manual'` with per-hop revalidation; stream the body with a 2MB cap then truncate. (The repo's node-fetch is v3; its decompressed Response body streams, so the cap works as designed.) Residual: DNS-rebinding TOCTOU between the ownership check and fetch's own resolution is accepted — closing it requires pinning the connection to the validated IP.
- **Accept:** Scrape of `http://localhost:5001/...`, `http://127.0.0.1/`, `http://169.254.169.254/` → error, not content; a public URL still scrapes; search-honesty e2e unaffected. DNS-rebinding TOCTOU accepted as residual.

### 8. ReDoS + body limits (high)
- **Target:** `server/file-operations.ts:4-48`; `server/routes.ts:1080-1138`; `server/index.ts:9-10` (global 50mb json + urlencoded — note: lines 9-10, not :12 as the audit said).
- **Change:** (a) Add dep `re2`; compile user patterns through it (drop-in). **Docker caveat (blocking):** the image builds on `node:20-alpine` with no python3/make/g++ and no musl prebuilds — either add those build deps to both Dockerfile stages or switch base to debian-slim; fallback if re2 won't build: `safe-regex2` validation + the 1MB cap. (b) Zod: `/api/text/grep|replace` `{text: z.string().max(1_000_000), pattern: z.string().min(1).max(500), newPattern?…}`; `/api/text/analyze|structure` `{text: z.string().max(1_000_000)}`. (c) **Limits (mechanics corrected):** a per-route `express.json()` mounted *after* the global parser is a no-op — body-parser skips already-parsed requests. Mount path-scoped parsers BEFORE the global instead: `app.use('/api/text', express.json({limit:'1mb'}))` first, then global json/urlencoded lowered to 2mb, with 50mb kept only on the route group that genuinely needs it (`/api/ai/*` image path). `express.urlencoded` gets the same treatment.
- **Accept:** `POST /api/text/grep` with `(a+)+$` over 1MB of `a`s returns instantly; oversized body → 413; e2e text checks green (their payloads are ~110 chars — verified no conflict); 15MB uploads still work (multer path untouched).

### 1. Storage-layer authz (critical — the root fix)
- **Target:** `server/storage.ts:9-41` (IStorage), `:43-282` (MemStorage), `server/db-storage.ts`, `server/ai-agent.ts:1317-1338` (`updateContext` Object.assign at `:1320`), tools `:135-380` + storage calls `:524/587/614/653/874`, `server/routes.ts:1141-1185` — **plus every other call site** (adversary count: 17 in routes.ts, 16 in ai-agent.ts, and the two the draft missed: `slash-commands-minimal.ts:215` and legacy `slash-commands.ts:425` — still typechecked until fix 10 deletes it; also the `ownsProject` helper at `routes.ts:40-47` calling `storage.getProject`).
- **Change:** Extend IStorage: `getDocument(id,userId)`, `updateDocument(id,patch,userId)`, `deleteDocument(id,userId)`, `getSources(projectId,userId)`, `getSource(id,userId)`, `deleteSource(id,userId)`, `getProject(id,userId)`, `updateProject/deleteProject(id,payload,userId)`. **Also scope the write/list paths the draft missed:** `createDocument`/`createSource` verify the payload's `projectId` belongs to `userId`, and `getDocuments(projectId)` takes `userId` — otherwise the agent's LLM-chosen projectId can still write into/list another user's project. PostgresStorage joins through `projects.userId`; MemStorage filters its maps. In `updateContext`: strip `userId`/`ownerUserId` from `newContext` pre-merge, then force `this.context.userId = ownerUserId` captured at `createAgent(userId)` — never client-settable. Tools pass `context.userId`; non-owned rows return undefined/[] → existing "not found" results. Land signatures + all call sites in one commit; `npm run check` gates it.
- **Accept:** Multi-user: user B's agent `get_document`/`update_document` on A's doc id → "Document not found" (add `test-agent-authz.js` per repo convention — the e2e gate runs single-user and cannot prove this fix). Single-user: identical behavior; e2e 18/18 (requires seed project 1 owned by user 1 — true on fresh seeds; verify on the existing dev DB first).

### 9. Autonomy telemetry honesty (med)
- **Target:** `server/routes.ts:1283-1322` (canned `plan`, `iterations:1`, fake efficiency math); dead helpers `:1534-1652`; `ai-agent.ts:803/817` stub tools (`execute_autonomous_workflow`, `continuous_improvement`), `:1076-1143` `executeAutonomousWorkflow` — verified zero callers; the stub never invoked it. **`detectComplexEditingRequest` at `:1655` is LIVE (called at `:381`) — do not let the deletion creep past 1652.**
- **Change:** Build `toolsExecuted` from the real trace (`toolResults` carries `tool/success/message/executionTime` at `ai-agent.ts:1362-1366`; parameters from `executionHistory` recorded at `:1356/:1369`); `plan` derived from step descriptions or `null` (client accepts both, `AIAgent.tsx:64-69`). **Exact response contract to preserve** (verified against client + e2e): `response`; `plan` (string|array|null); `toolsExecuted` as ARRAY of `{tool,success,message,data}` (`AIAgent.tsx:248,256-257` iterates it); `suggestedActions` (274); `additionalToolCalls` (286); `executionDetails.toolsExecuted` as a NUMBER + `.failedTools` (293-296 — same key name as the top-level array, different type); `performance.tokensUsed`. Drop fake `executionEfficiency`/`iterations`; compute `averageToolTime` from summed per-tool durations. E2E's agent check asserts only HTTP 200 + `content ?? response` length > 20 (note: in this baseline run the tool fields were absent entirely and the check still passed on content alone — after this fix they must be present and real).
- **Accept:** e2e agent check green with per-tool real durations; `grep -n "iterations: 1" server/routes.ts` → empty; `npm run check` green.

### 10. Deletion PR (med) — last
- **Verified zero imports** (adversary spot-checked 3 + full sweep): files `client/src/components/CommandPalette.tsx`, `client/src/hooks/use-undo-redo.ts`, `client/src/providers/ThemeProvider.tsx` (custom context, not next-themes-based), `client/src/components/ResizablePanel.tsx` + `ui/resizable.tsx`, `ui/sidebar.tsx`, `ui/chart.tsx` (**not** `components/Chart.tsx` — that's the live echarts one), `HelpTooltip.tsx`, `ui/input-otp.tsx`, `ui/carousel.tsx`, `ui/calendar.tsx`; server `slash-commands.ts` + `.bak`/`.backup` (identical 38,007-byte copies; not compiled but typechecked — delete in same PR as fix 1's call-site migration or after it); root `server.log`. Deps: `recharts, framer-motion, react-resizable-panels, passport, express-session, connect-pg-simple, memorystore, ws, next-themes, input-otp, embla-carousel-react, react-day-picker` **plus** `passport-local` + `@types/passport-local` (peer-dep would silently reinstall passport) **and** `@types/ws`. **Both Google SDKs stay** — `@google/genai` imported at `ai-content-generation.ts:1`; `@google/generative-ai` at `openai.ts:3` and `ai-agent.ts:2557`. Add per-surface error boundaries around MarkdownRenderer/Sidebar/AI panels in the same PR.
- **Accept:** `npm run check` + `npm run build` + e2e all green; `grep -rn <symbol>` clean for every deleted module.

---

## Invariants that survive every fix
1. One undo stack (`use-document.ts`) for all mutation sources — no second history mechanism.
2. API keys server-side env only.
3. Whole-document agent rewrites keep requiring AgentApplyDialog approval.
4. `PUT /api/documents/:id` keeps the `ifUpdatedAt` precondition (409 + server copy).
5. Single-user mode (no `AUTH_PASSWORD`) behaves unchanged; the 18-check e2e gate stays green.

## Verification log

**Baseline e2e (2026-09-14, fresh dev server on `feature/internal-tool-hardening`, Ollama `qwen3.5:0.8b`):**

```
E2E RESULT: 18/18 PASS (wall time: 2m 19s, exit 0)
1 CRUD GET /api/projects 42ms · 2 POST /api/documents 24ms · 3 PUT autosave 7ms
4 /continue 22.9s · 5 /improve 24.0s · 6 /fix 3.0s · 7 /bullets 11.1s · 8 /format 2.5s
9 STREAM /continue 23.7s (744 chunks, final 3478 chars) · 10 /table 0.9s · 11 /chart 14.2s
12 /image (mflux) 21.0s · 13 alt-text 8 words · 14 AGENT 15.0s · 15 SEARCH honesty 401/0 sources (by design)
16 TEXT /analyze 3ms · 17 TEXT /structure 1ms · 18 cleanup 204
SUMMARY: 18 PASS / 0 FAIL / 0 WARN
```

Runner observations carried into the plan: agent response lacked `toolResults`/`toolExecuted` fields (check passed on content length alone → strengthens fix 9); all Ollama outputs carry literal `<thinking>` tags (client parser strips them; unclosed-tag leak remains as audit A5); `/table` returned in 888ms with template-shaped output (flagged for a manual glance, not a failure).

## Discrepancies vs the original audit
- `express.json` 50mb is at `server/index.ts:9-10` (audit said :12).
- Both Google AI SDKs are actively imported — neither is removable (audit hedged "one of them").
- `applyWithHistory` reaches the stream handler via prop binding (`UltraMinimalEditor.tsx:692`), not direct call — mechanism unchanged.
- Three more deletable files found: `ui/input-otp.tsx`, `ui/carousel.tsx`, `ui/calendar.tsx`; plus `passport-local`/`@types/passport-local`/`@types/ws` deps.
- `executeAutonomousWorkflow` is truly dead — but its stub tools must be deleted with it.
