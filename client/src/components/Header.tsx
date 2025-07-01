import { useState, useEffect } from "react";
import { useSettings } from "@/providers/SettingsProvider";
import { useProcessing } from "@/providers/ProcessingProvider";
import { Button } from "@/components/ui/button";
import { Keyboard, Command, Brain } from "lucide-react";
import CommandPalette from "./CommandPalette";

interface HeaderProps {
  toggleSidebar: () => void;
  toggleContextPanel: () => void;
  onNewProject: () => void;
  llmProvider: 'openai' | 'ollama';
  setLlmProvider: (provider: 'openai' | 'ollama') => void;
  llmModel: string;
  setLlmModel: (model: string) => void;
  contextPanelOpen: boolean;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
}

export default function Header({ 
  toggleSidebar, 
  toggleContextPanel, 
  onNewProject, 
  llmProvider, 
  setLlmProvider, 
  llmModel, 
  setLlmModel, 
  contextPanelOpen,
  isFullScreen,
  onToggleFullScreen
}: HeaderProps) {
  const { settings } = useSettings();
  const { isAnyProcessing } = useProcessing();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className={`border-b dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50 transition-all duration-200 ${
        isAnyProcessing ? 'border-blue-200 dark:border-blue-800 shadow-blue-500/10' : ''
      }`}>
        <div className="w-full px-4 py-3 flex items-center justify-between">
          {/* Left side - Logo */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Keyboard className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold tracking-tight">wordPlay</h1>
            </div>
          </div>
          
          {/* Center - Subtle AI status indicator */}
          <div className="flex-1 flex justify-center">
            {isAnyProcessing && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-200 dark:border-blue-800">
                <Brain className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                <div className="flex space-x-0.5">
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}
          </div>
          
          {/* Right side - Command palette trigger */}
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Command className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">⌘K</span>
            </Button>
          </div>
        </div>
      </header>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNewProject={onNewProject}
        toggleContextPanel={toggleContextPanel}
        llmProvider={llmProvider}
        setLlmProvider={setLlmProvider}
        llmModel={llmModel}
        setLlmModel={setLlmModel}
        contextPanelOpen={contextPanelOpen}
        isFullScreen={isFullScreen}
        onToggleFullScreen={onToggleFullScreen}
      />
    </>
  );
}
