import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Project, Document } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Search, Upload, Code, Brush, Link, File, Settings, HelpCircle } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  projects: Project[];
  activeProjectId: number | null;
  onSelectProject: (projectId: number) => void;
  onSelectDocument: (documentId: number) => void;
}

export default function Sidebar({
  isOpen,
  projects,
  activeProjectId,
  onSelectProject,
  onSelectDocument
}: SidebarProps) {
  // If the sidebar is not open, don't render anything
  if (!isOpen) {
    return null;
  }

  // Fetch documents for the active project
  const { data: documents } = useQuery<Document[]>({
    queryKey: activeProjectId ? [`/api/projects/${activeProjectId}/documents`] : null,
    enabled: !!activeProjectId
  });

  // Fetch sources for the active project
  const { data: sources } = useQuery({
    queryKey: activeProjectId ? [`/api/projects/${activeProjectId}/sources`] : null,
    enabled: !!activeProjectId
  });

  return (
    <aside className="w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex flex-col h-full shadow-sm">
      {/* Project Navigation */}
      <div className="p-4 border-b dark:border-gray-700">
        <h2 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Projects</h2>
        <div className="space-y-1">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`flex items-center p-2 rounded-md cursor-pointer ${
                project.id === activeProjectId
                  ? "bg-primary-light bg-opacity-10 text-primary dark:text-primary-light"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              onClick={() => onSelectProject(project.id)}
            >
              <FileText className="h-4 w-4 mr-2" />
              <span>{project.name}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Tools Navigation */}
      <div className="p-4 border-b dark:border-gray-700">
        <h2 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Tools</h2>
        <div className="space-y-1">
          <div className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
            <Search className="h-4 w-4 mr-2" />
            <span>Web Search</span>
          </div>
          <div className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
            <Upload className="h-4 w-4 mr-2" />
            <span>Upload Source</span>
          </div>
          <div className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
            <Code className="h-4 w-4 mr-2" />
            <span>Command Mode</span>
          </div>
          <div className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
            <Brush className="h-4 w-4 mr-2" />
            <span>Style Analysis</span>
          </div>
        </div>
      </div>
      
      {/* Recent Sources */}
      {sources && sources.length > 0 && (
        <div className="p-4 border-b dark:border-gray-700">
          <h2 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Sources</h2>
          <div className="space-y-1">
            {sources.map((source) => (
              <div 
                key={source.id}
                className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              >
                {source.type === 'url' ? (
                  <Link className="h-4 w-4 mr-2" />
                ) : source.type === 'pdf' ? (
                  <File className="h-4 w-4 mr-2" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                <span className="text-sm truncate">{source.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Settings */}
      <div className="mt-auto p-4 border-t dark:border-gray-700">
        <div className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
          <Settings className="h-4 w-4 mr-2" />
          <span>Settings</span>
        </div>
        <div className="flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
          <HelpCircle className="h-4 w-4 mr-2" />
          <span>Help & Support</span>
        </div>
      </div>
    </aside>
  );
}
