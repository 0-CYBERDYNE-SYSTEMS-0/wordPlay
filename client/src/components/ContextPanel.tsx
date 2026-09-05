import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useApiProcessing } from "@/hooks/use-api-processing";
import { useSettings } from "@/providers/SettingsProvider";
import { Document } from "@shared/schema";
import { X, FileText, Pilcrow, MessageSquare, Link, FileText as FileIcon, Upload, Zap, Sparkles, BookOpen, BarChart2, Search, Clock, Code, Lightbulb, ExternalLink, Folder } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { countWords, calculateReadingTime, extractStructure } from "@/lib/document-processor";

interface ContextPanelProps {
  title: string;
  content: string;
  documentData?: Document;
  activeTab: "editor" | "research" | "settings";
  onClose: () => void;
  aiSuggestions?: string;
}

interface SavedSource {
  id: number;
  type: string;
  name: string;
  content?: string;
  url?: string;
  createdAt: string;
}

export default function ContextPanel({
  title,
  content,
  documentData,
  activeTab,
  onClose,
  aiSuggestions
}: ContextPanelProps) {
  const { startProcessing, stopProcessing, updateProgress } = useApiProcessing();
  const { settings } = useSettings();
  const [wordCount, setWordCount] = useState(0);
  const [readingTime, setReadingTime] = useState(0);
  const [paragraphCount, setParagraphCount] = useState(0);
  const [documentStructure, setDocumentStructure] = useState<{ 
    title: string; 
    paragraphs: { id: number; text: string; type: string }[] 
  }>({ title: "", paragraphs: [] });
  const [contextualHelp, setContextualHelp] = useState<{
    message: string;
    suggestions: string[];
  }>({
    message: "Start writing to get contextual suggestions...",
    suggestions: []
  });
  
  const [aiPrompt, setAiPrompt] = useState("");
  
  // Get contextual help from AI
  const contextualHelpMutation = useMutation({
    mutationFn: async (data?: { prompt?: string; content?: string }) => {
      const operationId = startProcessing({
        message: "Getting contextual help...",
        type: "ai-command",
        initialProgress: 0
      });
      try {
        const payload = {
          content: data?.content || content,
          title,
          prompt: data?.prompt,
          llmProvider: settings.llmProvider,
          llmModel: settings.llmModel
        };

        const res = await apiRequest("POST", "/api/ai/contextual-help", payload);
        return res.json();
      } catch (error) {
        console.error("Error getting contextual help:", error);
        // Return fallback data on error
        return {
          message: "AI assistant temporarily unavailable",
          suggestions: []
        };
      } finally {
        stopProcessing(operationId);
      }
    },
    onSuccess: (data) => {
      if (data && data.message) {
        setContextualHelp({
          message: data.message,
          suggestions: data.suggestions || []
        });
      }
    },
    onError: (error) => {
      console.error("Contextual help mutation error:", error);
      setContextualHelp({
        message: "AI assistant temporarily unavailable",
        suggestions: []
      });
    }
  });
  
  // Style metrics from document data or defaults
  const [styleMetrics, setStyleMetrics] = useState({
    formality: 50,
    complexity: 45,
    engagement: 60,
    tone: "Neutral"
  });
  
  // Get style metrics when content changes
  const styleAnalysisMutation = useMutation({
    mutationFn: async () => {
      const operationId = startProcessing({
        message: "Analyzing writing style...",
        type: "ai-command",
        initialProgress: 0
      });
      try {
        const res = await apiRequest("POST", "/api/ai/analyze-style", {
          content,
          llmProvider: settings.llmProvider,
          llmModel: settings.llmModel
        });
        return res.json();
      } catch (error) {
        console.error("Error analyzing style:", error);
        // Return fallback data on error
        return {
          metrics: {
            formality: 50,
            complexity: 45,
            engagement: 60,
            toneAnalysis: "Neutral"
          }
        };
      } finally {
        stopProcessing(operationId);
      }
    },
    onSuccess: (data) => {
      if (data && data.metrics) {
        setStyleMetrics({
          formality: data.metrics.formality || 50,
          complexity: data.metrics.complexity || 45, 
          engagement: data.metrics.engagement || 60,
          tone: data.metrics.toneAnalysis?.split('.')[0] || "Neutral"
        });
      }
    },
    onError: (error) => {
      console.error("Style analysis mutation error:", error);
    }
  });
  
  // Update document stats when content changes
  useEffect(() => {
    try {
      setWordCount(countWords(content || ""));
      setReadingTime(calculateReadingTime(content || ""));
      setParagraphCount((content || "").split(/\n\s*\n/).filter(p => p.trim().length > 0).length);
      setDocumentStructure(extractStructure(content || ""));
    } catch (error) {
      console.error("Error updating document stats:", error);
      // Set fallback values
      setWordCount(0);
      setReadingTime(0);
      setParagraphCount(0);
      setDocumentStructure({ title: title || "Untitled Document", paragraphs: [] });
    }
  }, [content, title]);
  
  // Style analysis now on-demand only (removed real-time analysis)
  
  // Handle sending AI prompt
  const handleSendPrompt = () => {
    if (!aiPrompt.trim()) return;
    
    contextualHelpMutation.mutate({
      prompt: aiPrompt,
      content: content
    });
    
    setAiPrompt("");
  };

  // Debug logging
  useEffect(() => {
    console.log("ContextPanel rendered with:", { 
      title: title || "no title", 
      contentLength: content?.length || 0, 
      wordCount, 
      readingTime,
      contextPanelVisible: true
    });
  }, [title, content, wordCount, readingTime]);

  // Simplified header - always the same
  const getContextHeader = () => "Document Context";

  // Get current project ID from document data
  const projectId = documentData?.projectId;

  // Fetch saved sources for research context
  const sourcesQuery = useQuery({
    queryKey: ["sources", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await apiRequest("GET", `/api/projects/${projectId}/sources`);
      return res.json() as Promise<SavedSource[]>;
    },
    enabled: !!projectId
  });

  return (
    <div className="w-full h-full bg-white dark:bg-gray-800 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
        <h2 className="font-medium text-lg text-gray-900 dark:text-gray-100">{getContextHeader()}</h2>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Close context panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      <div className="flex-1 overflow-auto p-3 space-y-3 min-h-0">
        {/* AI Suggestions Section - Show when available */}
        {aiSuggestions && (
          <div className="bg-gradient-to-r from-[var(--wp-wash)] to-copper-100 dark:from-copper-100 dark:to-copper-100 rounded-lg p-3 border border-copper-200 dark:border-copper-200">
            <h3 className="font-medium text-sm mb-2 flex items-center text-[var(--wp-copper)] dark:text-[var(--wp-copper)]">
              <Lightbulb className="h-4 w-4 mr-1" />
              AI Ideas & Suggestions
            </h3>
            <div className="text-sm text-[var(--wp-ink)]/80 dark:text-[var(--wp-ink)]/80 whitespace-pre-wrap">
              {aiSuggestions}
            </div>
          </div>
        )}

        {/* Simplified Consistent Content - Always Show These */}
        
        {/* Document Stats */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
          <h3 className="font-medium text-xs mb-2 flex items-center">
            <FileText className="h-3 w-3 mr-1" />
            Document Stats
          </h3>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex justify-between">
              <span>Words:</span>
              <span className="font-medium">{content.trim().split(/\s+/).filter(word => word.length > 0).length}</span>
            </div>
            <div className="flex justify-between">
              <span>Characters:</span>
              <span className="font-medium">{content.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Paragraphs:</span>
              <span className="font-medium">{content.split('\n\n').filter(p => p.trim().length > 0).length}</span>
            </div>
          </div>
        </div>

        {/* Project Sources - Always Available */}
        {sourcesQuery.data && sourcesQuery.data.length > 0 && (
          <div className="bg-copper-50 dark:bg-copper-100 rounded-lg p-2">
            <h3 className="font-medium text-xs mb-2 flex items-center text-[var(--wp-copper)] dark:text-[var(--wp-copper)]">
              <Folder className="h-3 w-3 mr-1" />
              Project Sources ({sourcesQuery.data.length})
            </h3>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {sourcesQuery.data.slice(0, 3).map((source) => (
                <div key={source.id} className="text-xs text-[var(--wp-ink)]/70 dark:text-[var(--wp-ink)]/80">
                  <div className="font-medium truncate">{source.name}</div>
                  <div className="text-copper-500 dark:text-copper-500 flex items-center">
                    {source.type}
                    {source.url && (
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="ml-1"
                        title="Open source"
                      >
                        <ExternalLink className="h-2 w-2" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {sourcesQuery.data.length > 3 && (
                <div className="text-xs text-copper-500 dark:text-copper-500">
                  +{sourcesQuery.data.length - 3} more sources
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Quick Actions for AI Features - Always Available */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
          <h3 className="font-medium text-xs mb-2 flex items-center">
            <Zap className="h-3 w-3 mr-1" />
            AI Quick Actions
          </h3>
          <div className="space-y-1">
            <button className="w-full text-left text-xs p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center">
              <Sparkles className="h-3 w-3 mr-1" />
              Use /improve to enhance writing
            </button>
            <button className="w-full text-left text-xs p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center">
              <FileText className="h-3 w-3 mr-1" />
              Use /format to structure your document
            </button>
            <button className="w-full text-left text-xs p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center">
              <BarChart2 className="h-3 w-3 mr-1" />
              Use /chart to visualize your data
            </button>
          </div>
        </div>
        
        {/* Global Document Info */}
        <div className="border-t pt-2 mt-2">
          <div className="bg-copper-50 dark:bg-copper-100 rounded-lg p-2">
            <h3 className="font-medium text-xs mb-1 flex items-center text-[var(--wp-copper)] dark:text-[var(--wp-copper)]">
              <FileText className="h-3 w-3 mr-1" />
              {title || "Untitled Document"}
            </h3>
            <div className="text-xs text-copper-500 dark:text-copper-500">
              <p>Modified: {new Date().toLocaleDateString()}</p>
              {content && <p>~{Math.ceil(content.trim().split(/\s+/).length / 200)} min read</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
