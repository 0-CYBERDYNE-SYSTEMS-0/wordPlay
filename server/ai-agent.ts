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

  // NEW: Process tool results intelligently and potentially chain more tools
  async processToolResults(
    originalRequest: string,
    toolExecutions: Array<{ toolName: string; parameters: any; result: ToolResult }>
  ): Promise<{
    synthesizedResponse: string;
    suggestedActions: string[];
    additionalToolCalls?: Array<{ tool: string; params: any; reasoning: string }>;
  }> {
    // Create summary of tool executions for analysis
    const executionSummary = toolExecutions.map(exec => ({
      tool: exec.toolName,
      success: exec.result.success,
      data: exec.result.data,
      message: exec.result.message,
      error: exec.result.error
    }));

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
      sourceCount: this.context.projectSources.length
    };

    const analysisPrompt = `You are an intelligent AI assistant analyzing the results of tool executions. Your job is to:

1. **SYNTHESIZE RESULTS**: Process tool outputs into meaningful insights
2. **PROVIDE VALUE**: Explain what the results mean for the user's writing project
3. **SUGGEST NEXT STEPS**: Recommend follow-up actions based on the results
4. **CHAIN TOOLS**: Identify if additional tools would add value

ORIGINAL USER REQUEST: "${originalRequest}"

CURRENT CONTEXT:
${JSON.stringify(contextSummary, null, 2)}

TOOL EXECUTION RESULTS:
${JSON.stringify(executionSummary, null, 2)}

ANALYSIS GUIDELINES:
- **For Web Search Results**: Summarize key findings, identify most relevant sources, explain how they relate to the user's needs
- **For Document Analysis**: Provide concrete insights about writing quality, structure, and specific improvement areas
- **For Text Generation**: Explain the approach taken and how it fits the user's style/goals
- **For Project Operations**: Confirm actions taken and suggest logical next steps
- **For Research Sources**: Explain what was found and how it can be used

RESPONSE INSTRUCTIONS:
Respond with a JSON object containing:
{
  "synthesizedResponse": "Comprehensive, intelligent summary of what was accomplished and what it means",
  "suggestedActions": ["Specific actionable next steps for the user"],
  "additionalToolCalls": [
    {
      "tool": "tool_name",
      "params": { "param": "value" },
      "reasoning": "Why this additional tool would add value"
    }
  ]
}

EXAMPLES OF GOOD SYNTHESIZED RESPONSES:

For Web Search:
❌ "Found 5 search results"
✅ "I found several valuable sources about sustainable writing practices. The Stanford study shows a 40% improvement in productivity with structured breaks. I've identified three actionable techniques you can apply immediately to your current project. The research particularly supports the approach you're taking in your second chapter."

For Document Analysis:
❌ "Document has 1,247 words"
✅ "Your document shows strong argumentative structure with clear thesis development. The readability score of 8.2 indicates professional-level writing. However, I noticed the transition between paragraphs 3-4 could be smoother, and your conclusion would benefit from a stronger call-to-action. Your technical vocabulary usage is excellent for your target audience."

For Text Processing:
❌ "Replaced 3 instances"
✅ "I've updated your document to use more inclusive language, replacing 3 instances of gendered terms with neutral alternatives. This maintains your professional tone while broadening your audience appeal. The changes flow naturally and preserve your original meaning while making the content more accessible."

Provide your analysis now:`;

    try {
      const { generateTextCompletion } = await import("./openai");
      
      const result = await generateTextCompletion(
        "", 
        {}, 
        analysisPrompt,
        this.context.llmProvider,
        this.context.llmModel
      );
      
      try {
        const parsed = JSON.parse(result);
        return {
          synthesizedResponse: parsed.synthesizedResponse || this.generateBasicSynthesis(toolExecutions, originalRequest),
          suggestedActions: parsed.suggestedActions || [],
          additionalToolCalls: parsed.additionalToolCalls || []
        };
      } catch (parseError) {
        // Fallback to basic synthesis
        return {
          synthesizedResponse: this.generateBasicSynthesis(toolExecutions, originalRequest),
          suggestedActions: this.generateBasicSuggestions(toolExecutions),
          additionalToolCalls: []
        };
      }
    } catch (error) {
      console.error("Error in tool result analysis:", error);
      return {
        synthesizedResponse: this.generateBasicSynthesis(toolExecutions, originalRequest),
        suggestedActions: this.generateBasicSuggestions(toolExecutions),
        additionalToolCalls: []
      };
    }
  }

  // Generate basic synthesis when AI analysis fails
  private generateBasicSynthesis(toolExecutions: Array<{ toolName: string; parameters: any; result: ToolResult }>, originalRequest: string): string {
    const successfulTools = toolExecutions.filter(exec => exec.result.success);
    const failedTools = toolExecutions.filter(exec => !exec.result.success);

    if (successfulTools.length === 0) {
      return `I attempted to help with your request "${originalRequest}" but encountered issues with the tools. Let me try a different approach.`;
    }

    const toolSummary = successfulTools.map(exec => {
      if (exec.toolName === 'web_search' && exec.result.data?.results) {
        return `Found ${exec.result.data.results.length} search results for your research`;
      }
      if (exec.toolName === 'get_document' && exec.result.data) {
        return `Retrieved your document "${exec.result.data.title}" (${exec.result.data.wordCount} words)`;
      }
      if (exec.toolName === 'analyze_writing_style' && exec.result.data) {
        return `Analyzed your writing style - found ${Object.keys(exec.result.data).length} key metrics`;
      }
      if (exec.toolName === 'update_document' && exec.result.data) {
        return `Updated your document with new content`;
      }
      return exec.result.message || `Executed ${exec.toolName} successfully`;
    }).join(', ');

    return `I've completed your request "${originalRequest}". ${toolSummary}. ${failedTools.length > 0 ? `Note: ${failedTools.length} operations had issues but the main task was completed.` : ''}`;
  }

  // Generate basic suggestions when AI analysis fails
  private generateBasicSuggestions(toolExecutions: Array<{ toolName: string; parameters: any; result: ToolResult }>): string[] {
    const suggestions: string[] = [];
    
    toolExecutions.forEach(exec => {
      if (exec.result.success) {
        if (exec.toolName === 'web_search') {
          suggestions.push("Review the search results and save relevant sources to your project");
        }
        if (exec.toolName === 'analyze_writing_style') {
          suggestions.push("Consider the style analysis recommendations for improving your writing");
        }
        if (exec.toolName === 'get_document') {
          suggestions.push("Use the document content for further analysis or editing");
        }
      }
    });

    if (suggestions.length === 0) {
      suggestions.push("Let me know if you'd like me to try a different approach");
    }

    return suggestions;
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
        wordCount: this.context.currentDocument.wordCount,
        content: this.context.currentDocument.content?.substring(0, 500) + "..." // First 500 chars for context
      } : null,
      documentCount: this.context.projectDocuments.length,
      sourceCount: this.context.projectSources.length,
      availableTools: this.getAvailableTools()
    };

    // Enhanced system prompt for intelligent tool usage and result processing
    const systemPrompt = `You are an intelligent AI writing assistant with access to powerful tools. Your goal is to help users with their writing projects by using tools strategically and processing their results to provide valuable, synthesized responses.

CORE PRINCIPLES:
1. **Chain Tools Intelligently**: Use multiple tools in sequence when beneficial
2. **Process Results**: Always analyze and synthesize tool outputs into meaningful insights
3. **Provide Value**: Don't just show raw data - interpret and explain what it means
4. **Be Proactive**: Suggest follow-up actions based on tool results
5. **Context Awareness**: Use current project/document context to make better decisions

AVAILABLE TOOLS AND THEIR STRATEGIC USES:
${this.getAvailableTools().map(tool => {
  const toolDef = this.tools.get(tool);
  return `- ${tool}: ${toolDef?.description}`;
}).join('\n')}

CURRENT CONTEXT:
${JSON.stringify(contextSummary, null, 2)}

INTELLIGENT TOOL USAGE PATTERNS:
- **Research Workflows**: web_search → scrape_webpage → save_source → analyze results → provide insights
- **Document Analysis**: get_document → analyze_document_structure → get_writing_suggestions → synthesize feedback
- **Content Creation**: analyze current content → generate_text → update_document → provide explanation
- **Text Processing**: search_in_text → replace_in_text → update_document → explain changes
- **Project Management**: list_projects → get_project → list_documents → provide overview

RESPONSE INSTRUCTIONS:
When tools are needed, respond with JSON containing:
{
  "needsTools": true,
  "plan": "Multi-step plan explaining tool chain and reasoning",
  "toolCalls": [
    {
      "tool": "tool_name",
      "params": { "param1": "value1" },
      "reasoning": "Specific reason for this tool in the context"
    }
  ],
  "response": "What you'll tell the user about your plan"
}

When no tools needed, respond with:
{
  "needsTools": false,
  "plan": "Direct response strategy",
  "response": "Helpful, contextual response"
}

EXAMPLES OF INTELLIGENT RESPONSES:
❌ BAD: "I found 5 search results" (raw data)
✅ GOOD: "I found several relevant sources about X. The most promising is Y because Z. I've saved this to your project sources and here's what it means for your writing..."

❌ BAD: "Document updated" (basic confirmation)
✅ GOOD: "I've enhanced your document by improving the flow in paragraph 2 and strengthening the conclusion. The changes maintain your voice while making the argument 23% more compelling..."

USER REQUEST: "${request}"

Analyze this request carefully. Consider:
1. What is the user really trying to accomplish?
2. What tools would provide the most value?
3. How can I chain tools to deliver a complete solution?
4. What insights can I provide beyond just executing tools?

Respond with your strategic plan and tool usage.`;

    try {
      const { generateTextCompletion } = await import("./openai");
      
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
          plan: parsed.plan || `Developing strategic approach for: "${request}"`,
          toolCalls: parsed.toolCalls || [],
          response: parsed.response || "I'm analyzing your request and determining the best approach to help you. Let me think about this strategically..."
        };
      } catch (parseError) {
        // Fallback if JSON parsing fails - but make it more intelligent
        return {
          plan: `Analyzing request contextually: "${request}"`,
          toolCalls: [],
          response: this.generateContextualFallbackResponse(request, contextSummary)
        };
      }
    } catch (error) {
      console.error("Error in agent request processing:", error);
      
      // Intelligent fallback response
      return {
        plan: `Developing approach for: "${request}"`,
        toolCalls: [],
        response: this.generateContextualFallbackResponse(request, contextSummary)
      };
    }
  }

  // Generate contextual fallback responses when LLM fails
  private generateContextualFallbackResponse(request: string, context: any): string {
    const lowerRequest = request.toLowerCase();
    
    // Contextual responses based on current state and request type
    if (lowerRequest.includes('search') || lowerRequest.includes('research')) {
      return `I can help you research this topic. I have access to web search, webpage scraping, and source management tools. ${context.currentProject ? `This will be added to your "${context.currentProject.name}" project.` : 'I can also help you organize the results into a new or existing project.'}`;
    }
    
    if (lowerRequest.includes('analyze') || lowerRequest.includes('style')) {
      return `I can analyze your writing in detail. ${context.currentDocument ? `I see you're working on "${context.currentDocument.title}" (${context.currentDocument.wordCount} words). I can examine its structure, style, and suggest improvements.` : 'If you select a document, I can provide comprehensive analysis of its structure, readability, and style.'}`;
    }
    
    if (lowerRequest.includes('write') || lowerRequest.includes('generate')) {
      return `I can help generate content for your project. ${context.currentProject ? `For your "${context.currentProject.name}" project, I can create content that matches your existing style and goals.` : 'I can also help you start a new project with the right structure and approach.'}`;
    }
    
    if (lowerRequest.includes('project') || lowerRequest.includes('organize')) {
      return `I can help manage your projects and documents. ${context.currentProject ? `You're currently working on "${context.currentProject.name}" with ${context.documentCount} documents and ${context.sourceCount} research sources.` : 'I can help you create a new project or organize existing content.'} What specific aspect would you like help with?`;
    }
    
    // Generic but contextual fallback
    return `I'm here to help with your writing project using my 19 specialized tools. ${context.currentProject ? `I can see you're working on "${context.currentProject.name}" - ` : ''}What specific assistance do you need? I can research topics, analyze your writing, generate content, manage projects, or process text in sophisticated ways.`;
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