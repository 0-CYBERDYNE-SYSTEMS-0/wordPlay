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
import { WebSocketServer } from "ws";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Set up WebSocket server for real-time suggestions
  const wss = new WebSocketServer({ server: httpServer });
  
  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");
    
    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "content_update") {
          // When content is updated, generate suggestions
          const suggestions = await generateSuggestions(data.content, data.style);
          ws.send(JSON.stringify({
            type: "suggestions",
            suggestions
          }));
        }
      } catch (error) {
        console.error("WebSocket error:", error);
      }
    });
    
    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });
  });

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
      const validatedData = projectSchema.parse(req.body);
      const project = await storage.createProject(validatedData);
      res.status(201).json(project);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data" });
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
      prompt: z.string().optional()
    });
    
    try {
      const { content, style, prompt } = generateSchema.parse(req.body);
      const generatedText = await generateTextCompletion(content, style, prompt);
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
      res.json(styleAnalysis);
    } catch (error) {
      res.status(400).json({ message: "Failed to analyze text style" });
    }
  });
  
  app.post("/api/ai/suggestions", async (req: Request, res: Response) => {
    const suggestSchema = z.object({
      content: z.string(),
      style: z.any().optional()
    });
    
    try {
      const { content, style } = suggestSchema.parse(req.body);
      const suggestions = await generateSuggestions(content, style);
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
  
  // Text Operations
  app.post("/api/text/grep", async (req: Request, res: Response) => {
    const grepSchema = z.object({
      content: z.string(),
      pattern: z.string()
    });
    
    try {
      const { content, pattern } = grepSchema.parse(req.body);
      const results = grepText(content, pattern);
      res.json(results);
    } catch (error) {
      res.status(400).json({ message: "Failed to perform grep operation" });
    }
  });
  
  app.post("/api/text/replace", async (req: Request, res: Response) => {
    const replaceSchema = z.object({
      content: z.string(),
      oldPattern: z.string(),
      newPattern: z.string()
    });
    
    try {
      const { content, oldPattern, newPattern } = replaceSchema.parse(req.body);
      const results = replaceText(content, oldPattern, newPattern);
      res.json(results);
    } catch (error) {
      res.status(400).json({ message: "Failed to perform replace operation" });
    }
  });
  
  app.post("/api/text/analyze", async (req: Request, res: Response) => {
    const analyzeSchema = z.object({
      content: z.string()
    });
    
    try {
      const { content } = analyzeSchema.parse(req.body);
      const analysis = analyzeDocument(content);
      res.json(analysis);
    } catch (error) {
      res.status(400).json({ message: "Failed to analyze document" });
    }
  });
  
  app.post("/api/text/structure", async (req: Request, res: Response) => {
    const structureSchema = z.object({
      content: z.string()
    });
    
    try {
      const { content } = structureSchema.parse(req.body);
      const structure = extractStructure(content);
      res.json(structure);
    } catch (error) {
      res.status(400).json({ message: "Failed to extract document structure" });
    }
  });

  return httpServer;
}
