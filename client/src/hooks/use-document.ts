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
  const maxRetries = 3;
  const lastSaveTime = useRef(0);
  const minimumSaveInterval = 500; // Minimum time between saves

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

  // AI applies (slash commands, suggestions, agent): always a forced history
  // point so the exact pre-AI text is one ⌘Z away.
  const applyWithHistory = useCallback((next: string | ((prev: string) => string)) => {
    const resolved = typeof next === "function" ? next(contentRef.current) : next;
    pushContentHistory(contentRef.current, { force: true });
    setContent(resolved);
  }, [pushContentHistory]);

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
    }
  }, [documentData, markServerTimestamp]);

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
      if ((titleChanged || contentChanged) && saveError) {
        setSaveError(null);
        setAutoSaveEnabled(true);
        saveRetryCount.current = 0;
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
      setAutoSaveEnabled(true);
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
      setAutoSaveEnabled(true);
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

      // Disable autosave after max retries to prevent spam
      if (saveRetryCount.current >= maxRetries) {
        setAutoSaveEnabled(false);
        toast({
          title: "Autosave disabled",
          description: "Multiple save attempts failed. Please use the manual save button.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error saving document",
          description: `${error.message} (${saveRetryCount.current}/${maxRetries} attempts)`,
          variant: "destructive",
        });
      }
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
  }, [debouncedContent, debouncedTitle, documentId, isDirty, autoSaveEnabled, isSaving]);

  // Warn and flush before closing/reloading when there are unsaved changes, so the
  // autosave debounce window can't silently drop recent keystrokes. The flush uses
  // isManual=true so it also attempts when autosave is disabled.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && hasInitialized.current) {
        saveDocument(true).catch(() => {});
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, saveDocument]);
  
  return {
    title,
    setTitle,
    content,
    setContent,
    setContentTyping,
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
