import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Document } from "@shared/schema";
import { X, FileText, Pilcrow, MessageSquare, Link, FileText as FileIcon, Upload, Zap, Sparkles, BookOpen, BarChart2, Search, Clock, Code } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { countWords, calculateReadingTime, extractStructure } from "@/lib/document-processor";

interface ContextPanelProps {
  title: string;
  content: string;
  documentData?: Document;
  activeTab: "editor" | "search" | "command" | "style";
  onClose: () => void;
}

export default function ContextPanel({
  title,
  content,
  documentData,
  activeTab,
  onClose
}: ContextPanelProps) {
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
      try {
        const payload = {
          content: data?.content || content,
          title,
          prompt: data?.prompt
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
      try {
        const res = await apiRequest("POST", "/api/ai/analyze-style", {
          content
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
  
  // Run style analysis when content changes significantly (but not on every keystroke)
  useEffect(() => {
    if (content && content.length > 100) {
      const timeoutId = setTimeout(() => {
        styleAnalysisMutation.mutate();
      }, 2000); // Debounce for 2 seconds
      
      return () => clearTimeout(timeoutId);
    }
  }, [content]);
  
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

  // Get context-aware header based on active tab
  const getContextHeader = () => {
    switch (activeTab) {
      case "editor":
        return "Document Insights";
      case "search":
        return "Research Context";
      case "command":
        return "AI Assistant Context";
      case "style":
        return "Style Analysis";
      default:
        return "Document Context";
    }
  };

  return (
    <div className="w-full h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col shadow-lg">
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
      
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {/* Context-specific content */}
        {activeTab === "editor" && (
          <>
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
            
            {/* Quick Actions */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              <h3 className="font-medium text-xs mb-2 flex items-center">
                <Zap className="h-3 w-3 mr-1" />
                Quick Actions
              </h3>
              <div className="space-y-1">
                <button className="w-full text-left text-xs p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Improve writing
                </button>
                <button className="w-full text-left text-xs p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center">
                  <BookOpen className="h-3 w-3 mr-1" />
                  Generate outline
                </button>
                <button className="w-full text-left text-xs p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center">
                  <BarChart2 className="h-3 w-3 mr-1" />
                  Analyze style
                </button>
              </div>
          </div>
          </>
        )}
        
        {activeTab === "search" && (
          <>
            {/* Research Tips */}
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
              <h3 className="font-medium text-xs mb-2 flex items-center text-green-800 dark:text-green-200">
                <Search className="h-3 w-3 mr-1" />
                Research Tips
              </h3>
              <ul className="text-xs text-green-700 dark:text-green-300 space-y-0.5">
                <li>• Use specific keywords</li>
                <li>• Try academic sources</li>
                <li>• Save important sources</li>
                <li>• Extract content</li>
              </ul>
              </div>
            
            {/* Search History */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              <h3 className="font-medium text-xs mb-2 flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                Recent Searches
              </h3>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <p>No recent searches</p>
              </div>
            </div>
          </>
        )}
        
        {activeTab === "command" && (
          <>
            {/* AI Assistant Help */}
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
              <h3 className="font-medium text-xs mb-2 flex items-center text-purple-800 dark:text-purple-200">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Assistant
              </h3>
              <div className="text-xs text-purple-700 dark:text-purple-300 space-y-1">
                <p>Tell the AI what you need:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>Rewrite paragraph</li>
                  <li>Make it formal</li>
                  <li>Add examples</li>
                  <li>Fix grammar</li>
                </ul>
              </div>
            </div>
            
            {/* Command Examples */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              <h3 className="font-medium text-xs mb-2 flex items-center">
                <Code className="h-3 w-3 mr-1" />
                Text Commands
              </h3>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                <div><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded text-xs">s/old/new/g</code> - Replace</div>
                <div><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded text-xs">/pattern/</code> - Search</div>
                <div><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded text-xs">d</code> - Delete line</div>
              </div>
            </div>
          </>
        )}
        
        {activeTab === "style" && (
          <>
            {/* Style Tips */}
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
              <h3 className="font-medium text-xs mb-2 flex items-center text-orange-800 dark:text-orange-200">
                <BarChart2 className="h-3 w-3 mr-1" />
                Style Analysis
              </h3>
              <div className="text-xs text-orange-700 dark:text-orange-300 space-y-1">
                <p>Analyzing for:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>Readability score</li>
                  <li>Sentence complexity</li>
                  <li>Vocabulary variety</li>
                  <li>Tone and formality</li>
                </ul>
              </div>
            </div>
            
            {/* Document Analysis */}
            {documentData && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                <h3 className="font-medium text-xs mb-1">Document Analysis</h3>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  <p>Project ID: {documentData.projectId}</p>
                  <p>Word Count: {documentData.wordCount || 0}</p>
          </div>
            </div>
          )}
          </>
        )}
        
        {/* Global Document Info */}
        <div className="border-t pt-2 mt-2">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
            <h3 className="font-medium text-xs mb-1 flex items-center text-blue-800 dark:text-blue-200">
              <FileText className="h-3 w-3 mr-1" />
              {title || "Untitled Document"}
            </h3>
            <div className="text-xs text-blue-600 dark:text-blue-400">
              <p>Modified: {new Date().toLocaleDateString()}</p>
              {content && <p>~{Math.ceil(content.trim().split(/\s+/).length / 200)} min read</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
