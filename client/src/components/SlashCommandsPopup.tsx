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
  Globe,
  BarChart2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import AIProcessingIndicator from './AIProcessingIndicator';

interface SlashCommandsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number, y: number };
  content: string;
  setContent: (content: string) => void;
  editorRef: React.RefObject<HTMLTextAreaElement>;
  llmProvider: 'openai' | 'ollama';
  llmModel: string;
  onSuggestions?: (suggestions: string) => void;
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
  },
  {
    id: 'analyze',
    title: 'Analyze Style',
    description: 'Get detailed style and readability analysis',
    icon: <BarChart2 className="h-4 w-4" />,
    action: 'analyze',
    category: 'utility'
  }
];

export default function SlashCommandsPopup({ 
  isOpen, 
  onClose, 
  position, 
  content, 
  setContent,
  editorRef,
  llmProvider,
  llmModel,
  onSuggestions
}: SlashCommandsPopupProps) {
  const { toast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  
  // Get selection details from editor
  const getSelectionInfo = () => {
    if (!editorRef.current) return {
      selectedText: '',
      selectionStart: 0,
      selectionEnd: 0,
      beforeSelection: content,
      afterSelection: ''
    };
    
    const textarea = editorRef.current;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const selectedText = content.substring(selectionStart, selectionEnd);
    
    return {
      selectedText,
      selectionStart,
      selectionEnd,
      beforeSelection: content.substring(0, selectionStart),
      afterSelection: content.substring(selectionEnd)
    };
  };

  // Mutation for executing commands
  const executeCommand = async (command: string) => {
    const selectionInfo = getSelectionInfo();
    setLoading(true);
    
    try {
      const res = await apiRequest('POST', '/api/ai/slash-command', {
        command,
        content,
        selectionInfo,
        style: null, // You can add style information here if needed
        llmProvider,
        llmModel
      });
      
      const data = await res.json();
      
      // Special handling for suggestions/ideas and analysis commands
      if (command === 'suggest' || command === 'analyze') {
        if (onSuggestions) {
          onSuggestions(data.result);
          toast({
            title: command === 'suggest' ? 'Ideas Generated' : 'Style Analysis Complete',
            description: command === 'suggest' ? 'New ideas have been added to the insights panel.' : 'Analysis results added to the insights panel.'
          });
        } else {
          // Fallback to old behavior if callback not provided
          const prefix = command === 'suggest' ? '--- AI Suggestions ---' : '--- Style Analysis ---';
          setContent(content + '\n\n' + prefix + '\n' + data.result);
          toast({
            title: 'AI Command Executed',
            description: data.message || 'Command completed successfully'
          });
        }
      } else {
        // Apply the result to the content for all other commands
        if (data.replaceEntireContent) {
          setContent(data.result);
        } else if (data.replaceSelection && selectionInfo.selectedText) {
          setContent(
            selectionInfo.beforeSelection + data.result + selectionInfo.afterSelection
          );
        } else if (command === 'continue') {
          setContent(content + '\n\n' + data.result);
        } else {
          setContent(data.result);
        }
        
        toast({
          title: 'AI Command Executed',
          description: data.message || 'Command completed successfully'
        });
      }
      
      // Force focus back to editor after content update
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();
        }
      }, 100);
      
    } catch (error) {
      console.error('Error executing slash command:', error);
      toast({
        title: 'AI Command Failed',
        description: `Failed to execute "${command}" command. Please check your LLM provider settings and try again.`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);
  
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <>
      <div 
        ref={menuRef}
        className="absolute z-50 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 w-64"
        style={{ top: position.y, left: position.x }}
      >
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium">AI Commands</p>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {SLASH_COMMANDS.map((cmd) => (
            <button
              key={cmd.id}
              onClick={() => {
                onClose();
                executeCommand(cmd.action);
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2"
              disabled={loading}
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
      
      {/* Loading overlay */}
      {loading && (
        <div className="fixed bottom-4 right-4 bg-primary text-white px-4 py-2 rounded-md shadow-lg flex items-center z-50">
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