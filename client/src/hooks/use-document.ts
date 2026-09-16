import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Document } from "@shared/schema";

interface UseDocumentProps {
  documentId?: number;
  projectId?: number;
  initialTitle?: string;
  initialContent?: string;
  autosaveInterval?: number;
}

// Thrown when the server refuses an autosave because another editor changed
// the document first (HTTP 409 + current server copy in the body).
export class DocumentConflictError extends Error {
  currentDocument: any;
  constructor(currentDocument: any) {
    super("This document changed on the server while you were editing.");
    this.currentDocument = currentDocument;
  }
}

const toIso = (value: unknown): string | undefined =>
  value ? new Date(value as string | Date).toISOString() : undefined;

// Durability mirror (fix: autosave durability) — every document change is
// mirrored here so edits lost to a crash/tab-close during the autosave
// debounce window are restored on the next mount.
const DOC_MIRROR_PREFIX = 'wp-doc-mirror:';

interface DocMirror {
  title: string;
  content: string;
  updatedAt?: string;
}

const readDocMirror = (documentId: number): DocMirror | null => {
  try {
    const raw = localStorage.getItem(`${DOC_MIRROR_PREFIX}${documentId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.title !== 'string' || typeof parsed?.content !== 'string') return null;
    return parsed as DocMirror;
  } catch {
    return null; // corrupted entry or storage unavailable — start from server data
  }
};

const clearDocMirror = (documentId?: number) => {
  if (!documentId) return;
  try {
    localStorage.removeItem(`${DOC_MIRROR_PREFIX}${documentId}`);
  } catch { /* storage unavailable — nothing to clear */ }
};

export function useDocument({
  documentId,
  projectId,
  initialTitle = "Untitled Document",
  initialContent = "",
  autosaveInterval = 1000
}: UseDocumentProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for document data
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedTitle, setLastSavedTitle] = useState(initialTitle);
  const [lastSavedContent, setLastSavedContent] = useState(initialContent);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  // Server document that a save refused to overwrite (409) — awaiting resolution
  const [conflict, setConflict] = useState<{ serverDocument: Document } | null>(null);
  // updatedAt of the last copy we know the server has (basis for conflict checks)
  const [lastSavedUpdatedAt, setLastSavedUpdatedAt] = useState<string | undefined>(undefined);
  const lastSavedUpdatedAtRef = useRef<string | undefined>(undefined);
  const markServerTimestamp = useCallback((value: unknown) => {
    const iso = toIso(value);
    lastSavedUpdatedAtRef.current = iso;
    setLastSavedUpdatedAt(iso);
  }, []);
  
  // Track if we've initialized from server data
  const hasInitialized = useRef(false);
  const saveRetryCount = useRef(0);
  const lastSaveTime = useRef(0);
  const minimumSaveInterval = 500; // Minimum time between saves
  // Autosave backoff after failures: never disable autosave, just wait
  // min(30s, 2^n × 2s) before the next attempt. Ticked to re-run the
  // autosave effect when a backoff window expires without further edits.
  const backoffUntilRef = useRef(0);
  const backoffTimerRef = useRef<number | undefined>(undefined);
  const [backoffTick, setBackoffTick] = useState(0);

  // Shared undo history so every writer (typing, slash commands, ambient
  // suggestions, the agent) feeds one stack — ⌘Z can revert any of them.
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const lastHistoryPushRef = useRef(0);
  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Reset initialization when documentId changes
  useEffect(() => {
    hasInitialized.current = false;
    setIsDirty(false);
    setSaveError(null);
    saveRetryCount.current = 0;
    setAutoSaveEnabled(true);
    // Never let undo cross documents.
    undoStackRef.current = [];
    redoStackRef.current = [];
    lastHistoryPushRef.current = 0;

    // Reset to initial values when switching documents
    if (!documentId) {
      setTitle(initialTitle);
      setContent(initialContent);
      setLastSavedTitle(initialTitle);
      setLastSavedContent(initialContent);
    }
  }, [documentId, initialTitle, initialContent]);

  // Coalesced history push (typing); `force` skips coalescing (AI applies).
  const pushContentHistory = useCallback((value: string, opts?: { force?: boolean }) => {
    const now = Date.now();
    if (!opts?.force && now - lastHistoryPushRef.current < 1000) return;
    lastHistoryPushRef.current = now;
    const stack = undoStackRef.current;
    if (stack.length >= 100) stack.shift();
    stack.push(value);
    redoStackRef.current = [];
  }, []);

  // Typing path: coalesced so undo steps are word/phrase-sized, not per-keystroke.
  const setContentTyping = useCallback((next: string) => {
    pushContentHistory(contentRef.current);
    setContent(next);
  }, [pushContentHistory]);

  // Streaming preview path: raw write that bypasses the undo stack entirely.
  // The stream wrapper (SlashCommandsPopup) anchors its single history entry
  // itself, so chunk count never affects ⌘Z depth.
  const setContentWithoutHistory = useCallback((next: string) => {
    setContent(next);
  }, []);

  // AI applies (slash commands, suggestions, agent): always a forced history
  // point so the exact pre-AI text is one ⌘Z away. Streaming previews pass
  // skipHistory and ride the single entry the stream anchored itself.
  const applyWithHistory = useCallback((
    next: string | ((prev: string) => string),
    opts?: { skipHistory?: boolean }
  ) => {
    const resolved = typeof next === "function" ? next(contentRef.current) : next;
    if (opts?.skipHistory) {
      setContentWithoutHistory(resolved);
      return;
    }
    const top = undoStackRef.current[undoStackRef.current.length - 1];
    if (resolved === top) {
      // Returning to the stack-top state must not consume undo depth:
      //  • content already equals it → true no-op, nothing to record;
      //  • content differs (a stream abort/cancel restoring the pre-AI text
      //    its first chunk anchored) → retire the anchor by popping it, so a
      //    cancelled command costs no ⌘Z press. Pushing here would create a
      //    dead entry (or, worse, swallow the pending transition's entry).
      if (contentRef.current !== resolved) {
        undoStackRef.current.pop();
      }
    } else {
      pushContentHistory(contentRef.current, { force: true });
    }
    contentRef.current = resolved;
    setContent(resolved);
  }, [pushContentHistory, setContentWithoutHistory]);

  const undoContent = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (prev === undefined) return;
    redoStackRef.current.push(contentRef.current);
    setContent(prev);
  }, []);

  const redoContent = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (next === undefined) return;
    pushContentHistory(contentRef.current, { force: true });
    setContent(next);
  }, [pushContentHistory]);
  
  // Debounce content changes using settings interval
  const debouncedContent = useDebounce(content, autosaveInterval);
  const debouncedTitle = useDebounce(title, autosaveInterval);
  
  // Fetch document if documentId is provided. Polls lightly so teammates'
  // changes surface while the document is open (adoption is gated on !isDirty).
  const { data: documentData } = useQuery<Document>({
    queryKey: documentId ? [`/api/documents/${documentId}`] : ['no-document'],
    enabled: !!documentId,
    refetchInterval: 15000,
  });

  // Update local state when document data is fetched
  useEffect(() => {
    if (documentData && !hasInitialized.current) {
      setTitle(documentData.title);
      setContent(documentData.content);
      setLastSavedTitle(documentData.title);
      setLastSavedContent(documentData.content);
      markServerTimestamp(documentData.updatedAt);
      setIsDirty(false);
      setSaveError(null);
      hasInitialized.current = true;

      // Restore edits mirrored to localStorage before the tab last closed.
      // Must run after the server copy is in place (an earlier restore would
      // be overwritten here), with the dirty flag set synchronously so the
      // teammate-adoption effect can never drop the restored text. The
      // restore is a forced history point (⌘Z drops back to the server
      // copy); the post-restore autosave sends ifUpdatedAt, so a teammate
      // edit since our last save surfaces the 409 dialog on mount — that is
      // deliberate: we never overwrite a teammate silently.
      const mirrored = documentId ? readDocMirror(documentId) : null;
      if (mirrored) {
        const contentChanged = mirrored.content !== documentData.content;
        const titleChanged = mirrored.title !== documentData.title;
        if (contentChanged) {
          contentRef.current = documentData.content; // history base for the forced push
          applyWithHistory(mirrored.content);
        }
        if (titleChanged) setTitle(mirrored.title);
        if (contentChanged || titleChanged) setIsDirty(true);
      }
    }
  }, [documentData, documentId, markServerTimestamp, applyWithHistory]);

  // A teammate changed the document while we have no local edits — adopt the
  // server version so the open editor stays current instead of going stale.
  useEffect(() => {
    if (
      documentData &&
      hasInitialized.current &&
      !isDirty &&
      !conflict &&
      toIso(documentData.updatedAt) !== lastSavedUpdatedAtRef.current
    ) {
      setTitle(documentData.title);
      setContent(documentData.content);
      setLastSavedTitle(documentData.title);
      setLastSavedContent(documentData.content);
      markServerTimestamp(documentData.updatedAt);
    }
  }, [documentData, isDirty, conflict, markServerTimestamp]);
  
  // Track dirty state when content or title changes
  useEffect(() => {
    if (hasInitialized.current) {
      const titleChanged = title !== lastSavedTitle;
      const contentChanged = content !== lastSavedContent;
      setIsDirty(titleChanged || contentChanged);
      
      // Clear save error when user makes changes (give autosave another chance)
      if (titleChanged || contentChanged) {
        // Any edit re-arms autosave immediately (no backoff wait).
        backoffUntilRef.current = 0;
        if (saveError) {
          setSaveError(null);
          setAutoSaveEnabled(true);
          saveRetryCount.current = 0;
        }
      }
    }
  }, [title, content, lastSavedTitle, lastSavedContent, saveError]);
  
  // Create new document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; projectId: number }) => {
      const res = await apiRequest("POST", "/api/documents", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/documents`] });
      setLastSavedTitle(data.title);
      setLastSavedContent(data.content);
      markServerTimestamp(data.updatedAt);
      setIsDirty(false);
      setSaveError(null);
      saveRetryCount.current = 0;
      backoffUntilRef.current = 0;
      setAutoSaveEnabled(true);
      clearDocMirror(data.id);
      toast({
        title: "Document created",
        description: "Your document has been created successfully.",
      });
      return data;
    },
    onError: (error) => {
      setSaveError(error.message);
      toast({
        title: "Error creating document",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update document mutation — uses a raw fetch so a 409 conflict body
  // (with the server's current copy) can be read and surfaced.
  const updateDocumentMutation = useMutation({
    mutationFn: async (data: { id: number; title?: string; content?: string; force?: boolean }) => {
      const res = await fetch(`/api/documents/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: data.title,
          content: data.content,
          // Omit the precondition when explicitly forcing an overwrite.
          ifUpdatedAt: data.force ? undefined : lastSavedUpdatedAtRef.current,
        }),
      });
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        throw new DocumentConflictError(body.currentDocument);
      }
      if (!res.ok) {
        let message = `Save failed (${res.status})`;
        try {
          const body = await res.json();
          if (body?.message) message = body.message;
        } catch { /* non-JSON body */ }
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${data.id}`] });
      setLastSavedTitle(data.title);
      setLastSavedContent(data.content);
      markServerTimestamp(data.updatedAt);
      setIsDirty(false);
      setSaveError(null);
      saveRetryCount.current = 0;
      backoffUntilRef.current = 0;
      setAutoSaveEnabled(true);
      clearDocMirror(data.id);
      return data;
    },
    onError: (error) => {
      if (error instanceof DocumentConflictError && error.currentDocument) {
        // Don't count a conflict as a save failure and don't retry into it —
        // surface both versions and let the writer resolve it.
        setConflict({ serverDocument: error.currentDocument });
        toast({
          title: "Document changed by someone else",
          description: "Your version is kept. Resolve the conflict to continue.",
          variant: "destructive",
        });
        return;
      }
      setSaveError(error.message);
      saveRetryCount.current++;

      // Back off before the next autosave attempt (min(30s, 2^n × 2s)) —
      // autosave is never permanently disabled. The timer re-kicks the
      // autosave effect so a retry happens even without further edits.
      const backoffMs = Math.min(30_000, 2 ** saveRetryCount.current * 2000);
      backoffUntilRef.current = Date.now() + backoffMs;
      window.clearTimeout(backoffTimerRef.current);
      backoffTimerRef.current = window.setTimeout(() => setBackoffTick((t) => t + 1), backoffMs);
      toast({
        title: "Error saving document",
        description: `${error.message} — retrying in ~${Math.round(backoffMs / 1000)}s`,
        variant: "destructive",
      });
    }
  });

  // Resolve a 409 conflict: adopt the server copy, or force-overwrite with ours.
  const resolveConflict = useCallback(async (choice: "server" | "mine") => {
    if (!conflict) return;
    const serverDoc = conflict.serverDocument;
    if (choice === "server") {
      setTitle(serverDoc.title);
      setContent(serverDoc.content);
      setLastSavedTitle(serverDoc.title);
      setLastSavedContent(serverDoc.content);
      markServerTimestamp(serverDoc.updatedAt);
      setIsDirty(false);
      clearDocMirror(documentId);
      undoStackRef.current = [];
      redoStackRef.current = [];
      toast({ title: "Server version loaded", description: "Your in-progress edits were replaced by the teammate's version." });
    } else {
      // Force write: no precondition. Update our known server timestamp on success.
      if (documentId) {
        try {
          const res = await fetch(`/api/documents/${documentId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ title, content }),
          });
          if (res.ok) {
            const data = await res.json();
            setLastSavedTitle(data.title);
            setLastSavedContent(data.content);
            markServerTimestamp(data.updatedAt);
            setIsDirty(false);
            saveRetryCount.current = 0;
            backoffUntilRef.current = 0;
            clearDocMirror(documentId);
            queryClient.invalidateQueries({ queryKey: [`/api/documents/${documentId}`] });
            toast({ title: "Your version saved", description: "Your edits overwrote the server copy." });
          } else {
            toast({ title: "Could not save your version", description: `Server responded ${res.status}.`, variant: "destructive" });
          }
        } catch (err: any) {
          toast({ title: "Could not save your version", description: err?.message || "Network error.", variant: "destructive" });
        }
      }
    }
    setConflict(null);
  }, [conflict, documentId, title, content, markServerTimestamp, queryClient, toast]);
  
  // Save document (create or update)
  const saveDocument = async (isManualSave: boolean = false) => {
    if (!projectId && !documentId) {
      return;
    }
    
    if (!isDirty) {
      return; // Nothing to save
    }
    
    // For manual saves, always attempt even if autosave is disabled
    if (!isManualSave && !autoSaveEnabled) {
      return;
    }
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      if (documentId) {
        // Update existing document
        await updateDocumentMutation.mutateAsync({
          id: documentId,
          title,
          content
        });
      } else if (projectId) {
        // Create new document
        await createDocumentMutation.mutateAsync({
          projectId,
          title,
          content
        });
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  // Auto-save when content or title changes (only if document exists and is dirty)
  useEffect(() => {
    if (documentId && isDirty && hasInitialized.current && autoSaveEnabled) {
      const now = Date.now();

      // Failed saves wait out their exponential backoff before retrying.
      if (now < backoffUntilRef.current) {
        return;
      }

      const timeSinceLastSave = now - lastSaveTime.current;

      // Rate limit saves to prevent excessive API calls
      if (timeSinceLastSave < minimumSaveInterval) {
        return;
      }

      // Only save if we're not currently saving
      if (!isSaving) {
        lastSaveTime.current = now;
        saveDocument(false); // false = not manual save
      }
    }
  }, [debouncedContent, debouncedTitle, documentId, isDirty, autoSaveEnabled, isSaving, backoffTick]);

  // Final flush when the tab closes/hides: a keepalive PUT so the autosave
  // debounce window can't silently drop recent keystrokes. fetch + keepalive
  // is the transport because navigator.sendBeacon always issues POST (it can
  // never hit app.put('/api/documents/:id')), and its `true` return only
  // means "queued". The ifUpdatedAt precondition is kept so a teammate edit
  // still surfaces the 409 dialog instead of being overwritten; if this
  // fails (e.g. server down), the localStorage mirror restores the text on
  // the next mount.
  //
  // When the flush SUCCEEDS the server timestamp is reconciled into hook
  // state: without that, a bfcache restore (Back button) would leave
  // isDirty=true and a stale lastSavedUpdatedAt, and the page's OWN flush
  // would 409 into the conflict dialog. An in-flight debounced save wins —
  // flushing under it would 409 against ourselves.
  useEffect(() => {
    const flushOnHide = () => {
      if (!documentId || !isDirty || !hasInitialized.current) return;
      if (updateDocumentMutation.isPending) return;
      try {
        fetch(`/api/documents/${documentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          keepalive: true,
          body: JSON.stringify({
            title,
            content,
            ifUpdatedAt: lastSavedUpdatedAtRef.current,
          }),
        })
          .then(async (res) => {
            if (!res.ok) return; // mirror covers the failure
            const data = await res.json().catch(() => null);
            if (!data?.updatedAt) return;
            setLastSavedTitle(data.title);
            setLastSavedContent(data.content);
            markServerTimestamp(data.updatedAt);
            setIsDirty(false);
            clearDocMirror(documentId);
          })
          .catch(() => { /* best-effort — mirror covers the failure */ });
      } catch { /* page is dying — mirror still has the text */ }
    };
    window.addEventListener('pagehide', flushOnHide);
    return () => window.removeEventListener('pagehide', flushOnHide);
  }, [documentId, isDirty, title, content, updateDocumentMutation.isPending, markServerTimestamp]);

  // Warn before closing/reloading with unsaved changes. The actual save
  // happens in the pagehide flush above; this only asks the user.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && hasInitialized.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Backoff retry timer must not outlive the hook.
  useEffect(() => () => window.clearTimeout(backoffTimerRef.current), []);

  // Durability mirror: every change lands in localStorage so a crash or a
  // closed tab during the autosave debounce window is recoverable on the
  // next mount (see the restore in the server-data init effect). Cleared on
  // every successful save.
  useEffect(() => {
    if (!documentId || !hasInitialized.current) return;
    try {
      localStorage.setItem(
        `${DOC_MIRROR_PREFIX}${documentId}`,
        JSON.stringify({
          title,
          content,
          updatedAt: lastSavedUpdatedAtRef.current,
        }),
      );
    } catch { /* private mode / quota exceeded — the mirror is best-effort */ }
  }, [documentId, title, content]);
  
  return {
    title,
    setTitle,
    content,
    setContent,
    setContentTyping,
    setContentWithoutHistory,
    applyWithHistory,
    undoContent,
    redoContent,
    isSaving,
    isDirty,
    saveError,
    autoSaveEnabled,
    saveDocument: (isManual = true) => saveDocument(isManual),
    documentData,
    conflict,
    resolveConflict
  };
}
