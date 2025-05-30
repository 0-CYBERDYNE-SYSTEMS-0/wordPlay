import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Editor from "@/components/Editor";
import ContextPanel from "@/components/ContextPanel";
import NewProjectModal from "@/components/NewProjectModal";
import WebSearch from "@/components/WebSearch";
import CommandMode from "@/components/CommandMode";
import StyleAnalysis from "@/components/StyleAnalysis";
import AIAgent from "@/components/AIAgent";
import { useDocument } from "@/hooks/use-document";
import { useSettings } from "@/providers/SettingsProvider";
import type { Project, Document } from "@shared/schema";

export default function Home() {
  const { settings, updateSettings } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(true); // Default to open to use left space
  const [contextPanelOpen, setContextPanelOpen] = useState(true); // Default to open to use right space
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "search" | "command" | "style">("editor");
  const [activeProjectId, setActiveProjectId] = useState<number | null>(1); // Default project
  const [activeDocumentId, setActiveDocumentId] = useState<number | null>(1); // Default document
  
  // Full screen state management
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [preFullScreenState, setPreFullScreenState] = useState({
    sidebarOpen: true,
    contextPanelOpen: true
  });

  // Add state for AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<string>("");

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

  // Auto-open context panel when switching to style analysis
  useEffect(() => {
    if (activeTab === "style" && !contextPanelOpen) {
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
          {activeTab === "search" && (
            <WebSearch 
              projectId={activeProjectId || undefined}
              contextPanelOpen={contextPanelOpen}
              onToggleContextPanel={toggleContextPanel}
            />
          )}
          {activeTab === "command" && (
            <CommandMode
              content={content}
              setContent={setContent}
              contextPanelOpen={contextPanelOpen}
              onToggleContextPanel={toggleContextPanel}
            />
          )}
          {activeTab === "style" && (
            <StyleAnalysis
              content={content}
              documentData={documentData as Document | undefined}
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
      {activeTab !== "command" && (
        <AIAgent
          currentProject={activeProject}
          currentDocument={documentData}
          llmProvider={settings.llmProvider}
          llmModel={settings.llmModel}
          onToolResult={(result) => {
            if (result.data && typeof result.data === 'string' && result.success) {
              if (result.data.includes('\n') || result.data.length > 50) {
                setContent(prev => prev + '\n\n' + result.data);
              }
            }
          }}
        />
      )}
    </div>
  );
}
