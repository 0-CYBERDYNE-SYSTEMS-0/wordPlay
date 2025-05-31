import React, { useState, useEffect, useRef } from 'react';
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList 
} from '@/components/ui/command';
import { 
  Pencil, 
  Type, 
  List, 
  Sparkles, 
  MessageSquare, 
  CheckSquare, 
  Wand2, 
  FileText, 
  Lightbulb,
  Globe,
  Layout,
  TreePine,
  Zap,
  Target,
  ArrowRight
} from 'lucide-react';

interface SlashCommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCommand: (command: SlashCommand) => void;
  filter: string;
  position: { x: number; y: number } | null;
}

export interface SlashCommand {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: string;
  category: string;
  hasParameters?: boolean;
  parameters?: string[];
  shortcut?: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // Creation Commands
  {
    id: 'continue',
    title: 'Continue writing',
    description: 'Continue the text with AI assistance',
    icon: <Type className="h-4 w-4" />,
    action: 'continue',
    category: 'creation',
    shortcut: '1'
  },
  {
    id: 'suggest',
    title: 'Ideas',
    description: 'Get new ideas related to your content',
    icon: <Lightbulb className="h-4 w-4" />,
    action: 'suggest',
    category: 'creation',
    shortcut: '2'
  },

  // Enhancement Commands
  {
    id: 'improve',
    title: 'Improve writing',
    description: 'Enhance clarity and readability',
    icon: <Sparkles className="h-4 w-4" />,
    action: 'improve',
    category: 'enhancement',
    hasParameters: true,
    parameters: ['clarity', 'engagement', 'flow', 'word-choice'],
    shortcut: '3'
  },
  {
    id: 'expand',
    title: 'Expand',
    description: 'Elaborate on the current text',
    icon: <Wand2 className="h-4 w-4" />,
    action: 'expand',
    category: 'enhancement',
    hasParameters: true,
    parameters: ['examples', 'detail', 'context', 'analysis'],
    shortcut: '4'
  },
  {
    id: 'rewrite',
    title: 'Rewrite',
    description: 'Rewrite the selected text',
    icon: <Pencil className="h-4 w-4" />,
    action: 'rewrite',
    category: 'enhancement',
    hasParameters: true,
    parameters: ['simpler', 'formal', 'engaging', 'different-angle'],
    shortcut: '5'
  },
  {
    id: 'simplify',
    title: 'Simplify',
    description: 'Make text easier to understand',
    icon: <Zap className="h-4 w-4" />,
    action: 'simplify',
    category: 'enhancement',
    shortcut: '6'
  },

  // Organization Commands
  {
    id: 'summarize',
    title: 'Summarize',
    description: 'Create a concise summary',
    icon: <FileText className="h-4 w-4" />,
    action: 'summarize',
    category: 'organization',
    shortcut: '7'
  },
  {
    id: 'list',
    title: 'Create list',
    description: 'Generate a list from the content',
    icon: <List className="h-4 w-4" />,
    action: 'list',
    category: 'organization',
    shortcut: '8'
  },
  {
    id: 'outline',
    title: 'Create outline',
    description: 'Generate structured outline',
    icon: <TreePine className="h-4 w-4" />,
    action: 'outline',
    category: 'organization',
    shortcut: '9'
  },
  {
    id: 'format',
    title: 'Format',
    description: 'Add proper formatting and structure',
    icon: <Layout className="h-4 w-4" />,
    action: 'format',
    category: 'organization'
  },

  // Utility Commands
  {
    id: 'fix',
    title: 'Fix grammar',
    description: 'Correct grammar and spelling',
    icon: <CheckSquare className="h-4 w-4" />,
    action: 'fix',
    category: 'utility'
  },
  {
    id: 'tone',
    title: 'Change tone',
    description: 'Adjust the tone of the text',
    icon: <MessageSquare className="h-4 w-4" />,
    action: 'tone',
    category: 'utility',
    hasParameters: true,
    parameters: ['professional', 'casual', 'academic', 'friendly', 'authoritative']
  },
  {
    id: 'translate',
    title: 'Translate',
    description: 'Translate text to another language',
    icon: <Globe className="h-4 w-4" />,
    action: 'translate',
    category: 'utility',
    hasParameters: true,
    parameters: ['spanish', 'french', 'german', 'italian', 'portuguese', 'other']
  }
];

export const COMMAND_CATEGORIES = {
  'creation': 'Creation',
  'enhancement': 'Enhancement', 
  'organization': 'Organization',
  'utility': 'Utility'
};

export default function SlashCommandMenu({ 
  isOpen, 
  onClose, 
  onSelectCommand, 
  filter, 
  position 
}: SlashCommandMenuProps) {
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>(SLASH_COMMANDS);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showingParameters, setShowingParameters] = useState<string | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<SlashCommand | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter commands based on user input
  useEffect(() => {
    if (filter === '') {
      setFilteredCommands(SLASH_COMMANDS);
    } else {
      const lowerFilter = filter.toLowerCase();
      setFilteredCommands(
        SLASH_COMMANDS.filter(
          command => 
            command.title.toLowerCase().includes(lowerFilter) || 
            command.description.toLowerCase().includes(lowerFilter) ||
            command.category.toLowerCase().includes(lowerFilter)
        )
      );
    }
    setSelectedIndex(0);
  }, [filter]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (showingParameters && selectedCommand) {
        // Handle parameter selection
        if (event.key === 'Escape') {
          setShowingParameters(null);
          setSelectedCommand(null);
          return;
        }
        
        if (event.key === 'Enter') {
          const paramIndex = selectedIndex;
          if (selectedCommand.parameters && paramIndex < selectedCommand.parameters.length) {
            const parameter = selectedCommand.parameters[paramIndex];
            onSelectCommand({
              ...selectedCommand,
              action: `${selectedCommand.action}:${parameter}`
            });
            onClose();
          }
          return;
        }
        
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : (selectedCommand.parameters?.length || 1) - 1
          );
          return;
        }
        
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedIndex(prev => 
            prev < (selectedCommand.parameters?.length || 1) - 1 ? prev + 1 : 0
          );
          return;
        }
      } else {
        // Handle main command selection
        if (event.key === 'Escape') {
          onClose();
          return;
        }
        
        if (event.key === 'Enter') {
          const command = filteredCommands[selectedIndex];
          if (command) {
            handleCommandSelect(command);
          }
          return;
        }
        
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : filteredCommands.length - 1);
          return;
        }
        
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedIndex(prev => prev < filteredCommands.length - 1 ? prev + 1 : 0);
          return;
        }
        
        // Handle number shortcuts
        const num = parseInt(event.key);
        if (num >= 1 && num <= 9) {
          const command = SLASH_COMMANDS.find(cmd => cmd.shortcut === num.toString());
          if (command) {
            handleCommandSelect(command);
          }
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, showingParameters, selectedCommand, onSelectCommand, onClose]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleCommandSelect = (command: SlashCommand) => {
    if (command.hasParameters && command.parameters) {
      setSelectedCommand(command);
      setShowingParameters(command.id);
      setSelectedIndex(0);
    } else {
      onSelectCommand(command);
      onClose();
    }
  };

  if (!isOpen || !position) return null;

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, command) => {
    if (!acc[command.category]) {
      acc[command.category] = [];
    }
    acc[command.category].push(command);
    return acc;
  }, {} as Record<string, SlashCommand[]>);

  return (
    <div 
      ref={menuRef}
      className="absolute z-50 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden w-80"
      style={{ 
        top: `${position.y}px`, 
        left: `${position.x}px`
      }}
    >
      <Command className="rounded-lg border shadow-md">
        <CommandInput 
          placeholder="Search commands..." 
          value={filter} 
          className="h-9"
          autoFocus
          readOnly
        />
        <CommandList className="max-h-80">
          <CommandEmpty>No commands found.</CommandEmpty>
          
          {showingParameters && selectedCommand ? (
            // Show parameter selection
            <CommandGroup heading={`${selectedCommand.title} - Choose style:`}>
              {selectedCommand.parameters?.map((param, index) => (
                <CommandItem
                  key={param}
                  onSelect={() => {
                    onSelectCommand({
                      ...selectedCommand,
                      action: `${selectedCommand.action}:${param}`
                    });
                    onClose();
                  }}
                  className={`flex items-center px-2 py-1 cursor-pointer ${
                    index === selectedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <ArrowRight className="h-4 w-4" />
                    <span className="text-sm font-medium capitalize">
                      {param.replace('-', ' ')}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : (
            // Show main commands grouped by category
            Object.entries(groupedCommands).map(([category, commands]) => (
              <CommandGroup key={category} heading={COMMAND_CATEGORIES[category as keyof typeof COMMAND_CATEGORIES]}>
                {commands.map((command, index) => {
                  const globalIndex = filteredCommands.indexOf(command);
                  return (
                    <CommandItem
                      key={command.id}
                      onSelect={() => handleCommandSelect(command)}
                      className={`flex items-center px-2 py-1 cursor-pointer ${
                        globalIndex === selectedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                          {command.icon}
                        </div>
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{command.title}</span>
                            {command.shortcut && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">
                                {command.shortcut}
                              </span>
                            )}
                            {command.hasParameters && (
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                            )}
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {command.description}
                          </span>
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))
          )}
        </CommandList>
      </Command>
    </div>
  );
}