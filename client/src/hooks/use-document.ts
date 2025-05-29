import { useState, useEffect, useRef } from "react";
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
  
  // Track if we've initialized from server data
  const hasInitialized = useRef(false);
  const saveRetryCount = useRef(0);
  const maxRetries = 3;
  const lastSaveTime = useRef(0);
  const minimumSaveInterval = 500; // Minimum time between saves
  
  // Debounce content changes using settings interval
  const debouncedContent = useDebounce(content, autosaveInterval);
  const debouncedTitle = useDebounce(title, autosaveInterval);
  
  // Fetch document if documentId is provided
  const { data: documentData } = useQuery<Document>({
    queryKey: documentId ? [`/api/documents/${documentId}`] : ['no-document'],
    enabled: !!documentId
  });
  
  // Update local state when document data is fetched
  useEffect(() => {
    if (documentData && !hasInitialized.current) {
      setTitle(documentData.title);
      setContent(documentData.content);
      setLastSavedTitle(documentData.title);
      setLastSavedContent(documentData.content);
      setIsDirty(false);
      setSaveError(null);
      hasInitialized.current = true;
    }
  }, [documentData]);
  
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
  
  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async (data: { id: number; title?: string; content?: string }) => {
      const res = await apiRequest("PUT", `/api/documents/${data.id}`, {
        title: data.title,
        content: data.content
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${data.id}`] });
      setLastSavedTitle(data.title);
      setLastSavedContent(data.content);
      setIsDirty(false);
      setSaveError(null);
      saveRetryCount.current = 0;
      setAutoSaveEnabled(true);
      return data;
    },
    onError: (error) => {
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
  
  return {
    title,
    setTitle,
    content,
    setContent,
    isSaving,
    isDirty,
    saveError,
    autoSaveEnabled,
    saveDocument: (isManual = true) => saveDocument(isManual),
    documentData
  };
}
