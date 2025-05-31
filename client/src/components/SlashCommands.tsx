import React, { useState, useEffect, useRef } from 'react';
import { 
  Type, 
  List, 
  Sparkles, 
  MessageSquare, 
  CheckSquare, 
  Wand2, 
  FileText, 
  Lightbulb,
  Pencil,
  Zap,
  TreePine,
  Layout,
  Globe
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface SlashCommandsProps {
  content: string;
  setContent: (content: string) => void;
  editorRef: React.RefObject<HTMLDivElement>;
}

interface SlashCommand {
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

interface SlashCommandMenuProps {
  commands: SlashCommand[];
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

const SLASH_COMMANDS: SlashCommand[] = [
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

function SlashCommandMenu({ commands, onSelect, onClose, position }: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);
  
  return (
    <div 
      ref={menuRef}
      className="absolute z-50 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 w-64"
      style={{ top: position.y, left: position.x }}
    >
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium">AI Commands</p>
      </div>
      <div className="max-h-64 overflow-y-auto p-1">
        {commands.map((cmd) => (
          <button
            key={cmd.id}
            onClick={() => onSelect(cmd)}
            className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              {cmd.icon}
            </div>
            <div>
              <div className="font-medium text-sm">{cmd.title}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{cmd.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SlashCommands({ content, setContent, editorRef }: SlashCommandsProps) {
  // Add handleKeyDown function to be attached to the editor div
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Pass the event to our internal handler
    handleEditorKeyDown(e);
  };
  const { toast } = useToast();
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectionInfo, setSelectionInfo] = useState({
    selectedText: '',
    selectionStart: 0,
    selectionEnd: 0,
    beforeSelection: '',
    afterSelection: ''
  });
  
  // Mutation for executing commands
  const commandMutation = useMutation({
    mutationFn: async (commandAction: string) => {
      const res = await apiRequest('POST', '/api/ai/slash-command', {
        command: commandAction,
        content,
        selectionInfo
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Handle different command results
      if (data.replaceEntireContent) {
        setContent(data.result);
      } else if (data.replaceSelection && selectionInfo.selectedText) {
        setContent(
          selectionInfo.beforeSelection + data.result + selectionInfo.afterSelection
        );
      } else if (data.command === 'continue') {
        setContent(content + '\n\n' + data.result);
      } else if (data.command === 'suggest') {
        setContent(content + '\n\n--- AI Suggestions ---\n' + data.result);
      } else {
        setContent(data.result);
      }
      
      toast({
        title: 'AI Command Executed',
        description: data.message || 'Command completed successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to execute AI command: ' + (error as Error).message,
        variant: 'destructive'
      });
    }
  });
  
  // Get selection details from editor
  const getSelectionInfo = () => {
    if (!editorRef.current) return null;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    
    const range = selection.getRangeAt(0);
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(editorRef.current);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    
    const selectionStart = preSelectionRange.toString().length;
    const selectionEnd = selectionStart + range.toString().length;
    
    return {
      selectedText: range.toString(),
      selectionStart,
      selectionEnd,
      beforeSelection: content.substring(0, selectionStart),
      afterSelection: content.substring(selectionEnd)
    };
  };
  
  // Handle keyboard events
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Detect slash key press
    if (e.key === '/' && !showMenu) {
      e.preventDefault(); // Prevent slash from being typed
      
      // Get cursor position for menu placement
      if (window.getSelection()) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          // Position menu below cursor
          setMenuPosition({
            x: rect.left,
            y: rect.bottom + window.scrollY + 5
          });
          
          // Get selection info
          const info = getSelectionInfo();
          if (info) setSelectionInfo(info);
          
          // Show menu
          setShowMenu(true);
        }
      }
    }
    
    // Close menu with escape
    if (e.key === 'Escape' && showMenu) {
      setShowMenu(false);
    }
  };
  
  // Handle command selection
  const handleCommandSelect = (command: SlashCommand) => {
    setShowMenu(false);
    commandMutation.mutate(command.action);
  };
  
  return (
    <>
      {/* This component doesn't render anything directly except the menu when active */}
      {showMenu && (
        <SlashCommandMenu
          commands={SLASH_COMMANDS}
          onSelect={handleCommandSelect}
          onClose={() => setShowMenu(false)}
          position={menuPosition}
        />
      )}
      
      {/* Loading indicator */}
      {commandMutation.isPending && (
        <div className="fixed bottom-4 right-4 bg-primary text-white px-4 py-2 rounded-md shadow-lg flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Generating AI content...</span>
        </div>
      )}
    </>
  );
}