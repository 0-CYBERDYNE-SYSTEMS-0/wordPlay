import { storage } from "./storage";
import { 
  generateTextCompletion, 
  analyzeTextStyle,
  generateSuggestions,
  processTextCommand,
  generateContextualAssistance
} from "./openai";
import { 
  searchWeb, 
  scrapeWebpage 
} from "./web-search";
import { 
  grepText, 
  replaceText, 
  countWords, 
  extractStructure, 
  analyzeDocument 
} from "./file-operations";

// Tool interface that the agent can use
interface AgentTool {
  name: string;
  description: string;
  parameters: any;
  execute: (params: any, context: AgentContext) => Promise<any>;
}

// Agent context - full app state available to agent
interface AgentContext {
  userId: number;
  currentProject?: any;
  currentDocument?: any;
  allProjects: any[];
  projectDocuments: any[];
  projectSources: any[];
  researchNotes: string;
  llmProvider?: 'openai' | 'ollama';
  llmModel?: string;
}

// Tool execution result
interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

// Create all available tools for the agent
export const agentTools: AgentTool[] = [
  // Project Management Tools
  {
    name: "list_projects",
    description: "Get all projects for the user",
    parameters: {},
    execute: async (params, context) => {
      const projects = await storage.getProjects(context.userId);
      return { success: true, data: projects, message: `Found ${projects.length} projects` };
    }
  },

  {
    name: "get_project",
    description: "Get details of a specific project",
    parameters: { projectId: "number" },
    execute: async (params, context) => {
      const project = await storage.getProject(params.projectId);
      if (!project) {
        return { success: false, error: "Project not found" };
      }
      return { success: true, data: project, message: `Retrieved project: ${project.name}` };
    }
  },

  {
    name: "create_project",
    description: "Create a new project",
    parameters: { name: "string", type: "string", style: "string" },
    execute: async (params, context) => {
      const project = await storage.createProject({
        userId: context.userId,
        name: params.name,
        type: params.type,
        style: params.style
      });
      return { success: true, data: project, message: `Created project: ${params.name}` };
    }
  },

  {
    name: "update_project",
    description: "Update project details",
    parameters: { projectId: "number", name: "string?", type: "string?", style: "string?" },
    execute: async (params, context) => {
      const { projectId, ...updateData } = params;
      const project = await storage.updateProject(projectId, updateData);
      if (!project) {
        return { success: false, error: "Project not found" };
      }
      return { success: true, data: project, message: `Updated project: ${project.name}` };
    }
  },

  // Document Management Tools
  {
    name: "list_documents",
    description: "Get all documents in a project",
    parameters: { projectId: "number" },
    execute: async (params, context) => {
      const documents = await storage.getDocuments(params.projectId);
      return { success: true, data: documents, message: `Found ${documents.length} documents` };
    }
  },

  {
    name: "get_document",
    description: "Get content and details of a specific document",
    parameters: { documentId: "number" },
    execute: async (params, context) => {
      const document = await storage.getDocument(params.documentId);
      if (!document) {
        return { success: false, error: "Document not found" };
      }
      return { success: true, data: document, message: `Retrieved document: ${document.title}` };
    }
  },

  {
    name: "create_document",
    description: "Create a new document in a project",
    parameters: { projectId: "number", title: "string", content: "string?" },
    execute: async (params, context) => {
      const wordCount = countWords(params.content || "");
      const document = await storage.createDocument({
        projectId: params.projectId,
        title: params.title,
        content: params.content || "",
        wordCount
      });
      return { success: true, data: document, message: `Created document: ${params.title}` };
    }
  },

  {
    name: "update_document",
    description: "Update document content or title",
    parameters: { documentId: "number", title: "string?", content: "string?" },
    execute: async (params, context) => {
      const { documentId, ...updateData } = params;
      
      // Calculate word count if content is being updated
      if (updateData.content) {
        updateData.wordCount = countWords(updateData.content);
      }
      
      const document = await storage.updateDocument(documentId, updateData);
      if (!document) {
        return { success: false, error: "Document not found" };
      }
      return { success: true, data: document, message: `Updated document: ${document.title}` };
    }
  },

  // Research and Source Tools
  {
    name: "web_search",
    description: "Search the web for information on a topic",
    parameters: { query: "string", source: "string?" },
    execute: async (params, context) => {
      const results = await searchWeb(params.query, params.source || "web");
      return { 
        success: true, 
        data: results, 
        message: `Found ${results.results.length} search results for: ${params.query}` 
      };
    }
  },

  {
    name: "scrape_webpage",
    description: "Extract content from a specific URL",
    parameters: { url: "string" },
    execute: async (params, context) => {
      const content = await scrapeWebpage(params.url);
      if (content.error) {
        return { success: false, error: content.error };
      }
      return { 
        success: true, 
        data: content, 
        message: `Extracted ${content.wordCount} words from ${content.domain}` 
      };
    }
  },

  {
    name: "save_source",
    description: "Save a research source to a project",
    parameters: { projectId: "number", type: "string", name: "string", url: "string?", content: "string?" },
    execute: async (params, context) => {
      const source = await storage.createSource(params);
      return { success: true, data: source, message: `Saved source: ${params.name}` };
    }
  },

  {
    name: "get_sources",
    description: "Get all research sources for a project",
    parameters: { projectId: "number" },
    execute: async (params, context) => {
      const sources = await storage.getSources(params.projectId);
      return { success: true, data: sources, message: `Found ${sources.length} sources` };
    }
  },

  // AI Writing Tools
  {
    name: "generate_text",
    description: "Generate text content using AI",
    parameters: { prompt: "string", context: "string?", style: "string?" },
    execute: async (params, context) => {
      const result = await generateTextCompletion(
        params.context || "", 
        params.style, 
        params.prompt,
        context.llmProvider,
        context.llmModel
      );
      return { success: true, data: result, message: "Generated text content" };
    }
  },

  {
    name: "analyze_writing_style",
    description: "Analyze the writing style of text",
    parameters: { text: "string" },
    execute: async (params, context) => {
      const analysis = await analyzeTextStyle(params.text);
      return { success: true, data: analysis, message: "Analyzed writing style" };
    }
  },

  {
    name: "get_writing_suggestions",
    description: "Get AI suggestions for improving text",
    parameters: { text: "string", type: "string?" },
    execute: async (params, context) => {
      const suggestions = await generateSuggestions(
        params.text, 
        params.type,
        context.llmProvider,
        context.llmModel
      );
      return { success: true, data: suggestions, message: "Generated writing suggestions" };
    }
  },

  {
    name: "process_text_command",
    description: "Process a natural language command about text",
    parameters: { command: "string", text: "string", context: "string?" },
    execute: async (params, context) => {
      const result = await processTextCommand(params.text, params.command);
      return { success: true, data: result, message: "Processed text command" };
    }
  },

  // Text Analysis Tools
  {
    name: "analyze_document_structure",
    description: "Analyze the structure and organization of a document",
    parameters: { text: "string" },
    execute: async (params, context) => {
      const structure = extractStructure(params.text);
      return { success: true, data: structure, message: "Analyzed document structure" };
    }
  },

  {
    name: "search_in_text",
    description: "Search for patterns or text within content",
    parameters: { text: "string", pattern: "string", caseSensitive: "boolean?" },
    execute: async (params, context) => {
      const results = grepText(params.text, params.pattern);
      return { success: true, data: results, message: `Found ${results.count} matches` };
    }
  },

  {
    name: "replace_in_text",
    description: "Replace text patterns in content",
    parameters: { text: "string", pattern: "string", replacement: "string", global: "boolean?" },
    execute: async (params, context) => {
      const result = replaceText(params.text, params.pattern, params.replacement);
      return { success: true, data: result, message: "Text replacement completed" };
    }
  }
];

// Main agent class
export class WordPlayAgent {
  private tools: Map<string, AgentTool>;
  private context: AgentContext;

  constructor(userId: number = 1) {
    this.tools = new Map();
    agentTools.forEach(tool => this.tools.set(tool.name, tool));
    
    this.context = {
      userId,
      allProjects: [],
      projectDocuments: [],
      projectSources: [],
      researchNotes: "",
      llmProvider: undefined,
      llmModel: undefined
    };
  }

  // Update agent context with current app state
  async updateContext(updates: Partial<AgentContext>) {
    this.context = { ...this.context, ...updates };
    
    // Auto-load related data when project changes
    if (updates.currentProject) {
      this.context.projectDocuments = await storage.getDocuments(updates.currentProject.id);
      this.context.projectSources = await storage.getSources(updates.currentProject.id);
    }
  }

  // Get available tools
  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  // Execute a tool
  async executeTool(toolName: string, parameters: any): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { success: false, error: `Tool '${toolName}' not found` };
    }

    try {
      const result = await tool.execute(parameters, this.context);
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Process natural language request and determine which tools to use
  async processRequest(request: string): Promise<{
    plan: string;
    toolCalls: Array<{ tool: string; params: any; reasoning: string }>;
    response: string;
  }> {
    // Create context summary for the LLM
    const contextSummary = {
      currentProject: this.context.currentProject ? {
        id: this.context.currentProject.id,
        name: this.context.currentProject.name,
        type: this.context.currentProject.type
      } : null,
      currentDocument: this.context.currentDocument ? {
        id: this.context.currentDocument.id,
        title: this.context.currentDocument.title,
        wordCount: this.context.currentDocument.wordCount
      } : null,
      documentCount: this.context.projectDocuments.length,
      sourceCount: this.context.projectSources.length,
      availableTools: this.getAvailableTools()
    };

    // Use OpenAI to plan tool usage
    try {
      const { generateTextCompletion } = await import("./openai");
      
      const systemPrompt = `You are an AI writing assistant agent. Based on the user's request and the current context, determine if you need to use any tools and respond appropriately.

Available tools: ${this.getAvailableTools().join(', ')}

Current context: ${JSON.stringify(contextSummary, null, 2)}

If you need to use tools, respond with a JSON object containing:
{
  "needsTools": true,
  "plan": "Brief description of what you'll do",
  "toolCalls": [
    {
      "tool": "tool_name",
      "params": { "param1": "value1" },
      "reasoning": "Why this tool is needed"
    }
  ],
  "response": "What you'll tell the user"
}

If you don't need tools, respond with:
{
  "needsTools": false,
  "plan": "How you'll respond",
  "response": "Your direct response to the user"
}

User request: "${request}"`;

      const result = await generateTextCompletion(
        "", 
        {}, 
        systemPrompt,
        this.context.llmProvider,
        this.context.llmModel
      );
      
      try {
        const parsed = JSON.parse(result);
        
        return {
          plan: parsed.plan || `Analyzing request: "${request}"`,
          toolCalls: parsed.toolCalls || [],
          response: parsed.response || "I can help you with that. Let me think about the best approach."
        };
      } catch (parseError) {
        // Fallback if JSON parsing fails
        return {
          plan: `Analyzing request: "${request}"`,
          toolCalls: [],
          response: result || "I can help you with that. What specific aspect would you like me to focus on?"
        };
      }
    } catch (error) {
      console.error("Error in agent request processing:", error);
      
      // Fallback response
      return {
        plan: `Processing request: "${request}"`,
        toolCalls: [],
        response: "I'm here to help with your writing project. Could you be more specific about what you'd like me to do?"
      };
    }
  }

  // Get current context summary
  getContextSummary(): string {
    const project = this.context.currentProject;
    const docCount = this.context.projectDocuments.length;
    const sourceCount = this.context.projectSources.length;
    
    return `Current context: ${project ? `Project "${project.name}"` : 'No project selected'}, ${docCount} documents, ${sourceCount} sources`;
  }
}

// Factory function to create agent instance
export function createAgent(userId: number = 1): WordPlayAgent {
  return new WordPlayAgent(userId);
} 