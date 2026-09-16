import type { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { storage } from "./storage";

/**
 * Minimal team sign-in, enabled by setting AUTH_PASSWORD in the server .env.
 *
 * - No AUTH_PASSWORD  → auth is disabled and the app behaves as a single-user
 *   local install (all requests resolve to user 1). Keeps local dev, the
 *   e2e suite, and existing deployments working unchanged.
 * - AUTH_PASSWORD set  → every /api and /uploads request needs a signed
 *   session cookie, obtained by POSTing the shared team password plus a
 *   display name (which becomes the per-user identity for ownership).
 *
 * Sessions are stateless HMAC-signed cookies (no new dependencies).
 */

const SESSION_COOKIE = "wp_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function isAuthEnabled(): boolean {
  return !!process.env.AUTH_PASSWORD;
}

// Signing secret: dedicated AUTH_SECRET if provided, otherwise derived from
// the deployment's password + database URL so it is never a public constant.
function sessionSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    `${process.env.AUTH_PASSWORD || "wordplay"}::${process.env.DATABASE_URL || "local"}`
  );
}

function sign(body: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
}

interface SessionPayload {
  userId: number;
  name: string;
  exp: number;
}

function createToken(userId: number, name: string): string {
  const payload: SessionPayload = { userId, name, exp: Date.now() + SESSION_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function verifyToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (!payload?.userId || !payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function readSession(req: Request): SessionPayload | null {
  const header = req.headers.cookie || "";
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  return verifyToken(match.slice(SESSION_COOKIE.length + 1));
}

// Resolves the acting user for any request. 0 means "unauthenticated" and is
// only meaningful when auth is disabled (in which case the answer is always 1).
export function resolveUserId(req: Request): number {
  if (!isAuthEnabled()) return 1;
  return readSession(req)?.userId ?? 0;
}

export function resolveDisplayName(req: Request): string {
  if (!isAuthEnabled()) return "writer";
  return readSession(req)?.name ?? "writer";
}

// Express middleware: pass-through when auth is disabled, otherwise enforce
// a valid session and stamp req.userId for the route handlers.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!isAuthEnabled()) {
    (req as Request & { userId?: number }).userId = 1;
    return next();
  }
  const session = readSession(req);
  if (!session) {
    return res.status(401).json({ message: "Sign in required" });
  }
  (req as Request & { userId?: number }).userId = session.userId;
  next();
}

function setSessionCookie(res: Response, token: string, maxAgeSeconds: number) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`
  );
}

// Tiny in-memory brute-force guard: 10 attempts per IP per minute.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function loginAllowed(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 10;
}

function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "writer";
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function registerAuthRoutes(app: Express): void {
  // Who am I? Lets the client decide whether to show a sign-in gate.
  app.get("/api/auth/session", (req: Request, res: Response) => {
    if (!isAuthEnabled()) {
      return res.json({ authRequired: false, authenticated: true, displayName: "writer", userId: 1 });
    }
    const session = readSession(req);
    if (!session) {
      return res.status(401).json({ authRequired: true, authenticated: false });
    }
    res.json({ authRequired: true, authenticated: true, displayName: session.name, userId: session.userId });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    if (!isAuthEnabled()) {
      return res.status(400).json({ message: "Team sign-in is not enabled on this server (set AUTH_PASSWORD)." });
    }
    if (!loginAllowed(req.ip || "unknown")) {
      return res.status(429).json({ message: "Too many sign-in attempts. Wait a minute and try again." });
    }
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const displayNameRaw = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
    if (!password || !timingSafeEqualStr(password, process.env.AUTH_PASSWORD as string)) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    // The display name becomes the per-user identity (documents/projects are
    // owned by the resolved user id).
    const displayName = displayNameRaw || "writer";
    const username = slugifyName(displayName);
    try {
      let user = await storage.getUserByUsername(username);
      if (!user) {
        user = await storage.createUser({ username, password: crypto.randomBytes(32).toString("hex") });
      }
      setSessionCookie(res, createToken(user.id, displayName), SESSION_TTL_MS / 1000);
      return res.json({ authenticated: true, displayName, userId: user.id });
    } catch (error: any) {
      console.error("Login failed (storage):", error?.message || error);
      return res.status(500).json({ message: "Sign-in succeeded but user setup failed. Is the database running?" });
    }
  });

  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    setSessionCookie(res, "", 0);
    res.json({ ok: true });
  });
}
