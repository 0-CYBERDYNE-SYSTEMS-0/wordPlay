import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Edit, Search, Code, Terminal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [commandHistory, setCommandHistory] = useState<CommandResult[]>([]);
  
  // Process command mutation
  const processCommandMutation = useMutation({
    mutationFn: async () => {
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
    },
    onError: (error) => {
      toast({
        title: "Command failed",
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
          Commands
        </button>
      </div>
      
      {/* Command Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-semibold mb-4">Text Commands</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Use grep and sed-like commands to manipulate your document.</p>
          
          <form onSubmit={executeCommand} className="mb-6">
            <div className="flex items-center border dark:border-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:ring-opacity-50">
              <div className="bg-gray-100 dark:bg-gray-700 p-3 text-gray-500 dark:text-gray-400 font-mono">&gt;</div>
              <Input 
                type="text" 
                placeholder="grep 'artificial intelligence' | highlight" 
                className="command-input flex-1 p-3 bg-white dark:bg-gray-800 focus:outline-none border-0 font-mono"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
              />
              <Button 
                type="submit"
                className="p-3 bg-primary hover:bg-primary-dark text-white transition-colors rounded-none"
                disabled={processCommandMutation.isPending}
              >
                {processCommandMutation.isPending ? (
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
          
          <div className="space-y-4">
            <div className="border dark:border-gray-700 rounded-lg p-4">
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
            
            {commandHistory.length > 0 && (
              <div className="border dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-md font-medium mb-2">Command History</h3>
                <div className="space-y-2 text-sm">
                  {commandHistory.map((cmd, index) => (
                    <div key={index} className="p-2 bg-gray-50 dark:bg-gray-800 rounded font-mono text-xs">
                      <span className="text-gray-500 dark:text-gray-400">&gt; </span>
                      <span className="text-primary dark:text-primary-light">{cmd.command}</span>
                      <div className="mt-1 text-gray-600 dark:text-gray-400">{cmd.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
