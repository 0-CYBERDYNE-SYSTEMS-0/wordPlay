# PenP@l - AI-Powered Writing Companion

PenP@l is an advanced writing assistant that helps users generate, edit, and refine content with the help of AI. The application provides a modern interface for creating and managing writing projects with powerful AI-driven features.

## Features

### Core Writing Experience
- **Project Management**: Create and organize multiple writing projects
- **Rich Text Editor**: Compose and edit content with a full-featured editor
- **Real-time Saving**: Automatic document saving to prevent data loss

### AI-Powered Assistance
- **Text Generation**: Continue or expand your writing with AI suggestions
- **Style Analysis**: Get detailed metrics about your writing style, readability, and tone
- **Command Mode**: Execute specialized commands to transform your text
- **Slash Commands**: Quick access to AI features through slash commands:
  - `/continue` - Extend your writing seamlessly
  - `/improve` - Enhance clarity and readability
  - `/summarize` - Create concise summaries
  - `/expand` - Add more detail and depth
  - `/list` - Transform content into organized lists
  - `/rewrite` - Refresh your text while preserving meaning
  - `/suggest` - Get new ideas and directions
  - `/tone` - Adjust the tone of your writing
  - `/fix` - Correct grammar and clarity issues

### Research & Context
- **Web Search**: Look up information without leaving the app
- **Context Panel**: Get AI-generated insights about your current document
- **Source Management**: Add and organize reference materials

### Technical Features
- **LLM Provider Options**: Choose between OpenAI and Ollama
- **Model Selection**: Select from various AI models
- **Light/Dark Mode**: Toggle between theme preferences

## Technology Stack

### Frontend
- **React**: UI framework
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn UI**: Component library

### Backend
- **Node.js/Express**: Server framework
- **PostgreSQL**: Database (via Drizzle ORM)
- **OpenAI API**: Primary AI integration
- **Ollama**: Local LLM alternative

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL database
- OpenAI API key (for cloud LLM features)
- Ollama (optional, for local LLM features)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables
4. Run database migrations:
   ```
   npm run db:migrate
   ```
5. Start the development server:
   ```
   npm run dev
   ```

## Usage

1. Create a new project by clicking the "New Project" button
2. Select your project type and writing style
3. Use the editor to write content
4. Access AI features through the command panel, slash commands, or the context panel
5. Switch between editor, search, command, and style analysis modes using the sidebar

## License

[MIT License](LICENSE) 