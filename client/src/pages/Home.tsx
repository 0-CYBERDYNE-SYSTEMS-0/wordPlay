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
import { useDocument } from "@/hooks/use-document";
import type { Project } from "@shared/schema";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "search" | "command" | "style">("editor");
  const [activeProjectId, setActiveProjectId] = useState<number | null>(1); // Default project
  const [activeDocumentId, setActiveDocumentId] = useState<number | null>(1); // Default document

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
      />
      
      <div className="flex flex-1 h-[calc(100vh-61px)]">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          projects={projects || []}
          activeProjectId={activeProjectId}
          onSelectProject={handleSelectProject}
          onSelectDocument={handleSelectDocument}
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
          
          {/* Context Panel */}
          {contextPanelOpen && (
            <ContextPanel 
              title={title}
              content={content}
              documentData={documentData}
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
      
      {/* Floating Action Button */}
      <div className="fixed right-6 bottom-6">
        <button 
          className="w-12 h-12 rounded-full bg-primary hover:bg-primary-dark text-white shadow-lg flex items-center justify-center transition-colors"
          aria-label="AI Actions"
        >
          <i className="ri-ai-generate text-xl"></i>
        </button>
      </div>
    </div>
  );
}
