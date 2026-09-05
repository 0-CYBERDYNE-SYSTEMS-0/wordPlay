import type { Express, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Image upload: teammates can bring their own images into documents
// (paste or drag-drop in the editor), not just generate them.
// Files land in the same public/uploads dir used by AI image generation.

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

export function registerUploadRoute(app: Express): void {
  app.post(
    "/api/uploads",
    upload.single("file"),
    (req: Request, res: Response) => {
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        return res.status(400).json({ message: "No file provided (expected multipart field 'file')" });
      }
      if (!ALLOWED_MIME.has(file.mimetype)) {
        return res.status(415).json({ message: `Unsupported file type: ${file.mimetype}. Images only (png, jpeg, webp, gif, svg).` });
      }

      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }

      // UUID names prevent collisions and path traversal; extension derives
      // from the validated mime type, not the client-supplied filename.
      const fileName = `upload-${crypto.randomUUID()}${EXT_BY_MIME[file.mimetype] || ""}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, fileName), file.buffer);

      const altText = (file.originalname || "Uploaded image")
        .replace(/\.[a-z0-9]+$/i, "")
        .split(/[-_\s]+/)
        .filter(Boolean)
        .slice(0, 8)
        .join(" ") || "Uploaded image";

      res.status(201).json({ url: `/uploads/${fileName}`, alt: altText, size: file.size });
    }
  );

  // Multer-specific errors (file too large etc.) surface as honest messages.
  app.use((err: any, _req: Request, res: Response, next: any) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "Image is larger than 15MB." });
    }
    next(err);
  });
}
