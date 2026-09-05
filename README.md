# wordPlay

An open-source, local-first AI writing studio. Bring your own model — Ollama,
any OpenAI-compatible server (LM Studio, vLLM, llama.cpp, an MLX endpoint), or
Gemini — and keep every key on your own machine.

```
Markdown editor · 8 undoable AI slash commands · autonomous agent with plan
visibility · web research · AI images (local mflux, Gemini, or any
OpenAI-compatible endpoint) · charts · mermaid diagrams · math · tables ·
one-file shareable HTML export
```

## Why wordPlay

- **Local-first AI.** Text, and by default images, generate on your hardware.
  Provider keys live in the server's `.env`, never in the browser.
- **Nothing eats your drafts.** Slash-command and agent edits both go through
  one undo stack (⌘Z). Whole-document agent rewrites require your explicit
  approval with a before/after view. Conflicting saves from a teammate surface
  a resolution dialog instead of silently overwriting.
- **Rich content that survives export.** Charts flatten to high-res PNGs and
  images are inlined, so the exported HTML file is fully self-contained.
- **Honest AI.** Provider failures name the real cause ("Ollama unreachable at
  …", "key rejected (401)"); search errors are never masked with simulated
  results.

## Quick start (single user, dev)

Prerequisites: Node ≥ 18 and PostgreSQL ≥ 13 (`docker start wordplay-postgres`
if you use the provided container naming).

```bash
git clone https://github.com/0-CYBERDYNE-SYSTEMS-0/wordPlay.git
cd wordPlay
npm install
cp .env.example .env          # set DATABASE_URL + any provider keys
npm run db:push
npm run dev                   # Vite :5173 proxies to the API on :5001
```

## Team deployment (Docker, one command)

```bash
cp .env.example .env
# set AUTH_PASSWORD (shared team password) + provider keys, then:
docker compose up -d --build
```

- The app serves API + client on port 5001, bound to `0.0.0.0` in the container.
- Schema initializes automatically; data lives in the `pgdata` volume.
- With `AUTH_PASSWORD` set, users sign in with the team password and a display
  name; projects and documents become per-user. Leave it unset for a
  single-user, no-auth install.
- See `.env.example` for every supported variable (`OLLAMA_URL`,
  `OPENAI_BASE_URL`, `MFLUX_BRIDGE_URL`, `IMAGE_API_URL`, `AI_REQUEST_TIMEOUT_MS`, …).

## AI providers

| Capability | Providers (in order of preference) | Configuration |
|---|---|---|
| Text (slash commands, agent) | Ollama · OpenAI-compatible (`OPENAI_BASE_URL`) · Gemini | Settings → AI, keys in server `.env` |
| Streaming tokens | Ollama | automatic for text commands |
| Images (`/image`) | local mflux bridge (FLUX.2 Klein) · Gemini · custom endpoint | Settings → AI → Image Generation |
| Charts (`/chart`) | any text provider | emits ECharts JSON, rendered in preview |
| Web research | Perplexity (`PERPLEXITY_API_KEY`) | disabled with a clear error until a valid key exists |

Notes:
- Image generation defaults to the local mflux bridge at `MFLUX_BRIDGE_URL`
  (default `http://127.0.0.1:4030`); Gemini is the cloud fallback. The
  **Custom endpoint** option speaks the standard OpenAI
  `/v1/images/generations` shape, which covers ComfyUI bridges, A1111 `--api`,
  SD WebUI, and hosted gateways.
- You can also paste or drag-drop your own images straight into the editor;
  they upload to `/uploads` and insert as markdown.

## Getting content out

The editor's download menu offers:

1. **Markdown (.md)** — the source, for git repos and other markdown tools.
2. **Shareable HTML** — a single self-contained file: charts flattened to
   high-res PNG, images inlined as data URLs, print-ready typography. Open it
   anywhere, attach it to email, or drop it into a CMS.
3. **Print / PDF** — renders the same standalone document into a hidden frame
   and opens the print dialog (charts and images included, unlike printing the
   raw editor).

## Slash commands

Type `/` in the editor: continue, improve, fix, bullets, format, chart, image,
table — plus undo, type-to-filter, streaming on Ollama, elapsed-time display
and Cancel on every command. Custom commands created in Settings → Custom
Commands appear in the same menu.

## Agent (Expert mode)

The floating agent runs multi-step tool chains (project management, research,
writing, text analysis). It shows its plan and per-tool outcomes inline, runs
with an elapsed timer and Cancel, and never modifies your document without
going through the undoable apply path — whole-document rewrites ask first.

## Development

```bash
npm run dev          # server + client
npm run check        # tsc — run after every change
npm run build        # vite build + esbuild server bundle → dist/
npm start            # production server on :5001
node test-ship-readiness.js   # 18-check e2e gate against a live dev server
```

`AGENTS.md` has the full architecture map (structure, conventions, env vars)
for anyone contributing.

## License

MIT — see [LICENSE](LICENSE).
