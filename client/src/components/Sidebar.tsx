import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Project, Document, Source } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  FileText, Search, Upload, Code, Brush, Link, File, Settings, 
  HelpCircle, BarChart2, PlusCircle, FolderPlus, ChevronDown, 
  ChevronRight, Trash2, Edit2, Sparkles, BookOpen, Plus, Wrench, Folder, X
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SidebarProps {
  isOpen: boolean;
  projects: Project[];
  activeProjectId: number | null;
  activeTab: "editor" | "search" | "command" | "style";
  onSelectProject: (projectId: number) => void;
  onSelectDocument: (documentId: number) => void;
  onChangeTab: (tab: "editor" | "search" | "command" | "style") => void;
  onClose: () => void;
}

export default function Sidebar({
  isOpen,
  projects,
  activeProjectId,
  activeTab,
  onSelectProject,
  onSelectDocument,
  onChangeTab,
  onClose
}: SidebarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [expandedSections, setExpandedSections] = useState<{
    projects: boolean;
    documents: boolean;
    tools: boolean;
    sources: boolean;
  }>({
    projects: true,
    documents: true,
    tools: true,
    sources: false
  });
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newDocumentName, setNewDocumentName] = useState("");
  const [isCreatingDocument, setIsCreatingDocument] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<number | null>(null);
  const [editingDocumentName, setEditingDocumentName] = useState("");

  // Only show sidebar content when open
  if (!isOpen) return null;

  // Fetch documents for the active project
  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: activeProjectId ? [`/api/projects/${activeProjectId}/documents`] : ['no-documents'],
    enabled: !!activeProjectId
  });

  // Fetch sources for the active project
  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: activeProjectId ? [`/api/projects/${activeProjectId}/sources`] : ['no-sources'],
    enabled: !!activeProjectId
  });
  
  // Create new project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/projects", {
        name,
        userId: 1, // Use a default user ID
        type: "writing"
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      onSelectProject(data.id);
      setNewProjectName("");
      setIsCreatingProject(false);
      
      toast({
        title: "Project created",
        description: `Project "${data.name}" has been created.`
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create project",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Create new document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!activeProjectId) {
        throw new Error("No project selected");
      }
      
      const res = await apiRequest("POST", "/api/documents", {
        projectId: activeProjectId,
        title,
        content: ""
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${activeProjectId}/documents`] });
      onSelectDocument(data.id);
      setNewDocumentName("");
      setIsCreatingDocument(false);
      
      toast({
        title: "Document created",
        description: `Document "${data.title}" has been created.`
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create document",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async ({ id, title }: { id: number, title: string }) => {
      const res = await apiRequest("PUT", `/api/documents/${id}`, {
        title
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${activeProjectId}/documents`] });
      setEditingDocumentId(null);
      setEditingDocumentName("");
      
      toast({
        title: "Document renamed",
        description: `Document has been renamed to "${data.title}".`
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to rename document",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/documents/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${activeProjectId}/documents`] });
      
      toast({
        title: "Document deleted",
        description: "The document has been deleted."
      });
      
      // If the active document was deleted, select another one if available
      if (documents.length > 1) {
        const otherDoc = documents.find(doc => doc.id !== id);
        if (otherDoc) {
          onSelectDocument(otherDoc.id);
        }
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to delete document",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Toggle section expand/collapse
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  // Handle creating a new project
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    
    createProjectMutation.mutate(newProjectName);
  };
  
  // Handle creating a new document
  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocumentName.trim()) return;
    
    createDocumentMutation.mutate(newDocumentName);
  };
  
  // Handle renaming a document
  const handleRenameDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDocumentId || !editingDocumentName.trim()) return;
    
    updateDocumentMutation.mutate({
      id: editingDocumentId,
      title: editingDocumentName
    });
  };
  
  // Start editing document name
  const startEditingDocument = (document: Document) => {
    setEditingDocumentId(document.id);
    setEditingDocumentName(document.title);
  };
  
  // Confirm delete document
  const confirmDeleteDocument = (id: number) => {
    if (confirm("Are you sure you want to delete this document? This action cannot be undone.")) {
      deleteDocumentMutation.mutate(id);
    }
  };

  // Navigate to Settings
  const handleNavigateToSettings = () => {
    setLocation('/settings');
  };

  return (
    <aside className="h-full w-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Navigation</h2>
        <button 
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Close navigation"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Projects Section */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center">
              <Folder className="h-4 w-4 mr-2" />
              Projects
            </h3>
            <button 
              onClick={() => setIsCreatingProject(true)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="New project"
            >
              <Plus className="h-4 w-4 text-gray-500" />
            </button>
          </div>
          
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className={`p-3 rounded-lg text-sm cursor-pointer transition-colors ${
                  project.id === activeProjectId
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                <div className="font-medium">{project.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {project.type || 'Writing'}
                </div>
              </div>
            ))}
          </div>

          {/* Create new project */}
          {isCreatingProject && (
            <form onSubmit={handleCreateProject} className="mt-2">
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name"
                className="mb-2"
                autoFocus
              />
              <div className="flex space-x-2">
                <Button type="submit" size="sm" disabled={createProjectMutation.isPending}>
                  Create
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setIsCreatingProject(false);
                    setNewProjectName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Documents Section */}
        {activeProjectId && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Documents
              </h3>
              <button 
                onClick={() => setIsCreatingDocument(true)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title="New document"
              >
                <Plus className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-2">
              {documents.map((document) => (
                <div key={document.id} className="group">
                  {editingDocumentId === document.id ? (
                    <form onSubmit={handleRenameDocument} className="space-y-2">
                      <Input
                        value={editingDocumentName}
                        onChange={(e) => setEditingDocumentName(e.target.value)}
                        className="text-sm"
                        autoFocus
                      />
                      <div className="flex space-x-1">
                        <Button type="submit" size="sm">Save</Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => setEditingDocumentId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div
                      onClick={() => onSelectDocument(document.id)}
                      className="p-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                    >
                      <span className="truncate flex-1">{document.title}</span>
                      <div className="opacity-0 group-hover:opacity-100 flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingDocument(document);
                          }}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDeleteDocument(document.id);
                          }}
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Create new document */}
            {isCreatingDocument && (
              <form onSubmit={handleCreateDocument} className="mt-2">
                <Input
                  value={newDocumentName}
                  onChange={(e) => setNewDocumentName(e.target.value)}
                  placeholder="Document title"
                  className="mb-2"
                  autoFocus
                />
                <div className="flex space-x-2">
                  <Button type="submit" size="sm" disabled={createDocumentMutation.isPending}>
                    Create
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setIsCreatingDocument(false);
                      setNewDocumentName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tools Section */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
            <Wrench className="h-4 w-4 mr-2" />
            Tools
          </h3>
          
          <div className="space-y-2">
            <div 
              className={`flex items-center p-3 rounded-lg text-sm cursor-pointer transition-colors ${
                activeTab === "editor"
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              onClick={() => onChangeTab("editor")}
            >
              <Edit2 className="h-4 w-4 mr-3 flex-shrink-0" />
              <span>Editor</span>
            </div>
            <div 
              className={`flex items-center p-3 rounded-lg text-sm cursor-pointer transition-colors ${
                activeTab === "search"
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              onClick={() => onChangeTab("search")}
            >
              <Search className="h-4 w-4 mr-3 flex-shrink-0" />
              <span>Research</span>
            </div>
            <div 
              className={`flex items-center p-3 rounded-lg text-sm cursor-pointer transition-colors ${
                activeTab === "command"
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              onClick={() => onChangeTab("command")}
            >
              <Sparkles className="h-4 w-4 mr-3 flex-shrink-0" />
              <span>AI Assistant</span>
            </div>
            <div 
              className={`flex items-center p-3 rounded-lg text-sm cursor-pointer transition-colors ${
                activeTab === "style"
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              onClick={() => onChangeTab("style")}
            >
              <BarChart2 className="h-4 w-4 mr-3 flex-shrink-0" />
              <span>Style Analysis</span>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div 
            className="flex items-center p-3 rounded-lg text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={handleNavigateToSettings}
          >
            <Settings className="h-4 w-4 mr-3 flex-shrink-0" />
            <span>Settings</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
