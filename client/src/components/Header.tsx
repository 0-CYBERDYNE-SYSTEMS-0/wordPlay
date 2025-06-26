import { useState, useEffect } from "react";
import { useSettings } from "@/providers/SettingsProvider";
import { useProcessing } from "@/providers/ProcessingProvider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sun, Moon, Menu, Info, Plus, Keyboard, Loader2, Brain, Settings, Zap, Star } from "lucide-react";
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

  const toggleUserMode = () => {
    const currentMode = settings.userExperienceMode;
    let newMode: 'simple' | 'advanced' | 'expert';
    
    if (currentMode === 'simple') {
      newMode = 'advanced';
    } else if (currentMode === 'advanced') {
      newMode = 'expert';
    } else {
      newMode = 'simple';
    }
    
    updateSettings({ userExperienceMode: newMode });
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
          
          {/* Global AI Processing Indicator - Larger and more prominent */}
          {isAnyProcessing ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-3 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="relative">
                      <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <Loader2 className="h-3 w-3 text-blue-500 animate-spin absolute -top-1 -right-1" />
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300 ml-2">
                        {processingState.message?.length > 20 
                          ? `${processingState.message.substring(0, 20)}...` 
                          : processingState.message || 'AI Processing'}
                      </span>
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
            <div className="flex items-center space-x-2 text-sm px-3 py-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-gray-600 dark:text-gray-400">Ready</span>
            </div>
          )}
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={contextPanelOpen ? "default" : "ghost"} 
                  size="icon" 
                  onClick={toggleContextPanel} 
                  aria-label="Toggle context panel"
                >
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

          {/* User Experience Mode Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={settings.userExperienceMode !== 'simple' ? "default" : "outline"} 
                  size="sm" 
                  onClick={toggleUserMode} 
                  className="flex items-center space-x-1"
                >
                  {settings.userExperienceMode === 'simple' ? (
                    <>
                      <Zap className="h-4 w-4" />
                      <span className="hidden sm:inline">Simple</span>
                    </>
                  ) : settings.userExperienceMode === 'advanced' ? (
                    <>
                      <Settings className="h-4 w-4" />
                      <span className="hidden sm:inline">Advanced</span>
                    </>
                  ) : (
                    <>
                      <Star className="h-4 w-4" />
                      <span className="hidden sm:inline">Expert</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Switch to {
                  settings.userExperienceMode === 'simple' ? 'Advanced' : 
                  settings.userExperienceMode === 'advanced' ? 'Expert' : 'Simple'
                } Mode</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {(settings.userExperienceMode === 'advanced' || settings.userExperienceMode === 'expert') && (
            <>
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
            </>
          )}
          
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
