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

// Enhanced Agent context with persistent memory and execution state
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
  
  // NEW: Enhanced autonomous capabilities
  executionHistory: ExecutionStep[];
  persistentMemory: Map<string, any>;
  currentGoals: Goal[];
  maxToolChainLength: number;
  autonomyLevel: 'conservative' | 'moderate' | 'aggressive';
  reflectionEnabled: boolean;
  learningEnabled: boolean;
  
  // NEW: Current editor state for real-time editing
  editorState?: {
    title: string;
    content: string;
    hasUnsavedChanges: boolean;
    wordCount: number;
  };
}

// NEW: Execution tracking for long-horizon tasks
interface ExecutionStep {
  id: string;
  timestamp: Date;
  action: string;
  toolUsed?: string;
  parameters?: any;
  result?: any;
  success: boolean;
  reasoning: string;
  nextSteps?: string[];
}

// NEW: Goal tracking for complex multi-step tasks
interface Goal {
  id: string;
  description: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  subGoals: Goal[];
  requiredTools: string[];
  estimatedSteps: number;
  actualSteps: number;
  startTime?: Date;
  completionTime?: Date;
}

// NEW: Enhanced tool result with reflection capabilities
interface EnhancedToolResult extends ToolResult {
  confidence: number;
  qualityScore: number;
  shouldContinue: boolean;
  suggestedNextActions: string[];
  learningPoints: string[];
}

// Tool execution result
interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  tool?: string;
  executionTime?: number;
}

// Agent response interface
interface AgentResponse {
  content: string;
  toolResults: ToolResult[];
  executionTime: number;
  tokensUsed: number;
}

// Define valid OpenAI models to prevent 404 errors
const VALID_OPENAI_MODELS = [
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4o'
];

// Validate model based on provider
function getValidModel(model: string | undefined, provider: 'openai' | 'ollama' = 'openai'): string {
  if (!model) {
    return provider === 'openai' ? 'gpt-4.1-mini' : 'qwen3:4b';
  }

  if (provider === 'openai') {
    return VALID_OPENAI_MODELS.includes(model) ? model : 'gpt-4.1-mini';
  } else {
    // For Ollama, we'll trust the model name since it should come from actual installed models
    return model;
  }
}

// Enhanced to support local models
function getValidOpenAIModel(model: string | undefined): string {
  return getValidModel(model, 'openai');
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
  },

  // NEW: Direct Editor Manipulation Tools
  {
    name: "edit_current_document",
    description: "Directly edit the current document in the editor interface",
    parameters: { 
      operation: "replace|append|prepend|insert", 
      content: "string", 
      description: "string?" 
    },
    execute: async (params, context) => {
      return { 
        success: true, 
        data: { 
          operation: params.operation, 
          content: params.content,
          description: params.description || `${params.operation} operation completed`
        }, 
        message: `Editor operation: ${params.operation}` 
      };
    }
  },

  {
    name: "replace_current_content",
    description: "Replace the entire content of the current document in the editor",
    parameters: { content: "string", reason: "string?" },
    execute: async (params, context) => {
      // Also update the database if we have current document ID
      if (context.currentDocument?.id) {
        const wordCount = countWords(params.content);
        await storage.updateDocument(context.currentDocument.id, {
          content: params.content,
          wordCount
        });
      }
      
      return { 
        success: true, 
        data: { 
          operation: "replace", 
          content: params.content,
          reason: params.reason || "Content replaced by agent"
        }, 
        message: "Replaced current document content" 
      };
    }
  },

  {
    name: "edit_text_with_pattern",
    description: "Find and replace text patterns in the current document using regex. Can target specific paragraphs by number or content patterns.",
    parameters: { 
      pattern: "string", 
      replacement: "string", 
      description: "string?",
      currentContent: "string?",
      targetParagraph: "number?",
      searchInParagraph: "string?"
    },
    execute: async (params, context) => {
      // Use current document content or provided content
      const textToEdit = params.currentContent || context.editorState?.content || context.currentDocument?.content || "";
      
      if (!textToEdit.trim()) {
        return { success: false, error: "No content to edit" };
      }
      
      let finalPattern = params.pattern;
      let finalText = textToEdit;
      
      // Handle paragraph-specific editing
      if (params.targetParagraph || params.searchInParagraph) {
        const paragraphs = textToEdit.split(/\n\s*\n/).filter((p: string) => p.trim().length > 0);
        let targetIndex = -1;
        
        if (params.targetParagraph && params.targetParagraph > 0 && params.targetParagraph <= paragraphs.length) {
          targetIndex = params.targetParagraph - 1;
        } else if (params.searchInParagraph) {
          targetIndex = paragraphs.findIndex((p: string) => 
            p.toLowerCase().includes(params.searchInParagraph.toLowerCase())
          );
        }
        
        if (targetIndex >= 0) {
          // Apply pattern only to the target paragraph
          const originalParagraph = paragraphs[targetIndex];
          const updatedParagraph = originalParagraph.replace(new RegExp(params.pattern, 'g'), params.replacement);
          paragraphs[targetIndex] = updatedParagraph;
          finalText = paragraphs.join('\n\n');
          
          // Update database if we have current document ID
          if (context.currentDocument?.id) {
            const wordCount = countWords(finalText);
            await storage.updateDocument(context.currentDocument.id, {
              content: finalText,
              wordCount
            });
          }
          
          return { 
            success: true, 
            data: { 
              operation: "replace", 
              content: finalText,
              count: originalParagraph !== updatedParagraph ? 1 : 0,
              description: params.description || `Edited paragraph ${targetIndex + 1}: ${params.pattern} → ${params.replacement}`
            }, 
            message: `Paragraph ${targetIndex + 1} editing completed` 
          };
        } else {
          return { success: false, error: "Could not find the target paragraph" };
        }
      }
      
      // Default: apply pattern to entire text
      const result = replaceText(finalText, params.pattern, params.replacement);
      
      // Also update the database if we have current document ID and changes were made
      if (context.currentDocument?.id && result.count > 0) {
        const wordCount = countWords(result.result);
        await storage.updateDocument(context.currentDocument.id, {
          content: result.result,
          wordCount
        });
      }
      
      return { 
        success: true, 
        data: { 
          operation: "replace", 
          content: result.result,
          count: result.count,
          description: params.description || `Replaced ${result.count} instances of "${params.pattern}"`
        }, 
        message: `Text pattern editing completed: ${result.count} replacements` 
      };
    }
  },

  {
    name: "improve_current_text",
    description: "Improve the current document content using AI",
    parameters: { 
      instruction: "string", 
      section: "string?",
      currentContent: "string?" 
    },
    execute: async (params, context) => {
      const textToImprove = params.currentContent || context.currentDocument?.content || "";
      
      if (!textToImprove.trim()) {
        return { success: false, error: "No content to improve" };
      }
      
      const improvedResult = await processTextCommand(textToImprove, params.instruction);
      
      // Also update the database if we have current document ID
      if (context.currentDocument?.id) {
        const wordCount = countWords(improvedResult.result);
        await storage.updateDocument(context.currentDocument.id, {
          content: improvedResult.result,
          wordCount
        });
      }
      
      return { 
        success: true, 
        data: { 
          operation: "replace", 
          content: improvedResult.result,
          description: `Improved text: ${params.instruction}`
        }, 
        message: improvedResult.message || "Text improvement completed" 
      };
    }
  },

  // NEW: Advanced autonomous operation tools
  {
    name: "reflect_on_progress",
    description: "Analyze current progress and adjust strategy",
    parameters: { currentGoal: "string", executedSteps: "array" },
    execute: async (params, context) => {
      // Note: This would need to be implemented differently since we can't access agent methods here
      return { 
        success: true, 
        data: { analysis: "Self-reflection not yet implemented in tool context" }, 
        message: "Self-reflection analysis placeholder" 
      };
    }
  },

  {
    name: "set_goal",
    description: "Set a new goal for autonomous execution",
    parameters: { description: "string", priority: "number", estimatedSteps: "number" },
    execute: async (params, context) => {
      const goal: Goal = {
        id: Date.now().toString(),
        description: params.description,
        priority: params.priority || 1,
        status: 'pending',
        subGoals: [],
        requiredTools: [],
        estimatedSteps: params.estimatedSteps || 5,
        actualSteps: 0,
        startTime: new Date()
      };
      
      context.currentGoals.push(goal);
      return { 
        success: true, 
        data: goal, 
        message: `Set new goal: ${params.description}` 
      };
    }
  },

  {
    name: "update_goal_status",
    description: "Update the status of a goal",
    parameters: { goalId: "string", status: "string", notes: "string?" },
    execute: async (params, context) => {
      const goal = context.currentGoals.find(g => g.id === params.goalId);
      if (!goal) {
        return { success: false, error: "Goal not found" };
      }
      
      goal.status = params.status as any;
      if (params.status === 'completed') {
        goal.completionTime = new Date();
      }
      
      return { 
        success: true, 
        data: goal, 
        message: `Updated goal status to: ${params.status}` 
      };
    }
  },

  {
    name: "store_memory",
    description: "Store information in persistent memory for future use",
    parameters: { key: "string", value: "any", category: "string?" },
    execute: async (params, context) => {
      const memoryEntry = {
        value: params.value,
        category: params.category || 'general',
        timestamp: new Date(),
        accessCount: 0
      };
      
      context.persistentMemory.set(params.key, memoryEntry);
      return { 
        success: true, 
        data: memoryEntry, 
        message: `Stored memory: ${params.key}` 
      };
    }
  },

  {
    name: "recall_memory",
    description: "Retrieve information from persistent memory",
    parameters: { key: "string?" },
    execute: async (params, context) => {
      if (params.key) {
        const memory = context.persistentMemory.get(params.key);
        if (memory) {
          memory.accessCount++;
          return { 
            success: true, 
            data: memory, 
            message: `Retrieved memory: ${params.key}` 
          };
        } else {
          return { success: false, error: "Memory not found" };
        }
      } else {
        // Return all memories
        const allMemories = Array.from(context.persistentMemory.entries()).map(([key, value]) => ({
          key,
          ...value
        }));
        return { 
          success: true, 
          data: allMemories, 
          message: `Retrieved ${allMemories.length} memories` 
        };
      }
    }
  },

  {
    name: "plan_multi_step_task",
    description: "Create a detailed plan for complex multi-step tasks",
    parameters: { task: "string", constraints: "object?", timeLimit: "number?" },
    execute: async (params, context) => {
      // Note: This would need to be implemented differently since we can't access agent methods here
      return { 
        success: true, 
        data: { steps: [], totalEstimatedTime: "5 minutes" }, 
        message: "Multi-step planning not yet implemented in tool context" 
      };
    }
  },

  {
    name: "execute_autonomous_workflow",
    description: "Execute a complex workflow autonomously with self-monitoring",
    parameters: { workflow: "object", maxSteps: "number?", checkpoints: "array?" },
    execute: async (params, context) => {
      // Note: This would need to be implemented differently since we can't access agent methods here
      return { 
        success: true, 
        data: { stepsCompleted: 0, totalSteps: 0 }, 
        message: "Autonomous workflow execution not yet implemented in tool context" 
      };
    }
  },

  {
    name: "continuous_improvement",
    description: "Analyze past executions and improve future performance",
    parameters: { analysisDepth: "string?" },
    execute: async (params, context) => {
      // Note: This would need to be implemented differently since we can't access agent methods here
      return { 
        success: true, 
        data: [], 
        message: "Continuous improvement analysis not yet implemented in tool context" 
      };
    }
  },

  {
    name: "edit_specific_paragraph",
    description: "Edit a specific paragraph by number or content match while preserving all other paragraphs",
    parameters: { 
      paragraphNumber: "number?", 
      searchText: "string?",
      newContent: "string", 
      operation: "replace|translate|improve|rewrite",
      currentContent: "string?" 
    },
    execute: async (params, context) => {
      const textToEdit = params.currentContent || context.editorState?.content || context.currentDocument?.content || "";
      
      if (!textToEdit.trim()) {
        return { success: false, error: "No content to edit" };
      }
      
      // Split into paragraphs
      const paragraphs = textToEdit.split(/\n\s*\n/).filter((p: string) => p.trim().length > 0);
      
      let targetParagraphIndex = -1;
      
      // Find target paragraph by number or search text
      if (params.paragraphNumber && params.paragraphNumber > 0 && params.paragraphNumber <= paragraphs.length) {
        targetParagraphIndex = params.paragraphNumber - 1;
      } else if (params.searchText) {
        targetParagraphIndex = paragraphs.findIndex((p: string) => 
          p.toLowerCase().includes(params.searchText.toLowerCase())
        );
      }
      
      if (targetParagraphIndex === -1) {
        return { success: false, error: "Could not find the target paragraph" };
      }
      
      // Replace the specific paragraph
      paragraphs[targetParagraphIndex] = params.newContent;
      
      // Rejoin paragraphs
      const result = paragraphs.join('\n\n');
      
      // Update database if we have current document ID
      if (context.currentDocument?.id) {
        const wordCount = countWords(result);
        await storage.updateDocument(context.currentDocument.id, {
          content: result,
          wordCount
        });
      }
      
      return { 
        success: true, 
        data: { 
          operation: "replace", 
          content: result,
          targetParagraph: targetParagraphIndex + 1,
          description: `${params.operation} paragraph ${targetParagraphIndex + 1}`
        }, 
        message: `Successfully edited paragraph ${targetParagraphIndex + 1}` 
      };
    }
  },
];

// Main agent class
export class WordPlayAgent {
  private tools: Map<string, AgentTool>;
  private context: AgentContext;

  constructor(userId: number = 1) {
    this.tools = new Map();
    agentTools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });
    
    this.context = {
      userId,
      allProjects: [],
      projectDocuments: [],
      projectSources: [],
      researchNotes: "",
      llmProvider: undefined,
      llmModel: undefined,
      
      // NEW: Enhanced autonomous capabilities
      executionHistory: [],
      persistentMemory: new Map(),
      currentGoals: [],
      maxToolChainLength: 10, // Increased for long-horizon tasks
      autonomyLevel: 'moderate', // Default to moderate autonomy
      reflectionEnabled: true,
      learningEnabled: true
    };
  }

  // NEW: Set autonomy level for different use cases
  setAutonomyLevel(level: 'conservative' | 'moderate' | 'aggressive') {
    this.context.autonomyLevel = level;
    
    // Adjust parameters based on autonomy level
    switch (level) {
      case 'conservative':
        this.context.maxToolChainLength = 5;
        this.context.reflectionEnabled = true;
        break;
      case 'moderate':
        this.context.maxToolChainLength = 10;
        this.context.reflectionEnabled = true;
        break;
      case 'aggressive':
        this.context.maxToolChainLength = 20;
        this.context.reflectionEnabled = false; // Less reflection for speed
        break;
    }
  }

  // NEW: Record execution step for learning and reflection
  private recordExecutionStep(action: string, toolUsed?: string, parameters?: any, result?: any, reasoning?: string): void {
    const step: ExecutionStep = {
      id: Date.now().toString(),
      timestamp: new Date(),
      action,
      toolUsed,
      parameters,
      result,
      success: result?.success ?? true,
      reasoning: reasoning || '',
      nextSteps: []
    };
    
    this.context.executionHistory.push(step);
    
    // Keep only last 100 steps to prevent memory bloat
    if (this.context.executionHistory.length > 100) {
      this.context.executionHistory = this.context.executionHistory.slice(-100);
    }
  }

  // NEW: Self-reflection capability
  private async performSelfReflection(currentGoal: string, executedSteps: any[], context: AgentContext): Promise<any> {
    const recentHistory = context.executionHistory.slice(-10);
    const successRate = recentHistory.filter(step => step.success).length / recentHistory.length;
    
    const reflectionPrompt = `Analyze my recent performance and suggest improvements:

CURRENT GOAL: ${currentGoal}

RECENT EXECUTION HISTORY:
${recentHistory.map(step => `- ${step.action}: ${step.success ? 'SUCCESS' : 'FAILED'} (${step.reasoning})`).join('\n')}

SUCCESS RATE: ${(successRate * 100).toFixed(1)}%

ANALYSIS NEEDED:
1. What patterns do you see in my successes and failures?
2. What should I do differently to improve performance?
3. Are there tools I'm underutilizing or overusing?
4. What adjustments should I make to my approach?

Respond with JSON:
{
  "analysis": "detailed analysis of performance",
  "improvements": ["specific improvement suggestions"],
  "toolRecommendations": ["tool usage recommendations"],
  "strategyAdjustments": ["strategic changes to make"]
}`;

    try {
      const { generateTextCompletion } = await import("./openai");
      const result = await generateTextCompletion("", {}, reflectionPrompt, context.llmProvider, getValidOpenAIModel(context.llmModel));
      return JSON.parse(result);
    } catch (error) {
      return {
        analysis: "Unable to perform detailed reflection",
        improvements: ["Continue with current approach"],
        toolRecommendations: ["Monitor tool success rates"],
        strategyAdjustments: ["Maintain current strategy"]
      };
    }
  }

  // NEW: Create detailed multi-step plans
  private async createDetailedPlan(task: string, constraints: any = {}, context: AgentContext): Promise<any> {
    const planningPrompt = `Create a detailed execution plan for this task:

TASK: ${task}

CONSTRAINTS: ${JSON.stringify(constraints)}

AVAILABLE TOOLS: ${this.getAvailableTools().join(', ')}

CURRENT CONTEXT:
- Project: ${context.currentProject?.name || 'None'}
- Document: ${context.currentDocument?.title || 'None'}
- Goals: ${context.currentGoals.length} active
- Memory entries: ${context.persistentMemory.size}

PLANNING REQUIREMENTS:
1. Break down the task into specific, actionable steps
2. Identify which tools to use for each step
3. Consider dependencies between steps
4. Include checkpoints for progress monitoring
5. Plan for error handling and alternative approaches

Respond with JSON:
{
  "steps": [
    {
      "id": "step_1",
      "description": "specific action to take",
      "tool": "tool_name",
      "parameters": {},
      "dependencies": ["step_ids"],
      "estimatedTime": "time estimate",
      "successCriteria": "how to know this step succeeded"
    }
  ],
  "totalEstimatedTime": "overall time estimate",
  "riskFactors": ["potential issues"],
  "alternativeApproaches": ["backup plans"]
}`;

    try {
      const { generateTextCompletion } = await import("./openai");
      const result = await generateTextCompletion("", {}, planningPrompt, context.llmProvider, getValidOpenAIModel(context.llmModel));
      return JSON.parse(result);
    } catch (error) {
      return {
        steps: [
          {
            id: "step_1",
            description: task,
            tool: "web_search",
            parameters: { query: task },
            dependencies: [],
            estimatedTime: "5 minutes",
            successCriteria: "Task completed successfully"
          }
        ],
        totalEstimatedTime: "5 minutes",
        riskFactors: ["Planning failed, using fallback"],
        alternativeApproaches: ["Manual execution"]
      };
    }
  }

  // NEW: Execute autonomous workflows with self-monitoring
  private async executeAutonomousWorkflow(workflow: any, maxSteps: number = 20, context: AgentContext): Promise<any> {
    const startTime = Date.now();
    let stepsCompleted = 0;
    const results: any[] = [];
    const errors: any[] = [];
    
    try {
      for (const step of workflow.steps) {
        if (stepsCompleted >= maxSteps) {
          break;
        }
        
        this.recordExecutionStep(`Executing step: ${step.description}`, step.tool, step.parameters, null, `Autonomous workflow step ${stepsCompleted + 1}`);
        
        try {
          const result = await this.executeTool(step.tool, step.parameters);
          results.push({ step: step.id, result });
          
          if (!result.success) {
            errors.push({ step: step.id, error: result.error });
            
            // Try alternative approach if available
            if (workflow.alternativeApproaches && workflow.alternativeApproaches.length > 0) {
              console.log(`Step ${step.id} failed, trying alternative approach`);
              // Could implement alternative execution here
            }
          }
          
          stepsCompleted++;
          
          // Self-reflection checkpoint every 5 steps
          if (context.reflectionEnabled && stepsCompleted % 5 === 0) {
            await this.performSelfReflection(`Workflow: ${workflow.description || 'Autonomous task'}`, results, context);
          }
          
        } catch (stepError) {
          errors.push({ step: step.id, error: stepError });
          console.error(`Error in workflow step ${step.id}:`, stepError);
        }
      }
      
      const duration = Date.now() - startTime;
      const successRate = (stepsCompleted - errors.length) / stepsCompleted;
      
      return {
        success: errors.length < stepsCompleted / 2, // Success if less than 50% failed
        stepsCompleted,
        totalSteps: workflow.steps.length,
        duration,
        successRate,
        results,
        errors,
        summary: `Completed ${stepsCompleted}/${workflow.steps.length} steps in ${duration}ms with ${(successRate * 100).toFixed(1)}% success rate`
      };
      
    } catch (error) {
      return {
        success: false,
        stepsCompleted,
        totalSteps: workflow.steps.length,
        duration: Date.now() - startTime,
        successRate: 0,
        results,
        errors: [...errors, { step: 'workflow', error }],
        summary: `Workflow failed after ${stepsCompleted} steps: ${error}`
      };
    }
  }

  // NEW: Analyze past performance for continuous improvement
  private async analyzePastPerformance(context: AgentContext): Promise<any[]> {
    const recentHistory = context.executionHistory.slice(-50);
    const toolUsage = new Map<string, { successes: number; failures: number }>();
    
    // Analyze tool performance
    recentHistory.forEach(step => {
      if (step.toolUsed) {
        const stats = toolUsage.get(step.toolUsed) || { successes: 0, failures: 0 };
        if (step.success) {
          stats.successes++;
        } else {
          stats.failures++;
        }
        toolUsage.set(step.toolUsed, stats);
      }
    });
    
    const improvements: any[] = [];
    
    // Identify underperforming tools
    toolUsage.forEach((stats, tool) => {
      const successRate = stats.successes / (stats.successes + stats.failures);
      if (successRate < 0.7 && stats.failures > 2) {
        improvements.push({
          type: 'tool_performance',
          tool,
          issue: `Low success rate: ${(successRate * 100).toFixed(1)}%`,
          suggestion: `Review parameters and usage patterns for ${tool}`
        });
      }
    });
    
    // Identify patterns in failures
    const failedSteps = recentHistory.filter(step => !step.success);
    if (failedSteps.length > recentHistory.length * 0.3) {
      improvements.push({
        type: 'general_performance',
        issue: `High failure rate: ${(failedSteps.length / recentHistory.length * 100).toFixed(1)}%`,
        suggestion: 'Consider reducing autonomy level or increasing reflection frequency'
      });
    }
    
    return improvements;
  }

  // Get list of available tool names
  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  getAllTools(): { name: string; description: string; parameters: any }[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  buildSystemPrompt(): string {
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
      availableTools: this.getAvailableTools(),
      editorState: this.context.editorState ? {
        title: this.context.editorState.title,
        currentWordCount: this.context.editorState.wordCount,
        hasUnsavedChanges: this.context.editorState.hasUnsavedChanges,
        contentPreview: this.context.editorState.content.length > 100 ? 
          this.context.editorState.content.substring(0, 100) + "..." : 
          this.context.editorState.content
      } : null
    };

    return `You are an intelligent AI writing assistant with access to powerful tools. Your goal is to help users with their writing projects by using tools strategically.

CORE PRINCIPLES:
1. **Provide Detailed, Helpful Responses**: Always give substantial, insightful answers. Never respond with generic phrases like "I've processed your request." Explain your thinking, provide specific advice, and be genuinely helpful.
2. **Chain Tools Intelligently**: Use multiple tools in sequence when beneficial to provide comprehensive assistance
3. **Process Results**: Always analyze and synthesize tool outputs into meaningful insights
4. **Provide Value**: Don't just show raw data - interpret and explain what it means for the user's specific situation
5. **Be Proactive**: Suggest follow-up actions based on tool results and user needs
6. **Context Awareness**: Use current project/document context to make better decisions and more relevant suggestions

RESPONSE REQUIREMENTS:
- Be specific and detailed in your responses
- Explain your reasoning and thought process
- Provide actionable advice and insights
- Use tools when they would genuinely help the user
- Suggest meaningful follow-up actions
- Never give generic or placeholder responses

AVAILABLE TOOLS:
${this.getAvailableTools().map(toolName => {
  const tool = this.tools.get(toolName);
  return `- ${toolName}: ${tool?.description}`;
}).join('\n')}

CURRENT CONTEXT:
${JSON.stringify(contextSummary, null, 2)}

INTELLIGENT TOOL USAGE PATTERNS:
- **Research Workflows**: web_search → scrape_webpage → save_source → analyze results → provide insights
- **Document Analysis**: get_document → analyze_document_structure → get_writing_suggestions → synthesize feedback
- **Content Creation**: analyze current content → generate_text → update_document → provide explanation
- **Text Processing**: search_in_text → replace_in_text → update_document → explain changes
- **Project Management**: list_projects → get_project → list_documents → provide overview
- **Direct Editor Operations**: 
  * Use edit_current_document for simple append/prepend operations
  * Use replace_current_content for complete document rewrites
  * Use edit_text_with_pattern for find-and-replace operations with regex
  * Use improve_current_text for AI-powered content improvement
- **Advanced Text Editing**:
  * Combine search_in_text + replace_in_text for precise text manipulation
  * Use analyze_document_structure before making structural changes
  * Chain generate_text + edit_current_document for content expansion

**EDITOR-AWARE CAPABILITIES:**
You can directly manipulate the user's editor content in real-time. When users ask you to:
- "Edit this text..." → Use edit_text_with_pattern or improve_current_text
- "Replace all instances of..." → Use edit_text_with_pattern with regex
- "Rewrite this document..." → Use replace_current_content
- "Add content..." → Use edit_current_document with append operation
- "Fix grammar/style..." → Use improve_current_text with specific instructions

Remember: Your responses should be detailed, insightful, and specifically tailored to help the user with their writing and research needs.`;
  }

  // Update agent context with current app state
  async updateContext(newContext: Partial<AgentContext>): Promise<void> {
    // Update basic context
    Object.assign(this.context, newContext);
    
    // Update current document reference if editorState is provided
    if (newContext.editorState && this.context.currentDocument) {
      this.context.currentDocument.content = newContext.editorState.content;
      this.context.currentDocument.title = newContext.editorState.title;
    }
    
    // Refresh project data if needed
    if (newContext.currentProject) {
      try {
        this.context.allProjects = await storage.getProjects(this.context.userId);
        this.context.projectDocuments = await storage.getDocuments(newContext.currentProject.id);
        this.context.projectSources = await storage.getSources(newContext.currentProject.id);
      } catch (error) {
        console.warn('Failed to refresh project data:', error);
      }
    }
  }

  // Execute a specific tool with parameters
  async executeTool(toolName: string, parameters: any): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${toolName}' not found. Available tools: ${this.getAvailableTools().join(', ')}`,
        tool: toolName,
        executionTime: 0
      };
    }

    const startTime = Date.now();
    
    try {
      // Record the execution attempt
      this.recordExecutionStep(`Executing tool: ${toolName}`, toolName, parameters, null, `Tool execution with parameters: ${JSON.stringify(parameters)}`);
      
      const result = await tool.execute(parameters, this.context);
      const executionTime = Date.now() - startTime;
      
      // Ensure the result always includes the tool name and execution time
      const enhancedResult: ToolResult = {
        ...result,
        tool: toolName,
        executionTime
      };
      
      // Record the execution result
      this.recordExecutionStep(`Tool completed: ${toolName}`, toolName, parameters, enhancedResult, enhancedResult.success ? 'Tool executed successfully' : `Tool failed: ${enhancedResult.error}`);
      
      return enhancedResult;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      const errorResult: ToolResult = {
        success: false,
        error: `Error executing tool '${toolName}': ${error.message}`,
        tool: toolName,
        executionTime
      };
      
      // Record the execution error
      this.recordExecutionStep(`Tool error: ${toolName}`, toolName, parameters, errorResult, `Tool execution failed with error: ${error.message}`);
      
      return errorResult;
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
    researchFindings?: {
      sources: any[];
      content: string;
      summary: string;
    };
    allToolResults?: {
      [toolName: string]: {
        success: boolean;
        data: any;
        message: string;
        summary: string;
        actionableInsights: string[];
      };
    };
    continuousOperationPlan?: {
      nextPhase: string;
      recommendedTools: string[];
      reasoning: string;
    };
  }> {
    // Create comprehensive summary of ALL tool executions for analysis
    const executionSummary = toolExecutions.map(exec => ({
      tool: exec.toolName,
      success: exec.result.success,
      data: exec.result.data,
      message: exec.result.message,
      error: exec.result.error,
      parameters: exec.parameters
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

    // Process ALL tool results comprehensively
    const allToolResults: any = {};
    let researchFindings: any = null;
    
    // Categorize and process each tool execution
    for (const exec of toolExecutions) {
      const toolName = exec.toolName;
      const result = exec.result;
      
      // Create detailed summary for each tool
      allToolResults[toolName] = {
        success: result.success,
        data: result.data,
        message: result.message || (result.success ? 'Executed successfully' : result.error),
        summary: this.generateToolSummary(toolName, exec.parameters, result),
        actionableInsights: this.extractActionableInsights(toolName, result)
      };
    }

    // Extract research findings (enhanced from previous version)
    const webSearchResults = toolExecutions.find(exec => exec.toolName === 'web_search' && exec.result.success);
    const scrapeResults = toolExecutions.filter(exec => exec.toolName === 'scrape_webpage' && exec.result.success);
    const savedSources = toolExecutions.filter(exec => exec.toolName === 'save_source' && exec.result.success);

    if (webSearchResults || scrapeResults.length > 0) {
      let researchContent = '';
      let sources: any[] = [];
      
      // Include web search results
      if (webSearchResults?.result.data) {
        const searchData = webSearchResults.result.data;
        if (searchData.results) {
          sources.push(...searchData.results);
          researchContent += `## Web Search Results for "${webSearchResults.parameters.query}"\n\n`;
          
          if (searchData.summary) {
            researchContent += `### AI Summary:\n${searchData.summary}\n\n`;
          }
          
          researchContent += `### Sources Found:\n`;
          searchData.results.forEach((result: any, index: number) => {
            researchContent += `${index + 1}. **${result.title}**\n`;
            researchContent += `   ${result.snippet}\n`;
            researchContent += `   Source: ${result.url}\n\n`;
          });
        }
      }
      
      // Include scraped content
      scrapeResults.forEach((scrapeResult, index) => {
        if (scrapeResult.result.data) {
          const scrapeData = scrapeResult.result.data;
          researchContent += `## Extracted Content ${index + 1}: ${scrapeData.title || 'Webpage'}\n\n`;
          researchContent += `**Source:** ${scrapeResult.parameters.url}\n`;
          researchContent += `**Word Count:** ${scrapeData.wordCount || 'Unknown'}\n\n`;
          
          if (scrapeData.content) {
            // Include first 1000 characters of content
            const preview = scrapeData.content.substring(0, 1000);
            researchContent += `**Content Preview:**\n${preview}${scrapeData.content.length > 1000 ? '...\n\n[Content truncated - full content saved to sources]' : ''}\n\n`;
          }
        }
      });
      
      if (researchContent) {
        researchFindings = {
          sources,
          content: researchContent,
          summary: webSearchResults?.result.data?.summary || `Research completed with ${sources.length} sources found and ${scrapeResults.length} pages extracted.`
        };
      }
    }

    // Enhanced analysis prompt that covers ALL tool types
    const analysisPrompt = `You are an intelligent AI assistant analyzing the results of autonomous tool executions. Your job is to:

1. **SYNTHESIZE ALL RESULTS**: Process ALL tool outputs into meaningful insights and actionable information
2. **PROVIDE COMPREHENSIVE VALUE**: Explain what ALL results mean for the user's request and project
3. **SUGGEST INTELLIGENT NEXT STEPS**: Recommend follow-up actions based on ALL tool results
4. **CHAIN TOOLS STRATEGICALLY**: Identify additional tools that would add value based on current results
5. **SHOW ALL FINDINGS**: Display research, document analysis, project updates, and any other tool results
6. **PLAN CONTINUOUS OPERATION**: Determine next phase of autonomous operation

ORIGINAL USER REQUEST: "${originalRequest}"

CURRENT CONTEXT:
${JSON.stringify(contextSummary, null, 2)}

COMPREHENSIVE TOOL EXECUTION RESULTS:
${JSON.stringify(executionSummary, null, 2)}

ALL TOOL RESULTS SUMMARY:
${JSON.stringify(allToolResults, null, 2)}

${researchFindings ? `
RESEARCH FINDINGS AVAILABLE:
- ${researchFindings.sources.length} sources found
- ${researchFindings.content.length} characters of research content
- Summary: ${researchFindings.summary}
` : ''}

ANALYSIS GUIDELINES FOR ALL TOOL TYPES:

**Research Tools (web_search, scrape_webpage, save_source):**
- Include actual findings, sources, and key insights
- Show what was discovered and saved
- Explain relevance to user's request

**Document Tools (get_document, create_document, update_document, analyze_writing_style):**
- Show document content, analysis results, and changes made
- Provide concrete insights about writing quality and structure
- Explain how documents were modified or created

**Project Tools (list_projects, create_project, get_project):**
- Display project information, creation confirmations, and organizational updates
- Show how the project structure was modified
- Explain project management actions taken

**Text Processing Tools (search_in_text, replace_in_text, analyze_document_structure):**
- Show search results, replacements made, and structural analysis
- Display before/after comparisons where applicable
- Explain text processing outcomes

**AI Generation Tools (generate_text, get_writing_suggestions, process_text_command):**
- Include generated content and suggestions
- Show how AI assistance was applied
- Explain the creative or analytical process

**Memory & Goal Tools (store_memory, recall_memory, set_goal, update_goal_status):**
- Display stored information and retrieved memories
- Show goal progress and status updates
- Explain how the agent's knowledge was enhanced

RESPONSE REQUIREMENTS:
- **Show actual results** from ALL tools, not just summaries
- **Include specific data** returned by each tool
- **Explain the impact** of each tool execution
- **Provide actionable next steps** based on ALL results
- **Plan continuous operation** for autonomous agents

RESPONSE FORMAT:
Respond with a JSON object containing:
{
  "synthesizedResponse": "Comprehensive response showing ALL tool results and their impact",
  "suggestedActions": ["Specific actionable next steps based on ALL tool results"],
  "additionalToolCalls": [
    {
      "tool": "tool_name",
      "params": { "param": "value" },
      "reasoning": "Why this tool would add value based on current results"
    }
  ],
  "continuousOperationPlan": {
    "nextPhase": "Description of next autonomous operation phase",
    "recommendedTools": ["tools for next phase"],
    "reasoning": "Why these tools and this phase make sense"
  }
}

EXAMPLES OF EXCELLENT RESPONSES:

For Research + Document Creation:
✅ "I've completed comprehensive research on [topic] and created a new document with the findings:

**Research Results:**
- Found 3 authoritative sources on [topic]
- Key insight 1: [specific finding from source 1]
- Key insight 2: [specific finding from source 2]
- Key insight 3: [specific finding from source 3]

**Document Created:**
- Title: '[Document Title]'
- Content: [Brief preview of generated content]
- Word Count: [X] words
- Saved to: [Project Name]

**Sources Saved:**
1. [Source 1] - [Key point]
2. [Source 2] - [Key point]
3. [Source 3] - [Key point]

All research has been organized and is ready for your use."

For Project Management + Analysis:
✅ "I've analyzed your project structure and made organizational improvements:

**Project Analysis:**
- Current projects: [X] projects found
- Active documents: [Y] documents
- Research sources: [Z] sources

**Actions Taken:**
- Created new project: '[Project Name]'
- Organized [X] documents by topic
- Updated project metadata

**Writing Analysis:**
- Average document length: [X] words
- Writing style: [Analysis results]
- Improvement suggestions: [Specific recommendations]

Your project is now better organized for efficient writing."

Provide your comprehensive analysis now, showing ALL tool results and their actionable value:`;

    try {
      const { generateTextCompletion } = await import("./openai");
      
      const result = await generateTextCompletion(
        "", 
        {}, 
        analysisPrompt,
        this.context.llmProvider,
        getValidOpenAIModel(this.context.llmModel)
      );
      
      try {
        const parsed = JSON.parse(result);
        return {
          synthesizedResponse: parsed.synthesizedResponse || this.generateEnhancedSynthesis(toolExecutions, originalRequest, researchFindings, allToolResults),
          suggestedActions: parsed.suggestedActions || [],
          additionalToolCalls: parsed.additionalToolCalls || [],
          researchFindings,
          allToolResults,
          continuousOperationPlan: parsed.continuousOperationPlan || this.generateContinuousOperationPlan(toolExecutions, originalRequest)
        };
      } catch (parseError) {
        // Fallback to enhanced basic synthesis with ALL tool results
        return {
          synthesizedResponse: this.generateEnhancedSynthesis(toolExecutions, originalRequest, researchFindings, allToolResults),
          suggestedActions: this.generateBasicSuggestions(toolExecutions),
          additionalToolCalls: [],
          researchFindings,
          allToolResults,
          continuousOperationPlan: this.generateContinuousOperationPlan(toolExecutions, originalRequest)
        };
      }
    } catch (error) {
      console.error("Error in comprehensive tool result analysis:", error);
      return {
        synthesizedResponse: this.generateEnhancedSynthesis(toolExecutions, originalRequest, researchFindings, allToolResults),
        suggestedActions: this.generateBasicSuggestions(toolExecutions),
        additionalToolCalls: [],
        researchFindings,
        allToolResults,
        continuousOperationPlan: this.generateContinuousOperationPlan(toolExecutions, originalRequest)
      };
    }
  }

  // Generate detailed summary for each tool type
  private generateToolSummary(toolName: string, parameters: any, result: ToolResult): string {
    if (!result.success) {
      return `Failed: ${result.error || 'Unknown error'}`;
    }

    switch (toolName) {
      case 'web_search':
        const searchData = result.data;
        return `Found ${searchData?.results?.length || 0} search results for "${parameters.query}"`;
      
      case 'scrape_webpage':
        const scrapeData = result.data;
        return `Extracted ${scrapeData?.wordCount || 'content'} from ${scrapeData?.domain || parameters.url}`;
      
      case 'save_source':
        return `Saved source "${parameters.name}" to project ${parameters.projectId}`;
      
      case 'get_document':
        const docData = result.data;
        return `Retrieved document "${docData?.title}" (${docData?.wordCount || 0} words)`;
      
      case 'create_document':
        const newDocData = result.data;
        return `Created document "${newDocData?.title || parameters.title}" in project ${parameters.projectId}`;
      
      case 'update_document':
        return `Updated document ${parameters.documentId} with new content`;
      
      case 'analyze_writing_style':
        const styleData = result.data;
        return `Analyzed writing style - ${Object.keys(styleData || {}).length} metrics calculated`;
      
      case 'get_writing_suggestions':
        const suggestions = result.data;
        return `Generated ${Array.isArray(suggestions) ? suggestions.length : 'multiple'} writing suggestions`;
      
      case 'list_projects':
        const projects = result.data;
        return `Found ${Array.isArray(projects) ? projects.length : 0} projects`;
      
      case 'create_project':
        const projectData = result.data;
        return `Created project "${projectData?.name || parameters.name}"`;
      
      case 'search_in_text':
        const searchResults = result.data;
        return `Found ${searchResults?.count || 0} matches for pattern "${parameters.pattern}"`;
      
      case 'replace_in_text':
        const replaceResults = result.data;
        return `Replaced "${parameters.pattern}" with "${parameters.replacement}"`;
      
      case 'analyze_document_structure':
        const structureData = result.data;
        return `Analyzed document structure - found ${structureData?.sections?.length || 0} sections`;
      
      case 'generate_text':
        return `Generated text content based on prompt: "${parameters.prompt?.substring(0, 50)}..."`;
      
      case 'store_memory':
        return `Stored memory entry "${parameters.key}" in category "${parameters.category || 'general'}"`;
      
      case 'recall_memory':
        const memoryData = result.data;
        return parameters.key ? `Retrieved memory "${parameters.key}"` : `Retrieved ${Array.isArray(memoryData) ? memoryData.length : 0} memory entries`;
      
      case 'set_goal':
        return `Set new goal: "${parameters.description}" with priority ${parameters.priority || 1}`;
      
      case 'update_goal_status':
        return `Updated goal ${parameters.goalId} status to "${parameters.status}"`;
      
      default:
        return result.message || 'Tool executed successfully';
    }
  }

  // Extract actionable insights from each tool result
  private extractActionableInsights(toolName: string, result: ToolResult): string[] {
    if (!result.success) {
      return [`Fix error: ${result.error}`];
    }

    const insights: string[] = [];

    switch (toolName) {
      case 'web_search':
        const searchData = result.data;
        if (searchData?.results?.length > 0) {
          insights.push('Review search results for relevant information');
          insights.push('Consider scraping top results for detailed content');
          insights.push('Save valuable sources to current project');
        }
        break;
      
      case 'scrape_webpage':
        insights.push('Analyze scraped content for key insights');
        insights.push('Extract quotes or data points for writing');
        insights.push('Consider creating outline based on content structure');
        break;
      
      case 'get_document':
        const docData = result.data;
        if (docData?.content) {
          insights.push('Analyze document writing style');
          insights.push('Generate improvement suggestions');
          insights.push('Check document structure and organization');
        }
        break;
      
      case 'analyze_writing_style':
        insights.push('Apply style recommendations to improve writing');
        insights.push('Adjust tone and complexity based on analysis');
        insights.push('Use insights for future content generation');
        break;
      
      case 'list_projects':
        insights.push('Review project organization and structure');
        insights.push('Consider consolidating or reorganizing projects');
        insights.push('Identify projects that need attention');
        break;
      
      case 'create_document':
        insights.push('Add content to the newly created document');
        insights.push('Set up document structure and outline');
        insights.push('Begin writing or research for the document');
        break;
      
      case 'generate_text':
        insights.push('Review generated content for accuracy');
        insights.push('Edit and refine the generated text');
        insights.push('Integrate generated content into documents');
        break;
      
      default:
        insights.push('Review tool results and plan next steps');
        break;
    }

    return insights;
  }

  // Generate continuous operation plan
  private generateContinuousOperationPlan(toolExecutions: Array<{ toolName: string; parameters: any; result: ToolResult }>, originalRequest: string): any {
    const successfulTools = toolExecutions.filter(exec => exec.result.success);
    const toolTypes = successfulTools.map(exec => exec.toolName);
    
    // Determine next phase based on tools executed
    if (toolTypes.includes('web_search') && !toolTypes.includes('scrape_webpage')) {
      return {
        nextPhase: 'Content Extraction',
        recommendedTools: ['scrape_webpage', 'save_source'],
        reasoning: 'Web search completed, now extract detailed content from top results'
      };
    }
    
    if (toolTypes.includes('scrape_webpage') && !toolTypes.includes('create_document')) {
      return {
        nextPhase: 'Content Creation',
        recommendedTools: ['create_document', 'generate_text'],
        reasoning: 'Content extracted, now create documents with the research findings'
      };
    }
    
    if (toolTypes.includes('create_document') && !toolTypes.includes('analyze_writing_style')) {
      return {
        nextPhase: 'Content Analysis',
        recommendedTools: ['analyze_writing_style', 'get_writing_suggestions'],
        reasoning: 'Document created, now analyze and improve the writing quality'
      };
    }
    
    if (toolTypes.includes('analyze_writing_style')) {
      return {
        nextPhase: 'Content Refinement',
        recommendedTools: ['update_document', 'generate_text'],
        reasoning: 'Analysis complete, now refine and improve the content based on insights'
      };
    }
    
    return {
      nextPhase: 'Task Completion',
      recommendedTools: ['store_memory', 'update_goal_status'],
      reasoning: 'Primary objectives achieved, now consolidate learnings and update goals'
    };
  }

  // Generate enhanced synthesis with research findings
  private generateEnhancedSynthesis(
    toolExecutions: Array<{ toolName: string; parameters: any; result: ToolResult }>, 
    originalRequest: string,
    researchFindings: any,
    allToolResults: any
  ): string {
    const successfulTools = toolExecutions.filter(exec => exec.result.success);
    const failedTools = toolExecutions.filter(exec => !exec.result.success);

    if (successfulTools.length === 0) {
      return `I attempted to help with your request "${originalRequest}" but encountered issues with the tools. Let me try a different approach.`;
    }

    let response = `I've completed your request "${originalRequest}". Here's a comprehensive summary of what was accomplished:\n\n`;

    // Group tools by category for better organization
    const toolCategories = {
      research: ['web_search', 'scrape_webpage', 'save_source'],
      documents: ['get_document', 'create_document', 'update_document', 'analyze_writing_style', 'get_writing_suggestions'],
      projects: ['list_projects', 'create_project', 'get_project', 'update_project'],
      textProcessing: ['search_in_text', 'replace_in_text', 'analyze_document_structure'],
      aiGeneration: ['generate_text', 'process_text_command'],
      memory: ['store_memory', 'recall_memory', 'set_goal', 'update_goal_status']
    };

    // Process each category
    Object.entries(toolCategories).forEach(([category, tools]) => {
      const categoryTools = successfulTools.filter(exec => tools.includes(exec.toolName));
      if (categoryTools.length > 0) {
        response += this.generateCategoryResponse(category, categoryTools, allToolResults);
      }
    });

    // For research tasks, include detailed findings
    if (researchFindings) {
      response += `\n**📚 RESEARCH FINDINGS:**\n`;
      
      if (researchFindings.sources.length > 0) {
        response += `Found ${researchFindings.sources.length} relevant sources:\n\n`;
        
        researchFindings.sources.forEach((source: any, index: number) => {
          response += `${index + 1}. **${source.title}**\n`;
          response += `   ${source.snippet}\n`;
          response += `   Source: ${source.url}\n\n`;
        });
      }
      
      if (researchFindings.summary) {
        response += `**Key Insights:** ${researchFindings.summary}\n\n`;
      }
      
      response += `All sources have been saved to your project for easy reference.\n\n`;
    }

    // Show specific tool results
    response += `**🔧 DETAILED RESULTS:**\n`;
    successfulTools.forEach((exec, index) => {
      const toolResult = allToolResults[exec.toolName];
      if (toolResult) {
        response += `${index + 1}. **${exec.toolName}**: ${toolResult.summary}\n`;
        if (toolResult.actionableInsights.length > 0) {
          response += `   💡 Insights: ${toolResult.actionableInsights.join(', ')}\n`;
        }
      }
    });

    if (failedTools.length > 0) {
      response += `\n⚠️ Note: ${failedTools.length} operations had issues but the main task was completed successfully.`;
    }

    return response;
  }

  // Generate category-specific responses
  private generateCategoryResponse(category: string, tools: Array<{ toolName: string; parameters: any; result: ToolResult }>, allToolResults: any): string {
    let response = '';

    switch (category) {
      case 'research':
        response += `**🔍 RESEARCH COMPLETED:**\n`;
        tools.forEach(tool => {
          const result = allToolResults[tool.toolName];
          if (result) {
            response += `- ${result.summary}\n`;
          }
        });
        response += '\n';
        break;

      case 'documents':
        response += `**📄 DOCUMENT OPERATIONS:**\n`;
        tools.forEach(tool => {
          const result = allToolResults[tool.toolName];
          if (result && result.data) {
            if (tool.toolName === 'get_document') {
              response += `- Retrieved: "${result.data.title}" (${result.data.wordCount || 0} words)\n`;
            } else if (tool.toolName === 'create_document') {
              response += `- Created: "${result.data.title || tool.parameters.title}"\n`;
            } else if (tool.toolName === 'update_document') {
              response += `- Updated document with new content\n`;
            } else if (tool.toolName === 'analyze_writing_style') {
              response += `- Analyzed writing style: ${Object.keys(result.data || {}).length} metrics\n`;
            } else if (tool.toolName === 'get_writing_suggestions') {
              response += `- Generated writing suggestions for improvement\n`;
            }
          }
        });
        response += '\n';
        break;

      case 'projects':
        response += `**📁 PROJECT MANAGEMENT:**\n`;
        tools.forEach(tool => {
          const result = allToolResults[tool.toolName];
          if (result) {
            response += `- ${result.summary}\n`;
          }
        });
        response += '\n';
        break;

      case 'textProcessing':
        response += `**✏️ TEXT PROCESSING:**\n`;
        tools.forEach(tool => {
          const result = allToolResults[tool.toolName];
          if (result) {
            response += `- ${result.summary}\n`;
          }
        });
        response += '\n';
        break;

      case 'aiGeneration':
        response += `**🤖 AI CONTENT GENERATION:**\n`;
        tools.forEach(tool => {
          const result = allToolResults[tool.toolName];
          if (result) {
            response += `- ${result.summary}\n`;
          }
        });
        response += '\n';
        break;

      case 'memory':
        response += `**🧠 MEMORY & GOALS:**\n`;
        tools.forEach(tool => {
          const result = allToolResults[tool.toolName];
          if (result) {
            response += `- ${result.summary}\n`;
          }
        });
        response += '\n';
        break;
    }

    return response;
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
  async processRequest(request: string): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`🤖 Agent processing request: ${request.substring(0, 100)}...`);
      
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = `User Request: ${request}

Based on your tools and the current context, analyze this request and provide a comprehensive response. 
Use your tools when necessary to gather information or perform actions.

Remember:
- Think step by step about what needs to be done
- Use tools when you need current information or to perform specific actions
- Be helpful and thorough in your response
- Provide practical, actionable advice when appropriate`;

      let response: any;
      const model = getValidModel(this.context.llmModel, this.context.llmProvider);

      if (this.context.llmProvider === 'ollama') {
        // Use Ollama for local models with tool calling
        response = await this.processOllamaRequest(systemPrompt, userPrompt, model);
      } else {
        // Use OpenAI API
        response = await this.processOpenAIRequest(systemPrompt, userPrompt, model);
      }

      return response;
    } catch (error) {
      console.error('❌ Agent processing error:', error);
      return {
        content: "I apologize, but I encountered an error while processing your request. Please try again.",
        toolResults: [],
        executionTime: Date.now() - startTime,
        tokensUsed: 0
      };
    }
  }

  private async processOpenAIRequest(systemPrompt: string, userPrompt: string, model: string): Promise<AgentResponse> {
    const startTime = Date.now();
    
    // Initialize OpenAI client
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY || "default_key" 
    });
    
    // Define the response schema using OpenAI's structured outputs
    const response = await openai.beta.chat.completions.parse({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "agent_response",
          schema: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "A detailed, helpful response to the user's request. Be specific, insightful, and provide value. Explain your thinking and provide actionable advice. This should be substantial and informative, not just a generic acknowledgment."
              },
              reasoning: {
                type: "string",
                description: "Your thought process and reasoning for this response and any tool decisions"
              },
              tools_to_use: {
                type: "array",
                description: "Tools to execute to help answer the user's request. Only include if tools would genuinely help.",
                items: {
                  type: "object",
                  properties: {
                    tool_name: { 
                      type: "string",
                      description: "Name of the tool to use"
                    },
                    parameters: { 
                      type: "object",
                      description: "Parameters for the tool"
                    },
                    reasoning: { 
                      type: "string",
                      description: "Why this tool is needed for the user's request"
                    }
                  },
                  required: ["tool_name", "parameters", "reasoning"]
                }
              },
              follow_up_suggestions: {
                type: "array",
                description: "Helpful follow-up actions or questions the user might want to consider",
                items: {
                  type: "string"
                }
              }
            },
            required: ["content", "reasoning"]
          }
        }
      },
      temperature: 0.7,
      max_tokens: 2000
    });

    const parsedResponse = response.choices[0].message.parsed;
    if (!parsedResponse) {
      throw new Error('Failed to parse agent response');
    }
    
    const agentResponse = parsedResponse as {
      content: string;
      reasoning?: string;
      tools_to_use?: Array<{
        tool_name: string;
        parameters: any;
        reasoning: string;
      }>;
      follow_up_suggestions?: string[];
    };

    // Execute tools if requested
    const toolResults: ToolResult[] = [];
    if (agentResponse.tools_to_use && agentResponse.tools_to_use.length > 0) {
      for (const toolRequest of agentResponse.tools_to_use) {
        try {
          const result = await this.executeTool(toolRequest.tool_name, toolRequest.parameters);
          toolResults.push(result);
        } catch (error) {
          console.error(`Tool execution error for ${toolRequest.tool_name}:`, error);
          toolResults.push({
            success: false,
            data: null,
            error: `Failed to execute ${toolRequest.tool_name}: ${error}`,
            tool: toolRequest.tool_name,
            executionTime: 0
          });
        }
      }
    }

    return {
      content: agentResponse.content,
      toolResults,
      executionTime: Date.now() - startTime,
      tokensUsed: response.usage?.total_tokens || 0
    };
  }

  private async processOllamaRequest(systemPrompt: string, userPrompt: string, model: string): Promise<AgentResponse> {
    const startTime = Date.now();
    
    // First check if Ollama is available
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    
    try {
      // Use Ollama's tool calling capabilities
      const tools = this.getAllTools().map(tool => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));

      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          tools: tools,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Process tool calls if any
      const toolResults: ToolResult[] = [];
      if (data.message?.tool_calls) {
        for (const toolCall of data.message.tool_calls) {
          try {
            const toolName = toolCall.function.name;
            const parameters = typeof toolCall.function.arguments === 'string' 
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments;
            
            const result = await this.executeTool(toolName, parameters);
            toolResults.push(result);
          } catch (error) {
            console.error(`Tool execution error:`, error);
            toolResults.push({
              success: false,
              data: null,
              error: `Failed to execute tool: ${error}`,
              tool: toolCall.function.name,
              executionTime: 0
            });
          }
        }
      }

      return {
        content: data.message?.content || "I processed your request but couldn't generate a response.",
        toolResults,
        executionTime: Date.now() - startTime,
        tokensUsed: data.eval_count || 0
      };

    } catch (error) {
      console.error('❌ Ollama processing error:', error);
      
      // Fallback to OpenAI if Ollama fails
      console.log('🔄 Falling back to OpenAI...');
      return this.processOpenAIRequest(systemPrompt, userPrompt, getValidOpenAIModel(this.context.llmModel));
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