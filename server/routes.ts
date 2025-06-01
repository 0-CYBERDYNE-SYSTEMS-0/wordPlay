import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
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
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // We've replaced WebSockets with direct API calls
  // This simplifies the architecture and avoids connection issues

  // API Routes
  // Projects
  app.get("/api/projects", async (req: Request, res: Response) => {
    const userId = 1; // Using default user for now
    const projects = await storage.getProjects(userId);
    res.json(projects);
  });
  
  app.get("/api/projects/:id", async (req: Request, res: Response) => {
    const project = await storage.getProject(parseInt(req.params.id));
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.json(project);
  });
  
  app.post("/api/projects", async (req: Request, res: Response) => {
    const projectSchema = z.object({
      userId: z.number().default(1), // Default user ID
      name: z.string().min(1),
      type: z.string().min(1),
      style: z.string().min(1).default("Professional") // Default style
    });
    
    try {
      console.log("Received project data:", req.body); // Debug log
      const validatedData = projectSchema.parse(req.body);
      console.log("Validated project data:", validatedData); // Debug log
      
      const project = await storage.createProject(validatedData);
      res.status(201).json(project);
    } catch (error: any) {
      console.error("Project creation error:", error); // Debug log
      
      if (error.name === 'ZodError') {
        // Return specific validation errors
        res.status(400).json({ 
          message: "Invalid project data", 
          errors: error.errors,
          details: error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      } else {
        res.status(400).json({ message: "Invalid project data" });
      }
    }
  });
  
  app.put("/api/projects/:id", async (req: Request, res: Response) => {
    const projectSchema = z.object({
      name: z.string().min(1).optional(),
      type: z.string().min(1).optional(),
      style: z.string().min(1).optional()
    });
    
    try {
      const validatedData = projectSchema.parse(req.body);
      const updatedProject = await storage.updateProject(parseInt(req.params.id), validatedData);
      
      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.json(updatedProject);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data" });
    }
  });
  
  app.delete("/api/projects/:id", async (req: Request, res: Response) => {
    const deleted = await storage.deleteProject(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.status(204).send();
  });
  
  // Documents
  app.get("/api/projects/:projectId/documents", async (req: Request, res: Response) => {
    const documents = await storage.getDocuments(parseInt(req.params.projectId));
    res.json(documents);
  });
  
  app.get("/api/documents/:id", async (req: Request, res: Response) => {
    const document = await storage.getDocument(parseInt(req.params.id));
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    res.json(document);
  });
  
  app.post("/api/documents", async (req: Request, res: Response) => {
    const documentSchema = z.object({
      projectId: z.number(),
      title: z.string().min(1),
      content: z.string().default(""),
      styleMetrics: z.any().optional(),
      wordCount: z.number().optional()
    });
    
    try {
      const validatedData = documentSchema.parse(req.body);
      
      // If word count wasn't provided, calculate it
      if (!validatedData.wordCount) {
        validatedData.wordCount = countWords(validatedData.content);
      }
      
      const document = await storage.createDocument(validatedData);
      res.status(201).json(document);
    } catch (error) {
      res.status(400).json({ message: "Invalid document data" });
    }
  });
  
  app.put("/api/documents/:id", async (req: Request, res: Response) => {
    const documentSchema = z.object({
      title: z.string().min(1).optional(),
      content: z.string().optional(),
      styleMetrics: z.any().optional(),
      wordCount: z.number().optional()
    });
    
    try {
      const validatedData = documentSchema.parse(req.body);
      
      // If content was updated but word count wasn't, calculate the new word count
      if (validatedData.content && !validatedData.wordCount) {
        validatedData.wordCount = countWords(validatedData.content);
      }
      
      const updatedDocument = await storage.updateDocument(parseInt(req.params.id), validatedData);
      
      if (!updatedDocument) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      res.json(updatedDocument);
    } catch (error) {
      res.status(400).json({ message: "Invalid document data" });
    }
  });
  
  app.delete("/api/documents/:id", async (req: Request, res: Response) => {
    const deleted = await storage.deleteDocument(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ message: "Document not found" });
    }
    res.status(204).send();
  });
  
  // Sources
  app.get("/api/projects/:projectId/sources", async (req: Request, res: Response) => {
    const sources = await storage.getSources(parseInt(req.params.projectId));
    res.json(sources);
  });
  
  app.post("/api/sources", async (req: Request, res: Response) => {
    const sourceSchema = z.object({
      projectId: z.number(),
      type: z.string().min(1),
      name: z.string().min(1),
      content: z.string().optional(),
      url: z.string().optional()
    });
    
    try {
      const validatedData = sourceSchema.parse(req.body);
      const source = await storage.createSource(validatedData);
      res.status(201).json(source);
    } catch (error) {
      res.status(400).json({ message: "Invalid source data" });
    }
  });
  
  app.delete("/api/sources/:id", async (req: Request, res: Response) => {
    const deleted = await storage.deleteSource(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ message: "Source not found" });
    }
    res.status(204).send();
  });
  
  // AI Features
  app.post("/api/ai/generate", async (req: Request, res: Response) => {
    const generateSchema = z.object({
      content: z.string(),
      style: z.any().optional(),
      prompt: z.string().optional(),
      llmProvider: z.enum(["openai", "ollama"]).optional(),
      llmModel: z.string().optional()
    });
    
    try {
      const { content, style, prompt, llmProvider, llmModel } = generateSchema.parse(req.body);
      const generatedText = await generateTextCompletion(content, style, prompt, llmProvider, llmModel);
      res.json({ generated: generatedText });
    } catch (error) {
      res.status(400).json({ message: "Failed to generate text" });
    }
  });
  
  app.post("/api/ai/analyze-style", async (req: Request, res: Response) => {
    const analyzeSchema = z.object({
      content: z.string()
    });
    
    try {
      const { content } = analyzeSchema.parse(req.body);
      const styleAnalysis = await analyzeTextStyle(content);
      res.json({ metrics: styleAnalysis });
    } catch (error) {
      console.error("Error in style analysis route:", error);
      res.status(400).json({ 
        message: "Failed to analyze text style",
        metrics: {
          formality: 50,
          complexity: 50,
          coherence: 50,
          engagement: 50,
          conciseness: 50,
          commonPhrases: ["Error analyzing text"],
          suggestions: ["Try again later"],
          toneAnalysis: "Analysis unavailable due to error",
          readability: {
            score: 50,
            grade: "Analysis unavailable"
          },
          wordDistribution: {
            unique: 0,
            repeated: 0,
            rare: 0
          }
        }
      });
    }
  });
  
  app.post("/api/ai/suggestions", async (req: Request, res: Response) => {
    const suggestSchema = z.object({
      content: z.string(),
      style: z.any().optional(),
      llmProvider: z.enum(["openai", "ollama"]).optional(),
      llmModel: z.string().optional()
    });
    
    try {
      const { content, style, llmProvider, llmModel } = suggestSchema.parse(req.body);
      const suggestions = await generateSuggestions(content, style, llmProvider, llmModel);
      res.json({ suggestions });
    } catch (error) {
      res.status(400).json({ message: "Failed to generate suggestions" });
    }
  });
  
  app.post("/api/ai/process-command", async (req: Request, res: Response) => {
    const commandSchema = z.object({
      content: z.string(),
      command: z.string()
    });
    
    try {
      const { content, command } = commandSchema.parse(req.body);
      
      // Detect if this is a complex editing request that should use the agent
      const isComplexEdit = detectComplexEditingRequest(command);
      
      if (isComplexEdit) {
        // Route to agent for targeted editing
        const { createAgent } = await import("./ai-agent");
        const agent = createAgent(1);
        
        // Update agent context with current content
        await agent.updateContext({
          currentDocument: {
            id: 1, // Temporary - should get from request context
            content: content,
            title: "Current Document"
          },
          editorState: {
            title: "Current Document",
            content: content,
            hasUnsavedChanges: false,
            wordCount: content.trim().split(/\s+/).filter(Boolean).length
          }
        });
        
        // Process the request with the agent for targeted editing
        const agentResponse = await agent.processRequest(`${command} while preserving the rest of the document. Current content: "${content}"`);
        
        // Extract the result from agent tools
        if (agentResponse.toolResults && agentResponse.toolResults.length > 0) {
          const editResult = agentResponse.toolResults.find(r => 
            r.success && r.data && 
            (r.tool === 'edit_current_document' || r.tool === 'replace_current_content' || r.tool === 'edit_text_with_pattern' || r.tool === 'improve_current_text')
          );
          
          if (editResult && editResult.data?.content) {
            return res.json({
              result: editResult.data.content,
              message: editResult.message || "Text edited successfully using agent tools",
              method: "agent_targeted_edit",
              tool_used: editResult.tool
            });
          }
        }
        
        // If we have tool results but no content, try to extract from data
        if (agentResponse.toolResults && agentResponse.toolResults.length > 0) {
          for (const toolResult of agentResponse.toolResults) {
            if (toolResult.success && toolResult.data) {
              // Check various data structures for content
              if (typeof toolResult.data === 'string') {
                return res.json({
                  result: toolResult.data,
                  message: toolResult.message || "Text processed using agent tools",
                  method: "agent_targeted_edit",
                  tool_used: toolResult.tool
                });
              } else if (toolResult.data.result) {
                return res.json({
                  result: toolResult.data.result,
                  message: toolResult.message || "Text processed using agent tools",
                  method: "agent_targeted_edit", 
                  tool_used: toolResult.tool
                });
              }
            }
          }
        }
        
        // Fallback if agent tools didn't work
        console.warn("Agent tools didn't provide expected edit result, falling back to basic processing");
      }
      
      // Default behavior for simple commands
      const result = await processTextCommand(content, command);
      res.json(result);
    } catch (error) {
      console.error("Error in process-command:", error);
      res.status(400).json({ message: "Failed to process command" });
    }
  });
  
  app.post("/api/ai/contextual-help", async (req: Request, res: Response) => {
    const helpSchema = z.object({
      content: z.string(),
      title: z.string()
    });
    
    try {
      const { content, title } = helpSchema.parse(req.body);
      const assistance = await generateContextualAssistance(content, title);
      res.json(assistance);
    } catch (error) {
      res.status(400).json({ message: "Failed to generate contextual help" });
    }
  });
  
  // Web Search
  app.post("/api/search", async (req: Request, res: Response) => {
    const searchSchema = z.object({
      query: z.string(),
      source: z.string().optional()
    });
    
    try {
      const { query, source } = searchSchema.parse(req.body);
      const results = await searchWeb(query, source);
      res.json(results);
    } catch (error) {
      res.status(400).json({ message: "Failed to perform search" });
    }
  });
  
  app.post("/api/scrape", async (req: Request, res: Response) => {
    const scrapeSchema = z.object({
      url: z.string().url()
    });
    
    try {
      const { url } = scrapeSchema.parse(req.body);
      const content = await scrapeWebpage(url);
      res.json(content);
    } catch (error) {
      res.status(400).json({ message: "Failed to scrape webpage" });
    }
  });
  
  // Slash commands for AI assistance
  app.post("/api/ai/slash-command", async (req: Request, res: Response) => {
    const commandSchema = z.object({
      command: z.string(),
      content: z.string(),
      selectionInfo: z.object({
        selectedText: z.string(),
        selectionStart: z.number(),
        selectionEnd: z.number(),
        beforeSelection: z.string().optional(),
        afterSelection: z.string().optional()
      }),
      style: z.any().optional(),
      llmProvider: z.enum(['openai', 'ollama']).optional(),
      llmModel: z.string().optional()
    });
    
    try {
      const validatedData = commandSchema.parse(req.body);
      
      // Import the executeSlashCommand function only when needed
      const { executeSlashCommand } = await import("./slash-commands");
      
      const result = await executeSlashCommand(
        validatedData.command, 
        validatedData.content, 
        validatedData.selectionInfo, 
        validatedData.style,
        validatedData.llmProvider,
        validatedData.llmModel
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Error executing slash command:", error);
      res.status(500).json({ 
        message: "Failed to execute slash command",
        error: error.message || "Unknown error"
      });
    }
  });

  // AI Response parsing endpoint for intelligent content handling
  app.post("/api/ai/parse-response", async (req: Request, res: Response) => {
    const parsingSchema = z.object({
      prompt: z.string(),
      llmProvider: z.enum(['openai', 'ollama']),
      llmModel: z.string(),
      maxTokens: z.number().optional().default(1000)
    });
    
    try {
      const validatedData = parsingSchema.parse(req.body);
      
      let result;
      
      if (validatedData.llmProvider === 'openai') {
        // Use OpenAI for parsing
        result = await generateTextCompletion(
          validatedData.prompt,
          {
            provider: 'openai',
            model: validatedData.llmModel,
            maxTokens: validatedData.maxTokens,
            temperature: 0.1 // Low temperature for consistent parsing
          }
        );
      } else {
        // Use Ollama for parsing
        result = await generateTextCompletion(
          validatedData.prompt,
          {
            provider: 'ollama',
            model: validatedData.llmModel,
            maxTokens: validatedData.maxTokens,
            temperature: 0.1 // Low temperature for consistent parsing
          }
        );
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Error parsing AI response:", error);
      res.status(500).json({ 
        message: "Failed to parse AI response",
        error: error.message || "Unknown error"
      });
    }
  });
  
  // Text analysis routes
  app.post("/api/text/grep", async (req: Request, res: Response) => {
    const { text, pattern } = req.body;
    
    if (!text || !pattern) {
      return res.status(400).json({ message: "Text and pattern are required" });
    }
    
    try {
      const results = grepText(text, pattern);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: "Error processing grep request", error: error.message });
    }
  });
  
  app.post("/api/text/replace", async (req: Request, res: Response) => {
    const { text, oldPattern, newPattern } = req.body;
    
    if (!text || !oldPattern || !newPattern) {
      return res.status(400).json({ message: "Text, oldPattern, and newPattern are required" });
    }
    
    try {
      const result = replaceText(text, oldPattern, newPattern);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Error processing replace request", error: error.message });
    }
  });
  
  app.post("/api/text/analyze", async (req: Request, res: Response) => {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }
    
    try {
      const analysis = analyzeDocument(text);
      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ message: "Error analyzing text", error: error.message });
    }
  });
  
  app.post("/api/text/structure", async (req: Request, res: Response) => {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }
    
    try {
      const structure = extractStructure(text);
      res.json(structure);
    } catch (error: any) {
      res.status(500).json({ message: "Error extracting structure", error: error.message });
    }
  });

  // AI Agent routes
  app.post("/api/agent/request", async (req: Request, res: Response) => {
    const { createAgent } = await import("./ai-agent");
    const { request, context } = req.body;
    
    if (!request) {
      return res.status(400).json({ message: "Request is required" });
    }
    
    try {
      const agent = createAgent(1); // Default user ID
      
      // Update agent context if provided
      if (context) {
        await agent.updateContext(context);
      }
      
      const result = await agent.processRequest(request);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Error processing agent request", error: error.message });
    }
  });
  
  app.post("/api/agent/tool", async (req: Request, res: Response) => {
    const { createAgent } = await import("./ai-agent");
    const { toolName, parameters, context } = req.body;
    
    if (!toolName) {
      return res.status(400).json({ message: "Tool name is required" });
    }
    
    try {
      const agent = createAgent(1); // Default user ID
      
      // Update agent context if provided
      if (context) {
        await agent.updateContext(context);
      }
      
      const result = await agent.executeTool(toolName, parameters || {});
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Error executing tool", error: error.message });
    }
  });
  
  app.get("/api/agent/tools", async (req: Request, res: Response) => {
    const { createAgent } = await import("./ai-agent");
    
    try {
      const agent = createAgent(1);
      const tools = agent.getAvailableTools();
      res.json({ tools });
    } catch (error: any) {
      res.status(500).json({ message: "Error getting tools", error: error.message });
    }
  });
  
  app.get("/api/agent/context", async (req: Request, res: Response) => {
    const { createAgent } = await import("./ai-agent");
    
    try {
      const agent = createAgent(1);
      const summary = agent.getContextSummary();
      res.json({ summary });
    } catch (error: any) {
      res.status(500).json({ message: "Error getting context", error: error.message });
    }
  });

  // ENHANCED: Maximum capability autonomous agent workflow
  app.post("/api/agent/intelligent-request", async (req: Request, res: Response) => {
    const { createAgent } = await import("./ai-agent");
    const { 
      request, 
      context, 
      autonomyLevel = 'moderate', 
      maxExecutionTime = 300000,
      llmProvider = 'openai',
      llmModel 
    } = req.body; // 5 min default
    
    if (!request) {
      return res.status(400).json({ message: "Request is required" });
    }
    
    try {
      const agent = createAgent(1); // Default user ID
      
      // Set autonomy level for maximum capability
      if (autonomyLevel) {
        agent.setAutonomyLevel(autonomyLevel);
      }
      
      // Update agent context if provided, including LLM selection
      const updatedContext = {
        ...context,
        llmProvider,
        llmModel
      };
      
      await agent.updateContext(updatedContext);
      
      const startTime = Date.now();
      
      // Step 1: Get initial agent response with multi-step capability
      console.log(`🤖 Processing intelligent request with ${autonomyLevel} autonomy level`);
      const agentResponse = await agent.processRequest(request);
      
      // Step 2: If the agent used tools, process their results for better output
      let finalResponse = agentResponse.content;
      let suggestedActions: string[] = [];
      let additionalToolCalls: any[] = [];
      
      if (agentResponse.toolResults && agentResponse.toolResults.length > 0) {
        console.log(`🛠️  Processing ${agentResponse.toolResults.length} tool results`);
        
        // Convert tool results to the format expected by processToolResults
        const toolExecutions = agentResponse.toolResults.map((result, index) => ({
          toolName: result.tool || `tool_${index}`,
          parameters: {}, // We don't have the original parameters
          result: result
        }));
        
        try {
          const synthesis = await agent.processToolResults(request, toolExecutions);
          finalResponse = synthesis.synthesizedResponse || finalResponse;
          suggestedActions = synthesis.suggestedActions || [];
          additionalToolCalls = synthesis.additionalToolCalls || [];
        } catch (synthError) {
          console.warn('Failed to synthesize tool results, using basic response:', synthError);
        }
      }
      
      const totalDuration = Date.now() - startTime;
      
      // Step 3: Return comprehensive response
      const responseData = {
        response: finalResponse,
        plan: "Analyzed request and executed appropriate tools based on context",
        autonomousExecution: {
          completed: true,
          iterations: 1,
          duration: totalDuration,
          autonomyLevel
        },
        toolsExecuted: agentResponse.toolResults.map(result => ({
          tool: result.tool || 'unknown',
          success: result.success,
          message: result.message || (result.success ? 'Executed successfully' : result.error),
          data: result.data
        })),
        suggestedActions: suggestedActions,
        additionalToolCalls: additionalToolCalls,
        executionDetails: {
          toolsPlanned: agentResponse.toolResults.length,
          toolsExecuted: agentResponse.toolResults.length,
          successfulTools: agentResponse.toolResults.filter(r => r.success).length,
          failedTools: agentResponse.toolResults.filter(r => !r.success).length,
          successRate: agentResponse.toolResults.length > 0 
            ? ((agentResponse.toolResults.filter(r => r.success).length / agentResponse.toolResults.length) * 100).toFixed(1) + '%'
            : '100%',
          averageToolTime: agentResponse.toolResults.length > 0 
            ? (totalDuration / agentResponse.toolResults.length).toFixed(0) + 'ms'
            : '0ms'
        },
        performance: {
          totalDuration,
          iterationsCompleted: 1,
          maxIterationsAllowed: 1,
          executionEfficiency: agentResponse.toolResults.length > 0 
            ? ((agentResponse.toolResults.filter(r => r.success).length / agentResponse.toolResults.length) * 100).toFixed(1) + '%'
            : '100%',
          autonomyLevel,
          tokensUsed: agentResponse.tokensUsed
        }
      };

      res.json(responseData);
      
    } catch (error: any) {
      console.error("Error in intelligent agent request:", error);
      res.status(500).json({ 
        message: "Error processing intelligent agent request", 
        error: error.message,
        response: "I encountered an issue while processing your request. Please try again with a simpler request.",
        fallbackResponse: "I encountered an issue during execution. The system attempted to complete your request but ran into technical difficulties. Please try again with a more specific request."
      });
    }
  });

  return httpServer;
}

// Helper method for determining chained tools
async function determineChainedTools(previousTool: string, result: any, context: any, agent: any): Promise<any[]> {
  const chainedTools: any[] = [];
  
  // Smart chaining based on tool results and context
  if (previousTool === 'web_search' && result.success && result.data?.results?.length > 0) {
    const topResult = result.data.results[0];
    if (topResult.url) {
      chainedTools.push({
        tool: 'scrape_webpage',
        params: { url: topResult.url },
        reasoning: 'Auto-scraping top search result for detailed content'
      });
      
      // If we have a current project, also save the source
      if (context?.currentProject) {
        chainedTools.push({
          tool: 'save_source',
          params: {
            projectId: context.currentProject.id,
            type: 'url',
            name: topResult.title || 'Web Source',
            url: topResult.url,
            content: '' // Will be filled by scrape result
          },
          reasoning: 'Auto-saving research source to current project'
        });
      }
    }
  }
  
  if (previousTool === 'scrape_webpage' && result.success && result.data?.content) {
    // If we scraped content, analyze it
    chainedTools.push({
      tool: 'analyze_document_structure',
      params: { text: result.data.content.substring(0, 5000) }, // First 5k chars
      reasoning: 'Auto-analyzing scraped content structure'
    });
  }
  
  if (previousTool === 'create_document' && result.success && context?.currentProject) {
    // If we created a document, analyze its style
    chainedTools.push({
      tool: 'analyze_writing_style',
      params: { documentId: result.data.id },
      reasoning: 'Auto-analyzing newly created document style'
    });
  }
  
  if (previousTool === 'analyze_writing_style' && result.success && context?.currentDocument) {
    // If we analyzed style, get improvement suggestions
    chainedTools.push({
      tool: 'get_writing_suggestions',
      params: { 
        text: context.currentDocument.content,
        type: 'improvement'
      },
      reasoning: 'Auto-generating improvement suggestions based on style analysis'
    });
  }
  
  return chainedTools;
}

// Helper method for determining if execution should continue
async function shouldContinueExecution(
  iterationExecutions: any[], 
  synthesis: any, 
  currentIteration: number, 
  maxIterations: number,
  agent: any
): Promise<{ continue: boolean; reason: string }> {
  
  // Check success rate
  const successRate = iterationExecutions.filter(exec => exec.result.success).length / iterationExecutions.length;
  if (successRate < 0.3) {
    return { continue: false, reason: 'Low success rate, stopping to prevent further failures' };
  }
  
  // Check if we have more tools to execute
  if (!synthesis.additionalToolCalls || synthesis.additionalToolCalls.length === 0) {
    return { continue: false, reason: 'No additional tools suggested, task appears complete' };
  }
  
  // Check iteration limit
  if (currentIteration >= maxIterations - 1) {
    return { continue: false, reason: 'Approaching maximum iteration limit' };
  }
  
  // Check if we're making progress
  if (currentIteration > 5) {
    const recentExecutions = iterationExecutions.slice(-3);
    const recentSuccessRate = recentExecutions.filter(exec => exec.result.success).length / recentExecutions.length;
    if (recentSuccessRate < 0.5) {
      return { continue: false, reason: 'Recent execution success rate declining' };
    }
  }
  
  return { continue: true, reason: 'Continuing autonomous execution with good progress' };
}

// Helper function to assess user experience quality
function assessUserExperience(finalSynthesis: any, allToolExecutions: any[], suggestedActions: string[]): string {
  const hasToolResults = finalSynthesis?.allToolResults && Object.keys(finalSynthesis.allToolResults).length > 0;
  const hasResearchFindings = !!finalSynthesis?.researchFindings;
  const hasActionableSteps = suggestedActions.length > 0;
  const hasContinuousOperation = !!finalSynthesis?.continuousOperationPlan;
  const toolsExecuted = allToolExecutions.length;
  
  if (hasToolResults && hasResearchFindings && hasActionableSteps && hasContinuousOperation) {
    return 'EXCELLENT';
  } else if (hasToolResults && (hasResearchFindings || hasActionableSteps)) {
    return 'GOOD';
  } else if (toolsExecuted > 0) {
    return 'BASIC';
  } else {
    return 'POOR';
  }
}

// Helper function to detect complex editing requests
function detectComplexEditingRequest(command: string): boolean {
  const complexEditPatterns = [
    /rewrite\s+(the\s+)?(first|second|third|fourth|fifth|\d+(?:st|nd|rd|th)?)\s+paragraph/i,
    /edit\s+(the\s+)?(first|second|third|fourth|fifth|\d+(?:st|nd|rd|th)?)\s+paragraph/i,
    /replace\s+(the\s+)?(first|second|third|fourth|fifth|\d+(?:st|nd|rd|th)?)\s+paragraph/i,
    /translate\s+(the\s+)?(first|second|third|fourth|fifth|\d+(?:st|nd|rd|th)?)\s+paragraph/i,
    /change\s+(the\s+)?(first|second|third|fourth|fifth|\d+(?:st|nd|rd|th)?)\s+paragraph/i,
    /modify\s+(the\s+)?(first|second|third|fourth|fifth|\d+(?:st|nd|rd|th)?)\s+paragraph/i,
    /improve\s+(the\s+)?(first|second|third|fourth|fifth|\d+(?:st|nd|rd|th)?)\s+paragraph/i,
    /rewrite.*paragraph.*\d+/i,
    /edit.*paragraph.*\d+/i,
    /in\s+(spanish|español|french|français|german|deutsch|italian|italiano|portuguese|português)/i,
    /translate.*to\s+(spanish|español|french|français|german|deutsch|italian|italiano|portuguese|português)/i,
    /find\s+and\s+replace/i,
    /replace\s+all\s+(instances|occurrences)/i,
    /fix\s+(spelling|grammar)\s+mistakes/i,
    /correct\s+(spelling|grammar)/i
  ];
  
  return complexEditPatterns.some(pattern => pattern.test(command));
}
