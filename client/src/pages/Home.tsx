import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Editor from "@/components/Editor";
import ContextPanel from "@/components/ContextPanel";
import NewProjectModal from "@/components/NewProjectModal";
import WebSearch from "@/components/WebSearch";
import AIAgent from "@/components/AIAgent";
import SettingsPanel from "@/components/SettingsPanel";
import { AIProcessingOverlay } from "@/components/AIProcessingIndicator";
import { useDocument } from "@/hooks/use-document";
import { useSettings } from "@/providers/SettingsProvider";
import type { Project, Document } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true); // Default to open to use left space
  const [contextPanelOpen, setContextPanelOpen] = useState(true); // Default to open to use right space
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "research" | "settings">("editor");
  const [activeProjectId, setActiveProjectId] = useState<number | null>(1); // Default project
  const [activeDocumentId, setActiveDocumentId] = useState<number | null>(1); // Default document
  
  // Full screen state management
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [preFullScreenState, setPreFullScreenState] = useState({
    sidebarOpen: true,
    contextPanelOpen: true
  });

  // Add state for AI suggestions and processing
  const [aiSuggestions, setAiSuggestions] = useState<string>("");
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiProcessingMessage, setAiProcessingMessage] = useState<string>("");

  // Fetch projects
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Current active project
  const activeProject = projects?.find(project => project.id === activeProjectId) || null;

  // Use document hook for the active document
  const {
    title,
    setTitle,
    content,
    setContent,
    isSaving,
    isDirty,
    saveError,
    autoSaveEnabled,
    saveDocument,
    documentData
  } = useDocument({
    documentId: activeDocumentId || undefined,
    projectId: activeProjectId || undefined,
    autosaveInterval: settings.autosaveInterval
  });

  // Handle toggling sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Handle toggling context panel
  const toggleContextPanel = () => {
    console.log("Toggling context panel. Current state:", contextPanelOpen);
    setContextPanelOpen(!contextPanelOpen);
  };

  // Handle new project creation
  const handleNewProject = () => {
    setNewProjectModalOpen(true);
  };

  // Handle project selection
  const handleSelectProject = (projectId: number) => {
    setActiveProjectId(projectId);
    setActiveDocumentId(null); // Reset active document when changing projects
  };

  // Handle document selection
  const handleSelectDocument = (documentId: number) => {
    setActiveDocumentId(documentId);
    // Automatically switch to editor tab when a document is selected
    setActiveTab("editor");
  };

  // Handle full screen toggle
  const toggleFullScreen = () => {
    if (isFullScreen) {
      // Exiting full screen - restore previous sidebar states
      setSidebarOpen(preFullScreenState.sidebarOpen);
      setContextPanelOpen(preFullScreenState.contextPanelOpen);
      setIsFullScreen(false);
    } else {
      // Entering full screen - save current states and hide sidebars
      setPreFullScreenState({
        sidebarOpen,
        contextPanelOpen
      });
      setSidebarOpen(false);
      setContextPanelOpen(false);
      setIsFullScreen(true);
    }
  };

  // Handle escape key to exit full screen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        toggleFullScreen();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isFullScreen]);

  // Auto-open context panel when switching to research
  useEffect(() => {
    if (activeTab === "research" && !contextPanelOpen) {
      setContextPanelOpen(true);
    }
  }, [activeTab]);

  // Debug logging
  useEffect(() => {
    console.log("Home component state:", { 
      contextPanelOpen, 
      title: title || "empty", 
      contentLength: content?.length || 0,
      settingsContextDefault: settings.contextPanelDefaultOpen 
    });
  }, [contextPanelOpen, title, content, settings.contextPanelDefaultOpen]);

  // Handle AI suggestions from slash commands
  const handleAiSuggestions = (suggestions: string) => {
    setAiSuggestions(suggestions);
    // Automatically open context panel to show suggestions
    if (!contextPanelOpen) {
      setContextPanelOpen(true);
    }
  };

  // If in full screen mode, render only the editor
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
        <Editor
          title={title}
          setTitle={setTitle}
          content={content}
          setContent={setContent}
          isSaving={isSaving}
          isDirty={isDirty}
          saveError={saveError}
          autoSaveEnabled={autoSaveEnabled}
          saveDocument={saveDocument}
          llmProvider={settings.llmProvider}
          llmModel={settings.llmModel}
          contextPanelOpen={false}
          onToggleContextPanel={() => {}}
          isFullScreen={isFullScreen}
          onToggleFullScreen={toggleFullScreen}
        />
        
        {/* Floating exit button */}
        <button
          onClick={toggleFullScreen}
          className="fixed top-4 right-4 z-50 p-2 bg-black bg-opacity-20 hover:bg-opacity-30 text-white rounded-full transition-opacity"
          title="Exit full screen (ESC)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 transition-colors duration-200 flex flex-col">
      <Header
        toggleSidebar={toggleSidebar}
        toggleContextPanel={toggleContextPanel}
        onNewProject={handleNewProject}
        llmProvider={settings.llmProvider}
        setLlmProvider={(provider) => updateSettings({ llmProvider: provider })}
        llmModel={settings.llmModel}
        setLlmModel={(model) => updateSettings({ llmModel: model })}
        contextPanelOpen={contextPanelOpen}
        isAIProcessing={isAIProcessing}
        aiProcessingMessage={aiProcessingMessage}
      />
      
      {/* Main Layout Grid */}
      <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : ''} ${contextPanelOpen ? 'context-open' : ''}`}>
        {/* Left Sidebar */}
        {sidebarOpen && (
          <div className="sidebar-container">
            <Sidebar
              isOpen={sidebarOpen}
              projects={projects || []}
              activeProjectId={activeProjectId}
              activeTab={activeTab}
              onSelectProject={handleSelectProject}
              onSelectDocument={handleSelectDocument}
              onChangeTab={setActiveTab}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        )}

        {/* Main Content Area */}
        <main className="main-content">
          {activeTab === "editor" && (
            <Editor
              title={title}
              setTitle={setTitle}
              content={content}
              setContent={setContent}
              isSaving={isSaving}
              isDirty={isDirty}
              saveError={saveError}
              autoSaveEnabled={autoSaveEnabled}
              saveDocument={saveDocument}
              llmProvider={settings.llmProvider}
              llmModel={settings.llmModel}
              contextPanelOpen={contextPanelOpen}
              onToggleContextPanel={toggleContextPanel}
              isFullScreen={isFullScreen}
              onToggleFullScreen={toggleFullScreen}
              onSuggestions={handleAiSuggestions}
            />
          )}
          {activeTab === "research" && (
            <WebSearch 
              projectId={activeProjectId || undefined}
              contextPanelOpen={contextPanelOpen}
              onToggleContextPanel={toggleContextPanel}
            />
          )}
          {activeTab === "settings" && (
            <SettingsPanel
              contextPanelOpen={contextPanelOpen}
              onToggleContextPanel={toggleContextPanel}
            />
          )}
        </main>

        {/* Right Context Panel */}
        {contextPanelOpen && (
          <div className="context-container">
            <ContextPanel 
              title={title || ""}
              content={content || ""}
              documentData={documentData as Document | undefined}
              activeTab={activeTab}
              onClose={toggleContextPanel}
              aiSuggestions={aiSuggestions}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <NewProjectModal
        isOpen={newProjectModalOpen}
        onClose={() => setNewProjectModalOpen(false)}
        onCreateProject={(project) => {
          setActiveProjectId(project.id);
          setNewProjectModalOpen(false);
        }}
      />
      
      {/* AI Agent - floating, minimized by default */}
      {(
        <AIAgent
          currentProject={activeProject}
          currentDocument={documentData}
          llmProvider={settings.llmProvider}
          llmModel={settings.llmModel}
          onToolResult={(result) => {
            if (!result.success) {
              toast({
                title: "Tool Error",
                description: result.error || "Tool execution failed",
                variant: "destructive"
              });
              return;
            }

            // Handle different tool types properly
            switch (result.tool) {
              case 'update_document':
                if (result.data?.content !== undefined) {
                  setContent(result.data.content);
                  if (result.data.title) {
                    setTitle(result.data.title);
                  }
                  toast({
                    title: "Document Updated",
                    description: "Your document has been updated by the agent",
                  });
                }
                break;

              case 'replace_in_text':
                if (result.data?.result !== undefined) {
                  setContent(result.data.result);
                  toast({
                    title: "Text Replaced",
                    description: `Replaced ${result.data.count || 0} instances`,
                  });
                }
                break;

              case 'generate_text':
                if (result.data && typeof result.data === 'string') {
                  setContent(prev => prev + '\n\n' + result.data);
                  toast({
                    title: "Text Generated",
                    description: "AI generated content has been added",
                  });
                }
                break;

              case 'process_text_command':
                if (result.data && typeof result.data === 'string') {
                  setContent(result.data);
                  toast({
                    title: "Text Command Executed",
                    description: "Your text has been processed",
                  });
                }
                break;

              case 'edit_current_document':
                // Handle direct editor operations
                if (result.data?.operation && result.data?.content !== undefined) {
                  switch (result.data.operation) {
                    case 'replace':
                      setContent(result.data.content);
                      break;
                    case 'append':
                      setContent(prev => prev + result.data.content);
                      break;
                    case 'prepend':
                      setContent(prev => result.data.content + prev);
                      break;
                    case 'insert':
                      // For now, just append - could be enhanced with cursor position
                      setContent(prev => prev + '\n\n' + result.data.content);
                      break;
                  }
                  toast({
                    title: "Editor Updated",
                    description: `Content ${result.data.operation}d successfully`,
                  });
                }
                break;

              case 'replace_current_content':
                if (result.data?.content !== undefined) {
                  setContent(result.data.content);
                  toast({
                    title: "Document Replaced",
                    description: result.data.reason || "Content replaced by agent",
                  });
                }
                break;

              case 'edit_text_with_pattern':
                if (result.data?.content !== undefined) {
                  setContent(result.data.content);
                  toast({
                    title: "Pattern Edit Complete",
                    description: result.data.description || `Replaced ${result.data.count || 0} instances`,
                  });
                }
                break;

              case 'improve_current_text':
                if (result.data?.content !== undefined) {
                  setContent(result.data.content);
                  toast({
                    title: "Text Improved",
                    description: result.data.description || "Content improved by AI",
                  });
                }
                break;

              case 'create_document':
                if (result.data?.title && result.data?.content !== undefined) {
                  // If creating a new document, update the current editor
                  setTitle(result.data.title);
                  setContent(result.data.content);
                  toast({
                    title: "Document Created",
                    description: `Created "${result.data.title}"`,
                  });
                }
                break;

              default:
                // Fallback for other tools that return useful text content
                if (result.data && typeof result.data === 'string' && result.data.length > 20) {
                  setContent(prev => prev + '\n\n' + result.data);
                  toast({
                    title: "Agent Result",
                    description: result.message || "Tool executed successfully",
                  });
                }
                break;
            }
          }}
          editorState={{
            title,
            content,
            hasUnsavedChanges: isDirty,
            wordCount: content?.length ? content.trim().split(/\s+/).filter(Boolean).length : 0
          }}
        />
      )}
      
      {/* Global AI Processing Overlay */}
      <AIProcessingOverlay 
        isProcessing={isAIProcessing} 
        message={aiProcessingMessage || "AI is working on your request..."} 
      />
    </div>
  );
}
