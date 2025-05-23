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
      style: z.string().min(1)
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
      const result = await processTextCommand(content, command);
      res.json(result);
    } catch (error) {
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
        beforeSelection: z.string(),
        afterSelection: z.string()
      }),
      style: z.any().optional()
    });
    
    try {
      const validatedData = commandSchema.parse(req.body);
      
      // Import the executeSlashCommand function only when needed
      const { executeSlashCommand } = await import("./slash-commands");
      
      const result = await executeSlashCommand(
        validatedData.command, 
        validatedData.content, 
        validatedData.selectionInfo, 
        validatedData.style
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

  return httpServer;
}
