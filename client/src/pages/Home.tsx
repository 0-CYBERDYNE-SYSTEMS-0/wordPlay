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
import type { Project, Document } from "@shared/schema";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "search" | "command" | "style">("editor");
  const [activeProjectId, setActiveProjectId] = useState<number | null>(1); // Default project
  const [activeDocumentId, setActiveDocumentId] = useState<number | null>(1); // Default document
  const [llmProvider, setLlmProvider] = useState<'openai' | 'ollama'>('openai');
  const [llmModel, setLlmModel] = useState<string>('gpt-4o');

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
    documentData
  } = useDocument({
    documentId: activeDocumentId || undefined,
    projectId: activeProjectId || undefined
  });

  // Handle toggling sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Handle toggling context panel
  const toggleContextPanel = () => {
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
  };

  return (
    <div className="font-sans bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 transition-colors duration-200 min-h-screen flex flex-col">
      <Header
        toggleSidebar={toggleSidebar}
        toggleContextPanel={toggleContextPanel}
        onNewProject={handleNewProject}
        llmProvider={llmProvider}
        setLlmProvider={setLlmProvider}
        llmModel={llmModel}
        setLlmModel={setLlmModel}
      />
      
      <div className="flex flex-1 h-[calc(100vh-61px)]">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          projects={projects || []}
          activeProjectId={activeProjectId}
          onSelectProject={handleSelectProject}
          onSelectDocument={handleSelectDocument}
          onChangeTab={setActiveTab}
        />
        
        {/* Main Content */}
        <main className="flex-1 overflow-hidden flex">
          {activeTab === "editor" && (
            <Editor
              title={title}
              setTitle={setTitle}
              content={content}
              setContent={setContent}
              isSaving={isSaving}
              onChangeTab={setActiveTab}
              activeTab={activeTab}
              llmProvider={llmProvider}
              llmModel={llmModel}
            />
          )}
          
          {activeTab === "search" && (
            <WebSearch 
              onChangeTab={setActiveTab}
              activeTab={activeTab}
              projectId={activeProjectId || undefined}
            />
          )}
          
          {activeTab === "command" && (
            <CommandMode
              onChangeTab={setActiveTab}
              activeTab={activeTab}
              content={content}
              setContent={setContent}
            />
          )}
          
          {activeTab === "style" && (
            <StyleAnalysis
              onChangeTab={setActiveTab}
              activeTab={activeTab}
              content={content}
              documentData={documentData as Document | undefined}
            />
          )}
          
          {/* Context Panel */}
          {contextPanelOpen && (
            <ContextPanel 
              title={title}
              content={content}
              documentData={documentData as Document | undefined}
              onClose={toggleContextPanel}
            />
          )}
        </main>
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
      
      {/* AI Agent */}
      <AIAgent
        currentProject={activeProject}
        currentDocument={documentData}
        onToolResult={(result) => {
          // Handle tool results that might update document content
          if (result.data && typeof result.data === 'string' && result.success) {
            // If it's a text generation or editing result, update content
            if (result.data.includes('\n') || result.data.length > 50) {
              setContent(prev => prev + '\n\n' + result.data);
            }
          }
        }}
      />
    </div>
  );
}
