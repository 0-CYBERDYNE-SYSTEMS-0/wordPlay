# wordPlay - AI-Powered Writing Companion

wordPlay is an advanced writing assistant that combines powerful AI capabilities with comprehensive project management. The application provides a modern interface for creating, managing, and enhancing writing projects with an intelligent AI agent that can perform complex text operations, research, and project management tasks.

## Features

### 🤖 AI Agent System
**NEW**: Intelligent AI agent with **19 specialized tools** for comprehensive writing assistance:

**Project & Document Management (8 tools):**
- Full CRUD operations on projects and documents
- Automated project organization and document retrieval
- Real-time content updates and synchronization

**Research & Web Integration (4 tools):**
- Web search with multiple source types (general, academic, news)
- Webpage content extraction and analysis
- Research source management and organization
- Automatic content archival for offline access

**AI Writing Tools (4 tools):**
- Contextual text generation with style preservation
- Advanced writing style analysis and metrics
- Intelligent writing suggestions and improvements
- Natural language text command processing

**Text Analysis & Manipulation (3 tools):**
- Advanced grep-like pattern searching with regex support
- Sed-like text replacement with global operations
- Document structure analysis and organization

### 📝 Core Writing Experience
- **Multi-Project Management**: Create and organize unlimited writing projects with type classification
- **Rich Text Editor**: Full-featured content editor with real-time formatting
- **4-Tab Interface**: Seamless switching between Editor, Research, AI Assistant, and Style Analysis
- **Auto-Save**: Intelligent document saving with conflict resolution
- **Real-time Word Count**: Live statistics and reading time estimates

### ✨ AI-Powered Assistance

**Slash Commands** - Quick AI features accessible via `/` key:
- `/continue` - Extend your writing seamlessly with AI
- `/improve` - Enhance clarity, flow, and readability
- `/summarize` - Create concise, comprehensive summaries
- `/expand` - Add detail, examples, and elaboration
- `/list` - Transform content into organized, structured lists
- `/rewrite` - Refresh text while preserving core meaning
- `/suggest` - Generate new ideas and creative directions
- `/tone` - Adjust writing tone and style appropriately
- `/fix` - Correct grammar, spelling, and clarity issues

**AI Assistant Tab** - Conversational interface with the agent:
- Natural language commands for complex text operations
- Context-aware assistance based on current document
- Tool execution with real-time feedback
- Command history and result tracking

**Style Analysis Tab** - Comprehensive writing analytics:
- Readability scores and complexity metrics
- Tone analysis and style consistency
- Sentence structure and paragraph organization
- Comparative analysis across documents

### 🔍 Research & Context System

**Research Tab** - Integrated web research tools:
- **Multi-Source Web Search**: General web, academic papers, news articles
- **Webpage Scraping**: Extract and save content from URLs
- **Source Management**: Organize references with automatic metadata
- **Content Integration**: Direct import of research into documents

**Context Panel** - AI-generated document insights:
- Real-time content analysis and suggestions
- Related topic identification
- Missing information detection
- Structure and flow recommendations

### 🛠️ Advanced Technical Features

**LLM Integration:**
- **OpenAI Support**: GPT-4, GPT-3.5 with configurable parameters
- **Ollama Support**: Local model execution for privacy
- **Model Selection**: Choose optimal models for different tasks
- **Context Management**: Intelligent context window optimization

**Text Processing Capabilities:**
- **Regex Operations**: Advanced pattern matching and replacement
- **Document Analysis**: Structure extraction and organization metrics
- **File Operations**: Comprehensive CRUD with version tracking
- **Command Line Tools**: Grep, sed, and text manipulation utilities

**UI/UX Features:**
- **Responsive Design**: Optimized for desktop and tablet use
- **Dark/Light Mode**: Theme switching with system preference detection
- **Keyboard Shortcuts**: Efficient navigation and command execution
- **Real-time Collaboration**: Multi-tab editing with conflict resolution

## Technology Stack

### Frontend
- **React 18**: Modern UI framework with concurrent features
- **TypeScript**: Full type safety and developer experience
- **Tailwind CSS**: Utility-first styling with custom design system
- **Shadcn UI**: Accessible component library with Radix primitives
- **TanStack Query**: Intelligent data fetching and caching
- **Lucide React**: Comprehensive icon system

### Backend
- **Node.js/Express**: High-performance server with middleware support
- **PostgreSQL**: Robust relational database with JSON support
- **Drizzle ORM**: Type-safe database operations with migrations
- **OpenAI API**: Primary AI integration with streaming support
- **Ollama Integration**: Local LLM support for privacy-focused usage
- **Zod Validation**: Runtime type checking and data validation

### Development Tools
- **Vite**: Fast build tool with hot module replacement
- **ESLint/Prettier**: Code quality and formatting automation
- **TypeScript Strict Mode**: Maximum type safety enforcement
- **Environment Management**: Secure configuration handling

## Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **yarn** package manager
- **PostgreSQL** database (v13 or higher)
- **OpenAI API key** (for cloud AI features)
- **Ollama** (optional, for local AI models)

### Installation

1. **Clone the repository:**
   ```bash
   git clone [repository-url]
   cd wordPlay
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize the database:**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Access the application:**
   Open `http://localhost:5173` in your browser

### Configuration

**Environment Variables:**
- `OPENAI_API_KEY` - Your OpenAI API key for cloud AI features
- `DATABASE_URL` - PostgreSQL connection string
- `OLLAMA_URL` - Ollama server URL (default: http://localhost:11434)
- `NODE_ENV` - Environment mode (development/production)

## Usage Guide

### Getting Started
1. **Create a Project**: Click "New Project" and select your writing type and style
2. **Choose Your Setup**: Configure AI provider (OpenAI/Ollama) and model preferences
3. **Start Writing**: Use the rich text editor with real-time AI assistance

### Using the AI Agent
1. **Access Agent**: Click the AI agent icon (bottom-right) for conversational assistance
2. **Natural Commands**: Ask questions like "Analyze my writing style" or "Create a summary"
3. **Tool Integration**: Agent automatically uses appropriate tools for complex tasks
4. **Real-time Updates**: See live changes as agent modifies your documents

### Advanced Features
1. **Research Integration**: Use the Research tab to gather sources and information
2. **Style Analysis**: Monitor writing quality and consistency in the Style tab
3. **Slash Commands**: Type `/` in the editor for quick AI transformations
4. **Project Organization**: Create multiple projects with different styles and purposes

### Workflow Examples
- **Academic Writing**: Research → Draft → AI Analysis → Revision → Style Check
- **Creative Writing**: Brainstorm → Write → AI Enhancement → Structure Analysis
- **Business Documents**: Template → Content → Professional Tone → Grammar Check

## API Documentation

The application exposes a REST API for advanced integrations:

- `POST /api/agent/request` - Send requests to the AI agent
- `POST /api/agent/tool` - Execute specific agent tools
- `GET /api/agent/tools` - List available agent tools
- `POST /api/ai/slash-command` - Execute slash commands
- Full CRUD operations for projects, documents, and sources

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- Development setup and workflow
- Code style and standards
- Testing requirements
- Pull request process

## License

[MIT License](LICENSE) - See LICENSE file for details.

## Support

- **Documentation**: [docs.wordplay.ai](https://docs.wordplay.ai)
- **Issues**: [GitHub Issues](https://github.com/wordplay/issues)
- **Community**: [Discord Server](https://discord.gg/wordplay)
- **Email**: support@wordplay.ai 