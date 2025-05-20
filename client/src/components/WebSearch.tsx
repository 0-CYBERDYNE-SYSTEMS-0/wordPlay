import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Edit, Search, Code, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WebSearchProps {
  activeTab: "editor" | "search" | "command";
  onChangeTab: (tab: "editor" | "search" | "command") => void;
  projectId?: number;
}

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export default function WebSearch({
  activeTab,
  onChangeTab,
  projectId
}: WebSearchProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSource, setSearchSource] = useState("web");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  
  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/search", {
        query: searchQuery,
        source: searchSource
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.results && data.results.length > 0) {
        setResults(data.results);
        setShowResults(true);
      } else {
        toast({
          title: "No results found",
          description: "Try a different search query or source."
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Add source mutation
  const addSourceMutation = useMutation({
    mutationFn: async (url: string) => {
      if (!projectId) {
        throw new Error("No active project");
      }
      
      const res = await apiRequest("POST", "/api/sources", {
        projectId,
        type: "url",
        name: url,
        url
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Source added",
        description: "The source has been added to your project."
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to add source",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    searchMutation.mutate();
  };
  
  // Handle adding a source
  const handleAddSource = (url: string) => {
    if (!projectId) {
      toast({
        title: "No active project",
        description: "Please select a project first.",
        variant: "destructive"
      });
      return;
    }
    
    addSourceMutation.mutate(url);
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
      
      {/* Search Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-semibold mb-4">Web Search</h2>
          
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex items-center border dark:border-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:ring-opacity-50">
              <Input 
                type="text" 
                placeholder="Search for information..." 
                className="flex-1 p-3 bg-white dark:bg-gray-800 focus:outline-none border-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button 
                type="submit"
                className="p-3 bg-primary hover:bg-primary-dark text-white transition-colors rounded-none"
                disabled={searchMutation.isPending}
              >
                {searchMutation.isPending ? (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </Button>
            </div>
            <div className="flex mt-2 space-x-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Sources:</span>
              <button 
                type="button"
                className={`text-xs ${searchSource === "web" ? "text-primary dark:text-primary-light" : "text-gray-600 dark:text-gray-400"} hover:underline`}
                onClick={() => setSearchSource("web")}
              >
                Web
              </button>
              <button 
                type="button"
                className={`text-xs ${searchSource === "academic" ? "text-primary dark:text-primary-light" : "text-gray-600 dark:text-gray-400"} hover:underline`}
                onClick={() => setSearchSource("academic")}
              >
                Academic
              </button>
              <button 
                type="button"
                className={`text-xs ${searchSource === "news" ? "text-primary dark:text-primary-light" : "text-gray-600 dark:text-gray-400"} hover:underline`}
                onClick={() => setSearchSource("news")}
              >
                News
              </button>
            </div>
          </form>
          
          {showResults && (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="border dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-medium text-primary dark:text-primary-light">{result.title}</h3>
                    <button 
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      onClick={() => handleAddSource(result.url)}
                      disabled={addSourceMutation.isPending}
                    >
                      <Plus className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {result.snippet}
                  </p>
                  <div className="flex items-center mt-2">
                    <span className="text-xs text-gray-500">{new URL(result.url).hostname}</span>
                    <span className="mx-2 text-gray-300">|</span>
                    <button 
                      className="text-xs text-primary dark:text-primary-light hover:underline"
                      onClick={() => handleAddSource(result.url)}
                      disabled={addSourceMutation.isPending}
                    >
                      Add to Sources
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
