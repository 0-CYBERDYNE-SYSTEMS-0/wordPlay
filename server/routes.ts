import type { Express, Request, Response } from "express";
import express from "express";
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
  processAIContentCommand
} from "./ai-content-generation";
import { 
  searchWeb,
  SearchError,
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
import {
  registerAuthRoutes,
  requireAuth,
  resolveUserId,
  isAuthEnabled,
} from "./auth";
import { registerUploadRoute } from "./upload";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // When auth is enabled, ownership is enforced: a user may only read/write
  // projects they own (documents and sources inherit ownership via project).
  const ownsProject = async (projectId: number, req: Request): Promise<boolean> => {
    if (!isAuthEnabled()) return true;
    const project = await storage.getProject(projectId);
    return !!project && project.userId === resolveUserId(req);
  };

  // Auth routes first so they stay reachable without a session, then the
  // guard for everything else under /api and /uploads. Pass-through when
  // AUTH_PASSWORD is unset (single-user local mode).
  registerAuthRoutes(app);
  app.use("/api", requireAuth);
  app.use("/uploads", requireAuth);

  // AI clients initialize lazily from server env — see ai-content-generation.ts.

  // Serve uploaded images
  app.use('/uploads', express.static('public/uploads'));

  // Bring-your-own image upload (paste / drag-drop in the editor)
  registerUploadRoute(app);

  // We've replaced WebSockets with direct API calls
  // This simplifies the architecture and avoids connection issues

  // API Routes
  // Projects
  app.get("/api/projects", async (req: Request, res: Response) => {
    const userId = resolveUserId(req);
    const projects = await storage.getProjects(userId);
    res.json(projects);
  });

  app.get("/api/projects/:id", async (req: Request, res: Response) => {
    const project = await storage.getProject(parseInt(req.params.id));
    if (!project || !(await ownsProject(project.id, req))) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.json(project);
  });

  app.post("/api/projects", async (req: Request, res: Response) => {
    const projectSchema = z.object({
      userId: z.number().default(1), // Overridden server-side below
      name: z.string().min(1),
      type: z.string().min(1),
      style: z.string().min(1).default("Professional") // Default style
    });

    try {
      console.log("Received project data:", req.body); // Debug log
      const validatedData = projectSchema.parse(req.body);
      validatedData.userId = resolveUserId(req); // The session user owns what they create
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
      if (!(await ownsProject(parseInt(req.params.id), req))) {
        return res.status(404).json({ message: "Project not found" });
      }
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
    if (!(await ownsProject(parseInt(req.params.id), req))) {
      return res.status(404).json({ message: "Project not found" });
    }
    const deleted = await storage.deleteProject(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.status(204).send();
  });
  
  // Documents
  app.get("/api/projects/:projectId/documents", async (req: Request, res: Response) => {
    if (!(await ownsProject(parseInt(req.params.projectId), req))) {
      return res.status(404).json({ message: "Project not found" });
    }
    const documents = await storage.getDocuments(parseInt(req.params.projectId));
    res.json(documents);
  });
  
  app.get("/api/documents/:id", async (req: Request, res: Response) => {
    const document = await storage.getDocument(parseInt(req.params.id));
    if (!document || !(await ownsProject(document.projectId, req))) {
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
      if (!(await ownsProject(validatedData.projectId, req))) {
        return res.status(404).json({ message: "Project not found" });
      }
      
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
      wordCount: z.number().optional(),
      // Optimistic concurrency: the updatedAt the client based its edit on.
      // Omit to force the write (explicit "overwrite" resolution).
      ifUpdatedAt: z.string().optional()
    });

    try {
      const { ifUpdatedAt, ...validatedData } = documentSchema.parse(req.body);
      const id = parseInt(req.params.id);
      const existing = await storage.getDocument(id);
      if (!existing || !(await ownsProject(existing.projectId, req))) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Conflict check: if the document changed since the client last saw it,
      // refuse the blind overwrite instead of silently clobbering the other editor.
      if (ifUpdatedAt) {
        const serverUpdatedAt = new Date(existing.updatedAt).toISOString();
        const clientUpdatedAt = new Date(ifUpdatedAt).toISOString();
        if (serverUpdatedAt !== clientUpdatedAt) {
          return res.status(409).json({
            message: "This document changed on the server while you were editing.",
            currentDocument: existing
          });
        }
      }

      // If content was updated but word count wasn't, calculate the new word count
      if (validatedData.content && !validatedData.wordCount) {
        validatedData.wordCount = countWords(validatedData.content);
      }

      const updatedDocument = await storage.updateDocument(id, validatedData);

      if (!updatedDocument) {
        return res.status(404).json({ message: "Document not found" });
      }

      res.json(updatedDocument);
    } catch (error) {
      res.status(400).json({ message: "Invalid document data" });
    }
  });
  
  app.delete("/api/documents/:id", async (req: Request, res: Response) => {
    const document = await storage.getDocument(parseInt(req.params.id));
    if (!document || !(await ownsProject(document.projectId, req))) {
      return res.status(404).json({ message: "Document not found" });
    }
    const deleted = await storage.deleteDocument(document.id);
    if (!deleted) {
      return res.status(404).json({ message: "Document not found" });
    }
    res.status(204).send();
  });
  
  // Sources
  app.get("/api/projects/:projectId/sources", async (req: Request, res: Response) => {
    if (!(await ownsProject(parseInt(req.params.projectId), req))) {
      return res.status(404).json({ message: "Project not found" });
    }
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
      if (!(await ownsProject(validatedData.projectId, req))) {
        return res.status(404).json({ message: "Project not found" });
      }
      const source = await storage.createSource(validatedData);
      res.status(201).json(source);
    } catch (error) {
      res.status(400).json({ message: "Invalid source data" });
    }
  });
  
  app.delete("/api/sources/:id", async (req: Request, res: Response) => {
    const source = await storage.getSource(parseInt(req.params.id));
    if (!source || !(await ownsProject(source.projectId, req))) {
      return res.status(404).json({ message: "Source not found" });
    }
    const deleted = await storage.deleteSource(source.id);
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
      llmProvider: z.enum(["openai", "ollama", "gemini", "kimi", "custom"]).optional(),
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
      content: z.string(),
      llmProvider: z.enum(["openai", "ollama", "gemini", "kimi", "custom"]).optional(),
      llmModel: z.string().optional()
    });

    try {
      const { content, llmProvider, llmModel } = analyzeSchema.parse(req.body);
      const styleAnalysis = await analyzeTextStyle(content, llmProvider, llmModel);
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
      llmProvider: z.enum(["openai", "ollama", "gemini", "kimi", "custom"]).optional(),
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
      command: z.string(),
      llmProvider: z.enum(["openai", "ollama", "gemini", "kimi", "custom"]).optional(),
      llmModel: z.string().optional()
    });

    try {
      const { content, command, llmProvider, llmModel } = commandSchema.parse(req.body);
      
      // Detect if this is a complex editing request that should use the agent
      const isComplexEdit = detectComplexEditingRequest(command);
      
      if (isComplexEdit) {
        // Route to agent for targeted editing
        const { createAgent } = await import("./ai-agent");
        const agent = createAgent(resolveUserId(req));
        
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
      const result = await processTextCommand(content, command, llmProvider, llmModel);
      res.json(result);
    } catch (error) {
      console.error("Error in process-command:", error);
      res.status(400).json({ message: "Failed to process command" });
    }
  });

  app.post("/api/ai/contextual-help", async (req: Request, res: Response) => {
    const helpSchema = z.object({
      content: z.string(),
      title: z.string(),
      llmProvider: z.enum(["openai", "ollama", "gemini", "kimi", "custom"]).optional(),
      llmModel: z.string().optional()
    });

    try {
      const { content, title, llmProvider, llmModel } = helpSchema.parse(req.body);
      const assistance = await generateContextualAssistance(content, title, llmProvider, llmModel);
      res.json(assistance);
    } catch (error) {
      res.status(400).json({ message: "Failed to generate contextual help" });
    }
  });

  // Web Search
  app.post("/api/search", async (req: Request, res: Response) => {
    const searchSchema = z.object({
      query: z.string(),
      source: z.string().optional(),
      model: z.string().optional()
    });

    try {
      const { query, source, model } = searchSchema.parse(req.body);
      const results = await searchWeb(query, source, { model });
      res.json(results);
    } catch (error: any) {
      console.error("Error in search route:", error.message);
      const statusCode = error.statusCode || (error instanceof SearchError ? 502 : 400);
      res.status(statusCode).json({ message: error.message || "Failed to perform search" });
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
      // Image generation settings arrive as top-level fields from the client
      imageProvider: z.string().optional(),
      imageModel: z.string().optional(),
      imageSize: z.string().optional(),
      imageSteps: z.number().optional(),
      llmProvider: z.enum(['openai', 'ollama', 'gemini', 'kimi', 'custom']).optional(),
      llmModel: z.string().optional(),
      includeContext: z.boolean().optional(),
      projectId: z.number().optional(),
      userId: z.number().optional()
    });

    try {
      const validatedData = commandSchema.parse(req.body);
      // Custom commands are looked up per user — always use the session user.
      validatedData.userId = resolveUserId(req);

      // Check if this is an AI content generation command
      const aiContentCommands = ['table', 'chart', 'image'];
      if (aiContentCommands.includes(validatedData.command)) {
        console.log('🎯 Processing AI content command:', validatedData.command);
        console.log('📋 Command data:', {
          command: validatedData.command,
          contentLength: validatedData.content.length,
          selectedTextLength: validatedData.selectionInfo.selectedText.length,
          llmProvider: validatedData.llmProvider,
          llmModel: validatedData.llmModel,
          style: validatedData.style
        });

        try {
          const result = await processAIContentCommand(
            validatedData.command,
            validatedData.content,
            validatedData.selectionInfo,
            validatedData.llmProvider || 'openai',
            validatedData.llmModel || 'gpt-4',
            validatedData.style, // Pass style/parameters from request
            {
              // Honor the user's Settings → AI → Image Generation choice:
              // 'local' = mflux bridge, 'gemini' = cloud, 'custom' = any
              // OpenAI-compatible images endpoint (IMAGE_API_URL in .env).
              // Top-level fields win; fall back to legacy style-embedded ones.
              provider: (validatedData.imageProvider || validatedData.style?.imageProvider || 'local') as any,
              imageModel: validatedData.imageModel || validatedData.style?.imageModel,
              imageSize: validatedData.imageSize || validatedData.style?.imageSize,
              steps: validatedData.imageSteps ?? validatedData.style?.imageSteps,
            }
          );

          console.log('✅ AI content command completed, result length:', result.length);
          return res.json({ result });
        } catch (aiError: any) {
          console.error("❌ AI content generation error:", aiError);
          return res.status(500).json({
            message: "Failed to generate AI content",
            error: aiError.message || "Unknown AI content generation error"
          });
        }
      }

      // Import the executeSlashCommand function for regular commands
      const { executeSlashCommand } = await import("./slash-commands-new");

      const result = await executeSlashCommand(
        validatedData.command,
        validatedData.content,
        validatedData.selectionInfo,
        validatedData.style,
        validatedData.llmProvider,
        validatedData.llmModel,
        validatedData.includeContext || false,
        validatedData.projectId,
        validatedData.userId
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Error executing slash command:", error);
      
      // Provide specific error messages and troubleshooting steps
      let errorMessage = "Failed to execute slash command";
      let troubleshooting: string[] = [];
      let statusCode = 500;
      
      if (error.message?.includes('OpenAI API key')) {
        errorMessage = "OpenAI configuration issue";
        troubleshooting = [
          "Set your OpenAI API key: export OPENAI_API_KEY=your_api_key",
          "Verify your API key at https://platform.openai.com/api-keys",
          "Check your OpenAI account has sufficient credits"
        ];
        statusCode = 401;
      } else if (error.message?.includes('Ollama')) {
        errorMessage = "Ollama connection issue";
        troubleshooting = [
          "Start Ollama server: ollama serve",
          "Pull required model: ollama pull qwen3:4b",
          "Check Ollama is running on port 11434: curl http://localhost:11434/api/tags",
          "Set custom Ollama URL if needed: export OLLAMA_URL=http://your-ollama-server:11434"
        ];
        statusCode = 503;
      } else if (error.message?.includes('rate limit')) {
        errorMessage = "API rate limit exceeded";
        troubleshooting = [
          "Wait a few minutes before trying again",
          "Check your API usage limits",
          "Consider upgrading your API plan",
          "Try switching to Ollama as a fallback"
        ];
        statusCode = 429;
      } else if (error.message?.includes('model')) {
        errorMessage = "AI model issue";
        troubleshooting = [
          "Try using a different model",
          "For OpenAI: use gpt-4o-mini or gpt-3.5-turbo",
          "For Ollama: ensure the model is downloaded with 'ollama pull model_name'",
          "Check model availability in your API account"
        ];
        statusCode = 400;
      } else if (error.message?.includes('timeout') || error.message?.includes('ECONNREFUSED')) {
        errorMessage = "Connection timeout or server unavailable";
        troubleshooting = [
          "Check your internet connection",
          "Verify the AI service is accessible",
          "Try again in a few moments",
          "Switch to an alternative AI provider"
        ];
        statusCode = 503;
      } else if (error.message?.includes('All AI providers failed')) {
        errorMessage = "All AI services are unavailable";
        troubleshooting = [
          "Check both OpenAI API key and Ollama server status",
          "Use the /api/ai/test endpoint to diagnose connectivity",
          "Ensure at least one AI service is properly configured",
          "Check the server logs for detailed error information"
        ];
        statusCode = 503;
      }
      
      res.status(statusCode).json({ 
        message: errorMessage,
        error: error.message || "Unknown error",
        troubleshooting,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Streaming slash command endpoint — pipes Ollama tokens to the client as
  // NDJSON lines so the editor renders text live instead of waiting for the
  // full completion. Each line: {"chunk":"..."} for text, and a final
  // {"done":true,"behavior":{...}} line with the same metadata shape as the
  // non-streaming route.
  app.post("/api/ai/slash-command/stream", async (req: Request, res: Response) => {
    const streamSchema = z.object({
      command: z.string(),
      content: z.string(),
      selectionInfo: z.object({
        selectedText: z.string(),
        selectionStart: z.number(),
        selectionEnd: z.number(),
        beforeSelection: z.string().optional(),
        afterSelection: z.string().optional()
      }),
      llmModel: z.string().optional(),
      includeContext: z.boolean().optional(),
      projectId: z.number().optional(),
      userId: z.number().optional()
    });

    try {
      const validatedData = streamSchema.parse(req.body);
      const { streamCoreCommand } = await import("./slash-commands-minimal");

      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');

      // Only core commands stream (Ollama-only for now; OpenAI streaming can
      // be added later). AI content commands (table/chart/image) fall back to
      // the non-streaming route from the client.
      const coreCommands = ['continue', 'improve', 'fix', 'bullets', 'table', 'format'];
      if (!coreCommands.includes(validatedData.command)) {
        res.write(JSON.stringify({ done: true, behavior: { result: '', message: `Streaming not supported for /${validatedData.command}`, contextOnly: true } }) + '\n');
        res.end();
        return;
      }
      if (!validatedData.llmModel) {
        res.write(JSON.stringify({ done: true, behavior: { result: '', message: 'No model specified for streaming.', contextOnly: true } }) + '\n');
        res.end();
        return;
      }

      const generator = streamCoreCommand(
        validatedData.command as any,
        validatedData.content,
        validatedData.selectionInfo,
        validatedData.llmModel,
        validatedData.includeContext || false,
        validatedData.projectId
      );

      for await (const item of generator) {
        if (typeof item === 'string') {
          res.write(JSON.stringify({ chunk: item }) + '\n');
        } else {
          res.write(JSON.stringify({ done: true, behavior: item.behavior }) + '\n');
        }
      }
      res.end();
    } catch (error: any) {
      console.error("Error streaming slash command:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: error.message || "Failed to stream slash command" });
      } else {
        res.write(JSON.stringify({ done: true, behavior: { result: '', message: error.message || 'Stream failed', contextOnly: true } }) + '\n');
        res.end();
      }
    }
  });

  // AI Response parsing endpoint for intelligent content handling
  app.post("/api/ai/parse-response", async (req: Request, res: Response) => {
    const parsingSchema = z.object({
      prompt: z.string(),
      llmProvider: z.enum(['openai', 'ollama', 'gemini', 'kimi', 'custom']),
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

  // AI Connection test endpoint for debugging
  // Ollama model list, proxied through the server so remote devices on the
  // network see the server host's Ollama (a browser's localhost is its own).
  app.get("/api/ai/ollama/models", async (req: Request, res: Response) => {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        return res.status(502).json({
          message: `Ollama at ${ollamaUrl} responded HTTP ${response.status}`
        });
      }
      const data = await response.json();
      res.json({ models: data.models || [] });
    } catch (error: any) {
      res.status(502).json({
        message: `Could not reach Ollama at ${ollamaUrl} — is it running on the server host?`
      });
    }
  });

  app.get("/api/ai/test", async (req: Request, res: Response) => {
    try {
      const { testAIConnections, testGeminiConnection } = await import("./openai");
      const connectionStatus = await testAIConnections();
      const geminiStatus = await testGeminiConnection();

      // Reachability for every OpenAI-compatible cloud provider, straight
      // from the registry (own key + endpoint per provider).
      const { allProviders, resolveProviderCredentials } = await import("./provider-registry");
      const providerStatuses: Record<string, any> = {};
      for (const def of allProviders()) {
        if (def.kind !== 'openai-compatible') continue;
        const { apiKey, baseURL } = resolveProviderCredentials(def.id);
        const configured = !!(def.apiKeyEnv && process.env[def.apiKeyEnv]);
        try {
          const res = await fetch(`${baseURL.replace(/\/$/, '')}/models`, {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            signal: AbortSignal.timeout(8000),
          });
          providerStatuses[def.id] = { available: res.ok, httpStatus: res.status, configured, label: def.label };
        } catch (err: any) {
          providerStatuses[def.id] = { available: false, configured, label: def.label, error: err?.message };
        }
      }

      res.json({
        status: "success",
        timestamp: new Date().toISOString(),
        ...connectionStatus,
        gemini: geminiStatus,
        providers: providerStatuses,
        troubleshooting: {
          openai: connectionStatus.openai.available ? null : [
            "Set your OpenAI API key: export OPENAI_API_KEY=your_api_key",
            "Verify your API key at https://platform.openai.com/api-keys",
            "Check your account has sufficient credits",
            "Ensure your API key has the correct permissions"
          ],
          ollama: connectionStatus.ollama.available ? null : [
            "Install Ollama from https://ollama.ai",
            "Start Ollama server: ollama serve",
            "Pull a model: ollama pull qwen3:4b",
            "Check server status: curl http://localhost:11434/api/tags",
            "Set custom URL if needed: export OLLAMA_URL=http://your-server:11434"
          ],
          gemini: geminiStatus.available ? null : [
            "Set your Gemini API key: export GEMINI_API_KEY=your_key (or enter it in Settings → AI)",
            "Get a key at https://aistudio.google.com/apikey"
          ]
        }
      });
    } catch (error: any) {
      console.error("Error testing AI connections:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to test AI connections",
        error: error.message,
        timestamp: new Date().toISOString(),
        troubleshooting: [
          "Check if the server can access external APIs",
          "Verify network connectivity",
          "Check firewall settings",
          "Ensure environment variables are properly set"
        ]
      });
    }
  });

  // Custom Command routes
  app.get("/api/custom-commands", async (req: Request, res: Response) => {
    const userId = resolveUserId(req);
    try {
      const commands = await storage.getCustomCommands(userId);
      res.json(commands);
    } catch (error: any) {
      console.error("Error fetching custom commands:", error);
      res.status(500).json({ message: "Failed to fetch custom commands", error: error.message });
    }
  });

  app.post("/api/custom-commands", async (req: Request, res: Response) => {
    const userId = resolveUserId(req);
    
    const commandSchema = z.object({
      name: z.string().min(1, "Name is required"),
      trigger: z.string().min(2, "Trigger must be at least 2 characters").startsWith("/", "Trigger must start with /"),
      promptTemplate: z.string().min(1, "Prompt template is required"),
      description: z.string().optional(),
      isActive: z.boolean().optional().default(true)
    });

    try {
      const validatedData = commandSchema.parse(req.body);
      
      // Import validation function
      const { validateCustomCommand } = await import("./slash-commands-new");
      const validation = validateCustomCommand(validatedData);
      
      if (!validation.isValid) {
        return res.status(400).json({ 
          message: "Invalid custom command",
          errors: validation.errors 
        });
      }

      const command = await storage.createCustomCommand({
        ...validatedData,
        userId
      });
      
      res.json(command);
    } catch (error: any) {
      console.error("Error creating custom command:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors.map((e: any) => e.message)
        });
      }
      res.status(500).json({ message: "Failed to create custom command", error: error.message });
    }
  });

  app.put("/api/custom-commands/:id", async (req: Request, res: Response) => {
    const commandId = parseInt(req.params.id);
    
    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      trigger: z.string().min(2).startsWith("/").optional(), 
      promptTemplate: z.string().min(1).optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional()
    });

    try {
      const validatedData = updateSchema.parse(req.body);
      
      if (validatedData.trigger) {
        const { validateCustomCommand } = await import("./slash-commands-new");
        const validation = validateCustomCommand({
          name: validatedData.name || "temp",
          trigger: validatedData.trigger,
          promptTemplate: validatedData.promptTemplate || "temp"
        });
        
        if (!validation.isValid) {
          return res.status(400).json({ 
            message: "Invalid custom command", 
            errors: validation.errors 
          });
        }
      }

      const existingCommand = await storage.getCustomCommand(commandId);
      if (!existingCommand || (isAuthEnabled() && existingCommand.userId !== resolveUserId(req))) {
        return res.status(404).json({ message: "Custom command not found" });
      }
      const command = await storage.updateCustomCommand(commandId, validatedData);
      
      if (!command) {
        return res.status(404).json({ message: "Custom command not found" });
      }
      
      res.json(command);
    } catch (error: any) {
      console.error("Error updating custom command:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors.map((e: any) => e.message)
        });
      }
      res.status(500).json({ message: "Failed to update custom command", error: error.message });
    }
  });

  app.delete("/api/custom-commands/:id", async (req: Request, res: Response) => {
    const commandId = parseInt(req.params.id);
    
    try {
      const existingCommand = await storage.getCustomCommand(commandId);
      if (!existingCommand || (isAuthEnabled() && existingCommand.userId !== resolveUserId(req))) {
        return res.status(404).json({ message: "Custom command not found" });
      }
      const deleted = await storage.deleteCustomCommand(commandId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Custom command not found" });
      }
      
      res.json({ message: "Custom command deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting custom command:", error);
      res.status(500).json({ message: "Failed to delete custom command", error: error.message });
    }
  });

  // Get available commands (core + custom) for autocomplete/UI
  app.get("/api/available-commands", async (req: Request, res: Response) => {
    const userId = 1; // Using default user for now
    
    try {
      const { getAvailableCommands } = await import("./slash-commands-new");
      const commands = await getAvailableCommands(userId);
      res.json(commands);
    } catch (error: any) {
      console.error("Error fetching available commands:", error);
      res.status(500).json({ message: "Failed to fetch available commands", error: error.message });
    }
  });

  // AI Writing Intent Analysis endpoint for AmbientAI
  app.post("/api/ai/analyze-writing-intent", async (req: Request, res: Response) => {
    const analysisSchema = z.object({
      content: z.string(),
      cursorPosition: z.number(),
      selectedText: z.string().optional(),
      assistanceLevel: z.enum(['minimal', 'moderate', 'comprehensive'])
    });

    try {
      const { content, cursorPosition, selectedText, assistanceLevel } = analysisSchema.parse(req.body);

      // Create writing context
      const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
      const characterCount = content.length;
      const paragraphCount = content.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

      // Basic writing context
      const writingContext = {
        content: content || "",
        cursorPosition,
        selectedText,
        wordCount,
        characterCount,
        paragraphCount,
        lastActivity: new Date(),
        typingSpeed: 0, // Could be calculated from user behavior
        isActiveTyping: false,
        hasUnsavedChanges: false,
        sessionDuration: 0 // Could be calculated from session start
      };

      // Use the ContextualAIEngine (client-side) or create a server-side equivalent
      // For now, we'll use a simplified analysis that can be enhanced
      const analysis = analyzeWritingIntentSimple(writingContext);
      const insights = generateContextualInsights(analysis, writingContext, assistanceLevel);

      res.json({
        analysis,
        insights,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error("Error in writing intent analysis:", error);
      res.status(400).json({
        message: "Failed to analyze writing intent",
        error: error.message
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
      const agent = createAgent(resolveUserId(req));
      
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
      const agent = createAgent(resolveUserId(req));
      
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
      const agent = createAgent(resolveUserId(req));
      const tools = agent.getAvailableTools();
      res.json({ tools });
    } catch (error: any) {
      res.status(500).json({ message: "Error getting tools", error: error.message });
    }
  });
  
  app.get("/api/agent/context", async (req: Request, res: Response) => {
    const { createAgent } = await import("./ai-agent");
    
    try {
      const agent = createAgent(resolveUserId(req));
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
      const agent = createAgent(resolveUserId(req));

      // Set autonomy level for maximum capability
      if (autonomyLevel) {
        agent.setAutonomyLevel(autonomyLevel);
      }

      // Update agent context if provided, including LLM selection.
      // The client sends llmProvider/llmModel both nested in `context` and top-level;
      // prefer the nested (context) values so the user's actual selection wins.
      // API keys are never accepted from the client — server env only.
      const updatedContext = {
        ...context,
        llmProvider: context?.llmProvider ?? llmProvider,
        llmModel: context?.llmModel ?? llmModel,
        openaiApiKey: undefined,
        geminiApiKey: undefined
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

  // Helper functions for writing intent analysis
  function analyzeWritingIntentSimple(context: any) {
    const { content, wordCount, paragraphCount } = context;
    
    // Basic content analysis
    const hasQuestions = content.includes('?');
    const hasTechnicalTerms = /\b(API|function|algorithm|database|framework|component|system|process|methodology|analysis|synthesis|evaluation|implementation)\b/i.test(content);
    const hasCreativeWords = /\b(feel|imagine|dream|wonder|imagine|story|character|emotion|sense|moment|suddenly|perhaps|magic)\b/i.test(content);
    const hasResearchIndicators = /\b(research|study|find|discover|evidence|source|citation|reference|data|statistics)\b/i.test(content);

    let intentType = 'creative-writing';
    let confidence = 0.5;

    if (hasTechnicalTerms && wordCount > 50) {
      intentType = 'technical-doc';
      confidence = 0.8;
    } else if (hasResearchIndicators) {
      intentType = 'research';
      confidence = 0.75;
    } else if (hasCreativeWords && !hasTechnicalTerms) {
      intentType = 'creative-writing';
      confidence = 0.7;
    }

    let complexity = 'simple';
    if (wordCount > 200) complexity = 'moderate';
    if (wordCount > 500 || paragraphCount > 5) complexity = 'complex';

    let mood = 'flowing';
    const incompletePatterns = content.match(/\.\.\.|—|--|…/g);
    if (incompletePatterns && incompletePatterns.length > 2) {
      mood = 'struggling';
    }

    let assistance = 'minimal';
    if (mood === 'struggling' || complexity === 'complex') {
      assistance = 'comprehensive';
    } else if (wordCount > 100 && (intentType === 'research' || intentType === 'technical-doc')) {
      assistance = 'moderate';
    }

    return {
      type: intentType,
      complexity,
      mood,
      assistance,
      confidence,
      reasoning: `Document type: ${intentType} • Length: ${wordCount} words, ${paragraphCount} paragraphs • Complexity: ${complexity} • Current mood: ${mood} • Recommended assistance: ${assistance}`
    };
  }

  function generateContextualInsights(analysis: any, context: { content: string; wordCount: number }, assistanceLevel: string) {
    const insights = [];
    const { content, wordCount } = context;

    // Always provide continuation suggestions if appropriate
    if (wordCount > 20 && content.trim().length > 0) {
      insights.push({
        id: 'continuation',
        type: 'continuation',
        title: getContinuationTitle(analysis.type),
        suggestion: generateContinuationSuggestion(content, analysis),
        confidence: calculateContinuationConfidence(analysis, wordCount),
        preview: getContinuationPreview(content, analysis),
        reasoning: 'AI detected natural continuation point in writing flow',
        priority: 'medium',
        category: 'content'
      });
    }

    // Intent-specific insights
    switch (analysis.type) {
      case 'creative-writing':
        if (content.includes('character') || content.includes('persona')) {
          insights.push({
            id: 'character-dev',
            type: 'improvement',
            title: 'Character Development',
            suggestion: 'Consider adding a specific character trait or backstory to make them more vivid',
            confidence: 0.7,
            preview: '"The protagonist stood at the edge of the forest, remembering..."',
            reasoning: 'User is developing characters and could benefit from specific details',
            priority: 'medium',
            category: 'content'
          });
        }
        break;
        
      case 'technical-doc':
        if (wordCount > 100) {
          insights.push({
            id: 'technical-clarity',
            type: 'improvement',
            title: 'Technical Clarity',
            suggestion: 'Consider adding a diagram or example to illustrate complex concepts',
            confidence: 0.75,
            preview: 'Consider this structure: Problem → Solution → Example → Benefits',
            reasoning: 'Technical documentation benefits from visual aids and clear examples',
            priority: 'high',
            category: 'structure'
          });
        }
        break;
        
      case 'research':
        insights.push({
          id: 'research-source',
          type: 'research',
          title: 'Source Validation',
          suggestion: 'Would you like me to search for recent sources on this topic?',
          confidence: 0.8,
          preview: 'I can find academic papers and current research to support your points',
          reasoning: 'Research documents benefit from credible, current sources',
          priority: 'high',
          category: 'research'
        });
        break;
    }

    // Style insights for moderate+ assistance
    if (assistanceLevel !== 'minimal' && wordCount > 50) {
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const avgSentenceLength = sentences.reduce((acc, sentence) => acc + sentence.split(' ').length, 0) / sentences.length;
      
      if (avgSentenceLength > 25) {
        insights.push({
          id: 'readability',
          type: 'improvement',
          title: 'Improve Readability',
          suggestion: 'Consider breaking up long sentences for better readability',
          confidence: 0.7,
          preview: 'Split complex sentences into shorter, clearer ones',
          reasoning: 'Long sentences can reduce readability and engagement',
          priority: 'medium',
          category: 'style'
        });
      }
    }

    return insights.slice(0, 3); // Return top 3 insights
  }

  function getContinuationTitle(type: string): string {
    switch (type) {
      case 'creative-writing': return 'Continue Story';
      case 'technical-doc': return 'Expand Technical Detail';
      case 'research': return 'Add Research Finding';
      case 'structured-doc': return 'Continue Argument';
      case 'brainstorm': return 'Brainstorm Ideas';
      default: return 'Continue Writing';
    }
  }

  function generateContinuationSuggestion(content: string, analysis: any): string {
    const lastParagraph = content.split('\n\n').pop() || '';
    
    switch (analysis.type) {
      case 'creative-writing':
        return 'Building on the current scene, the next paragraph could explore the character\'s inner thoughts or introduce a new development that moves the story forward.';
      case 'technical-doc':
        return 'Following your current explanation, you could provide a practical example, code snippet, or step-by-step instruction that demonstrates the concept.';
      case 'research':
        return 'Based on your current point, you could cite a specific study, present supporting evidence, or explore a related finding that strengthens your argument.';
      default:
        return 'You could continue developing this idea by adding supporting details, examples, or exploring the logical next step in your reasoning.';
    }
  }

  function getContinuationPreview(content: string, analysis: any): string {
    switch (analysis.type) {
      case 'creative-writing':
        return 'However, the memory felt different now...';
      case 'technical-doc':
        return 'For example, consider this implementation...';
      case 'research':
        return 'According to recent studies (Smith et al., 2024)...';
      default:
        return 'This leads to several important implications...';
    }
  }

  function calculateContinuationConfidence(analysis: any, wordCount: number): number {
    let baseConfidence = 0.5;
    
    if (wordCount > 100) baseConfidence += 0.2;
    if (wordCount > 300) baseConfidence += 0.1;
    
    if (analysis.type === 'research' || analysis.type === 'technical-doc') {
      baseConfidence += 0.1;
    }
    
    return Math.min(baseConfidence, 0.9);
  }

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
