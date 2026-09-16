import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./db-migrate";
import { config } from "./config";

const app = express();
// Path-scoped parsers must mount BEFORE the global ones: body-parser skips
// already-parsed requests, so a parser placed after the global one is a no-op.
// /api/text stays small (regex utilities); /api/ai keeps 50mb for base64 image
// payloads; /api/agent and /api/documents carry whole-document content in
// JSON (agent context, autosave PUTs), so they get headroom above the 2mb
// global without re-opening the old unlimited-everything surface. Multipart
// uploads (15MB) go through multer and bypass these parsers.
app.use("/api/text", express.json({ limit: '1mb' }));
app.use("/api/text", express.urlencoded({ extended: false, limit: '1mb' }));
app.use("/api/ai", express.json({ limit: '50mb' }));
app.use("/api/agent", express.json({ limit: '10mb' }));
app.use("/api/documents", express.json({ limit: '10mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Initialize database
    log("Initializing database...");
    const dbInitialized = await initializeDatabase();
    if (dbInitialized) {
      log("Database initialized successfully");
    } else {
      log("Database initialization failed, but continuing with server startup");
    }
  } catch (error) {
    log(`Database initialization error: ${error}`);
    // Continue with application startup even if database init fails
  }

  const server = await registerRoutes(app);

  // A shared team server must survive one bad request. Express 4 cannot catch
  // async route rejections, so without these handlers a single failed DB query
  // takes the whole process down for everyone.
  process.on("unhandledRejection", (reason) => {
    log(`Unhandled rejection (server kept alive): ${reason}`);
  });
  process.on("uncaughtException", (err) => {
    log(`Uncaught exception (server kept alive): ${err?.stack || err}`);
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on configured port
  server.listen(config.server.port, config.server.host, () => {
    log(`serving on ${config.server.host}:${config.server.port}`);
  });
})();
