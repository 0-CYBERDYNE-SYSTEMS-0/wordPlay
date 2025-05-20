import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Edit, Search, Code, BarChart2, Sparkles, BookOpen, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Document } from "@shared/schema";

interface StyleAnalysisProps {
  activeTab: "editor" | "search" | "command" | "style";
  onChangeTab: (tab: "editor" | "search" | "command" | "style") => void;
  content: string;
  documentData?: Document;
}

interface StyleMetrics {
  formality: number; // 0-100
  complexity: number; // 0-100
  coherence: number; // 0-100
  engagement: number; // 0-100
  conciseness: number; // 0-100
  commonPhrases: string[];
  suggestions: string[];
  toneAnalysis: string;
  readability: {
    score: number; // 0-100
    grade: string; // e.g., "College Level", "High School", etc.
  };
  wordDistribution: {
    unique: number;
    repeated: number;
    rare: number;
  };
}

export default function StyleAnalysis({
  activeTab,
  onChangeTab,
  content,
  documentData
}: StyleAnalysisProps) {
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [styleMetrics, setStyleMetrics] = useState<StyleMetrics | null>(null);
  
  // Analyze style mutation
  const analyzeStyleMutation = useMutation({
    mutationFn: async () => {
      setAnalyzing(true);
      try {
        const res = await apiRequest("POST", "/api/ai/analyze-style", {
          content
        });
        return res.json();
      } finally {
        setAnalyzing(false);
      }
    },
    onSuccess: (data) => {
      if (data.metrics) {
        setStyleMetrics(data.metrics);
        
        toast({
          title: "Analysis complete",
          description: "Your writing style has been analyzed."
        });
      } else {
        toast({
          title: "Analysis incomplete",
          description: "Couldn't generate complete style metrics.",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Handle analyzing style
  const handleAnalyzeStyle = () => {
    if (!content.trim() || content.length < 20) {
      toast({
        title: "Not enough content",
        description: "Please add more content to analyze style."
      });
      return;
    }
    
    analyzeStyleMutation.mutate();
  };
  
  // Automatically analyze style when component loads if content is available
  useEffect(() => {
    if (content && content.trim().length > 20 && !styleMetrics && !analyzing) {
      analyzeStyleMutation.mutate();
    }
  }, [content, styleMetrics, analyzing]);
  
  // Also run analysis when the component mounts if we already have content
  useEffect(() => {
    if (content && content.trim().length > 20 && !styleMetrics && !analyzing) {
      analyzeStyleMutation.mutate();
    }
  }, []);
  
  // Get text length details
  const wordCount = documentData?.wordCount || content.split(/\s+/).filter(Boolean).length;
  const charCount = content.length;
  const paragraphCount = content.split(/\n\s*\n/).filter(Boolean).length;
  
  // Format a metric value as a label
  const getMetricLabel = (value: number): string => {
    if (value < 30) return "Low";
    if (value < 70) return "Moderate";
    return "High";
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex border-b dark:border-gray-800">
        <button 
          className={`px-4 py-3 font-medium text-sm flex items-center ${
            activeTab === "editor" 
              ? "bg-primary text-white" 
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
          onClick={() => onChangeTab("editor")}
        >
          <Edit className="h-4 w-4 mr-2" />
          Editor
        </button>
        <button 
          className={`px-4 py-3 font-medium text-sm flex items-center ${
            activeTab === "search" 
              ? "bg-primary text-white" 
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
          onClick={() => onChangeTab("search")}
        >
          <Search className="h-4 w-4 mr-2" />
          Research
        </button>
        <button 
          className={`px-4 py-3 font-medium text-sm flex items-center ${
            activeTab === "command" 
              ? "bg-primary text-white" 
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
          onClick={() => onChangeTab("command")}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          AI Assistant
        </button>
        <button 
          className={`px-4 py-3 font-medium text-sm flex items-center ${
            activeTab === "style" 
              ? "bg-primary text-white" 
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
          onClick={() => onChangeTab("style")}
        >
          <BarChart2 className="h-4 w-4 mr-2" />
          Style
        </button>
      </div>
      
      {/* Style Analysis Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Writing Style Analysis</h2>
            
            <Button
              variant="outline"
              onClick={handleAnalyzeStyle}
              disabled={analyzing || !content.trim()}
              className="flex items-center"
            >
              {analyzing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Analyze Style
                </>
              )}
            </Button>
          </div>
          
          {/* Basic Text Stats */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Word Count</div>
              <div className="mt-1 flex items-baseline">
                <div className="text-2xl font-semibold">{wordCount}</div>
                <div className="ml-2 text-xs text-gray-500">words</div>
              </div>
            </div>
            
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Reading Time</div>
              <div className="mt-1 flex items-baseline">
                <div className="text-2xl font-semibold">{Math.ceil(wordCount / 225)}</div>
                <div className="ml-2 text-xs text-gray-500">minutes</div>
              </div>
            </div>
            
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Paragraphs</div>
              <div className="mt-1 flex items-baseline">
                <div className="text-2xl font-semibold">{paragraphCount}</div>
                <div className="ml-2 text-xs text-gray-500">{paragraphCount === 1 ? 'paragraph' : 'paragraphs'}</div>
              </div>
            </div>
          </div>
          
          {!styleMetrics && !analyzing && (
            <div className="border dark:border-gray-700 rounded-lg p-6 text-center bg-white dark:bg-gray-800 mb-6">
              <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-lg font-medium mb-2">No Style Analysis Available</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Click "Analyze Style" to get detailed insights about your writing style, readability metrics, and improvement suggestions.
              </p>
              <Button
                onClick={handleAnalyzeStyle}
                disabled={analyzing || !content.trim()}
                className="mx-auto"
              >
                <Zap className="h-4 w-4 mr-2" />
                Analyze Now
              </Button>
            </div>
          )}
          
          {analyzing && (
            <div className="border dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 mb-6">
              <h3 className="text-lg font-medium mb-4 text-center">Analyzing Your Writing Style</h3>
              <div className="space-y-1 mb-6">
                <div className="text-sm font-medium flex justify-between">
                  <span>Analyzing text...</span>
                  <span>Please wait</span>
                </div>
                <Progress value={analyzing ? 70 : 0} className="h-2" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Our AI is examining your writing patterns, readability, tone, and style. This might take a moment for longer texts.
              </p>
            </div>
          )}
          
          {/* Style Metrics Results */}
          {styleMetrics && (
            <div className="space-y-6">
              {/* Style Metrics */}
              <div className="border dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
                <h3 className="text-lg font-medium mb-4">Style Metrics</h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Formality</span>
                      <span className="text-sm text-gray-600">{getMetricLabel(styleMetrics.formality)}</span>
                    </div>
                    <Progress value={styleMetrics.formality} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Complexity</span>
                      <span className="text-sm text-gray-600">{getMetricLabel(styleMetrics.complexity)}</span>
                    </div>
                    <Progress value={styleMetrics.complexity} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Coherence</span>
                      <span className="text-sm text-gray-600">{getMetricLabel(styleMetrics.coherence)}</span>
                    </div>
                    <Progress value={styleMetrics.coherence} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Engagement</span>
                      <span className="text-sm text-gray-600">{getMetricLabel(styleMetrics.engagement)}</span>
                    </div>
                    <Progress value={styleMetrics.engagement} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Conciseness</span>
                      <span className="text-sm text-gray-600">{getMetricLabel(styleMetrics.conciseness)}</span>
                    </div>
                    <Progress value={styleMetrics.conciseness} className="h-2" />
                  </div>
                </div>
              </div>
              
              {/* Readability */}
              <div className="border dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
                <h3 className="text-lg font-medium mb-4">Readability</h3>
                
                <div className="mb-4 flex items-center">
                  <div className="mr-4">
                    <div className="relative h-20 w-20 flex items-center justify-center">
                      <svg className="absolute" width="80" height="80" viewBox="0 0 100 100">
                        <circle 
                          className="text-gray-200 dark:text-gray-700" 
                          strokeWidth="10"
                          stroke="currentColor" 
                          fill="transparent" 
                          r="40" 
                          cx="50" 
                          cy="50" 
                        />
                        <circle 
                          className="text-primary" 
                          strokeWidth="10"
                          stroke="currentColor" 
                          fill="transparent" 
                          r="40" 
                          cx="50" 
                          cy="50" 
                          strokeDasharray={`${2 * Math.PI * 40}`}
                          strokeDashoffset={`${2 * Math.PI * 40 * (1 - styleMetrics.readability.score / 100)}`}
                          strokeLinecap="round"
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                      <span className="font-bold text-lg">{styleMetrics.readability.score}</span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-medium">{styleMetrics.readability.grade}</div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {styleMetrics.readability.score > 80 ? (
                        "Your text is highly readable and accessible to most readers."
                      ) : styleMetrics.readability.score > 60 ? (
                        "Your text has good readability but could be simplified in some areas."
                      ) : (
                        "Your text might be challenging for some readers. Consider simplifying."
                      )}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Word Usage */}
              <div className="border dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
                <h3 className="text-lg font-medium mb-4">Word Usage</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Unique Words</div>
                    <div className="mt-1 text-xl font-semibold">{styleMetrics.wordDistribution.unique}</div>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Repeated Words</div>
                    <div className="mt-1 text-xl font-semibold">{styleMetrics.wordDistribution.repeated}</div>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Rare/Complex Words</div>
                    <div className="mt-1 text-xl font-semibold">{styleMetrics.wordDistribution.rare}</div>
                  </div>
                </div>
                
                {styleMetrics.commonPhrases.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Common Phrases & Patterns</h4>
                    <div className="flex flex-wrap gap-2">
                      {styleMetrics.commonPhrases.map((phrase, index) => (
                        <div key={index} className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-medium">
                          {phrase}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Tone Analysis */}
              <div className="border dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
                <h3 className="text-lg font-medium mb-2">Tone Analysis</h3>
                <p className="text-gray-700 dark:text-gray-300">{styleMetrics.toneAnalysis}</p>
              </div>
              
              {/* Suggestions */}
              {styleMetrics.suggestions.length > 0 && (
                <div className="border dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
                  <h3 className="text-lg font-medium mb-4">Suggestions for Improvement</h3>
                  <ul className="space-y-2">
                    {styleMetrics.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start">
                        <div className="flex-shrink-0 h-5 w-5 rounded-full bg-primary-light bg-opacity-20 flex items-center justify-center mr-2 mt-0.5">
                          <span className="text-primary text-xs font-bold">{index + 1}</span>
                        </div>
                        <span className="text-gray-700 dark:text-gray-300">{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}