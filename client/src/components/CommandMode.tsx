import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Edit, Search, Code, Terminal, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface CommandModeProps {
  activeTab: "editor" | "search" | "command";
  onChangeTab: (tab: "editor" | "search" | "command") => void;
  content: string;
  setContent: (content: string) => void;
}

interface CommandResult {
  command: string;
  result: string;
  message: string;
  timestamp: Date;
}

export default function CommandMode({
  activeTab,
  onChangeTab,
  content,
  setContent
}: CommandModeProps) {
  const { toast } = useToast();
  const [command, setCommand] = useState("");
  const [naturalLanguagePrompt, setNaturalLanguagePrompt] = useState("");
  const [isNaturalLanguageMode, setIsNaturalLanguageMode] = useState(true);
  const [commandHistory, setCommandHistory] = useState<CommandResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  
  // Focus the appropriate input when tab is selected
  useEffect(() => {
    if (activeTab === "command") {
      if (isNaturalLanguageMode && promptInputRef.current) {
        promptInputRef.current.focus();
      } else if (commandInputRef.current) {
        commandInputRef.current.focus();
      }
    }
  }, [activeTab, isNaturalLanguageMode]);
  
  // Process command mutation (for technical command mode)
  const processCommandMutation = useMutation({
    mutationFn: async () => {
      setIsProcessing(true);
      const res = await apiRequest("POST", "/api/ai/process-command", {
        content,
        command
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Add command to history
      setCommandHistory(prev => [
        {
          command,
          result: data.result,
          message: data.message,
          timestamp: new Date()
        },
        ...prev
      ]);
      
      // Update document content if result is different
      if (data.result !== content) {
        setContent(data.result);
        
        toast({
          title: "Command executed",
          description: data.message
        });
      }
      
      // Clear command input
      setCommand("");
      setIsProcessing(false);
    },
    onError: (error) => {
      setIsProcessing(false);
      toast({
        title: "Command failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Process natural language prompt (for AI agent mode)
  const processNaturalLanguagePrompt = useMutation({
    mutationFn: async () => {
      setIsProcessing(true);
      const res = await apiRequest("POST", "/api/ai/contextual-help", {
        content,
        title: "User Prompt",
        prompt: naturalLanguagePrompt
      });
      return res.json();
    },
    onSuccess: async (data) => {
      // Show the AI thinking
      toast({
        title: "AI Assistant",
        description: "Thinking about your request...",
      });
      
      // Get the AI's response
      try {
        // Process the natural language command through OpenAI
        const commandRes = await apiRequest("POST", "/api/ai/process-command", {
          content,
          command: `Based on the user request: "${naturalLanguagePrompt}", determine what changes to make to the text and execute them.`
        });
        
        const commandData = await commandRes.json();
        
        // Update document content
        if (commandData.result !== content) {
          setContent(commandData.result);
        }
        
        // Add to history
        setCommandHistory(prev => [
          {
            command: naturalLanguagePrompt,
            result: commandData.result,
            message: data.message || commandData.message,
            timestamp: new Date()
          },
          ...prev
        ]);
        
        toast({
          title: "AI Assistant",
          description: data.message || "I've processed your request.",
        });
      } catch (error: any) {
        toast({
          title: "AI Assistant Error",
          description: error.message || "I couldn't complete that request",
          variant: "destructive"
        });
      }
      
      // Clear prompt input
      setNaturalLanguagePrompt("");
      setIsProcessing(false);
    },
    onError: (error) => {
      setIsProcessing(false);
      toast({
        title: "AI Assistant Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Handle command execution
  const executeCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    
    processCommandMutation.mutate();
  };
  
  // Handle natural language prompt
  const executeNaturalLanguagePrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalLanguagePrompt.trim()) return;
    
    processNaturalLanguagePrompt.mutate();
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
          AI Assistant
        </button>
      </div>
      
      {/* Command Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">PenP@l</h2>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsNaturalLanguageMode(true)}
                className={`px-3 py-1 text-sm rounded-md flex items-center ${
                  isNaturalLanguageMode
                    ? "bg-primary text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                }`}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Writing Assistant
              </button>
              <button
                onClick={() => setIsNaturalLanguageMode(false)}
                className={`px-3 py-1 text-sm rounded-md flex items-center ${
                  !isNaturalLanguageMode
                    ? "bg-primary text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                }`}
              >
                <Terminal className="h-4 w-4 mr-1" />
                Text Commands
              </button>
            </div>
          </div>
          
          {isNaturalLanguageMode ? (
            <>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Tell the AI what you need help with. The assistant can rewrite, edit, format, 
                or generate new content based on your document.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                <button 
                  className="p-2 text-sm text-left rounded border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => setNaturalLanguagePrompt("Rewrite this content to be more concise and professional.")}
                >
                  <span className="font-medium">Make it professional</span>
                  <span className="block text-xs text-gray-500">Rewrite in a business-appropriate tone</span>
                </button>
                <button 
                  className="p-2 text-sm text-left rounded border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => setNaturalLanguagePrompt("Fix any grammar and spelling errors in this document.")}
                >
                  <span className="font-medium">Fix errors</span>
                  <span className="block text-xs text-gray-500">Correct spelling and grammar issues</span>
                </button>
                <button 
                  className="p-2 text-sm text-left rounded border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => setNaturalLanguagePrompt("Summarize the main points of this content in 3-4 bullet points.")}
                >
                  <span className="font-medium">Create summary</span>
                  <span className="block text-xs text-gray-500">Generate a concise summary</span>
                </button>
                <button 
                  className="p-2 text-sm text-left rounded border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => setNaturalLanguagePrompt("Generate a conclusion paragraph that ties together the main ideas.")}
                >
                  <span className="font-medium">Add conclusion</span>
                  <span className="block text-xs text-gray-500">Create a closing paragraph</span>
                </button>
              </div>
              
              <form onSubmit={executeNaturalLanguagePrompt} className="mb-6">
                <div className="border dark:border-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:ring-opacity-50">
                  <Textarea
                    ref={promptInputRef}
                    placeholder="Example: 'Rewrite the second paragraph to be more engaging' or 'Find and fix grammar errors' or 'Make this sound more professional'"
                    className="w-full p-3 min-h-[120px] bg-white dark:bg-gray-800 focus:outline-none border-0"
                    value={naturalLanguagePrompt}
                    onChange={(e) => setNaturalLanguagePrompt(e.target.value)}
                  />
                  <div className="flex justify-end bg-gray-50 dark:bg-gray-900 p-2">
                    <Button
                      type="submit"
                      disabled={isProcessing || !naturalLanguagePrompt.trim()}
                      className="px-4 py-2 bg-primary hover:bg-primary-dark text-white transition-colors"
                    >
                      {isProcessing ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Content
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
              
              <div className="border dark:border-gray-700 rounded-lg p-4 mb-6">
                <h3 className="text-md font-medium mb-2">AI Assistant Can Help With:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded flex items-start">
                    <div className="mt-0.5 mr-2 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">"Rewrite this paragraph to be more engaging"</p>
                  </div>
                  <div className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded flex items-start">
                    <div className="mt-0.5 mr-2 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">"Find and replace all instances of 'company' with 'organization'"</p>
                  </div>
                  <div className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded flex items-start">
                    <div className="mt-0.5 mr-2 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">"Generate a conclusion based on my content"</p>
                  </div>
                  <div className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded flex items-start">
                    <div className="mt-0.5 mr-2 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">"Format this text with proper paragraph breaks"</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Use grep and sed-like commands to manipulate your document directly.
              </p>
              
              <form onSubmit={executeCommand} className="mb-6">
                <div className="flex items-center border dark:border-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:ring-opacity-50">
                  <div className="bg-gray-100 dark:bg-gray-700 p-3 text-gray-500 dark:text-gray-400 font-mono">&gt;</div>
                  <Input 
                    ref={commandInputRef}
                    type="text" 
                    placeholder="grep 'artificial intelligence' | highlight" 
                    className="command-input flex-1 p-3 bg-white dark:bg-gray-800 focus:outline-none border-0 font-mono"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                  />
                  <Button 
                    type="submit"
                    className="p-3 bg-primary hover:bg-primary-dark text-white transition-colors rounded-none"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <Terminal className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </form>
              
              <div className="border dark:border-gray-700 rounded-lg p-4 mb-6">
                <h3 className="text-md font-medium mb-2">Common Commands</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <code className="font-mono text-xs text-primary dark:text-primary-light">grep 'pattern'</code>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Find all instances of a pattern</p>
                  </div>
                  <div className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <code className="font-mono text-xs text-primary dark:text-primary-light">replace 'old' 'new'</code>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Replace text throughout document</p>
                  </div>
                  <div className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <code className="font-mono text-xs text-primary dark:text-primary-light">style analyze</code>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Analyze current writing style</p>
                  </div>
                  <div className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <code className="font-mono text-xs text-primary dark:text-primary-light">auto-complete paragraph</code>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Generate a paragraph based on context</p>
                  </div>
                </div>
              </div>
            </>
          )}
          
          {commandHistory.length > 0 && (
            <div className="border dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-md font-medium mb-2">Interaction History</h3>
              <div className="space-y-2 text-sm">
                {commandHistory.map((cmd, index) => (
                  <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="flex items-start">
                      <div className="bg-primary rounded-full w-6 h-6 flex items-center justify-center text-white flex-shrink-0 mt-0.5 mr-2">
                        <span className="text-xs">You</span>
                      </div>
                      <span className="text-gray-800 dark:text-gray-200">{cmd.command}</span>
                    </div>
                    <div className="mt-2 pl-8 flex items-start">
                      <div className="bg-gray-300 dark:bg-gray-600 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                        <Sparkles className="h-3 w-3 text-gray-600 dark:text-gray-300" />
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">{cmd.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
