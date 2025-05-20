import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Document } from "@shared/schema";
import { X, FileText, Pilcrow, MessageSquare, Link, FileText as FileIcon, Upload } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { countWords, calculateReadingTime, extractStructure } from "@/lib/document-processor";

interface ContextPanelProps {
  title: string;
  content: string;
  documentData?: Document;
  onClose: () => void;
}

export default function ContextPanel({
  title,
  content,
  documentData,
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
    message: "",
    suggestions: []
  });
  
  // Get contextual assistance from AI
  const getContextualAssistanceMutation = useMutation({
    mutationFn: async () => {
      try {
        const res = await apiRequest("POST", "/api/ai/contextual-help", {
          content,
          title
        });
        return res.json();
      } catch (error) {
        console.error("Error getting contextual assistance:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data && data.message) {
        setContextualHelp({
          message: data.message,
          suggestions: data.suggestions || []
        });
      }
    }
  });
  const [aiPrompt, setAiPrompt] = useState("");
  
  // Get contextual help from AI
  const contextualHelpMutation = useMutation({
    mutationFn: async (data?: { prompt?: string; content?: string }) => {
      const payload = {
        content: data?.content || content,
        title,
        prompt: data?.prompt
      };
      
      const res = await apiRequest("POST", "/api/ai/contextual-help", payload);
      return res.json();
    }
  });
  
  // Update document stats when content changes
  useEffect(() => {
    setWordCount(countWords(content));
    setReadingTime(calculateReadingTime(content));
    setParagraphCount(content.split(/\n\s*\n/).filter(p => p.trim().length > 0).length);
    setDocumentStructure(extractStructure(content));
    
    // Get contextual help when content changes significantly
    if (content.length > 50 && content.length % 100 < 10) {
      contextualHelpMutation.mutate({});
    }
  }, [content]);
  
  // Update contextual help when mutation completes
  useEffect(() => {
    if (contextualHelpMutation.isSuccess && contextualHelpMutation.data) {
      setContextualHelp(contextualHelpMutation.data);
    }
  }, [contextualHelpMutation.isSuccess, contextualHelpMutation.data]);
  
  // Style metrics from document data or defaults
  const [styleMetrics, setStyleMetrics] = useState({
    formality: 50,
    complexity: 50,
    engagement: 50,
    tone: "Analyzing..."
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
        throw error;
      }
    },
    onSuccess: (data) => {
      if (data && data.metrics) {
        setStyleMetrics({
          formality: data.metrics.formality || 50,
          complexity: data.metrics.complexity || 50, 
          engagement: data.metrics.engagement || 50,
          tone: data.metrics.toneAnalysis?.split('.')[0] || "Neutral"
        });
      }
    }
  });
  
  // Run style analysis when content changes significantly
  useEffect(() => {
    if (content && content.length > 100) {
      styleAnalysisMutation.mutate();
    }
  }, [content]);
  
  // Handle sending AI prompt
  const handleSendPrompt = () => {
    if (!aiPrompt.trim()) return;
    
    // Send the prompt to the AI assistant
    contextualHelpMutation.mutate({
      prompt: aiPrompt,
      content: content
    });
    
    setAiPrompt("");
  };

  return (
    <div className="w-80 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex flex-col h-full">
      <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
        <h2 className="font-medium">Document Context</h2>
        <button 
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      {/* Document Stats */}
      <div className="p-4 border-b dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Document Stats</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Words:</span>
            <span className="ml-1">{wordCount}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Reading time:</span>
            <span className="ml-1">~{readingTime} min</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Paragraphs:</span>
            <span className="ml-1">{paragraphCount}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Tone:</span>
            <span className="ml-1">{styleMetrics.tone}</span>
          </div>
        </div>
      </div>
      
      {/* Document Structure */}
      <div className="p-4 border-b dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Structure</h3>
        <div className="space-y-2">
          <div className="p-2 bg-primary bg-opacity-10 rounded text-primary dark:text-primary-light text-sm flex items-center">
            <FileText className="h-4 w-4 mr-1" />
            <span className="truncate">{title || "Untitled Document"}</span>
          </div>
          
          {documentStructure.paragraphs.map((paragraph) => (
            <div 
              key={paragraph.id}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm cursor-pointer flex items-center"
            >
              <Pilcrow className="h-4 w-4 mr-1 flex-shrink-0" />
              <span className="truncate">{paragraph.text.substring(0, 30)}...</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* AI Assistant */}
      <div className="p-4 border-b dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">AI Assistant</h3>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
          <div className="flex space-x-2 items-start mb-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white flex-shrink-0">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-sm text-gray-800 dark:text-gray-200">
              <p>{contextualHelp.message}</p>
              <div className="mt-2 space-y-1">
                {contextualHelp.suggestions.map((suggestion, index) => (
                  <button 
                    key={index}
                    className="w-full text-left p-1.5 text-xs bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-200 dark:border-gray-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-3">
          <div className="flex border dark:border-gray-700 rounded overflow-hidden">
            <input 
              type="text" 
              placeholder="Ask the AI assistant..." 
              className="flex-1 p-2 text-sm bg-white dark:bg-gray-800 focus:outline-none"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSendPrompt();
                }
              }}
            />
            <button 
              className="p-2 bg-primary hover:bg-primary-dark text-white transition-colors"
              onClick={handleSendPrompt}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Sources */}
      <div className="p-4 border-b dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Active Sources</h3>
        <div className="space-y-2">
          <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm flex items-center">
            <FileIcon className="h-4 w-4 mr-2 text-gray-500" />
            <span className="truncate">AI Writing Tools Survey.pdf</span>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm flex items-center">
            <Link className="h-4 w-4 mr-2 text-gray-500" />
            <span className="truncate">blog.example.com/future-of-ai</span>
          </div>
        </div>
        
        <button className="mt-2 w-full p-2 text-xs border border-dashed border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 flex items-center justify-center">
          <Upload className="h-3 w-3 mr-1" /> Add Source
        </button>
      </div>
      
      {/* Style Analysis */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Style Analysis</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-gray-500 dark:text-gray-400">Formality</span>
              <span>Professional</span>
            </div>
            <Progress value={styleMetrics.formality * 100} className="h-1.5" />
          </div>
          
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-gray-500 dark:text-gray-400">Complexity</span>
              <span>Medium</span>
            </div>
            <Progress value={styleMetrics.complexity * 100} className="h-1.5" />
          </div>
          
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-gray-500 dark:text-gray-400">Engagement</span>
              <span>Informative</span>
            </div>
            <Progress value={styleMetrics.engagement * 100} className="h-1.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
