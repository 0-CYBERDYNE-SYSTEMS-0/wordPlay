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
  llmProvider: 'openai' | 'ollama' | 'gemini';
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
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const lastCommandRef = useRef<string>('');
  // Moment the menu opened. Used to ignore the keystroke that opened it —
  // the '/' keydown is still propagating to the document-level listener
  // below, which would otherwise swallow it into the type-to-filter query.
  const openedAtRef = useRef(0);
  const { toast } = useToast();
  const { settings } = useSettings();
  const { startProcessing, stopProcessing } = useApiProcessing();
  // Track the command currently being executed so the processing overlay can
  // show command-specific detail (e.g. image provider/model/size/steps).
  const [activeCommand, setActiveCommand] = useState<SlashCommand | null>(null);

  // Type-to-filter: match on title or action
  const filteredCommands = SLASH_COMMANDS.filter(c =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.action.toLowerCase().includes(query.toLowerCase())
  );

  // Reset query + selection whenever the menu opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Stamp the open time so the type-to-filter handler below can drop
      // the very keystroke that opened the menu (the '/' itself).
      openedAtRef.current = performance.now();
    }
  }, [isOpen]);

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

  // AbortController for the in-flight command fetch (FIX-07: cancel support)
  const abortRef = useRef<AbortController | null>(null);
  // Elapsed-time tracking so the loading state communicates progress after ~10s
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Streams a core command (Ollama) via /api/ai/slash-command/stream and
  // applies each token to the editor live. Returns the final behavior object
  // (same shape as the non-streaming route) so onSuccess can finish the
  // post-processing.
  const streamCommand = async (
    requestData: any,
    controller: AbortController,
    hasSelection: boolean,
    start: number | undefined,
    end: number | undefined
  ) => {
    const res = await fetch('/api/ai/slash-command/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
      credentials: 'include',
      signal: controller.signal
    });

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.message) message = body.message;
      } catch {}
      throw new Error(message);
    }
    if (!res.body) throw new Error('Streaming not supported by server');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    // Progressive editor state — start from the original content with the
    // selection range cleared (the AI output grows into that span).
    let streamedText = '';
    let appliedContent = content;
    let appliedStart = (hasSelection ? start : start) ?? (editorRef.current?.selectionStart ?? 0); // cursor position for insert-at-cursor
    let behavior: any = null;

    const applyChunk = (text: string) => {
      streamedText += text;
      // Rebuild: content before + streamed output + content after the
      // selection/insertion point. Using the ORIGINAL content means the
      // editor shows the AI text appearing live in place of the selection.
      const before = requestData.content.slice(0, appliedStart);
      const after = requestData.content.slice(hasSelection ? end : appliedStart);
      appliedContent = before + streamedText + after;
      setContent(appliedContent);
      // Keep the textarea caret at the end of the streamed text
      if (editorRef.current) {
        editorRef.current.setSelectionRange(before.length + streamedText.length, before.length + streamedText.length);
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line) continue;
          let data: any;
          try {
            data = JSON.parse(line);
          } catch {
            continue; // partial line — wait for more
          }
          if (data.chunk) {
            applyChunk(data.chunk);
          } else if (data.done) {
            behavior = data.behavior || {};
            // If the server said the final result differs (e.g. no selection),
            // overwrite the streamed content with the authoritative result.
            if (behavior.result && behavior.result !== streamedText) {
              const before = requestData.content.slice(0, appliedStart);
              const after = requestData.content.slice(hasSelection ? end : appliedStart);
              setContent(before + behavior.result + after);
            }
          }
        }
      }

      // Flush any trailing line that arrived without a newline (the final
      // {"done":true,...} line often lands in the last chunk without \n).
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim());
          if (data.done) {
            behavior = data.behavior || {};
            if (behavior.result && behavior.result !== streamedText) {
              const before = requestData.content.slice(0, appliedStart);
              const after = requestData.content.slice(hasSelection ? end : appliedStart);
              setContent(before + behavior.result + after);
            }
          }
        } catch {
          // ignore malformed trailing data
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      result: streamedText,
      message: behavior?.message || 'Applied command.',
      replaceSelection: behavior?.replaceSelection,
      appendToContent: behavior?.appendToContent,
      insertAtCursor: behavior?.insertAtCursor,
      contextOnly: behavior?.contextOnly,
      smartExpansion: behavior?.smartExpansion,
      // Mark that we already streamed into the editor — onSuccess must not
      // re-apply the replacement.
      streamed: true
    };
  };

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
        // Wire the user's image settings from Settings → AI → Image Generation:
        // provider (local mflux bridge vs Gemini cloud), Gemini model name,
        // resolution, and mflux step count.
        requestData.style = 'realistic'; // Default to realistic style
        requestData.imageProvider = settings.imageProvider || 'local';
        requestData.imageModel = settings.imageModel || 'gemini-3.1-flash-lite-image';
        requestData.imageSize = settings.imageSize || '1024x1024';
        requestData.imageSteps = settings.imageSteps ?? 1;
      } else if (command.action === 'table') {
        requestData.mode = 'replace'; // Default to replace mode
        requestData.style = 'simple'; // Default to simple style
      }

      // Cancel any stale request, then wire up a fresh one
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setElapsedSeconds(0);
      const elapsedTimer = window.setInterval(() => {
        setElapsedSeconds(s => s + 1);
      }, 1000);

      // Streaming path: Ollama + core commands stream tokens into the editor
      // live via /api/ai/slash-command/stream (NDJSON). AI content commands
      // (table/chart/image) and OpenAI still use the single-shot endpoint.
      const isAIContentCommand = ['chart', 'image', 'table'].includes(command.action);
      const canStream = llmProvider === 'ollama' && !isAIContentCommand && command.action !== 'undo';

      try {
        if (canStream) {
          return await streamCommand(requestData, controller, hasSelection, start, end);
        }

        const res = await fetch('/api/ai/slash-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
          credentials: 'include',
          signal: controller.signal
        });

        if (!res.ok) {
          let message = `Request failed (${res.status})`;
          try {
            const body = await res.json();
            if (body?.message) message = body.message;
            else if (body?.error) message = body.error;
          } catch {}
          throw new Error(message);
        }

        return await res.json();
      } finally {
        window.clearInterval(elapsedTimer);
        abortRef.current = null;
      }
    },
    onSuccess: async (data) => {
      if (!data) return;

      const action = lastCommandRef.current;
      const aiContentCommands = ['chart', 'image', 'table'];
      const isAIContentCommand = aiContentCommands.includes(action);

      if (isAIContentCommand) {
        // AI content generation returns the result directly (markdown image / table / chart)
        const generatedContent = data.result || '';

        // Images must always land on their own line as a separate block —
        // never spliced mid-sentence. Tables/charts keep the previous behavior.
        const isImage = action === 'image';
        // Charts are NEW blocks — they must NEVER replace existing content
        // (the user's selection may be the whole doc, which would swallow
        // text/images). Always insert at the caret or append at the end.
        const isChart = action === 'chart';
        const blockContent = (isImage || isChart)
          ? `\n\n${generatedContent}\n\n`
          : generatedContent;

        // Charts + images: always insert at cursor / end — never replace.
        if (isChart || isImage) {
          const textarea = editorRef.current;
          if (textarea) {
            const cursorPos = textarea.selectionStart;
            const newContent = content.slice(0, cursorPos) + blockContent + content.slice(cursorPos);
            setContent(newContent);

            setTimeout(() => {
              const newPosition = cursorPos + blockContent.length;
              textarea.setSelectionRange(newPosition, newPosition);
              textarea.focus();
            }, 0);
          } else {
            const newContent = content + (content.endsWith('\n') ? '' : '\n\n') + generatedContent;
            setContent(newContent);
          }
        } else if (selectionInfo.hasSelection) {
          const { start, end } = selectionInfo;
          if (start !== undefined && end !== undefined) {
            const newContent = content.slice(0, start) + blockContent + content.slice(end);
            setContent(newContent);

            setTimeout(() => {
              if (editorRef.current) {
                const newPosition = start + blockContent.length;
                editorRef.current.setSelectionRange(newPosition, newPosition);
                editorRef.current.focus();
              }
            }, 0);
          }
        } else {
          const textarea = editorRef.current;
          if (textarea) {
            const cursorPos = textarea.selectionStart;
            const newContent = content.slice(0, cursorPos) + blockContent + content.slice(cursorPos);
            setContent(newContent);

            setTimeout(() => {
              const newPosition = cursorPos + blockContent.length;
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

      // Streaming path already applied the text to the editor live — only
      // parse for the context panel / suggestions and toast.
      if (data.streamed) {
        if (data.contextOnly) {
          onSuggestions?.(parsedResponse.suggestions || data.result);
          toast({
            title: "Suggestions Generated",
            description: data.message || "Check the context panel for suggestions."
          });
        } else {
          // Clean the streamed content of XML tags that may have been
          // rendered live (the model sometimes streams <thinking>/<final_output>
          // tags before the text). Re-apply the cleaned version.
          if (parsedResponse.content && parsedResponse.content !== data.result) {
            const applyStart = data.smartExpansion ? data.smartExpansion.expandedStart : selectionInfo.start;
            const applyEnd = data.smartExpansion ? data.smartExpansion.expandedEnd : selectionInfo.end;
            if (typeof applyStart === 'number' && typeof applyEnd === 'number') {
              const newContent = content.slice(0, applyStart) + parsedResponse.content + content.slice(applyEnd);
              setContent(newContent);
            }
          }
          toast({
            title: "Command Executed",
            description: data.message || `Applied ${action} successfully.`
          });
        }
        return;
      }

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
    onError: (error: any) => {
      // Don't toast a noisy abort error — the user cancelled on purpose.
      if (error?.name === 'AbortError' || error?.code === 20) {
        console.log('Slash command cancelled by user');
        return;
      }
      console.error('Slash command error:', error);
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({
        title: "Command Failed",
        description: message,
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsProcessing(false);
      setActiveCommand(null);
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
    setActiveCommand(command);
    const id = startProcessing({
      message: `Executing ${command.title}...`,
      type: 'ai-command',
      initialProgress: 0
    });
    setProcessingId(id);
    executeCommandMutation.mutate(command);

    // Image generation can take 30-60s locally. Don't block the editor with a
    // full-screen popup for the whole wait — close the menu immediately and
    // let the image appear in the editor (with a toast) when it's ready.
    if (command.action === 'image') {
      onClose();
    }
  };

  // Keyboard navigation + type-to-filter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : Math.max(filteredCommands.length - 1, 0));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => prev < filteredCommands.length - 1 ? prev + 1 : 0);
          break;
        case 'Enter':
          e.preventDefault();
          if (!isProcessing && filteredCommands[selectedIndex]) {
            handleExecuteCommand(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Backspace':
          e.preventDefault();
          setQuery(prev => prev.slice(0, -1));
          setSelectedIndex(0);
          break;
        default:
          // Handle number shortcuts (1-9 and 0) — only when not filtering
          if (!query) {
            const num = parseInt(e.key);
            if (num >= 1 && num <= 9 && num <= SLASH_COMMANDS.length) {
              e.preventDefault();
              if (!isProcessing) {
                handleExecuteCommand(SLASH_COMMANDS[num - 1]);
              }
              break;
            } else if (e.key === '0') {
              // Handle 0 for the last command (undo)
              e.preventDefault();
              if (!isProcessing) {
                const undoCommand = SLASH_COMMANDS.find(cmd => cmd.shortcut === '0');
                if (undoCommand) {
                  handleExecuteCommand(undoCommand);
                }
              }
              break;
            }
          }

          // Type-to-filter: consume a single printable character (never let it
          // reach the textarea) and append it to the filter query. The
          // keystroke that opened the menu (the '/') is still propagating to
          // this document-level listener — drop it so it doesn't get searched.
          if (
            e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey &&
            e.timeStamp - openedAtRef.current > 50
          ) {
            e.preventDefault();
            setQuery(prev => prev + e.key);
            setSelectedIndex(0);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, isProcessing, filteredCommands.length, query]);

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
        {filteredCommands.length === 0 ? (
          <div className="px-3.5 py-6 text-center text-[12px] text-stone-500">
            No commands match “{query}”
          </div>
        ) : (
          filteredCommands.map((command, index) => (
            <button
              key={command.id}
              type="button"
              onClick={() => !isProcessing && handleExecuteCommand(command)}
              disabled={isProcessing}
              className={`
                flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors
                ${index === selectedIndex
                  ? 'bg-copper-100 border-l-2 border-[var(--wp-copper)]'
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
                    ? 'bg-copper-100 text-[var(--wp-copper)]'
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
          ))
        )}
      </div>

      <div className="border-t border-[var(--wp-line)] px-3.5 py-2 dark:border-stone-700">
        <div className="flex items-center justify-between text-[10px] text-stone-400">
          <span className="truncate">
            {query ? `Filtering “${query}”` : '↑↓ · 1–9 · ↵ · Esc'}
          </span>
          {isProcessing && (
            <span className="text-[var(--wp-copper)]">Working…</span>
          )}
        </div>
      </div>

      {isProcessing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--wp-paper)]/70 backdrop-blur-[1px] dark:bg-stone-900/70">
          {activeCommand?.action === 'image' ? (
            // Dedicated image-generation overlay — tells the user exactly what
            // is running (provider/model/size/steps) since local mflux can
            // take 30-60s and a bare spinner reads as "stuck".
            <div className="flex flex-col items-center gap-3 px-4 py-2 text-center">
              <AIProcessingIndicator
                isProcessing
                message={elapsedSeconds >= 10 ? `Generating image… ${elapsedSeconds}s` : 'Generating image…'}
              />
              <div className="rounded-lg border border-[var(--wp-line)] bg-[var(--wp-paper-elevated)] px-3.5 py-2.5 text-[11px] leading-relaxed text-stone-600 dark:text-stone-300">
                <div className="mb-1 font-medium text-[var(--wp-ink)] dark:text-stone-100">
                  {settings.imageProvider === 'gemini' ? 'Gemini (cloud)' : 'FLUX.2 Klein 4B · local mflux'}
                </div>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5">
                  <span>Model: {settings.imageProvider === 'gemini' ? settings.imageModel || 'gemini-3.1-flash-lite-image' : 'FLUX.2-klein-4B'}</span>
                  <span>Size: {settings.imageSize || '1024x1024'}</span>
                  <span>Steps: {settings.imageSteps ?? 1}</span>
                </div>
              </div>
              <p className="max-w-[260px] text-[10px] leading-snug text-stone-400">
                Local generation can take 30–60s. The image will appear in the editor when ready.
              </p>
            </div>
          ) : (
            <AIProcessingIndicator
              isProcessing
              message={elapsedSeconds >= 10 ? `Still working… ${elapsedSeconds}s` : "Processing command…"}
            />
          )}
          <button
            type="button"
            onClick={() => {
              abortRef.current?.abort();
              setIsProcessing(false);
              setActiveCommand(null);
              if (processingId) {
                stopProcessing(processingId);
                setProcessingId(null);
              }
              onClose();
            }}
            className="rounded-md border border-[var(--wp-line)] px-3 py-1.5 text-[11px] text-stone-600 transition-colors hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}