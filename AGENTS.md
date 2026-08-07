# Repository Guidelines

## Project Structure & Module Organization
- `client/` React + Vite app. Source in `client/src` (aliases: `@` → `client/src`, `@shared` → `shared`, `@assets` → `attached_assets`).
- `server/` Express + TypeScript API (`server/index.ts`, `server/routes.ts`, DB via Drizzle).
- `shared/` Shared types/utilities consumed by both client and server.
- `public/` Static assets (served in dev; built assets go to `dist/public`).
- `migrations/` Database migrations; config in `drizzle.config.ts`.
- `dist/` Build output (server bundle + client assets).
- Test scripts live at repo root as `test-*.js` (ad‑hoc integration checks).

## Build, Test, and Development Commands
- `npm run dev` — Run client (Vite) + server concurrently with proxy (`http://localhost:5173` → `:5001`).
- `npm run dev:server` — Start API locally via `tsx server/index.ts` on port `5001`.
- `npm run dev:client` — Start Vite dev server for the React app.
- `npm run build` — Build client to `dist/public` and bundle server to `dist/index.js`.
- `npm start` — Run the built server in production mode.
- `npm run check` — Type-check the TypeScript project.
- `npm run db:push` — Apply Drizzle schema changes to the database.
- Integration scripts: with the server running, `node test-openai-agent.js` (and other `test-*.js`).

## Coding Style & Naming Conventions
- TypeScript-first. 2-space indentation; semicolons optional but be consistent.
- Client: React components/pages PascalCase (e.g., `components/Header.tsx`); hooks in `client/src/hooks` named `use-*.ts(x)`; utilities in `client/src/lib`.
- Server: files kebab-case (e.g., `openai.ts`, `routes.ts`); prefer named exports.
- Keep imports ordered (node → third-party → local). Favor explicit types at module boundaries and Zod schemas for runtime validation.

## Testing Guidelines
- No formal test runner; use the `test-*.js` scripts as integration checks against a running server.
- Name new scripts `test-<area>.js` and place at repo root. Example: `node test-gemini-simple.js`.
- Ensure `.env` is configured and server is running (`npm run dev:server`) before executing tests.

## Commit & Pull Request Guidelines
- Commit messages: imperative mood; Conventional Commits encouraged (`feat:`, `fix:`, `chore:`, `refactor:`). Keep scope concise.
- PRs: include a clear description, linked issues, steps to reproduce/test, and screenshots/GIFs for UI changes. Note any DB changes and run `npm run db:push` locally.

## Security & Configuration
- Configure env via `.env` (see `.env.example`). Common vars: `DATABASE_URL`, provider API keys.
- Never commit secrets. Local dev runs on `:5001`; Vite proxies `/api` and `/uploads` to the server.
