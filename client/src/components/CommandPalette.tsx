import { useState, useEffect, useRef } from "react";
import { useSettings } from "@/providers/SettingsProvider";
import { useProcessing } from "@/providers/ProcessingProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Command,
  Sun, 
  Moon, 
  Settings, 
  Zap, 
  Star, 
  Plus,
  Info,
  Maximize,
  Minimize,
  Search,
  Keyboard,
  BarChart2,
  FileText,
  Brain
} from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNewProject: () => void;
  toggleContextPanel: () => void;
  llmProvider: 'openai' | 'ollama';
  setLlmProvider: (provider: 'openai' | 'ollama') => void;
  llmModel: string;
  setLlmModel: (model: string) => void;
  contextPanelOpen: boolean;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  shortcut?: string;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onNewProject,
  toggleContextPanel,
  llmProvider,
  setLlmProvider,
  llmModel,
  setLlmModel,
  contextPanelOpen,
  isFullScreen,
  onToggleFullScreen
}: CommandPaletteProps) {
  const { settings, updateSettings } = useSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  // Fetch Ollama models when provider is selected
  useEffect(() => {
    if (llmProvider === 'ollama') {
      fetch('http://localhost:11434/api/tags')
        .then(res => res.json())
        .then(data => setOllamaModels(data.models?.map((m: any) => m.name) || []))
        .catch(() => {});
    }
  }, [llmProvider]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'light' ? 'dark' : settings.theme === 'dark' ? 'system' : 'light';
    updateSettings({ theme: nextTheme });
    onClose();
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
    onClose();
  };

  const getThemeIcon = () => {
    if (settings.theme === 'light') return <Moon className="h-4 w-4" />;
    if (settings.theme === 'dark') return <Sun className="h-4 w-4" />;
    const isDarkSystem = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDarkSystem ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />;
  };

  const commands: CommandItem[] = [
    // Project & Navigation
    {
      id: 'new-project',
      title: 'New Project',
      description: 'Create a new writing project',
      icon: <Plus className="h-4 w-4" />,
      action: () => { onNewProject(); onClose(); },
      category: 'Project',
      shortcut: 'Ctrl+N'
    },
    {
      id: 'toggle-context',
      title: contextPanelOpen ? 'Hide Context Panel' : 'Show Context Panel',
      description: 'Toggle the insights and context panel',
      icon: <Info className="h-4 w-4" />,
      action: () => { toggleContextPanel(); onClose(); },
      category: 'View',
      shortcut: 'Ctrl+I'
    },
    {
      id: 'toggle-fullscreen',
      title: isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen',
      description: 'Toggle distraction-free full screen mode',
      icon: isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />,
      action: () => { onToggleFullScreen?.(); onClose(); },
      category: 'View',
      shortcut: 'F11'
    },

    // Appearance
    {
      id: 'toggle-theme',
      title: `Switch to ${settings.theme === 'light' ? 'Dark' : settings.theme === 'dark' ? 'System' : 'Light'} Theme`,
      description: 'Change the application theme',
      icon: getThemeIcon(),
      action: toggleTheme,
      category: 'Appearance',
      shortcut: 'Ctrl+T'
    },
    {
      id: 'toggle-mode',
      title: `Switch to ${settings.userExperienceMode === 'simple' ? 'Advanced' : settings.userExperienceMode === 'advanced' ? 'Expert' : 'Simple'} Mode`,
      description: 'Change interface complexity level',
      icon: settings.userExperienceMode === 'simple' ? <Settings className="h-4 w-4" /> : 
            settings.userExperienceMode === 'advanced' ? <Star className="h-4 w-4" /> : <Zap className="h-4 w-4" />,
      action: toggleUserMode,
      category: 'Appearance',
      shortcut: 'Ctrl+M'
    },

    // AI Provider (only show in advanced/expert mode)
    ...(settings.userExperienceMode !== 'simple' ? [
      {
        id: 'switch-openai',
        title: 'Switch to OpenAI',
        description: 'Use OpenAI GPT models',
        icon: <Brain className="h-4 w-4" />,
        action: () => { setLlmProvider('openai'); onClose(); },
        category: 'AI Provider'
      },
      {
        id: 'switch-ollama',
        title: 'Switch to Ollama',
        description: 'Use local Ollama models',
        icon: <Brain className="h-4 w-4" />,
        action: () => { setLlmProvider('ollama'); onClose(); },
        category: 'AI Provider'
      }
    ] : []),

    // AI Models (only show in advanced/expert mode)
    ...(settings.userExperienceMode !== 'simple' && llmProvider === 'openai' ? [
      {
        id: 'model-gpt-4.1',
        title: 'GPT-4.1',
        description: 'OpenAI\'s most capable model',
        icon: <Brain className="h-4 w-4" />,
        action: () => { setLlmModel('gpt-4.1'); onClose(); },
        category: 'AI Model'
      },
      {
        id: 'model-gpt-4.1-mini',
        title: 'GPT-4.1 Mini',
        description: 'Faster, more affordable model',
        icon: <Brain className="h-4 w-4" />,
        action: () => { setLlmModel('gpt-4.1-mini'); onClose(); },
        category: 'AI Model'
      },
      {
        id: 'model-gpt-4.1-nano',
        title: 'GPT-4.1 Nano',
        description: 'Fastest, most affordable model',
        icon: <Brain className="h-4 w-4" />,
        action: () => { setLlmModel('gpt-4.1-nano'); onClose(); },
        category: 'AI Model'
      }
    ] : []),

    ...(settings.userExperienceMode !== 'simple' && llmProvider === 'ollama' ? 
      ollamaModels.map(model => ({
        id: `model-${model}`,
        title: model,
        description: 'Local Ollama model',
        icon: <Brain className="h-4 w-4" />,
        action: () => { setLlmModel(model); onClose(); },
        category: 'AI Model'
      })) : [])
  ];

  // Filter commands based on search query
  const filteredCommands = commands.filter(command =>
    command.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    command.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    command.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev === 0 ? filteredCommands.length - 1 : prev - 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((groups, command) => {
    const category = command.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(command);
    return groups;
  }, {} as Record<string, CommandItem[]>);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-sm font-medium">
            <Command className="h-4 w-4" />
            Command Palette
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-3 border-b">
          <Input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search commands..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {Object.entries(groupedCommands).map(([category, categoryCommands]) => (
            <div key={category}>
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30">
                {category}
              </div>
              {categoryCommands.map((command, index) => {
                const globalIndex = filteredCommands.indexOf(command);
                return (
                  <button
                    key={command.id}
                    onClick={command.action}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors ${
                      globalIndex === selectedIndex ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded border bg-background">
                      {command.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{command.title}</span>
                        {command.shortcut && (
                          <kbd className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {command.shortcut}
                          </kbd>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {command.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
          
          {filteredCommands.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No commands found</p>
              <p className="text-xs">Try a different search term</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>↑↓ Navigate • Enter Select • Esc Close</span>
            <span>Ctrl+K to open</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}