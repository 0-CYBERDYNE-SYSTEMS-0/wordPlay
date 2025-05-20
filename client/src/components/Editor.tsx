import { useState, useEffect, useRef } from "react";
import { useAISuggestions } from "@/hooks/use-ai-suggestions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Search, Code, X, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EditorProps {
  title: string;
  setTitle: (title: string) => void;
  content: string;
  setContent: (content: string) => void;
  isSaving: boolean;
  activeTab: "editor" | "search" | "command";
  onChangeTab: (tab: "editor" | "search" | "command") => void;
}

export default function Editor({
  title,
  setTitle,
  content,
  setContent,
  isSaving,
  activeTab,
  onChangeTab
}: EditorProps) {
  const { toast } = useToast();
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  
  // Get AI suggestions based on content
  const {
    suggestions,
    selectedSuggestion,
    setSelectedSuggestion,
    isFetching,
    generateTextCompletion,
    isGenerating
  } = useAISuggestions({
    content,
    enabled: true
  });
  
  // Show suggestion after typing and when suggestions are available
  useEffect(() => {
    if (hasFocus && suggestions.length > 0 && !showSuggestion) {
      const timer = setTimeout(() => {
        setShowSuggestion(true);
        setSelectedSuggestion(suggestions[0]);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [suggestions, hasFocus, showSuggestion]);
  
  // Handle accepting a suggestion
  const acceptSuggestion = async () => {
    if (selectedSuggestion) {
      setContent((prevContent) => prevContent + " " + selectedSuggestion);
      setShowSuggestion(false);
      
      toast({
        title: "Suggestion accepted",
        description: "The AI suggestion has been added to your document."
      });
    }
  };
  
  // Handle generating a paragraph
  const generateParagraph = async () => {
    try {
      const result = await generateTextCompletion("Continue this text with a new paragraph that follows logically.");
      if (result.generated) {
        setContent((prevContent) => prevContent + "\n\n" + result.generated);
        
        toast({
          title: "Paragraph generated",
          description: "A new paragraph has been added to your document."
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate paragraph.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-editor-light dark:bg-editor-dark">
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
          Search
        </button>
        <button 
          className={`px-4 py-3 font-medium text-sm flex items-center ${
            activeTab === "command" 
              ? "bg-primary text-white" 
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
          onClick={() => onChangeTab("command")}
        >
          <Code className="h-4 w-4 mr-2" />
          Commands
        </button>
      </div>
      
      {/* Editor Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-8 py-12">
          <div className="mb-4">
            <h1 
              ref={titleRef}
              contentEditable="true"
              className="text-3xl font-bold font-serif focus:outline-none border-b border-transparent focus:border-gray-300 dark:focus:border-gray-700 pb-1"
              onInput={(e) => setTitle(e.currentTarget.textContent || "Untitled Document")}
              onFocus={() => setHasFocus(true)}
              onBlur={() => setHasFocus(false)}
              suppressContentEditableWarning={true}
            >
              {title}
            </h1>
          </div>
          
          {/* Editable Content */}
          <div 
            ref={editorRef}
            contentEditable="true"
            className="prose prose-lg dark:prose-invert max-w-none font-serif focus:outline-none"
            onInput={(e) => setContent(e.currentTarget.innerText)}
            onFocus={() => setHasFocus(true)}
            onBlur={() => setHasFocus(false)}
            suppressContentEditableWarning={true}
          >
            {content}
          </div>
          
          {/* Saving Indicator */}
          {isSaving && (
            <div className="mt-4 text-sm text-gray-500 flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </div>
          )}
          
          {/* Suggestion Bubble */}
          {showSuggestion && selectedSuggestion && (
            <div className="mt-4 p-3 rounded-lg bg-primary bg-opacity-10 border border-primary-light">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-primary mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-sm font-medium text-primary dark:text-primary-light">AI Suggestion</span>
                </div>
                <button 
                  onClick={() => setShowSuggestion(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-gray-800 dark:text-gray-200 text-sm font-serif">
                <span className="text-gray-500">...</span> {selectedSuggestion}
              </p>
              <div className="flex space-x-2 mt-2">
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={acceptSuggestion}
                  className="bg-primary hover:bg-primary-dark text-white"
                >
                  Accept
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowSuggestion(false)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
          
          {/* Generate button */}
          <div className="mt-6">
            <Button 
              variant="outline"
              onClick={generateParagraph}
              disabled={isGenerating}
              className="flex items-center"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Paragraph
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
