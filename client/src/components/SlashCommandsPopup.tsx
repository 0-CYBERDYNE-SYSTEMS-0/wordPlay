import React, { useState, useEffect, useRef } from 'react';
import { 
  Type, 
  Sparkles, 
  CheckSquare, 
  FileText, 
  Lightbulb,
  Pencil,
  Undo,
  ArrowRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useApiProcessing } from '@/hooks/use-api-processing';
import AIProcessingIndicator from './AIProcessingIndicator';
import { createAIResponseParser, type ParsedAIResponse } from '@/lib/aiResponseParser';
import { useSettings } from '@/providers/SettingsProvider';

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
  onUndo?: () => void;
  activeProjectId?: number | null;
}

export interface SlashCommand {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: string;
  shortcut?: string;
}

// Simplified, essential commands only
const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'continue',
    title: 'Continue writing',
    description: 'Continue the text with AI assistance',
    icon: <Type className="h-4 w-4" />,
    action: 'continue',
    shortcut: '1'
  },
  {
    id: 'improve',
    title: 'Improve writing',
    description: 'Enhance clarity and readability',
    icon: <Sparkles className="h-4 w-4" />,
    action: 'improve',
    shortcut: '2'
  },
  {
    id: 'fix',
    title: 'Fix grammar',
    description: 'Correct grammar and spelling',
    icon: <CheckSquare className="h-4 w-4" />,
    action: 'fix',
    shortcut: '3'
  },
  {
    id: 'summarize',
    title: 'Summarize',
    description: 'Create a concise summary',
    icon: <FileText className="h-4 w-4" />,
    action: 'summarize',
    shortcut: '4'
  },
  {
    id: 'rewrite',
    title: 'Rewrite',
    description: 'Rewrite the selected text',
    icon: <Pencil className="h-4 w-4" />,
    action: 'rewrite',
    shortcut: '5'
  },
  {
    id: 'suggest',
    title: 'Get ideas',
    description: 'Generate ideas and suggestions',
    icon: <Lightbulb className="h-4 w-4" />,
    action: 'suggest',
    shortcut: '6'
  },
  {
    id: 'undo',
    title: 'Undo',
    description: 'Undo the last change',
    icon: <Undo className="h-4 w-4" />,
    action: 'undo',
    shortcut: '7'
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
  onSuggestions, 
  onUndo, 
  activeProjectId 
}: SlashCommandsPopupProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { settings } = useSettings();
  const { startProcessing, stopProcessing } = useApiProcessing();

  // Get selected text or determine context
  const getSelectionInfo = () => {
    const textarea = editorRef.current;
    if (!textarea) return { selectedText: '', hasSelection: false };

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end);
    
    return {
      selectedText: selectedText.trim(),
      hasSelection: selectedText.trim().length > 0,
      start,
      end
    };
  };

  const selectionInfo = getSelectionInfo();

  // Execute slash command
  const executeCommandMutation = useMutation({
    mutationFn: async (command: SlashCommand) => {
      if (command.action === 'undo') {
        onUndo?.();
        return null;
      }

      const { selectedText, hasSelection, start, end } = selectionInfo;
      
      const response = await apiRequest('POST', '/api/ai/slash-command', {
        command: command.action,
        content: content,
        selectedText: hasSelection ? selectedText : undefined,
        selectionStart: hasSelection ? start : undefined,
        selectionEnd: hasSelection ? end : undefined,
        llmProvider,
        llmModel,
        projectId: activeProjectId
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: async (data) => {
      if (!data) return; // Undo command

      const responseParser = createAIResponseParser(llmProvider);
      const parsedResponse = await responseParser.parseResponse(
        data.result || '', 
        data.command || 'unknown', 
        content, 
        selectionInfo
      );
      
      // Handle different response types
      if (data.contextOnly) {
        // Show suggestions in context panel
        onSuggestions?.(parsedResponse.suggestions || data.result);
        toast({
          title: "Suggestions Generated",
          description: data.message || "Check the context panel for AI suggestions."
        });
      } else if (data.replaceSelection && selectionInfo.hasSelection) {
        // Replace selected text
        const { start, end } = selectionInfo;
        if (start !== undefined && end !== undefined) {
          const newContent = content.slice(0, start) + parsedResponse.content + content.slice(end);
          setContent(newContent);
          
          // Update cursor position
          setTimeout(() => {
            if (editorRef.current) {
              const newPosition = start + parsedResponse.content.length;
              editorRef.current.setSelectionRange(newPosition, newPosition);
              editorRef.current.focus();
            }
          }, 0);
        }
      } else if (data.appendToContent) {
        // Append to end of content
        const newContent = content + (content.endsWith('\n') ? '' : '\n\n') + parsedResponse.content;
        setContent(newContent);
        
        // Move cursor to end
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.setSelectionRange(newContent.length, newContent.length);
            editorRef.current.focus();
          }
        }, 0);
      }

      toast({
        title: "Command Executed",
        description: data.message || `Applied ${data.command} successfully.`
      });
    },
    onError: (error) => {
      console.error('Slash command error:', error);
      toast({
        title: "Command Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsProcessing(false);
      if (processingId) {
        stopProcessing(processingId);
        setProcessingId(null);
      }
      onClose();
    }
  });

  // Handle command execution
  const handleExecuteCommand = (command: SlashCommand) => {
    setIsProcessing(true);
    const id = startProcessing({
      message: `Executing ${command.title}...`,
      type: 'ai-command',
      initialProgress: 0
    });
    setProcessingId(id);
    executeCommandMutation.mutate(command);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : SLASH_COMMANDS.length - 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => prev < SLASH_COMMANDS.length - 1 ? prev + 1 : 0);
          break;
        case 'Enter':
          e.preventDefault();
          if (!isProcessing) {
            handleExecuteCommand(SLASH_COMMANDS[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        default:
          // Handle number shortcuts
          const num = parseInt(e.key);
          if (num >= 1 && num <= SLASH_COMMANDS.length) {
            e.preventDefault();
            if (!isProcessing) {
              handleExecuteCommand(SLASH_COMMANDS[num - 1]);
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, isProcessing]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 overflow-hidden"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '320px',
        maxHeight: '400px'
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Choose a command
          </h3>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {selectionInfo.hasSelection 
              ? `${selectionInfo.selectedText.length} chars selected`
              : `${content.length} chars in document`
            }
          </div>
        </div>
      </div>

      {/* Commands */}
      <div className="max-h-80 overflow-y-auto">
        {SLASH_COMMANDS.map((command, index) => (
          <button
            key={command.id}
            onClick={() => !isProcessing && handleExecuteCommand(command)}
            disabled={isProcessing}
            className={`
              w-full px-4 py-3 flex items-center gap-3 text-left transition-colors
              ${index === selectedIndex 
                ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500' 
                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }
              ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-600">
              {command.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {command.title}
                </span>
                {command.shortcut && (
                  <span className="text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                    {command.shortcut}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {command.description}
              </p>
            </div>
            {index === selectedIndex && (
              <ArrowRight className="h-4 w-4 text-blue-500 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>↑↓ Navigate • Enter Execute • Esc Close</span>
          {isProcessing && <span className="text-blue-500">Processing...</span>}
        </div>
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center">
          <AIProcessingIndicator 
            isProcessing={isProcessing} 
            message="Processing command..." 
          />
        </div>
      )}
    </div>
  );
}