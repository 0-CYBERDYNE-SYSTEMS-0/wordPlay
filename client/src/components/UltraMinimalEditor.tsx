import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSettings } from '@/providers/SettingsProvider';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import AmbientAI from '@/components/AmbientAI';
import SlashCommandsPopup from '@/components/SlashCommandsPopup';
import {
  Save,
  CheckCircle,
  AlertTriangle,
  Maximize,
  Minimize,
  Settings as SettingsIcon,
  Keyboard,
  Sparkles,
  Slash,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { Eye, PenLine } from 'lucide-react';

interface UltraMinimalEditorProps {
  title: string;
  setTitle: (title: string) => void;
  content: string;
  setContent: (content: string) => void;
  isSaving: boolean;
  isDirty: boolean;
  saveError: string | null;
  autoSaveEnabled: boolean;
  saveDocument: (isManual?: boolean) => Promise<void>;
  llmProvider: 'openai' | 'ollama' | 'gemini';
  llmModel: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onOpenFullFeatures?: () => void;
  activeProjectId?: number | null;
  onSuggestions?: (suggestions: string) => void;
}

export default function UltraMinimalEditor({
  title,
  setTitle,
  content,
  setContent,
  isSaving,
  isDirty,
  saveError,
  autoSaveEnabled,
  saveDocument,
  llmProvider,
  llmModel,
  openaiApiKey,
  geminiApiKey,
  isFullScreen,
  onToggleFullScreen,
  onOpenFullFeatures,
  activeProjectId,
  onSuggestions,
}: UltraMinimalEditorProps) {
  const { settings } = useSettings();
  const { toast } = useToast();
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedText, setSelectedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showTitle, setShowTitle] = useState(true);
  const [wordCount, setWordCount] = useState(0);
  const [slashCommandsOpen, setSlashCommandsOpen] = useState(false);
  const [slashCommandPosition, setSlashCommandPosition] = useState({ x: 0, y: 0 });
  const [showChrome, setShowChrome] = useState(true);
  const [viewMode, setViewMode] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const lastHistoryPushRef = useRef(0);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [exportOpen, setExportOpen] = useState(false);

  // Coalesce rapid typing so undo steps are word/phrase-sized, not per-keystroke.
  const pushHistoryToUndo = useCallback((value: string) => {
    const now = Date.now();
    if (now - lastHistoryPushRef.current < 1000) return;
    lastHistoryPushRef.current = now;
    const stack = undoStackRef.current;
    if (stack.length >= 100) stack.shift();
    stack.push(value);
    redoStackRef.current = [];
  }, []);

  const handleUndo = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (prev === undefined) return;
    redoStackRef.current.push(content);
    setContent(prev);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.setSelectionRange(prev.length, prev.length);
        ta.focus();
      }
    });
  }, [content, setContent]);

  const handleRedo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (next === undefined) return;
    pushHistoryToUndo(content);
    setContent(next);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.setSelectionRange(next.length, next.length);
        ta.focus();
      }
    });
  }, [content, pushHistoryToUndo, setContent]);

  // AI-driven content changes (slash commands, suggestions) go through here so they
  // can be undone.
  const applyAIContent = useCallback((next: string) => {
    pushHistoryToUndo(content);
    setContent(next);
  }, [content, pushHistoryToUndo, setContent]);

  const debouncedContent = useDebounce(content, 300);

  useEffect(() => {
    const words = content.trim().split(/\s+/).filter((word) => word.length > 0);
    setWordCount(content.trim() ? words.length : 0);
  }, [debouncedContent]);

  useEffect(() => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(true);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1000);
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [content]);

  // Auto-fade chrome in focus mode while typing (desktop fullscreen)
  useEffect(() => {
    if (!isFullScreen) {
      setShowChrome(true);
      return;
    }
    setShowChrome(true);
    if (chromeTimeoutRef.current) clearTimeout(chromeTimeoutRef.current);
    if (isTyping) {
      chromeTimeoutRef.current = setTimeout(() => setShowChrome(false), 1600);
    }
    return () => {
      if (chromeTimeoutRef.current) clearTimeout(chromeTimeoutRef.current);
    };
  }, [isTyping, isFullScreen]);

  const handleSelectionChange = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setCursorPosition(start);
    setSelectedText(content.slice(start, end));
  }, [content]);

  const handleApplySuggestion = useCallback(
    (suggestion: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + suggestion + content.slice(end);
      applyAIContent(newContent);

      setTimeout(() => {
        const newPosition = start + suggestion.length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();
      }, 0);

      toast({
        title: 'Inserted',
        description: 'Suggestion placed at your cursor.',
      });
    },
    [content, applyAIContent, toast]
  );

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      pushHistoryToUndo(content);
      setContent(e.target.value);
    },
    [content, pushHistoryToUndo, setContent]
  );

  const handleManualSave = async () => {
    if (!isDirty) {
      toast({
        title: 'Up to date',
        description: 'Nothing new to save.',
      });
      return;
    }

    try {
      await saveDocument(true);
      if (!saveError) {
        toast({
          title: 'Saved',
          description: 'Document stored successfully.',
        });
      }
    } catch {
      // handled in hook
    }
  };

  const downloadFile = useCallback((filename: string, text: string, mime: string) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

  const handleExport = useCallback((format: 'md' | 'txt' | 'print') => {
    setExportOpen(false);
    const base = (title.trim() || 'document').replace(/[^\w\-. ]+/g, '_').replace(/\s+/g, '_');
    const fullText = `${title.trim() ? title.trim() + '\n\n' : ''}${content}`;
    if (format === 'print') {
      window.print();
      return;
    }
    if (format === 'md') {
      downloadFile(`${base}.md`, fullText, 'text/markdown;charset=utf-8');
    } else {
      downloadFile(`${base}.txt`, fullText, 'text/plain;charset=utf-8');
    }
    toast({
      title: "Export complete",
      description: `Downloaded ${base}.${format}`
    });
  }, [title, content, downloadFile, toast]);

  // Close export menu on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const closeMenu = (e: MouseEvent) => {
      const el = exportMenuRef.current;
      if (el && !el.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, [exportOpen]);

  const openSlashMenu = (textarea: HTMLTextAreaElement) => {
    const rect = textarea.getBoundingClientRect();
    const gutter = 12;
    const menuW = 320;
    const menuH = 360;
    let x = rect.left + gutter;
    let y = rect.top + Math.min(120, rect.height * 0.2);

    // Keep on screen
    x = Math.min(x, window.innerWidth - menuW - gutter);
    y = Math.min(y, window.innerHeight - menuH - gutter);
    x = Math.max(gutter, x);
    y = Math.max(gutter, y);

    setSlashCommandPosition({ x, y });
    setSlashCommandsOpen(true);
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) handleRedo();
      else handleUndo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      handleRedo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleManualSave();
      return;
    }

    if (e.key === '/' && !slashCommandsOpen && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      openSlashMenu(e.currentTarget);
      return;
    }

    if (e.key === 'Escape' && slashCommandsOpen) {
      e.preventDefault();
      setSlashCommandsOpen(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11' || (e.ctrlKey && e.shiftKey && e.key === 'F')) {
        e.preventDefault();
        onToggleFullScreen();
        return;
      }

      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        onOpenFullFeatures?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onToggleFullScreen, onOpenFullFeatures]);

  useEffect(() => {
    if (content.length === 0 && title.length === 0) {
      setShowTitle(true);
    }
  }, [content, title]);

  const renderSaveStatus = () => {
    if (isSaving) {
      return (
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--wp-teal)]">
          <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
          Saving
        </div>
      );
    }

    if (saveError) {
      return (
        <div
          className="flex items-center gap-1 text-[12px] text-red-600 dark:text-red-400"
          title={saveError}
        >
          <AlertTriangle className="h-3 w-3" />
          Save failed
        </div>
      );
    }

    if (isDirty) {
      return (
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--wp-copper)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--wp-copper)]" />
          Unsaved
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 text-[12px] text-stone-500">
        <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        Saved
      </div>
    );
  };

  const isEmpty = content.length === 0 && !title;

  return (
    <div
      className={`
        ultra-minimal-editor relative flex h-full flex-col
        bg-[var(--wp-paper)] text-[var(--wp-ink)] dark:bg-stone-950 dark:text-stone-100
        ${isFullScreen ? 'full-screen fixed inset-0 z-50' : ''}
      `}
      onMouseMove={() => isFullScreen && setShowChrome(true)}
      onTouchStart={() => isFullScreen && setShowChrome(true)}
    >
      {/* Subtle paper grain / wash */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
        style={{
          background:
            'radial-gradient(1200px 600px at 50% -10%, var(--wp-wash), transparent 70%)',
        }}
        aria-hidden
      />

      {/* Toolbar */}
      <div
        className={`
          relative z-10 shrink-0 border-b border-[var(--wp-line)] px-3 py-2 sm:px-5 sm:py-2.5
          transition-opacity duration-300
          ${isFullScreen ? 'absolute left-0 right-0 top-0 bg-[var(--wp-paper)]/85 backdrop-blur-md dark:bg-stone-950/85' : ''}
          ${isFullScreen && !showChrome ? 'opacity-0 pointer-events-none' : 'opacity-100'}
        `}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden sm:flex sm:items-center sm:gap-3">{renderSaveStatus()}</div>
            <div className="sm:hidden">
              {isDirty ? (
                <span className="text-[11px] text-[var(--wp-copper)]">Unsaved</span>
              ) : saveError ? (
                <span className="text-[11px] text-red-600 dark:text-red-400" title={saveError}>Save failed</span>
              ) : isSaving ? (
                <span className="text-[11px] text-[var(--wp-teal)]">Saving…</span>
              ) : (
                <span className="text-[11px] text-stone-500">
                  <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                </span>
              )}
            </div>
            {wordCount > 0 && (
              <span className="hidden tabular-nums text-[11px] tracking-wide text-stone-500 sm:inline">
                {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
              </span>
            )}
            {isTyping && (
              <span className="writing-flow-indicator typing hidden sm:inline-block" title="Writing" />
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <span
              className={`hidden rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider sm:inline ${
                autoSaveEnabled
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'bg-stone-500/10 text-stone-500'
              }`}
            >
              {autoSaveEnabled ? 'Autosave' : 'Manual'}
            </span>

            <div className="flex items-center rounded-lg border border-[var(--wp-line)] p-0.5">
              <Button
                variant={viewMode === 'write' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('write')}
                className="h-7 gap-1 px-2 text-[11px]"
                title="Write (raw markdown source)"
                aria-label="Write mode"
              >
                <PenLine className="h-3 w-3" />
                <span className="hidden sm:inline">Write</span>
              </Button>
              <Button
                variant={viewMode === 'preview' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('preview')}
                className="h-7 gap-1 px-2 text-[11px]"
                title="Preview (renders charts, html, json, and code artifacts)"
                aria-label="Preview mode"
              >
                <Eye className="h-3 w-3" />
                <span className="hidden sm:inline">Preview</span>
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setViewMode('write');
                requestAnimationFrame(() => {
                  const ta = textareaRef.current;
                  if (ta) {
                    ta.focus();
                    openSlashMenu(ta);
                  }
                });
              }}
              className="h-9 gap-1 px-2 text-stone-500 hover:text-[var(--wp-ink)] sm:h-8"
              title="AI commands (/)"
              aria-label="AI commands"
            >
              <Slash className="h-3.5 w-3.5" />
              <span className="hidden text-[11px] sm:inline">Commands</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenFullFeatures}
              className="h-9 w-9 p-0 text-stone-500 hover:text-[var(--wp-ink)] sm:h-8 sm:w-8"
              title="Settings (Ctrl+Shift+A)"
              aria-label="Settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFullScreen}
              className="h-9 w-9 p-0 text-stone-500 hover:text-[var(--wp-ink)] sm:h-8 sm:w-8"
              title={isFullScreen ? 'Exit focus (F11)' : 'Focus mode (F11)'}
              aria-label={isFullScreen ? 'Exit focus mode' : 'Enter focus mode'}
            >
              {isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSave}
              disabled={isSaving || (!isDirty && !saveError)}
              className="h-9 border-[var(--wp-line)] px-2.5 text-[11px] sm:h-8"
              title="Save (⌘S)"
            >
              <Save className="mr-1 h-3 w-3" />
              Save
            </Button>

            <div ref={exportMenuRef} className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExportOpen((open) => !open)}
                className="h-9 w-9 p-0 text-stone-500 hover:text-[var(--wp-ink)] sm:h-8 sm:w-8"
                title="Export (download / print)"
                aria-label="Export document"
              >
                <Download className="h-4 w-4" />
              </Button>
              {exportOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--wp-line)] bg-[var(--wp-paper-elevated)] shadow-lg dark:bg-stone-900 dark:border-stone-700">
                  <button
                    type="button"
                    onClick={() => handleExport('md')}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] text-[var(--wp-ink)] hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    Markdown (.md)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('txt')}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] text-[var(--wp-ink)] hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    Plain text (.txt)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('print')}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] text-[var(--wp-ink)] hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    Print / PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Writing column */}
      <div
        className={`
          relative z-[1] mx-auto flex w-full min-h-0 flex-1 flex-col
          px-4 sm:px-8 md:px-12
          ${isFullScreen ? 'max-w-3xl pt-14 sm:pt-16' : 'max-w-3xl'}
        `}
      >
        {(showTitle || title.length > 0) && (
          <div className="shrink-0 pb-2 pt-8 sm:pt-12 md:pt-14">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => setShowTitle(true)}
              onBlur={() => {
                if (title.length === 0 && content.length > 0) setShowTitle(false);
              }}
              placeholder="Untitled"
              className="w-full border-none bg-transparent text-center font-serif font-semibold tracking-tight text-[var(--wp-ink)] outline-none placeholder:text-stone-300 dark:text-stone-50 dark:placeholder:text-stone-600"
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
                lineHeight: 1.2,
              }}
              aria-label="Document title"
            />
            <div className="mx-auto mt-4 h-px w-12 bg-copper-300" />
          </div>
        )}

        {viewMode === 'preview' ? (
          <div className="relative min-h-0 flex-1 overflow-y-auto py-4 sm:py-6 minimal-scrollbar">
            <MarkdownRenderer content={content} className="writing-preview" />
          </div>
        ) : (
        <div className="relative flex min-h-0 flex-1 flex-col py-4 sm:py-6">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            onSelect={handleSelectionChange}
            onKeyUp={handleSelectionChange}
            onClick={handleSelectionChange}
            onKeyDown={handleTextareaKeyDown}
            aria-label="Document body"
            placeholder={
              isEmpty
                ? 'Begin writing. Press / for AI — continue, improve, image, chart…'
                : ''
            }
            className="
              minimal-scrollbar writing-text flex-1 w-full resize-none border-none bg-transparent
              outline-none placeholder:text-stone-400/80 dark:placeholder:text-stone-600
            "
            style={{
              fontFamily: 'Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif',
              lineHeight: 1.75,
              fontSize: 'clamp(16px, 2.2vw, 18px)',
              caretColor: 'var(--wp-copper)',
            }}
            spellCheck
          />
        </div>
        )}
      </div>

      {/* Empty state — non-blocking, bottom hint */}
      {isEmpty && !isFullScreen && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 z-[2] flex justify-center px-4 sm:bottom-24">
          <div className="pointer-events-auto max-w-sm rounded-2xl border border-[var(--wp-line)] bg-[var(--wp-paper-elevated)]/95 px-5 py-4 text-center shadow-lg backdrop-blur-sm dark:bg-stone-900/95 dark:border-stone-700">
            <Sparkles className="mx-auto mb-2 h-5 w-5 text-[var(--wp-copper)]" />
            <p className="font-serif text-[15px] text-[var(--wp-ink)] dark:text-stone-100">
              A quiet page. Start anywhere.
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-stone-500">
              Type <kbd className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px] dark:bg-stone-800">/</kbd> for
              continue, improve, image & chart. <kbd className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px] dark:bg-stone-800">F11</kbd> focus.
            </p>
          </div>
        </div>
      )}

      <AmbientAI
        content={content}
        cursorPosition={cursorPosition}
        selectedText={selectedText}
        onApplySuggestion={handleApplySuggestion}
        onOpenFullAI={onOpenFullFeatures}
        isEnabled={settings.userExperienceMode !== 'simple' || content.length > 10}
        assistanceLevel={settings.userExperienceMode === 'simple' ? 'minimal' : 'moderate'}
      />

      <SlashCommandsPopup
        isOpen={slashCommandsOpen}
        onClose={() => setSlashCommandsOpen(false)}
        position={slashCommandPosition}
        content={content}
        setContent={applyAIContent}
        editorRef={textareaRef}
        llmProvider={llmProvider}
        llmModel={llmModel}
        openaiApiKey={openaiApiKey}
        geminiApiKey={geminiApiKey}
        onSuggestions={onSuggestions}
        onUndo={handleUndo}
        activeProjectId={activeProjectId}
      />

      {isFullScreen && showChrome && (
        <div className="pointer-events-none absolute bottom-3 right-4 z-10 flex items-center gap-1.5 text-[10px] text-stone-400 sm:bottom-4 sm:right-6">
          <Keyboard className="h-3 w-3" />
          <span className="hidden sm:inline">⌘S · / commands · F11 exit</span>
        </div>
      )}
    </div>
  );
}
