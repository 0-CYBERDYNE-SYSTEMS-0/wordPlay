# AGENTS.md — wordPlay

Guidance for AI coding agents working in this repository. Assumes no prior knowledge of the project.

## Project Overview

**wordPlay** is a full-stack, AI-powered writing companion web app. It combines a rich markdown editor with an autonomous AI agent (19 tools across project management, research, writing, and text analysis), slash commands (`/continue`, `/improve`, `/fix`, `/bullets`, `/format`, `/chart`, `/image`, `/table`, plus client-side `/undo`), web research (Perplexity), and multi-LLM support (OpenAI, Google Gemini, Ollama for local models, and OpenAI-compatible local endpoints such as an MLX server).

- License: MIT. Package: `wordplay@1.0.0`, ESM (`"type": "module"`).
- Repo origin: Replit project (`.replit` config present); deployed via Replit autoscale (`npm run build` then `npm run start`).
- UI component system: shadcn/ui ("new-york" style, neutral base color) — see `components.json`.
- Additional docs: `README.md` (feature overview + API reference), `CLAUDE.md` (similar agent guidance), `LLM_PIPELINE_FLOW.md` (AI pipeline details), `CONTRIBUTING.md`, `AGENT_FIXES_SUMMARY.md`, `HANDOFF.md` (prioritized UX fix queue from the 2026-08 QA pass — read before touching the editor or AI routing; the current branch `feature/ultra-minimalist-writing` is mid-overhaul of these areas), `SHIP_READINESS.md` (2026-09 pre-ship QA/PM go-no-go report — verdict GO with conditions; live e2e evidence and HANDOFF queue status: 11 DONE / 1 PARTIAL, only FIX-08 restore-last-open-doc remains).

## Technology Stack

- **Frontend** (`client/`): React 18.3 + TypeScript, Vite 5, Tailwind CSS 3.4 (+ `@tailwindcss/typography`, tailwindcss-animate), shadcn/ui (Radix UI primitives), TanStack Query 5, react-hook-form + Zod, wouter (routing), framer-motion, recharts/echarts, react-markdown + remark/rehype plugins, jspdf/html2canvas (export).
- **Backend** (`server/`): Node.js (≥18) + Express 4 + TypeScript, executed with `tsx` in dev, bundled with esbuild for prod.
- **Database**: PostgreSQL (≥13) via Drizzle ORM 0.39 + `drizzle-kit`; `pg` driver with a connection pool (`connect-pg-simple`, `node-pg-migrate`, `@neondatabase/serverless` also present).
- **AI**: `openai` SDK (with optional `OPENAI_BASE_URL` override for OpenAI-compatible local servers), `@google/generative-ai` + `@google/genai` (Gemini, incl. image generation), Ollama via HTTP, Perplexity API for web search, local image generation via an mflux bridge (FLUX.2 Klein).
- **Validation**: Zod + `drizzle-zod` + `zod-validation-error` everywhere at module boundaries.

## Project Structure & Module Organization

```
client/                  React + Vite app (Vite root is client/, entry client/index.html)
  src/
    components/          React components, PascalCase (Home uses UltraMinimalEditor)
      ui/                shadcn/ui generated primitives
    hooks/               Custom hooks, kebab-case use-*.ts(x) (use-document.ts owns the shared undo stack)
    lib/                 Client utilities (queryClient.ts, lenientJson.ts, aiResponseParser.ts, ...)
    pages/               Route pages (Home.tsx, Settings.tsx — the single settings surface, not-found.tsx)
    providers/           React context providers (ThemeProvider, SettingsProvider, ProcessingProvider)
    utils/               export-utils.ts (standalone HTML/PDF export), reasoning-models.ts
server/                  Express + TypeScript API (kebab-case filenames, prefer named exports)
  index.ts               Entry: middleware, DB init, route registration, Vite dev/static serving
  routes.ts              All REST endpoints (~40 routes under /api/*); ownership checks live here
  auth.ts                Optional team auth (AUTH_PASSWORD): HMAC cookie sessions + login/logout/session
  upload.ts              POST /api/uploads — bring-your-own image upload (multer, 15MB, image mimes)
  ai-agent.ts            Autonomous agent engine + tool definitions (largest file)
  ai-content-generation.ts  Multi-provider content + image generation (mflux / Gemini / custom endpoint)
  openai.ts              Text completion, style analysis, suggestions (OpenAI / Ollama / Gemini)
  web-search.ts          Perplexity-backed web search + page scraping
  file-operations.ts     grepText, replaceText, countWords, extractStructure, analyzeDocument
  slash-commands-new.ts  ACTIVE slash-command dispatcher (imported dynamically by routes.ts)
  slash-commands-minimal.ts  Core command execution used by -new
  storage.ts             IStorage interface + MemStorage; exports `storage = new PostgresStorage()`
  db-storage.ts          PostgresStorage (Drizzle implementation of IStorage)
  db.ts / db-migrate.ts  Pool + startup schema initialization
  config.ts              dotenv loading; database/server config (port 5001 default)
  vite.ts                Dev Vite middleware + production static serving
shared/
  schema.ts              Drizzle pgTables + drizzle-zod insert schemas + inferred types
                         (users, projects, documents, sources, custom_commands)
public/                  Static assets; public/uploads/ holds generated/uploaded images (served at /uploads)
migrations/              Drizzle migrations (config: drizzle.config.ts, schema: shared/schema.ts)
scripts/                 db-push.js, init-db.js (legacy CommonJS helpers using drizzle-kit push:pg)
attached_assets/         Design docs/screenshots (aliased as @assets)
test-*.js                Ad-hoc integration test scripts at repo root (no test runner)
dist/                    Build output (dist/public client assets, dist/index.js server bundle)
Dockerfile               Production image (API + built client, single port)
docker-compose.yml       Team deployment: app + Postgres + uploads volume
```

**Path aliases**: `@` → `client/src` and `@shared` → `shared` are defined in both `vite.config.ts` and `tsconfig.json`. `@assets` → `attached_assets` is a **Vite-only alias** (not in tsconfig), so `@assets/*` imports won't resolve under `npm run check` — prefer a relative import if type-checking that path.

## Build, Test, and Development Commands

- `npm run dev` — Run server + client concurrently. Vite dev server on `http://localhost:5173` proxies `/api` and `/uploads` to the Express server on `:5001`.
- `npm run dev:server` — API only, via `tsx server/index.ts` (port from `PORT`, default 5001).
- `npm run dev:client` — Vite dev server only.
- `npm run build` — `vite build` → `dist/public`, then esbuild bundles `server/index.ts` → `dist/index.js` (ESM, `--packages=external`).
- `npm start` — Production: `NODE_ENV=production node dist/index.js` (serves API + static client).
- `npm run check` — `tsc` type-check (noEmit). Run this to validate any change.
- `npm run db:push` — `drizzle-kit push` applies `shared/schema.ts` to the database. Requires `DATABASE_URL`.
- **Local dev requires Postgres** — start it with `docker start wordplay-postgres` before `npm run dev` (see `HANDOFF.md`).

## Architecture Notes

- **Single port in production**: the Express server serves the built client from `dist/public` and also runs Vite middleware in dev (`server/vite.ts`). In the standard local dev flow you run both processes and use the Vite port (5173).
- **Team auth & ownership**: when `AUTH_PASSWORD` is set, `server/auth.ts` gates `/api` and `/uploads` with HMAC-signed session cookies; users sign in with the shared password + display name (maps to a `users` row). Routes enforce per-user ownership of projects/documents/sources/custom commands. Unset → single-user mode (`userId = 1`), e2e tests unaffected.
- **Data safety invariants** (keep them): API keys are server-side env only — never accept client-sent keys; all document edits (typing, slash commands, agent) share the undo history in `use-document.ts`; whole-document agent rewrites require explicit approval (`AgentApplyDialog`); `PUT /api/documents/:id` supports an `ifUpdatedAt` precondition (409 + server copy on conflict).
- **API surface**: all endpoints live in `server/routes.ts` — REST CRUD for projects/documents/sources/custom-commands, AI endpoints (`/api/ai/*`, `/api/agent/*`), text ops (`/api/text/*`), `POST /api/uploads` (image upload), and search/scrape. Request/response bodies are validated with Zod schemas derived from `shared/schema.ts`.
- **Storage layer**: routes depend only on the `IStorage` interface from `server/storage.ts`; the active export is `PostgresStorage` (Drizzle). `MemStorage` exists for in-memory use.
- **AI pipeline**: the editor sends slash commands to `/api/ai/slash-command`, which dynamically imports `./slash-commands-new` (→ `slash-commands-minimal`; custom commands from the DB appear in the same menu). The agent (`/api/agent/*`) runs the tool-using engine in `server/ai-agent.ts`. Text generation supports OpenAI, `OPENAI_BASE_URL`-compatible servers, Gemini, and Ollama. Image generation is local-first (mflux bridge) with Gemini fallback and an OpenAI-compatible custom-endpoint adapter (`IMAGE_API_URL`). WebSockets were removed in favor of direct API calls.
- **Preview renderer** (`client/src/components/MarkdownRenderer.tsx`): GFM tables, raw HTML, syntax highlighting, ` ```chart ` ECharts fences, ` ```mermaid ` diagrams, and `$`/`$$` math (KaTeX).
- **Payload limits**: JSON/urlencoded bodies capped at 50mb for image handling; uploads capped at 15MB.

## Coding Style & Naming Conventions

- TypeScript-first, strict mode; 2-space indentation; semicolons optional but consistent within a file.
- Client: components/pages PascalCase; hooks `use-*.ts(x)`; utilities in `client/src/lib`.
- Server: kebab-case filenames; prefer named exports.
- Import order: node builtins → third-party → local (`@/`, `@shared/`).
- Explicit types at module boundaries; Zod schemas for all runtime validation (define tables in `shared/schema.ts`, derive insert schemas via `drizzle-zod`, infer TS types from them — never duplicate shape definitions).
- Follow existing file patterns; make minimal, targeted changes.

## Testing Instructions

- **No formal test runner** is configured. `npm run check` (tsc) is the baseline correctness gate — run it after every change.
- Integration checks are ad-hoc Node scripts at the repo root named `test-<area>.js` (e.g. `node test-openai-agent.js`, `node test-gemini-simple.js`). They expect `.env` configured and the server running (`npm run dev:server`).
- `node test-ship-readiness.js` is the committed 18-check e2e gate (CRUD, all slash commands, NDJSON streaming, image gen, agent tool loop, search honesty, text ops). Run it against a live dev server; honors `BASE_URL` (default `http://localhost:5001`) and `QA_MODEL` (default `qwen3.5:0.8b`). It requires auth to be disabled (no `AUTH_PASSWORD`).
- When adding coverage for a feature, follow the same pattern: create `test-<area>.js` at the root that exercises the running API.

## Security & Configuration

- Configure env via `.env` (template: `.env.example`). **Never commit secrets** — `.env` is gitignored.
- Env vars:
  - `DATABASE_URL` — PostgreSQL connection (required for `db:push`; server falls back to `postgres://$USER@localhost:5432/wordplay`)
  - `OPENAI_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY` — provider keys (optional per feature)
  - `OPENAI_BASE_URL` — legacy: still honored as the custom endpoint when `CUSTOM_BASE_URL` is unset
  - `CUSTOM_BASE_URL`, `CUSTOM_API_KEY` — "Custom (OpenAI-compatible)" provider (MLX, LM Studio, vLLM, OpenRouter...)
  - `KIMI_API_KEY`, `KIMI_BASE_URL` — Kimi Coding Plan provider (default endpoint `https://api.kimi.com/coding/v1`)
  - `MFLUX_BRIDGE_URL` (default `http://127.0.0.1:4030`), `MFLUX_STEPS` (default 1) — local image generation
  - `OLLAMA_URL` (default `http://localhost:11434`) — local models
  - `GEMINI_IMAGE_MODEL` — must be an image-capable Gemini model (default `gemini-3.1-flash-lite-image`)
  - `IMAGE_API_URL`, `IMAGE_API_KEY`, `IMAGE_API_MODEL` — optional OpenAI-compatible custom image endpoint
  - `AUTH_PASSWORD` — enables team sign-in when set (shared password; per-user ownership). `AUTH_SECRET` — optional cookie-signing secret
  - `AI_REQUEST_TIMEOUT_MS` (default `180000`) — bounds all AI requests (OpenAI, Ollama, agent loop, slash commands) in `server/openai.ts`, `server/ai-agent.ts`, `server/slash-commands-minimal.ts`
  - `NODE_ENV`, `PORT` (default 5001), `HOST` (default localhost; set `0.0.0.0` to expose to the team)
- DB SSL is enabled only when `NODE_ENV=production` (see `server/config.ts`).

## Commit & Pull Request Guidelines

- Commit messages: imperative mood; Conventional Commits encouraged (`feat:`, `fix:`, `chore:`, `refactor:`). Keep scope concise.
- PRs: clear description, linked issues, steps to reproduce/test, screenshots/GIFs for UI changes. Note any DB changes and run `npm run db:push` locally.
