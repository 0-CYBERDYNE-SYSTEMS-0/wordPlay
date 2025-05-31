import { useState, useEffect } from "react";
import { useSettings } from "@/providers/SettingsProvider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sun, Moon, Menu, Info, Plus } from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 5.523-4.477 10-10 10S0 15.523 0 10 4.477 0 10 0s10 4.477 10 10z" />
              <path d="M13 7l4 -4" />
              <path d="M13 7h-6a2 2 0 0 0 -2 2v6" />
              <path d="M17 17v-6a2 2 0 0 0 -2 -2h-6" />
            </svg>FFT
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
          
          {/* Connection Status Indicator */}
          <div className="flex items-center space-x-1 text-xs">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-gray-600 dark:text-gray-400">Connected</span>
          </div>
          
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
