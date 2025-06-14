import { useState, useEffect } from "react";
import { useSettings } from "@/providers/SettingsProvider";
import { useProcessing } from "@/providers/ProcessingProvider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sun, Moon, Menu, Info, Plus, Keyboard, Loader2, Brain } from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import AIProcessingIndicator from "./AIProcessingIndicator";

interface HeaderProps {
  toggleSidebar: () => void;
  toggleContextPanel: () => void;
  onNewProject: () => void;
  llmProvider: 'openai' | 'ollama';
  setLlmProvider: (provider: 'openai' | 'ollama') => void;
  llmModel: string;
  setLlmModel: (model: string) => void;
  contextPanelOpen: boolean;
}

export default function Header({ toggleSidebar, toggleContextPanel, onNewProject, llmProvider, setLlmProvider, llmModel, setLlmModel, contextPanelOpen }: HeaderProps) {
  const { settings, updateSettings } = useSettings();
  const { isAnyProcessing, processingState } = useProcessing();
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  useEffect(() => {
    if (llmProvider === 'ollama') {
      fetch('http://localhost:11434/api/tags')
        .then(res => res.json())
        .then(data => setOllamaModels(data.models?.map((m: any) => m.name) || []));
    }
  }, [llmProvider]);

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'light' ? 'dark' : settings.theme === 'dark' ? 'system' : 'light';
    updateSettings({ theme: nextTheme });
  };

  const getThemeIcon = () => {
    if (settings.theme === 'light') return <Moon className="h-5 w-5" />;
    if (settings.theme === 'dark') return <Sun className="h-5 w-5" />;
    // System theme - show based on current system preference
    const isDarkSystem = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDarkSystem ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />;
  };

  return (
    <header className="border-b dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
      <div className="w-full px-0 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3 ml-2">
          <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center space-x-2">
            <Keyboard className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">wordPlay </h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 mr-2">
          <Button 
            variant="outline" 
            size="sm"
            className="flex items-center space-x-1"
            onClick={onNewProject}
          >
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </Button>
          
          {/* Global AI Processing Indicator - Discrete */}
          {isAnyProcessing ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                    <div className="relative">
                      <Brain className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      <Loader2 className="h-2 w-2 text-blue-500 animate-spin absolute -top-0.5 -right-0.5" />
                    </div>
                    <div className="flex space-x-0.5">
                      <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{processingState.message || 'AI is processing...'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            /* Connection Status Indicator - Only show when AI isn't processing */
            <div className="flex items-center space-x-1 text-xs px-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-gray-600 dark:text-gray-400">Ready</span>
            </div>
          )}
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleContextPanel} aria-label="Toggle context panel">
                  <Info className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Context Panel</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
                  {getThemeIcon()}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle {settings.theme === "light" ? "Dark" : "Light"} Mode</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <Select value={llmProvider} onValueChange={v => setLlmProvider(v as 'openai' | 'ollama')}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="ollama">Ollama</SelectItem>
            </SelectContent>
          </Select>
          <Select value={llmModel} onValueChange={setLlmModel}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              {llmProvider === 'openai' ? (
                <>
                  <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                  <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                  <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                </>
              ) : (
                ollamaModels.map(model => (
                  <SelectItem key={model} value={model}>{model}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          
          <div className="flex items-center space-x-1 ml-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
              <span className="text-sm font-medium">U</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
