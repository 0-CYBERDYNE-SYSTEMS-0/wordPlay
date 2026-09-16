# Contributing to WordPlay

We're excited that you're interested in contributing to WordPlay! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)
- Git

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/wordPlay.git
   cd wordPlay
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/0-CYBERDYNE-SYSTEMS-0/wordPlay/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node.js version, etc.)
   - Screenshots if applicable

### Suggesting Features

1. Check [Issues](https://github.com/0-CYBERDYNE-SYSTEMS-0/wordPlay/issues) for existing feature requests
2. Create a new issue with:
   - Clear title and description of the feature
   - Use cases and benefits
   - Any implementation ideas (optional)

### Submitting Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the coding standards below
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm run check  # TypeScript checking
   npm run build  # Ensure build works
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## Coding Standards

### General Guidelines

- Use TypeScript for all new code
- Follow existing code style and patterns
- Write clear, descriptive commit messages
- Keep functions small and focused
- Add JSDoc comments for public APIs

### Commit Message Format

We use conventional commits:

- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` code style changes (formatting, etc.)
- `refactor:` code refactoring
- `test:` adding or updating tests
- `chore:` maintenance tasks

Example: `feat: add dark mode toggle to settings panel`

### Code Style

- Use Prettier for formatting (runs automatically)
- Use ESLint rules (check with `npm run lint`)
- Prefer `const` over `let`, avoid `var`
- Use descriptive variable names
- Add TypeScript types for all parameters and return values

### File Organization

- **Frontend** (`client/src/`):
  - Components in PascalCase: `MyComponent.tsx`
  - Hooks with `use` prefix: `useMyHook.ts`
  - Utilities in camelCase: `myUtility.ts`

- **Backend** (`server/`):
  - Use kebab-case for file names: `my-module.ts`
  - Group related functionality in modules

## Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

### Testing

While we don't have extensive tests yet, please:
- Test your changes manually
- Ensure TypeScript compilation passes
- Verify the build process works
- Test both frontend and backend functionality

### AI Features

When working on AI-related features:
- Test with both OpenAI and Ollama models
- Handle API errors gracefully
- Consider rate limiting and costs
- Document any new AI capabilities

## Architecture Overview

WordPlay consists of:

### Frontend (`client/`)
- **React 18** with TypeScript
- **Tailwind CSS** + shadcn/ui components
- **Vite** for development and building
- **Wouter** for routing

### Backend (`server/`)
- **Express.js** API server
- **PostgreSQL** with Drizzle ORM
- **AI Integration** (OpenAI, Ollama, Gemini)
- **WebSocket** support for real-time features

### Key Features
- **Slash Commands** - `/continue`, `/improve`, etc.
- **AI Agent** - 19 specialized tools
- **Research Panel** - Web search integration
- **Rich Text Editor** - Markdown with live preview

## Areas for Contribution

### High Impact Areas
- **AI Features**: New slash commands, agent tools, model integrations
- **UI/UX**: Component improvements, accessibility, mobile responsiveness
- **Performance**: Optimization, caching, bundle size reduction

### Medium Impact Areas
- **Documentation**: Tutorials, API docs, code comments
- **Testing**: Unit tests, integration tests, E2E tests
- **DevOps**: Docker, CI/CD, deployment automation

### Getting Help

- Check existing [Issues](https://github.com/0-CYBERDYNE-SYSTEMS-0/wordPlay/issues)
- Review the [README](README.md) for setup instructions
- Look at recent commits for code examples

## Recognition

Contributors will be recognized in:
- README.md contributor section
- Release notes for significant contributions
- GitHub contributor graphs

Thank you for contributing to WordPlay! 🚀