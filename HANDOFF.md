# HANDOFF — wordPlay UX/UI Fix Queue

**From:** QA pass of 2026-08-12 (report-only, nothing fixed)
**Full evidence:** `.gstack/qa-reports/qa-report-localhost-2026-08-12.md` + 35 screenshots in `.gstack/qa-reports/screenshots/`
**Regression baseline:** `.gstack/qa-reports/baseline.json` (re-run QA after fixes and diff against it)
**Overall score at handoff:** 66/100 (D). Functional 14/100 is the drag.

## How to use this document

- Fixes are ordered so each one lands independently. Do them in order; each has its own acceptance criteria.
- Repo has no test runner. Per convention, add `test-<area>.js` at repo root (runs against a live server) and run `npm run check` after every change.
- Dev setup: `docker start wordplay-postgres`, then `npm run dev` (Vite :5173 proxies to Express :5001).
- **Known-bad local env (not code bugs):** `OPENAI_API_KEY` in `.env` is invalid, `PERPLEXITY_API_KEY` returns 401, and the MLX endpoint `OPENAI_BASE_URL=http://127.0.0.1:18110/v1` is down. Several fixes below are about how the app *handles* exactly these failures, so you can reproduce with the current `.env`.
- Ollama is a working local provider for testing: pick "Ollama (Local)" in Settings → AI. Use `qwen3.5:0.8b` for speed; the 9b model exceeds the server's 5-min timeout on this machine.

---

## FIX-01 — Make Settings → AI provider/model actually control all AI paths (ISSUE-001, Critical)

**Symptom:** User selects "Ollama (Local)" + `qwen3.5:0.8b` in Settings. Slash commands still call whatever `OPENAI_BASE_URL` env points to. The agent widget (`/api/agent/intelligent-request`) ignores the selection entirely and calls OpenAI directly.

**Repro:**
1. Settings → AI → Provider "Ollama (Local)", model `qwen3.5:0.8b`.
2. Editor → `/` → Continue writing. Watch server log: request goes to `OPENAI_BASE_URL`, not Ollama.
3. Expert mode → wordPlay agent FAB → send "Fix grammar". Server log shows an OpenAI call and a 401.

**Where to look:**
- `server/openai.ts` — client construction; check how `OPENAI_BASE_URL`/key are read vs. what the client sends in the request body.
- `server/slash-commands-minimal.ts` (`executeCoreCommand`, ~line 323) — what provider/model it passes.
- `server/ai-agent.ts` — the agent's LLM calls; confirm it never receives the user's provider choice.
- `server/routes.ts` — `/api/ai/slash-command` (~line 491) and `/api/agent/intelligent-request`; check what the client POSTs (does the UI even send provider/model?) and whether settings are client-localStorage-only with no server channel.
- Client: `client/src/providers/SettingsProvider.tsx` — where the selection lives today.

**Direction (decide as a team):** either (a) client sends `{ provider, model }` with every AI request and the server honors it, or (b) server-side settings store. Then **show the active provider/endpoint + key health** somewhere visible (e.g., Settings → AI with a "Test connection" button), because silent fallback is the root of half the bugs in this report.

**Acceptance:**
- Selecting Ollama + a model makes slash commands, quiet assist, and the agent all hit `OLLAMA_URL` with that model (verify in server logs).
- Selecting OpenAI makes all three hit OpenAI with the selected model.
- Agent no longer calls OpenAI when Ollama is selected.
- `npm run check` passes; `test-ai-provider-routing.js` added.

---

## FIX-02 — Slash menu: type-to-filter without polluting the document (ISSUE-002, High)

**Symptom:** Typing `/` opens the menu; typing `con` inserts "con" into the document mid-sentence and the menu never filters.

**Repro:** Editor body → type `/con`. Menu shows all 9 items; document now contains stray "con".

**Where to look:** the slash-command menu component in `client/src/components/` (find the listbox with "AI slash commands") and the editor (`Editor.tsx`) — the `/` handler intercepts one keystroke but subsequent keys fall through to the textarea.

**Acceptance:**
- `/con` filters to "Continue writing"; `/im` to "Improve writing"; no characters enter the document while the menu is open.
- Escape closes the menu and leaves the document untouched.
- Arrow keys + Enter and number shortcuts still work.
- No-results query shows an empty state, not the full list.

---

## FIX-03 — Expose the full advertised command set, or stop advertising it (ISSUE-003, High)

**Symptom:** Menu shows 9 commands. Onboarding promises 17 (Advanced) and the Research context panel suggests `/outline` and `/analyze`, which don't exist in the menu. README lists `/summarize`, `/expand`, `/rewrite`, `/tone`, `/suggest`, `/list`.

**Depends on:** FIX-02 (filtering is how users reach a long list).

**Where to look:** the command registry behind `server/slash-commands-new.ts` / `slash-commands-minimal.ts` and the client menu items list; onboarding copy (`onboard-2.png`); the "AI Quick Actions" panel in the Research view.

**Acceptance:**
- Menu, onboarding copy, Research quick-actions, and README describe the same set.
- Every command shown is executable; every executable command is discoverable via filtering.
- Update docs (`README.md`, `AGENTS.md`, `CLAUDE.md`) to match reality.

---

## FIX-04 — Research search button submits instead of navigating away (ISSUE-004, High)

**Symptom:** Research tab → type query → click blue magnifier button → app navigates to the Write tab; no search runs. Enter in the field works.

**Where to look:** the Research Assistant page component (`client/src/pages/` or `components/`) — the button's `onClick`/`type` and any form/submit or routing side effect. `screenshots/research-results.png` shows the bounce.

**Acceptance:**
- Clicking the button runs the same search as Enter, with a loading state.
- No navigation away from Research.
- Add `test-research-search.js` (or extend QA baseline check).

---

## FIX-05 — Never present simulated sources as real (ISSUE-005, High)

**Symptom:** Perplexity 401 → server logs the error but returns HTTP 200 with fabricated `example.com` sources; UI shows "Sources (3)" with "Add to Sources" buttons and blames missing config ("please configure the PERPLEXITY_API_KEY") — the key IS configured, it's unauthorized.

**Where to look:** `server/web-search.ts` (the simulated fallback path) and `server/routes.ts` `/api/search`.

**Acceptance:**
- Provider errors (401/429/network) produce a non-200 or an explicit `error` payload and a clear UI error naming the real cause ("Perplexity rejected the API key (401)").
- Simulated data is either removed entirely or visually labeled "OFFLINE DEMO DATA — not real sources" with no "Add to Sources" affordance.
- Search button and Enter path (FIX-04) both surface the error state.

---

## FIX-06 — Document deletion needs confirm or undo (ISSUE-006, High)

**Symptom:** Sidebar hover → tiny trash icon → instant DELETE 204, toast only. One mis-click destroys content.

**Where to look:** the navigation sidebar document row component; consider an undoable soft-delete (toast with "Undo" for ~5s) or an AlertDialog confirm. Project delete likely has the same issue — check.

**Acceptance:**
- Delete requires confirmation or offers working Undo.
- Trash/edit icon buttons get accessible names (`aria-label="Delete document"` etc.) — this is part of FIX-09 but do these two here.

---

## FIX-07 — Streaming/progress/cancel for long AI operations (ISSUE-007 + ISSUE-008, High/Medium)

**Symptom:** `/continue` against a slow model: blurred popover says "Processing command…" for 5 minutes, no streaming, no cancel; server dies at `UND_ERR_HEADERS_TIMEOUT` (301s) and the API returns `200 {"result":"","message":"Error executing…"}` — so the UI shows a success-styled "**Command Executed**" toast containing an error message.

**Two workstreams:**
1. **Server contract:** AI endpoints must return real error status codes (4xx/5xx) or a typed `{ ok: false, error }` shape the UI can trust. Timeout should be configurable and shorter for interactive commands.
2. **Client UX:** stream tokens if feasible (SSE/chunked), else show elapsed time + a Cancel button that aborts the fetch. Error toasts use destructive styling and an honest title ("Command failed").

**Where to look:** `server/routes.ts` `/api/ai/slash-command` (returns 200 on error today), `server/slash-commands-minimal.ts`, the client slash-command executor (toast text "Command Executed"), and `server/openai.ts` fetch timeout config.

**Acceptance:**
- A failing command produces a red "failed" toast with the real reason; nothing logs `AI response parsing failed completely` for an empty `result`.
- User can cancel an in-flight command.
- Loading state communicates progress beyond a static spinner after ~10s.

---

## FIX-08 — Reload restores your document (ISSUE-009, Medium)

**Symptom:** Reload → `GET /api/documents/1 404` (stale remembered ID) → console error + blank "Untitled Document" with no empty state. (Doc 1 was deleted earlier; the app never recovered.)

**Where to look:** the "last open document" persistence (localStorage key read at app start in `client/src/`) and the 404 handler for `GET /api/documents/:id` consumers (`use-document.ts`).

**Acceptance:**
- On 404, the app clears the stale ID and falls back to the first available document in the current project, or shows a real empty state ("No document selected — pick one or create one") with a CTA.
- Reloading with a valid open doc returns you to it.
- No console error on this path.

---

## FIX-09 — Accessibility pass (ISSUE-012, Medium)

- Add `aria-describedby`/Description to all `DialogContent` (Radix warning on every dialog open).
- Name every icon-only button (sidebar doc edit/delete, toolbar icons).
- Agent chat: Enter submits, Shift+Enter newlines.
- Dark mode: raise contrast of secondary labels (sidebar group headers, "Novel Draft" breadcrumb) to WCAG AA.

**Where to look:** `client/src/components/` sidebar + toolbar + agent widget (`AIAgent.tsx`), `client/src/components/ui/dialog.tsx` usages.

**Acceptance:** No Radix warnings in console; ARIA snapshot shows no bare `[button]` entries; Enter sends chat; contrast passes AA at 375px and 1280px in both themes.

---

## FIX-10 — Onboarding fits 1280×720 (ISSUE-011, Medium)

**Symptom:** Step 2 (mode selection) renders taller than the viewport; Back/Next are off-screen and unclickable without scrolling.

**Where to look:** the onboarding dialog component — cap dialog height (`max-h-[90vh]`) and make the content area scroll with the footer pinned.

**Acceptance:** At 1280×720 and 375×812, every onboarding step shows its title and action buttons; buttons are clickable with a real pointer.

---

## FIX-11 — Image insertion lands cleanly (ISSUE-010, Medium)

**Symptom:** `/image` result markdown inserted mid-sentence ("…in the air, ![entire prompt text](…)and the keeper's…"), alt text = full prompt excerpt.

**Where to look:** the image command result handler in `server/slash-commands-minimal.ts` and/or the client insertion logic — insert at a paragraph boundary (new block after current paragraph), alt text = short description or "Generated image", not 140 chars of prompt.

**Acceptance:** Image always lands on its own line as a separate block, never splitting a sentence; alt text ≤ ~8 words.

---

## FIX-12 — Polish batch (ISSUE-013/014/015, Low)

- Mobile (375px): fix clipped "Saved" indicator; keep word count visible or intentionally hidden.
- Settings → Editor: Autosave slider ticks read "5s … 2s … 5m" — fix midpoint label.
- Onboarding step 3: "WordPlay" → "wordPlay" (brand casing).
- Agent chat: don't echo raw provider error JSON/messages to users; map to friendly text.
- Export → Markdown: add success toast (or browser-native download feedback).

---

## Verification checklist (run after all fixes)

1. `npm run check` clean.
2. Re-run the QA pass against `baseline.json` (the browse binary: `~/.claude/skills/gstack/browse/dist/browse`); target: Functional ≥ 70, UX ≥ 80, overall ≥ 85.
3. Fresh-profile onboarding at 1280×720 completes with pointer clicks only.
4. Full AI happy path with Ollama `qwen3.5:0.8b`: `/continue`, `/improve`, `/image`, agent chat — all succeed, all logged to the right provider.
5. Reload mid-session returns to the open document; no console errors on load.
6. `git grep -n "simulated" server/` returns no user-facing fake-source path, or it is clearly labeled demo data.

## Notes for the team

- The QA scratch document was deleted during QA; the "pp" document and "Novel Draft" project are pre-existing user data — don't delete them.
- Server crashes hard if Postgres is down at the first DB-touching request (`server/db-storage.ts` + `routes.ts` getProjects) — out of scope for this queue but worth a follow-up: the server logs "serving on localhost:5001" while DB-less, then dies on request. Degrade gracefully instead.
- No test framework exists. Consider this queue the forcing function to start `test-*.js` coverage per the repo's AGENTS.md conventions.
