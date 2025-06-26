# CLAUDE.md

This file provides guidance to assistant when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start both client and server in development mode (uses concurrently)
- `npm run dev:client` - Start Vite dev server for React frontend (port 5173)
- `npm run dev:server` - Start Node.js backend with tsx for TypeScript execution
- `npm run build` - Build client with Vite and server with esbuild for production
- `npm run start` - Start production server from dist/
- `npm run check` - Run TypeScript type checking across the codebase
- `npm run db:push` - Push database schema changes using Drizzle Kit

### Testing
- No explicit test commands found in package.json
- Use TypeScript compilation (`npm run check`) to verify code correctness

## Architecture Overview

### Project Structure
This is a full-stack TypeScript application with AI-powered writing assistance:

**Frontend** (`client/`):
- React 18.3.1 with TypeScript and Vite
- Tailwind CSS with shadcn/ui component library
- Three main tabs: Editor (with slash commands), Research (web search), Settings
- AI features exposed primarily through slash commands in the editor
- Context Panel for document stats, project sources, and AI suggestions

**Backend** (`server/`):
- Express.js API server with TypeScript
- PostgreSQL database with Drizzle ORM
- AI integration with OpenAI and Ollama support
- File operations, web search, and AI agent capabilities

**Database** (`shared/schema.ts`):
- Users, projects, documents, and research sources
- Managed via Drizzle ORM with migrations in `migrations/`

### Key Technical Details

**AI Integration**:
- Slash commands trigger AI operations (`/continue`, `/improve`, `/summarize`, etc.)
- Model selection: `qwen3:0.6b` for Ollama, `gpt-4.1-nano` for OpenAI
- AI agent with 19 specialized tools across project management, research, writing, and text analysis
- Context panel displays AI reasoning separately from final document content

**Development Workflow**:
- Client runs on port 5173 (Vite dev server)
- Server runs on port 5001 (Express API)
- Vite proxy configuration routes `/api` and `/uploads` to backend
- Hot reload enabled for both frontend and backend development

**File Organization**:
- `client/src/components/` - React components (PascalCase naming)
- `client/src/hooks/` - Custom React hooks (camelCase with `use` prefix)
- Server files use kebab-case naming convention
- Shared utilities in `shared/` directory
- Database migrations managed automatically via Drizzle

### AI Agent Architecture

The AI system operates through:
1. Slash commands as the primary UI interface in the editor
2. Background AI agent processing with tool access
3. Separate rendering of AI reasoning vs. final suggestions
4. Three autonomy levels: Conservative, Moderate, Aggressive
5. Context-aware document analysis and style suggestions

### Environment Setup

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - For OpenAI integration (optional)
- `OLLAMA_URL` - For local Ollama server (optional, defaults to localhost:11434)
- `NODE_ENV` - development/production
- `PORT` - Server port (defaults in code)

The application is designed to be an AI-saturated writing environment with intuitive background assistance and seamless pipeline integration between all components.