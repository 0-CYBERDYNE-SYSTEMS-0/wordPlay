import { useState, useEffect } from "react";
import { useSettings } from "@/providers/SettingsProvider";
import { useProcessing, ProcessingOperation } from "@/providers/ProcessingProvider";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Keyboard, Command, Brain, AlertCircle, CheckCircle, X, RotateCcw } from "lucide-react";
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
  focusMode?: 'writing' | 'organization' | 'research' | 'full';
  setFocusMode?: (mode: 'writing' | 'organization' | 'research' | 'full') => void;
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
  onToggleFullScreen,
  focusMode,
  setFocusMode
}: HeaderProps) {
  const { settings } = useSettings();
  const { 
    isAnyProcessing, 
    processingState, 
    getCurrentOperation, 
    retryOperation, 
    clearCompleted 
  } = useProcessing();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  const currentOperation = getCurrentOperation();
  const hasErrors = processingState.errorCount > 0;
  const hasCompleted = processingState.completedOperations > 0;

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
          
          {/* Center - Enhanced AI status indicator */}
          <div className="flex-1 flex justify-center">
            {isAnyProcessing && currentOperation && (
              <div 
                className="flex items-center space-x-3 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                onClick={() => setShowDetails(!showDetails)}
              >
                <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div className="flex flex-col items-start min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100 truncate">
                      {currentOperation.message}
                    </span>
                    {currentOperation.progress > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {currentOperation.progress}%
                      </Badge>
                    )}
                  </div>
                  {currentOperation.progress > 0 && (
                    <Progress 
                      value={currentOperation.progress} 
                      className="w-24 h-1 mt-1"
                    />
                  )}
                </div>
                {processingState.activeOperations > 1 && (
                  <Badge variant="outline" className="text-xs">
                    +{processingState.activeOperations - 1}
                  </Badge>
                )}
              </div>
            )}
            
            {/* Error indicator */}
            {hasErrors && !isAnyProcessing && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-red-50 dark:bg-red-900/20 rounded-full border border-red-200 dark:border-red-800">
                <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-900 dark:text-red-100">
                  {processingState.errorCount} failed
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearCompleted}
                  className="h-5 px-1 text-red-600 hover:text-red-700"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            {/* Completed indicator */}
            {hasCompleted && !isAnyProcessing && !hasErrors && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 rounded-full border border-green-200 dark:border-green-800">
                <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-900 dark:text-green-100">
                  {processingState.completedOperations} completed
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearCompleted}
                  className="h-5 px-1 text-green-600 hover:text-green-700"
                >
                  <X className="h-3 w-3" />
                </Button>
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

      {/* Detailed processing overlay */}
      {showDetails && isAnyProcessing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowDetails(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">AI Operations</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowDetails(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {processingState.operations.map((operation) => (
                <div key={operation.id} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {operation.status === 'active' && <Brain className="h-4 w-4 text-blue-500 animate-pulse" />}
                      {operation.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {operation.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                      <span className="text-sm font-medium">{operation.message}</span>
                    </div>
                    {operation.status === 'error' && operation.canRetry && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => retryOperation(operation.id)}
                        className="h-6 px-2"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  {operation.status === 'active' && (
                    <div className="space-y-1">
                      <Progress value={operation.progress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{operation.progress}%</span>
                        <span>{Math.round((Date.now() - operation.startTime) / 1000)}s</span>
                      </div>
                    </div>
                  )}
                  
                  {operation.error && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-800 dark:text-red-200">
                      {operation.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-4 flex justify-between items-center text-sm text-muted-foreground">
              <span>Total: {processingState.totalOperations}</span>
              <span>Active: {processingState.activeOperations}</span>
              <span>Completed: {processingState.completedOperations}</span>
            </div>
          </div>
        </div>
      )}

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
        focusMode={focusMode}
        setFocusMode={setFocusMode}
      />
    </>
  );
}
