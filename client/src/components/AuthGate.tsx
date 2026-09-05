import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot } from "lucide-react";

interface SessionInfo {
  authRequired: boolean;
  authenticated: boolean;
  displayName?: string;
}

/**
 * Team sign-in gate. When the server has AUTH_PASSWORD set, the whole app is
 * behind this screen until a session cookie exists. When auth is disabled the
 * session check reports `authRequired: false` and this renders children
 * immediately, so single-user local installs are unaffected.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        const data = res.ok ? await res.json() : { authRequired: true, authenticated: false };
        if (!cancelled) setSession(data);
      } catch {
        // Server unreachable — let the app render and surface its own errors.
        if (!cancelled) setSession({ authRequired: false, authenticated: true });
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password, displayName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message || `Sign-in failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setSession({ authRequired: true, authenticated: true, displayName: data.displayName });
    } catch (err: any) {
      setError(err?.message || "Network error during sign-in");
    } finally {
      setSubmitting(false);
    }
  };

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--wp-paper)] text-[var(--wp-ink)] dark:bg-stone-950 dark:text-stone-100">
        <div className="text-sm text-stone-400">Checking session…</div>
      </div>
    );
  }

  const needsLogin = session?.authRequired && !session?.authenticated;
  if (!needsLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--wp-paper)] text-[var(--wp-ink)] dark:bg-stone-950 dark:text-stone-100">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wp-copper)] text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">wordPlay</h1>
            <p className="text-xs text-stone-500 dark:text-stone-400">Team workspace sign-in</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Your name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Dana"
            autoComplete="off"
          />
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Your name identifies your projects and documents to teammates.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Team password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Shared team password"
            autoFocus
          />
        </div>

        {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

        <Button type="submit" className="w-full" disabled={submitting || !password}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
