<p align="center">
  <img src="docs/hero.png" alt="WordPlay — write with an agent, not an autocomplete" width="100%">
</p>

# WordPlay

An editor with an AI agent beside it — write with a 30-tool agent, not an autocomplete.

WordPlay pairs a rich markdown writing workspace with an autonomous AI agent — research, drafting, style analysis, images, charts, and project management — and runs on the model you choose: OpenAI, Google Gemini, Kimi, a fully local Ollama model, or any OpenAI-compatible endpoint (MLX, LM Studio, vLLM, OpenRouter). It runs in the browser with a React/Express stack and stores everything in PostgreSQL.

![WordPlay editor with research, projects, and the AI assistant panel](docs/wordplay-ui.png)

## What it does

- **30-tool AI agent.** Projects, documents, research & web, text analysis, generation, and long-term memory/goals. Three autonomy levels (conservative → aggressive); whole-document rewrites always ask before applying.
- **Slash commands.** `/continue`, `/improve`, `/fix`, `/bullets`, `/table`, `/chart`, `/image`, `/format` — plus your own custom commands, saved to the database and available in the same menu. Client-side `/undo` rolls back any AI edit.
- **Multi-provider AI.** Switch models per request from one settings surface: cloud (OpenAI, Gemini, Kimi) or local (Ollama, custom OpenAI-compatible servers). Timeouts are bounded and honest — no infinite spinners.
- **Image generation.** Local-first via an mflux bridge (FLUX.2 Klein), with Gemini and any OpenAI-compatible image endpoint (`/v1/images/generations`) as alternatives.
- **Research & context.** Perplexity-backed web search and page scraping, source management, and honest failures — if search is unconfigured or fails, you get an error, never fabricated sources.
- **Rich preview.** Markdown with GFM tables, ```` ```chart ```` fences (ECharts), Mermaid diagrams, KaTeX math, and syntax highlighting.
- **Projects & documents.** Multi-tab interface, real-time auto-save, a shared undo history across typing, slash commands, and agent edits, and conflict-safe saves (conditional `PUT` returns 409 with the server copy on conflict).
- **Team-ready.** Optional shared-password sign-in (`AUTH_PASSWORD`) with per-user ownership of projects, documents, and sources. Unset, it's a private single-user app.
- **Dark/light themes** and a responsive layout.

## Quick start

### Local development

You need Node.js ≥ 18 and PostgreSQL ≥ 13.

```bash
git clone https://github.com/0-CYBERDYNE-SYSTEMS-0/wordPlay.git
cd wordPlay
npm install
cp .env.example .env   # add your DATABASE_URL; provider keys are optional
npm run db:push
npm run dev            # → http://localhost:5173
```

Without any keys, WordPlay uses a local Ollama model at `http://localhost:11434` — a fully offline, no-cost setup. Add `OPENAI_API_KEY`, `GEMINI_API_KEY`, `KIMI_API_KEY`, and/or `CUSTOM_BASE_URL` to switch to cloud or other local servers. Web research needs `PERPLEXITY_API_KEY`.

### Team deployment (Docker)

One command brings up the app, PostgreSQL, and a persistent uploads volume:

```bash
cp .env.example .env   # set at least AUTH_PASSWORD (+ provider keys)
docker compose up -d --build
```

The schema initializes automatically at startup; publish the port on your LAN via the `ports` mapping. Without Docker, `npm run build && npm start` serves the API and built client on a single port.

## Configuration

Everything is configured through `.env` (see [`.env.example`](.env.example) for the full annotated list):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (required) |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` / `KIMI_API_KEY` | Cloud model providers (optional) |
| `CUSTOM_BASE_URL` + `CUSTOM_API_KEY` | Any OpenAI-compatible endpoint (MLX, LM Studio, vLLM, OpenRouter…) |
| `OLLAMA_URL` | Local Ollama (default `http://localhost:11434`) |
| `PERPLEXITY_API_KEY` | Web search for the agent and research tools (optional) |
| `MFLUX_BRIDGE_URL` | Local FLUX.2 image-generation bridge (default `http://127.0.0.1:4030`) |
| `AUTH_PASSWORD` | Enables team sign-in with per-user ownership |
| `AI_REQUEST_TIMEOUT_MS` | Bounds all AI requests (default 180000) |

API keys are server-side environment variables only — the client never sends or stores keys.

## Architecture

```
React 18 + Vite / TypeScript / Tailwind ─▶ Express API ─┬─ AI Agent Engine (30 tools)
                                                        ├─ Slash-command pipeline
                                                        ├─ PostgreSQL + Drizzle ORM
                                                        ├─ Providers: OpenAI · Gemini · Kimi ·
                                                        │   Ollama · OpenAI-compatible
                                                        ├─ Images: mflux (FLUX.2) · Gemini · custom
                                                        └─ Web search / extraction (Perplexity)
```

All REST endpoints live in `server/routes.ts`; ownership checks are enforced there and in the storage layer. See [`LLM_PIPELINE_FLOW.md`](LLM_PIPELINE_FLOW.md) for how requests route through the model pipeline.

## Security notes

- API keys never leave the server.
- When team auth is enabled, `/api` and `/uploads` are gated by HMAC-signed session cookies, and every project, document, source, and custom command is ownership-checked.
- Preview and exported HTML are sanitized; the scraper is SSRF-guarded; user-supplied regexes run under `re2`.

## Docs

| Document | What's in it |
|----------|--------------|
| [`AGENTS.md`](AGENTS.md) | Guidance for AI coding agents working in this repo |
| [`LLM_PIPELINE_FLOW.md`](LLM_PIPELINE_FLOW.md) | How agent requests route through the model pipeline |
| [`AGENT_FIXES_SUMMARY.md`](AGENT_FIXES_SUMMARY.md) | Known fixes and behavior notes for the agent layer |
| [`HANDOFF.md`](HANDOFF.md) | Prioritized UX fix queue from the 2026-08 QA pass |
| [`SHIP_READINESS.md`](SHIP_READINESS.md) | Pre-ship QA/PM go-no-go report (verdict: GO, 18/18 e2e checks pass) |
| [`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md) | Security-hardening remediation record |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to contribute |

## Testing

No formal test runner is configured; `npm run check` (TypeScript, strict) is the baseline gate. Integration checks are ad-hoc scripts at the repo root (`test-*.js`) run against a live dev server — [`test-ship-readiness.js`](test-ship-readiness.js) is the committed 18-check e2e gate covering CRUD, every slash command, streaming, image generation, the agent tool loop, and search honesty.

## License

[MIT](LICENSE) — WordPlay is open source.
