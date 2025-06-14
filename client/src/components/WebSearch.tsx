import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useApiProcessing } from "@/hooks/use-api-processing";
import { Edit, Search, Code, Plus, ExternalLink, BookOpen, Globe, Archive, Save, Brain, Clock, BarChart2, Sparkles, PanelRightOpen, Folder, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WebSearchProps {
  projectId?: number;
  contextPanelOpen: boolean;
  onToggleContextPanel: () => void;
}

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

interface SearchResponse {
  results: SearchResult[];
  summary?: string;
  error?: string;
}

interface SavedSource {
  id: number;
  type: string;
  name: string;
  content?: string;
  url?: string;
  createdAt: string;
}

// Helper function to safely extract hostname from URL
function safeGetHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch (error) {
    // If URL is malformed, try to extract domain from it
    const cleanUrl = url.replace(/\]\(.*$/, ''); // Remove markdown syntax like ](...)
    try {
      return new URL(cleanUrl).hostname;
    } catch (error2) {
      // If still malformed, return a fallback
      return url.replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
    }
  }
}

// Helper function to clean URLs of malformed syntax
function cleanUrl(url: string): string {
  return url
    .replace(/\]\(.*$/, '') // Remove markdown link endings like ](...)
    .replace(/\)$/, '')     // Remove trailing parentheses
    .replace(/,$/, '')      // Remove trailing commas
    .replace(/\.$/, '')     // Remove trailing periods
    .trim();
}

export default function WebSearch({
  projectId,
  contextPanelOpen,
  onToggleContextPanel
}: WebSearchProps) {
  const { toast } = useToast();
  const { processedApiRequest } = useApiProcessing();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSource, setSearchSource] = useState("web");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [showResults, setShowResults] = useState(false);
  const [activeResearchTab, setActiveResearchTab] = useState("search");
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [researchNotes, setResearchNotes] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // For sources panel
  const [sources, setSources] = useState<{id: number; name: string; url: string}[]>([]);
  const [selectedSource, setSelectedSource] = useState<number | null>(null);
  const [sourceContent, setSourceContent] = useState("");
  
  // Fetch saved sources for the current project
  const sourcesQuery = useQuery({
    queryKey: ["sources", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await processedApiRequest("GET", `/api/projects/${projectId}/sources`, undefined, "Loading sources...");
      return res.json() as Promise<SavedSource[]>;
    },
    enabled: !!projectId
  });

  // Load existing research notes when component mounts or project changes
  useEffect(() => {
    if (sourcesQuery.data) {
      // Find the most recent "notes" type source and load it into research notes
      const notesSource = sourcesQuery.data
        .filter(source => source.type === "notes")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      if (notesSource?.content) {
        setResearchNotes(notesSource.content);
      }
    }
  }, [sourcesQuery.data]);
  
  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async () => {
      const res = await processedApiRequest("POST", "/api/search", {
        query: searchQuery,
        source: searchSource
      }, "Searching...");
      return res.json();
    },
    onSuccess: (data) => {
      setResults(data.results || []);
      setAiSummary(data.summary || "");
      setShowResults(true);
      
      if (data.results?.length === 0) {
        toast({
          title: "No results found",
          description: "Try refining your search query.",
          variant: "destructive"
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
  
  // Save source mutation
  const saveSourceMutation = useMutation({
    mutationFn: async (source: { name: string; url: string; content: string; type: string }) => {
      if (!projectId) throw new Error("No project selected");
      const res = await processedApiRequest("POST", `/api/projects/${projectId}/sources`, source, "Saving source...");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Source saved",
        description: "The source has been added to your project."
      });
      sourcesQuery.refetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to save source",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Save research notes mutation
  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("No project selected");
      const res = await processedApiRequest("POST", `/api/projects/${projectId}/sources`, {
        name: "Research Notes",
        type: "notes",
        content: researchNotes,
        url: ""
      }, "Saving notes...");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Notes saved",
        description: "Your research notes have been saved."
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to save notes",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Scrape URL mutation
  const scrapeUrlMutation = useMutation({
    mutationFn: async () => {
      const res = await processedApiRequest("POST", "/api/scrape", {
        url: scrapeUrl
      }, "Scraping webpage...");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.content) {
        saveSourceMutation.mutate({
          name: data.title || scrapeUrl,
          url: scrapeUrl,
          content: data.content,
          type: "webpage"
        });
        setScrapeUrl("");
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to scrape URL",
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
  
  // Handle scraping a webpage
  const handleScrape = (e: React.FormEvent) => {
    e.preventDefault();
    scrapeUrlMutation.mutate();
  };
  
  // Save research notes
  const handleSaveNotes = () => {
    if (!researchNotes.trim()) {
      toast({
        title: "Nothing to save",
        description: "Please add some research notes first."
      });
      return;
    }
    
    saveNotesMutation.mutate();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Web Search Header */}
      <div className="flex items-center justify-between border-b dark:border-gray-800 px-6 py-3">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-medium text-gray-700 dark:text-gray-300">Web Research</h2>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Context Panel Toggle */}
        <button 
            onClick={onToggleContextPanel}
            className={`p-2 rounded-lg transition-colors ${
              contextPanelOpen
                ? 'bg-primary bg-opacity-10 text-primary'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
            title={contextPanelOpen ? 'Hide Context Panel' : 'Show Context Panel'}
        >
            <PanelRightOpen className="h-5 w-5" />
        </button>
        </div>
      </div>
      
      {/* Search Content - Full width */}
      <div className="flex-1 overflow-auto p-6">
        <div className="w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Research Assistant</h2>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveResearchTab("search")}
                className={`px-3 py-1 text-sm rounded-md flex items-center ${
                  activeResearchTab === "search"
                    ? "bg-primary text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                }`}
              >
                <Search className="h-4 w-4 mr-1" />
                Web Search
              </button>
              <button
                onClick={() => setActiveResearchTab("url")}
                className={`px-3 py-1 text-sm rounded-md flex items-center ${
                  activeResearchTab === "url"
                    ? "bg-primary text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                }`}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Import URL
              </button>
              <button
                onClick={() => setActiveResearchTab("notes")}
                className={`px-3 py-1 text-sm rounded-md flex items-center ${
                  activeResearchTab === "notes"
                    ? "bg-primary text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                }`}
              >
                <BookOpen className="h-4 w-4 mr-1" />
                Notes
              </button>
            </div>
          </div>
          
          {activeResearchTab === "search" && (
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Search the web for information to enhance your writing. Find facts, references, and inspiration.
              </p>
              
              <form onSubmit={handleSearch} className="mb-6">
                <div className="flex items-center border dark:border-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:ring-opacity-50">
                  <Input 
                    ref={searchInputRef}
                    type="text" 
                    placeholder="Search for facts, statistics, or inspiration..." 
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
                    className={`text-xs ${searchSource === "web" ? "text-primary dark:text-primary-light font-medium" : "text-gray-600 dark:text-gray-400"} hover:underline`}
                    onClick={() => setSearchSource("web")}
                  >
                    General Web
                  </button>
                  <button 
                    type="button"
                    className={`text-xs ${searchSource === "academic" ? "text-primary dark:text-primary-light font-medium" : "text-gray-600 dark:text-gray-400"} hover:underline`}
                    onClick={() => setSearchSource("academic")}
                  >
                    Academic
                  </button>
                  <button 
                    type="button"
                    className={`text-xs ${searchSource === "news" ? "text-primary dark:text-primary-light font-medium" : "text-gray-600 dark:text-gray-400"} hover:underline`}
                    onClick={() => setSearchSource("news")}
                  >
                    News
                  </button>
                </div>
              </form>
              
              {showResults && (
                <div className="space-y-6">
                  {/* AI Summary Section */}
                  {aiSummary && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-center mb-3">
                        <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                        <h3 className="font-medium text-blue-900 dark:text-blue-100">AI Research Summary</h3>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="text-blue-800 dark:text-blue-200 leading-relaxed whitespace-pre-wrap">
                          {aiSummary}
                        </p>
                      </div>
                      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                        <button
                          onClick={() => setResearchNotes(prev => 
                            prev + `\n\n## Research Summary for "${searchQuery}"\n\n${aiSummary}\n\n---\n`
                          )}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Add summary to notes
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Search Results */}
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center">
                      <Search className="h-5 w-5 mr-2" />
                      Sources ({results.length})
                    </h3>
                    <div className="space-y-4">
                      {results.map((result, index) => (
                        <div key={index} className="border dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <h3 className="text-lg font-medium text-primary dark:text-primary-light">{result.title}</h3>
                            <button 
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              onClick={() => saveSourceMutation.mutate({
                                name: result.title,
                                url: result.url,
                                content: result.snippet,
                                type: "webpage"
                              })}
                              disabled={saveSourceMutation.isPending}
                              title="Save to your sources"
                            >
                              <Save className="h-4 w-4 text-gray-500" />
                            </button>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {result.snippet}
                          </p>
                          <div className="flex items-center mt-2">
                            <span className="text-xs text-gray-500">{safeGetHostname(result.url)}</span>
                            <span className="mx-2 text-gray-300">|</span>
                            <a 
                              href={cleanUrl(result.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline flex items-center"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View Source
                            </a>
                            <span className="mx-2 text-gray-300">|</span>
                            <button 
                              className="text-xs text-primary dark:text-primary-light hover:underline"
                              onClick={() => saveSourceMutation.mutate({
                                name: result.title,
                                url: result.url,
                                content: result.snippet,
                                type: "webpage"
                              })}
                              disabled={saveSourceMutation.isPending}
                            >
                              Add to Sources
                            </button>
                            <span className="mx-2 text-gray-300">|</span>
                            <button 
                              className="text-xs text-green-600 dark:text-green-400 hover:underline"
                              onClick={() => {
                                setScrapeUrl(cleanUrl(result.url));
                                setActiveResearchTab("url");
                              }}
                            >
                              Extract Content
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeResearchTab === "url" && (
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Import content from a specific URL to reference in your writing.
              </p>
              
              <form onSubmit={handleScrape} className="mb-6">
                <div className="flex items-center border dark:border-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:ring-opacity-50">
                  <div className="bg-gray-100 dark:bg-gray-700 p-3 text-gray-500 dark:text-gray-400">
                    <Globe className="h-5 w-5" />
                  </div>
                  <Input 
                    type="url" 
                    placeholder="Enter a URL to import content (e.g., https://example.com/article)" 
                    className="flex-1 p-3 bg-white dark:bg-gray-800 focus:outline-none border-0"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                  />
                  <Button 
                    type="submit"
                    className="p-3 bg-primary hover:bg-primary-dark text-white transition-colors rounded-none"
                    disabled={scrapeUrlMutation.isPending || !scrapeUrl.trim()}
                  >
                    {scrapeUrlMutation.isPending ? (
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <Archive className="h-5 w-5" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  The content will be extracted and added to your research notes.
                </p>
              </form>
            </div>
          )}
          
          {activeResearchTab === "notes" && (
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Keep track of your research notes and insights to reference while writing.
              </p>
              
              <div className="border dark:border-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:ring-opacity-50 mb-4">
                <Textarea
                  placeholder="Add your research notes here. Content from web searches and URL imports will appear here."
                  className="w-full p-3 min-h-[200px] bg-white dark:bg-gray-800 focus:outline-none border-0"
                  value={researchNotes}
                  onChange={(e) => setResearchNotes(e.target.value)}
                />
                <div className="flex justify-end bg-gray-50 dark:bg-gray-900 p-2">
                  <Button
                    onClick={handleSaveNotes}
                    disabled={saveNotesMutation.isPending || !researchNotes.trim()}
                    className="px-4 py-2"
                    variant="outline"
                  >
                    {saveNotesMutation.isPending ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Save className="h-4 w-4 mr-2" />
                        Save Notes
                      </div>
                    )}
                  </Button>
                </div>
              </div>

              {/* Saved Sources Section */}
              {sourcesQuery.data && sourcesQuery.data.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <Folder className="h-5 w-5 mr-2" />
                    Saved Sources ({sourcesQuery.data.length})
                  </h3>
                  <div className="space-y-3">
                    {sourcesQuery.data.map((source) => (
                      <div key={source.id} className="border dark:border-gray-700 rounded-lg p-3 hover:shadow-sm transition-shadow">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{source.name}</h4>
                            <p className="text-xs text-gray-500 mt-1">
                              {source.type} • {new Date(source.createdAt).toLocaleDateString()}
                            </p>
                            {source.url && (
                              <a 
                                href={source.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-xs text-blue-500 hover:underline flex items-center mt-1"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                {source.url}
                              </a>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {source.content && (
                              <button
                                onClick={() => {
                                  setResearchNotes(prev => 
                                    prev + `\n\n## ${source.name}\n\n${source.content}\n\n---\n`
                                  );
                                  toast({
                                    title: "Content added",
                                    description: "Source content added to research notes."
                                  });
                                }}
                                className="text-xs text-green-600 dark:text-green-400 hover:underline"
                                title="Add to notes"
                              >
                                Add to Notes
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                try {
                                  await processedApiRequest("DELETE", `/api/projects/${projectId}/sources/${source.id}`);
                                  sourcesQuery.refetch();
                                  toast({
                                    title: "Source deleted",
                                    description: "Research source has been removed."
                                  });
                                } catch (error) {
                                  toast({
                                    title: "Failed to delete",
                                    description: "Could not remove the source.",
                                    variant: "destructive"
                                  });
                                }
                              }}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="Delete source"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                <p>Tips:</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Paste quotes or excerpts that support your writing</li>
                  <li>Add links to sources you want to reference later</li>
                  <li>Organize information with bullet points or sections</li>
                  <li>Make note of key statistics or facts for your document</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
