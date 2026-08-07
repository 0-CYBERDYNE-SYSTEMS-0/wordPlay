import React, { useState, useEffect, useRef } from 'react';
import {
  Type,
  Sparkles,
  CheckSquare,
  FileText,
  List,
  Undo,
  ArrowRight,
  BarChart2,
  Image,
  Table
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
    id: 'bullets',
    title: 'Bullet points',
    description: 'Convert selected text into bullet points',
    icon: <List className="h-4 w-4" />,
    action: 'bullets',
    shortcut: '4'
  },
  {
    id: 'format',
    title: 'Format document',
    description: 'Improve structure and formatting',
    icon: <FileText className="h-4 w-4" />,
    action: 'format',
    shortcut: '5'
  },
  {
    id: 'chart',
    title: 'Create chart',
    description: 'Generate interactive chart from data',
    icon: <BarChart2 className="h-4 w-4" />,
    action: 'chart',
    shortcut: '6'
  },
  {
    id: 'image',
    title: 'Generate image',
    description: 'Create image from description',
    icon: <Image className="h-4 w-4" />,
    action: 'image',
    shortcut: '7'
  },
  {
    id: 'table',
    title: 'Create table',
    description: 'Generate markdown table from content',
    icon: <Table className="h-4 w-4" />,
    action: 'table',
    shortcut: '8'
  },
  {
    id: 'undo',
    title: 'Undo',
    description: 'Undo the last change',
    icon: <Undo className="h-4 w-4" />,
    action: 'undo',
    shortcut: '0'
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
  const lastCommandRef = useRef<string>('');
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
      const { selectedText, hasSelection, start, end } = selectionInfo;
      lastCommandRef.current = command.action;

      // All commands use /api/ai/slash-command. The server schema requires a
      // nested selectionInfo object with numeric start/end positions.
      const requestData: any = {
        command: command.action,
        content: content,
        selectionInfo: {
          selectedText: hasSelection ? selectedText : '',
          selectionStart: hasSelection ? start : 0,
          selectionEnd: hasSelection ? end : 0,
          beforeSelection: content.slice(0, hasSelection ? start : 0),
          afterSelection: content.slice(hasSelection ? end : 0)
        },
        llmProvider,
        llmModel,
        projectId: activeProjectId
      };

      // Intelligent defaults per AI content command
      if (command.action === 'chart') {
        requestData.chartType = 'auto'; // Let AI choose best chart type
      } else if (command.action === 'image') {
        requestData.style = 'realistic'; // Default to realistic style
      } else if (command.action === 'table') {
        requestData.mode = 'replace'; // Default to replace mode
        requestData.style = 'simple'; // Default to simple style
      }

      const response = await apiRequest('POST', '/api/ai/slash-command', requestData);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: async (data) => {
      if (!data) return;

      const action = lastCommandRef.current;
      const aiContentCommands = ['chart', 'image', 'table'];
      const isAIContentCommand = aiContentCommands.includes(action);

      if (isAIContentCommand) {
        // AI content generation returns the result directly (markdown image / table / chart)
        const generatedContent = data.result || '';

        if (selectionInfo.hasSelection) {
          const { start, end } = selectionInfo;
          if (start !== undefined && end !== undefined) {
            const newContent = content.slice(0, start) + generatedContent + content.slice(end);
            setContent(newContent);

            setTimeout(() => {
              if (editorRef.current) {
                const newPosition = start + generatedContent.length;
                editorRef.current.setSelectionRange(newPosition, newPosition);
                editorRef.current.focus();
              }
            }, 0);
          }
        } else {
          const textarea = editorRef.current;
          if (textarea) {
            const cursorPos = textarea.selectionStart;
            const newContent = content.slice(0, cursorPos) + generatedContent + content.slice(cursorPos);
            setContent(newContent);

            setTimeout(() => {
              const newPosition = cursorPos + generatedContent.length;
              textarea.setSelectionRange(newPosition, newPosition);
              textarea.focus();
            }, 0);
          } else {
            const newContent = content + (content.endsWith('\n') ? '' : '\n\n') + generatedContent;
            setContent(newContent);
          }
        }

        toast({
          title: "Content Generated",
          description: `${action} created successfully.`
        });
        return;
      }

      // Regular slash command responses
      const responseParser = createAIResponseParser(llmProvider);
      const parsedResponse = await responseParser.parseResponse(
        data.result || '',
        action,
        content,
        selectionInfo
      );

      if (data.contextOnly) {
        onSuggestions?.(parsedResponse.suggestions || data.result);
        toast({
          title: "Suggestions Generated",
          description: data.message || "Check the context panel for suggestions."
        });
      } else if (data.replaceSelection) {
        // Respect smart expansion bounds when the server widened the selection
        const replaceStart = data.smartExpansion ? data.smartExpansion.expandedStart : selectionInfo.start;
        const replaceEnd = data.smartExpansion ? data.smartExpansion.expandedEnd : selectionInfo.end;
        if (typeof replaceStart === 'number' && typeof replaceEnd === 'number') {
          const newContent = content.slice(0, replaceStart) + parsedResponse.content + content.slice(replaceEnd);
          setContent(newContent);

          setTimeout(() => {
            if (editorRef.current) {
              const newPosition = replaceStart + parsedResponse.content.length;
              editorRef.current.setSelectionRange(newPosition, newPosition);
              editorRef.current.focus();
            }
          }, 0);
        }
      } else if (data.appendToContent) {
        const newContent = content + (content.endsWith('\n') ? '' : '\n\n') + parsedResponse.content;
        setContent(newContent);

        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.setSelectionRange(newContent.length, newContent.length);
            editorRef.current.focus();
          }
        }, 0);
      } else if (data.insertAtCursor) {
        const textarea = editorRef.current;
        const cursorPos = textarea ? textarea.selectionStart : (selectionInfo.end ?? 0);
        const newContent = content.slice(0, cursorPos) + parsedResponse.content + content.slice(cursorPos);
        setContent(newContent);

        setTimeout(() => {
          if (editorRef.current) {
            const newPosition = cursorPos + parsedResponse.content.length;
            editorRef.current.setSelectionRange(newPosition, newPosition);
            editorRef.current.focus();
          }
        }, 0);
      }

      toast({
        title: "Command Executed",
        description: data.message || `Applied ${action} successfully.`
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
    // Undo is a local editor action — no AI processing needed
    if (command.action === 'undo') {
      onUndo?.();
      onClose();
      return;
    }

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
          // Handle number shortcuts (1-9 and 0)
          const num = parseInt(e.key);
          if (num >= 1 && num <= 9 && num <= SLASH_COMMANDS.length) {
            e.preventDefault();
            if (!isProcessing) {
              handleExecuteCommand(SLASH_COMMANDS[num - 1]);
            }
          } else if (e.key === '0') {
            // Handle 0 for the last command (undo)
            e.preventDefault();
            if (!isProcessing) {
              const undoCommand = SLASH_COMMANDS.find(cmd => cmd.shortcut === '0');
              if (undoCommand) {
                handleExecuteCommand(undoCommand);
              }
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

  // Clamp menu to viewport on small screens
  const menuWidth = Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 16 : 320);
  const left = Math.min(
    Math.max(8, position.x),
    typeof window !== 'undefined' ? window.innerWidth - menuWidth - 8 : position.x
  );
  const top = Math.min(
    Math.max(8, position.y),
    typeof window !== 'undefined' ? window.innerHeight - 120 : position.y
  );

  return (
    <div
      ref={popupRef}
      className="fixed z-50 overflow-hidden rounded-2xl border border-[var(--wp-line)] bg-[var(--wp-paper-elevated)] shadow-[0_28px_56px_-16px_rgba(26,22,18,0.35)] dark:bg-stone-900 dark:border-stone-700"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${menuWidth}px`,
        maxHeight: 'min(400px, calc(100vh - 24px))',
      }}
      role="listbox"
      aria-label="AI slash commands"
    >
      <div className="border-b border-[var(--wp-line)] px-4 py-3 dark:border-stone-700">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-serif text-[14px] font-semibold tracking-tight text-[var(--wp-ink)] dark:text-stone-50">
            Commands
          </h3>
          <div className="text-[11px] tabular-nums text-stone-400">
            {selectionInfo.hasSelection
              ? `${selectionInfo.selectedText.length} selected`
              : `${content.length} chars`}
          </div>
        </div>
        <p className="mt-0.5 text-[11px] text-stone-500">Write, polish, chart, image, table</p>
      </div>

      <div className="max-h-72 overflow-y-auto minimal-scrollbar">
        {SLASH_COMMANDS.map((command, index) => (
          <button
            key={command.id}
            type="button"
            onClick={() => !isProcessing && handleExecuteCommand(command)}
            disabled={isProcessing}
            className={`
              flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors
              ${index === selectedIndex
                ? 'bg-[var(--wp-copper)]/10 border-l-2 border-[var(--wp-copper)]'
                : 'border-l-2 border-transparent hover:bg-stone-50 dark:hover:bg-stone-800/60'
              }
              ${isProcessing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
            `}
            role="option"
            aria-selected={index === selectedIndex}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                index === selectedIndex
                  ? 'bg-[var(--wp-copper)]/15 text-[var(--wp-copper)]'
                  : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'
              }`}
            >
              {command.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-[var(--wp-ink)] dark:text-stone-100">
                  {command.title}
                </span>
                {command.shortcut && (
                  <span className="rounded-md bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-500 dark:bg-stone-800">
                    {command.shortcut}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-stone-500 dark:text-stone-400">
                {command.description}
              </p>
            </div>
            {index === selectedIndex && (
              <ArrowRight className="h-4 w-4 shrink-0 text-[var(--wp-copper)]" />
            )}
          </button>
        ))}
      </div>

      <div className="border-t border-[var(--wp-line)] px-3.5 py-2 dark:border-stone-700">
        <div className="flex items-center justify-between text-[10px] text-stone-400">
          <span className="truncate">↑↓ · 1–9 · ↵ · Esc</span>
          {isProcessing && (
            <span className="text-[var(--wp-copper)]">Working…</span>
          )}
        </div>
      </div>

      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--wp-paper)]/70 backdrop-blur-[1px] dark:bg-stone-900/70">
          <AIProcessingIndicator
            isProcessing={isProcessing}
            message="Processing command…"
          />
        </div>
      )}
    </div>
  );
}