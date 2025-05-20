import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Project, Document, Source } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  FileText, Search, Upload, Code, Brush, Link, File, Settings, 
  HelpCircle, BarChart2, PlusCircle, FolderPlus, ChevronDown, 
  ChevronRight, Trash2, Edit2, Sparkles, BookOpen
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SidebarProps {
  isOpen: boolean;
  projects: Project[];
  activeProjectId: number | null;
  onSelectProject: (projectId: number) => void;
  onSelectDocument: (documentId: number) => void;
  onChangeTab: (tab: "editor" | "search" | "command" | "style") => void;
}

export default function Sidebar({
  isOpen,
  projects,
  activeProjectId,
  onSelectProject,
  onSelectDocument,
  onChangeTab
}: SidebarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  // If the sidebar is not open, don't render anything
  if (!isOpen) {
    return null;
  }

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

  return (
    <aside className="w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex flex-col h-full shadow-sm">
      {/* Projects Section */}
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div 
            className="flex items-center cursor-pointer" 
            onClick={() => toggleSection('projects')}
          >
            {expandedSections.projects ? (
              <ChevronDown className="h-4 w-4 mr-1 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 mr-1 text-gray-500" />
            )}
            <h2 className="font-medium text-gray-700 dark:text-gray-300">Projects</h2>
          </div>
          
          <button 
            className="h-5 w-5 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600"
            onClick={() => setIsCreatingProject(!isCreatingProject)}
            title="New Project"
          >
            <PlusCircle className="h-3 w-3 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        
        {isCreatingProject && (
          <form onSubmit={handleCreateProject} className="mb-3">
            <div className="flex items-center space-x-1 mb-1">
              <Input
                type="text"
                placeholder="Project name..."
                className="h-7 text-sm"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
              />
              <Button 
                type="submit" 
                size="sm"
                className="h-7 px-2"
                disabled={!newProjectName.trim() || createProjectMutation.isPending}
              >
                {createProjectMutation.isPending ? "..." : "Add"}
              </Button>
            </div>
          </form>
        )}
        
        {expandedSections.projects && (
          <div className="space-y-1">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`flex items-center p-2 rounded-md cursor-pointer ${
                  project.id === activeProjectId
                    ? "bg-primary bg-opacity-10 text-primary dark:text-primary-light"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                onClick={() => onSelectProject(project.id)}
              >
                <FileText className="h-4 w-4 mr-2" />
                <span className="text-sm">{project.name}</span>
              </div>
            ))}
            
            {projects.length === 0 && !isCreatingProject && (
              <div className="text-sm text-gray-500 dark:text-gray-400 p-2">
                No projects yet. Create your first project.
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Documents Section */}
      {activeProjectId && (
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div 
              className="flex items-center cursor-pointer" 
              onClick={() => toggleSection('documents')}
            >
              {expandedSections.documents ? (
                <ChevronDown className="h-4 w-4 mr-1 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-1 text-gray-500" />
              )}
              <h2 className="font-medium text-gray-700 dark:text-gray-300">Documents</h2>
            </div>
            
            <button 
              className="h-5 w-5 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600"
              onClick={() => setIsCreatingDocument(!isCreatingDocument)}
              title="New Document"
            >
              <PlusCircle className="h-3 w-3 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
          
          {isCreatingDocument && (
            <form onSubmit={handleCreateDocument} className="mb-3">
              <div className="flex items-center space-x-1 mb-1">
                <Input
                  type="text"
                  placeholder="Document title..."
                  className="h-7 text-sm"
                  value={newDocumentName}
                  onChange={(e) => setNewDocumentName(e.target.value)}
                  autoFocus
                />
                <Button 
                  type="submit" 
                  size="sm"
                  className="h-7 px-2"
                  disabled={!newDocumentName.trim() || createDocumentMutation.isPending}
                >
                  {createDocumentMutation.isPending ? "..." : "Add"}
                </Button>
              </div>
            </form>
          )}
          
          {expandedSections.documents && (
            <div className="space-y-1">
              {documents.map((document) => (
                <div key={document.id} className="relative group">
                  {editingDocumentId === document.id ? (
                    <form onSubmit={handleRenameDocument}>
                      <div className="flex items-center space-x-1 mb-1">
                        <Input
                          type="text"
                          className="h-7 text-sm"
                          value={editingDocumentName}
                          onChange={(e) => setEditingDocumentName(e.target.value)}
                          autoFocus
                        />
                        <Button 
                          type="submit" 
                          size="sm"
                          className="h-7 px-2"
                          disabled={!editingDocumentName.trim() || updateDocumentMutation.isPending}
                        >
                          {updateDocumentMutation.isPending ? "..." : "Save"}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div
                      className={`flex items-center justify-between p-2 rounded-md cursor-pointer ${
                        document.id === (document as any).activeDocumentId
                          ? "bg-primary-light bg-opacity-10 text-primary dark:text-primary-light"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                      onClick={() => onSelectDocument(document.id)}
                    >
                      <div className="flex items-center overflow-hidden">
                        <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="text-sm truncate">{document.title}</span>
                      </div>
                      
                      <div className="flex space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingDocument(document);
                          }}
                          title="Rename"
                        >
                          <Edit2 className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        </button>
                        <button
                          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDeleteDocument(document.id);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {documents.length === 0 && !isCreatingDocument && (
                <div className="text-sm text-gray-500 dark:text-gray-400 p-2">
                  No documents in this project. Create your first document.
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Tools Navigation */}
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div 
            className="flex items-center cursor-pointer" 
            onClick={() => toggleSection('tools')}
          >
            {expandedSections.tools ? (
              <ChevronDown className="h-4 w-4 mr-1 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 mr-1 text-gray-500" />
            )}
            <h2 className="font-medium text-gray-700 dark:text-gray-300">Writing Tools</h2>
          </div>
        </div>
        
        {expandedSections.tools && (
          <div className="space-y-1">
            <div 
              className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => onChangeTab("editor")}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              <span className="text-sm">Editor</span>
            </div>
            <div 
              className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => onChangeTab("search")}
            >
              <Search className="h-4 w-4 mr-2" />
              <span className="text-sm">Research</span>
            </div>
            <div 
              className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => onChangeTab("command")}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              <span className="text-sm">AI Assistant</span>
            </div>
            <div 
              className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => onChangeTab("style")}
            >
              <BarChart2 className="h-4 w-4 mr-2" />
              <span className="text-sm">Style Analysis</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Recent Sources */}
      {activeProjectId && sources.length > 0 && (
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div 
              className="flex items-center cursor-pointer" 
              onClick={() => toggleSection('sources')}
            >
              {expandedSections.sources ? (
                <ChevronDown className="h-4 w-4 mr-1 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-1 text-gray-500" />
              )}
              <h2 className="font-medium text-gray-700 dark:text-gray-300">Research Sources</h2>
            </div>
          </div>
          
          {expandedSections.sources && (
            <div className="space-y-1">
              {sources.map((source: Source) => (
                <div 
                  key={source.id}
                  className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                >
                  {source.type === 'url' ? (
                    <Link className="h-4 w-4 mr-2" />
                  ) : source.type === 'pdf' ? (
                    <File className="h-4 w-4 mr-2" />
                  ) : source.type === 'notes' ? (
                    <BookOpen className="h-4 w-4 mr-2" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  <span className="text-sm truncate">{source.name || 'Unnamed Source'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Help & Settings */}
      <div className="mt-auto p-4 border-t dark:border-gray-700">
        <div className="space-y-1">
          <div className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
            <Settings className="h-4 w-4 mr-2" />
            <span className="text-sm">Settings</span>
          </div>
          <div className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
            <HelpCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">Help & Support</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
