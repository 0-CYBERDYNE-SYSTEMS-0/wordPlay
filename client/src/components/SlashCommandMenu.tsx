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
  Lightbulb
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
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'continue',
    title: 'Continue writing',
    description: 'Continue the text with AI assistance',
    icon: <Type className="h-4 w-4" />,
    action: 'continue'
  },
  {
    id: 'improve',
    title: 'Improve writing',
    description: 'Enhance clarity and readability',
    icon: <Sparkles className="h-4 w-4" />,
    action: 'improve'
  },
  {
    id: 'summarize',
    title: 'Summarize',
    description: 'Create a concise summary',
    icon: <FileText className="h-4 w-4" />,
    action: 'summarize'
  },
  {
    id: 'expand',
    title: 'Expand',
    description: 'Elaborate on the current text',
    icon: <Wand2 className="h-4 w-4" />,
    action: 'expand'
  },
  {
    id: 'list',
    title: 'Create list',
    description: 'Generate a list from the content',
    icon: <List className="h-4 w-4" />,
    action: 'list'
  },
  {
    id: 'rewrite',
    title: 'Rewrite',
    description: 'Rewrite the selected text',
    icon: <Pencil className="h-4 w-4" />,
    action: 'rewrite'
  },
  {
    id: 'suggest',
    title: 'Ideas',
    description: 'Get new ideas related to your content',
    icon: <Lightbulb className="h-4 w-4" />,
    action: 'suggest'
  },
  {
    id: 'tone',
    title: 'Change tone',
    description: 'Adjust the tone of the text',
    icon: <MessageSquare className="h-4 w-4" />,
    action: 'tone'
  },
  {
    id: 'fix',
    title: 'Fix grammar',
    description: 'Correct grammar and spelling',
    icon: <CheckSquare className="h-4 w-4" />,
    action: 'fix'
  }
];

export default function SlashCommandMenu({ 
  isOpen, 
  onClose, 
  onSelectCommand, 
  filter, 
  position 
}: SlashCommandMenuProps) {
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>(SLASH_COMMANDS);
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
            command.description.toLowerCase().includes(lowerFilter)
        )
      );
    }
  }, [filter]);

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

  if (!isOpen || !position) return null;

  return (
    <div 
      ref={menuRef}
      className="absolute z-50 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden w-72"
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
        <CommandList>
          <CommandEmpty>No commands found.</CommandEmpty>
          {filteredCommands.map((command) => (
            <CommandItem
              key={command.id}
              onSelect={() => {
                onSelectCommand(command);
                onClose();
              }}
              className="flex items-center px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <div className="flex items-center gap-2 flex-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  {command.icon}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{command.title}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{command.description}</span>
                </div>
              </div>
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    </div>
  );
}