# wordPlay — Ship-Readiness Report

**Date:** QA + PM pass, day before ship
**Branch:** `feature/ultra-minimalist-writing` @ `441c82b` + fixes below
**Roles:** Product Manager + QA Engineer pass
**Verdict: GO, with conditions** — see §5.

---

## 1. What was verified (QA)

### 1.1 Gates

| Gate | Result |
|---|---|
| `npm run check` (tsc, strict) | ✅ PASS |
| `npm run build` (vite + esbuild → `dist/`) | ✅ PASS |
| `node test-ship-readiness.js` (new, committed) | ✅ **18/18 PASS** |

### 1.2 Full e2e generative matrix (live server, Ollama `qwen3.5:0.8b`)

| Capability | Result | Evidence |
|---|---|---|
| Projects/documents CRUD + autosave path | ✅ | create/PUT/delete round-trip, scratch docs cleaned up |
| `/continue` | ✅ | 9.4k chars returned |
| `/improve` | ✅ | 6.6s–66s |
| `/fix` | ✅ | 101s worst case (slow local model, honest wait + Cancel in UI) |
| `/bullets` | ✅ | 14.6s |
| `/format` | ✅ | 11.4s |
| Streaming (NDJSON) | ✅ | 22–25 progressive chunks, final result applied |
| `/table` | ✅ | markdown table generated |
| `/chart` | ✅ (after fix) | 44s; was an unbounded hang before §2 FIX-1 |
| `/image` (local mflux FLUX.2, 1-step) | ✅ | 118s, PNG served HTTP 200, alt text = 8 words (FIX-11 ✓) |
| Agent tool loop (`/api/agent/intelligent-request`, Ollama, conservative) | ✅ | 32–137s, completes with summary |
| Search honesty (FIX-05) | ✅ | Perplexity 401 → **HTTP 401**, zero fabricated sources |
| Text ops `/analyze`, `/structure` | ✅ | 200 with real stats |
| Provider routing (FIX-01) | ✅ | `llmProvider/llmModel` accepted end-to-end on slash + agent paths |

### 1.3 UI user-journey walk (real Chrome, real keystrokes)

- ✅ Onboarding shows → completes → **stays completed after reload** (was broken — §2 FIX-2)
- ✅ `/` opens slash menu without inserting anything; `con` filters 9→1 ("Continue writing"); `Esc` closes with document byte-identical (FIX-02 verified live)
- ✅ Preview mode renders markdown (paragraphs verified; table/chart renderer unchanged)
- ✅ Autosave indicator, word count, Write/Preview toggle, Commands button all functional
- ✅ Agent FAB (expert mode) opens chat with input + quick-action chips
- ⚠️ Observed live: after the open document is deleted externally, UI falls back to a *different* document — confirms HANDOFF FIX-08 PARTIAL (no last-open-doc restore; no data loss, just context switch)

### 1.4 HANDOFF.md queue status (static verification, file:line evidence in QA log)

**11 DONE / 1 PARTIAL / 0 MISSING.** Only FIX-08 (restore last-open document on reload) remains partial — acceptable for ship as a known limitation; the dangerous half of FIX-08 (stale-id 404 crash/blank state) is resolved by design (no stale id persisted).

---

## 2. Bugs found & fixed in this pass

| # | Severity | Bug | Fix |
|---|---|---|---|
| FIX-1 | **P0** | `/chart` (and any slow Ollama content call) hung forever: `callOllama` in `server/openai.ts` and `server/slash-commands-minimal.ts` had **no fetch timeout** — waits on undici's ~5-min header timeout while UI spins | Added `AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS, default 180s)` to both; now fails honestly into the existing red-toast error path |
| FIX-2 | **P1** | Welcome modal reappeared on **every reload** — neither Close nor Finish persisted `hasCompletedOnboarding` (`client/src/pages/Home.tsx`) | Both paths now call `updateSettings({ hasCompletedOnboarding: true })`; verified live across reloads |
| FIX-3 | **P1** | Settings → Agent autonomy (Conservative/Moderate/Aggressive) was a **placebo** — never sent; server silently defaulted to moderate (`client/src/components/AIAgent.tsx`) | New `autonomyLevel` prop, wired from `settings.autonomyLevel` in Home → request body |

All fixes pass `npm run check`; build green.

---

## 3. Known issues shipped as-is (PM-accepted, documented)

1. **Streaming is Ollama-only** (`/api/ai/slash-command/stream` hardwires Ollama; OpenAI/Gemini/chart/image are single-shot with elapsed-timer + Cancel). Acceptable: Cancel + honest errors cover the wait.
2. **Agent writes bypass undo** — agent tool results use raw `setContent` (no ⌘Z, no diff preview), and unrecognized long agent strings are blindly appended to the doc (`Home.tsx` `onToolResult`). **Top post-ship item.** Mitigation for now: agent is expert-mode-only; slash commands (the primary path) *are* undoable.
3. **`<thinking>` wire format** — server returns reasoning tags by design; client parser strips them before insertion. Edge case: an *unclosed* `<thinking>` tag (small model hits token limit mid-thought) leaks reasoning text into the document. P2: add unclosed-tag pattern to `aiResponseParser.ts`.
4. **Two settings surfaces** (`SettingsPanel` tab vs `/settings` page) with divergent constraints; Gemini "Test connection" actually pings the OpenAI slot. P2.
5. **Dead UI**: ContextPanel "AI Quick Actions" buttons have no handlers; `defaultExportFormat` pdf/docx setting does nothing (export is md/txt/print). P2 — remove or wire.
6. Research "Save Notes" appends a new source row each save (duplicates accumulate). P2.
7. Onboarding copy drift ("All 9 slash commands" mode gating that doesn't exist; "Gemini 2.0 Flash" images vs local-mflux default). P3 copy fix.
8. Environment-dependent (not code bugs): `PERPLEXITY_API_KEY` returns 401 (search is honestly disabled until a valid key), `OPENAI_BASE_URL` MLX endpoint down, Ollama model quality drives speed (0.8b: 6–100s/command).

---

## 4. Agent UX / product-role assessment (PM)

**Verdict: ship-able core, fragmented periphery.** The slash-command system is the coherent, primary assistant: one menu, one apply-path, undoable, streaming, honest errors. The agent FAB is a competent expert-mode power tool with friendly error mapping. What remains incoherent: four AI entry points (slash, AmbientAI, agent FAB, research summaries) with three different result blast-radii (selection / cursor / whole-doc), agent reasoning captured but never rendered, and dead controls that promise functionality that doesn't exist.

**Ranked post-ship recommendations:**
1. Route agent writes through the undo-aware `applyAIContent` + show a before/after confirm for whole-doc replaces (removes the only remaining silent-data-loss path).
2. Render the agent's plan/tool trace inline (already captured on the message object).
3. Stop appending unrecognized agent strings >20 chars to the document; ask instead.
4. Consolidate settings to one surface; fix Gemini test-connection mapping.
5. Delete or wire dead controls (ContextPanel quick actions, export-format setting); prune unmounted legacy components (`Editor.tsx`, `RichMarkdownEditor.tsx`, `ContextualAIEngine.tsx`).

---

## 5. Go/No-Go

**GO for tomorrow**, conditioned on:
- ✅ Build + type-check green (done)
- ✅ 18/18 e2e suite green (done)
- ✅ P0/P1 fixes landed (done — §2)
- Ship notes must state: search requires a valid Perplexity key; best local experience is Ollama `qwen3.5:0.8b`+; image gen needs the mflux bridge (or a Gemini key); streaming currently Ollama-only.

**Repro:** start Postgres (`docker start wordplay-postgres`), `npm run dev`, then `node test-ship-readiness.js` (`QA_MODEL` env to override model).
