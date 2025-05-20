import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface UseAISuggestionsProps {
  content: string;
  style?: any;
  enabled?: boolean;
}

interface Suggestion {
  text: string;
  position?: number;
}

export function useAISuggestions({
  content,
  style,
  enabled = true
}: UseAISuggestionsProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  
  // Debounce content to avoid excessive API calls
  const debouncedContent = useDebounce(content, 1500);
  
  // Automatically fetch suggestions when content changes
  useEffect(() => {
    if (!enabled || !debouncedContent || isFetching) return;
    
    // Automatically trigger suggestion fetch when content changes
    if (debouncedContent.length > 10) {
      fetchSuggestionsMutation.mutate();
    }
  }, [debouncedContent, enabled, isFetching]);
  
  // API-based suggestions
  const fetchSuggestionsMutation = useMutation({
    mutationFn: async () => {
      setIsFetching(true);
      try {
        const res = await apiRequest("POST", "/api/ai/suggestions", {
          content: debouncedContent,
          style
        });
        const data = await res.json();
        return data.suggestions;
      } finally {
        setIsFetching(false);
      }
    },
    onSuccess: (data) => {
      setSuggestions(data);
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
      const res = await apiRequest("POST", "/api/ai/generate", {
        content,
        style,
        prompt
      });
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
    isFetching: isFetching || fetchSuggestionsMutation.isPending,
    generateTextCompletion: (prompt?: string) => generateTextCompletion.mutateAsync(prompt),
    isGenerating: generateTextCompletion.isPending
  };
}
