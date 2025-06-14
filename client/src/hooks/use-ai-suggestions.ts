import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useApiProcessing } from "@/hooks/use-api-processing";

interface UseAISuggestionsProps {
  content: string;
  style?: any;
  enabled?: boolean;
  llmProvider: 'openai' | 'ollama';
  llmModel?: string;
}

interface Suggestion {
  text: string;
  position?: number;
}

export function useAISuggestions({
  content,
  style,
  enabled = true,
  llmProvider,
  llmModel
}: UseAISuggestionsProps) {
  const { toast } = useToast();
  const { processedApiRequest } = useApiProcessing();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  
  // Debounce content to avoid excessive API calls
  const debouncedContent = useDebounce(content, 1500);
  
  // DISABLED: Auto-generation removed per user request
  // Users will use agent or slash commands instead
  /*
  // Automatically fetch suggestions when content changes
  useEffect(() => {
    if (!enabled || !debouncedContent || isFetching) return;
    
    // Automatically trigger suggestion fetch when content changes
    if (debouncedContent.length > 10) {
      fetchSuggestionsMutation.mutate();
    }
  }, [debouncedContent, enabled, isFetching]);
  */
  
  // API-based suggestions (now only manual via agent/slash commands)
  const fetchSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const res = await processedApiRequest("POST", "/api/ai/suggestions", {
        content: debouncedContent,
        style,
        llmProvider,
        llmModel
      }, "Getting writing suggestions...");
      return res.json();
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions || []);
    },
    onError: (error) => {
      console.error("Error fetching suggestions:", error);
      toast({
        title: "Error fetching suggestions",
        description: "Failed to get AI suggestions. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // No need for additional fallback since we're using direct API calls now
  
  const generateTextCompletion = useMutation({
    mutationFn: async (prompt?: string) => {
      const res = await processedApiRequest("POST", "/api/ai/generate", {
        content,
        style,
        prompt,
        llmProvider,
        llmModel
      }, "Generating text...");
      return res.json();
    },
    onError: (error) => {
      toast({
        title: "Error generating text",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  return {
    suggestions,
    selectedSuggestion,
    setSelectedSuggestion,
    isFetching: fetchSuggestionsMutation.isPending,
    generateTextCompletion: (prompt?: string) => generateTextCompletion.mutateAsync(prompt),
    isGenerating: generateTextCompletion.isPending,
    fetchSuggestions: () => fetchSuggestionsMutation.mutate()
  };
}
