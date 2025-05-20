import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Document } from "@shared/schema";
import { fixReversedText } from "@/lib/text-utils";

interface UseDocumentProps {
  documentId?: number;
  projectId?: number;
  initialTitle?: string;
  initialContent?: string;
}

export function useDocument({
  documentId,
  projectId,
  initialTitle = "Untitled Document",
  initialContent = ""
}: UseDocumentProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for document data
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  
  // Debounce content changes to avoid excessive API calls
  const debouncedContent = useDebounce(content, 1000);
  const debouncedTitle = useDebounce(title, 1000);
  
  // Fetch document if documentId is provided
  const { data: documentData } = useQuery<Document>({
    queryKey: documentId ? [`/api/documents/${documentId}`] : ['no-document'],
    enabled: !!documentId
  });
  
  // Update local state when document data is fetched
  useEffect(() => {
    if (documentData) {
      setTitle(documentData.title);
      setContent(documentData.content);
    }
  }, [documentData]);
  
  // Create new document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; projectId: number }) => {
      const res = await apiRequest("POST", "/api/documents", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/documents`] });
      toast({
        title: "Document created",
        description: "Your document has been created successfully.",
      });
      return data;
    },
    onError: (error) => {
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
      return data;
    },
    onError: (error) => {
      toast({
        title: "Error saving document",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Save document (create or update)
  const saveDocument = async () => {
    if (!projectId && !documentId) {
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Always fix content before saving
      const fixedContent = fixReversedText(content);
      const fixedTitle = fixReversedText(title);
      
      if (documentId) {
        // Update existing document
        await updateDocumentMutation.mutateAsync({
          id: documentId,
          title: fixedTitle,
          content: fixedContent
        });
      } else if (projectId) {
        // Create new document
        await createDocumentMutation.mutateAsync({
          projectId,
          title: fixedTitle,
          content: fixedContent
        });
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  // Auto-save when content or title changes
  useEffect(() => {
    if (documentId && (debouncedContent !== documentData?.content || debouncedTitle !== documentData?.title)) {
      saveDocument();
    }
  }, [debouncedContent, debouncedTitle, documentId]);
  
  return {
    title,
    setTitle,
    content,
    setContent,
    isSaving,
    saveDocument,
    documentData
  };
}
