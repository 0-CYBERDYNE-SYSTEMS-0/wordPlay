import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Eye, Edit3, Columns, Focus, Bold, Italic, List, 
  Hash, Quote, Code, Table, Link, Image, Type, 
  Palette, Split, Maximize2, Minimize2
} from "lucide-react";
import { GuidedHint } from "@/components/HelpTooltip";
import { useSettings } from "@/providers/SettingsProvider";
import MarkdownRenderer from "./MarkdownRenderer";

interface RichMarkdownEditorProps {
  content: string;
  setContent: (content: string) => void;
  placeholder?: string;
  isFullScreen: boolean;
  showGettingStartedHint?: boolean;
  onHideHint?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  editorRef?: React.RefObject<HTMLTextAreaElement>;
}

type ViewMode = 'write' | 'preview' | 'split';

export default function RichMarkdownEditor({
  content,
  setContent,
  placeholder = "Start writing...",
  isFullScreen,
  showGettingStartedHint = false,
  onHideHint,
  onKeyDown,
  editorRef
}: RichMarkdownEditorProps) {
  const { settings } = useSettings();
  const [viewMode, setViewMode] = useState<ViewMode>('write');
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const internalEditorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Use provided ref or internal ref
  const textareaRef = editorRef || internalEditorRef;

  // Handle content changes
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (e.target.value.length > 10) {
      onHideHint?.();
    }
  };

  // Quick formatting functions
  const insertFormatting = useCallback((before: string, after: string = '') => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    const newText = content.substring(0, start) + before + selectedText + after + content.substring(end);
    setContent(newText);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }, [content, setContent, textareaRef]);

  // Formatting shortcuts
  const handleKeyboardShortcuts = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          insertFormatting('**', '**');
          break;
        case 'i':
          e.preventDefault();
          insertFormatting('*', '*');
          break;
        case 'k':
          e.preventDefault();
          insertFormatting('[', '](url)');
          break;
        case '`':
          e.preventDefault();
          insertFormatting('`', '`');
          break;
      }
    }
    onKeyDown?.(e);
  }, [insertFormatting, onKeyDown]);

  // Format button actions
  const formatActions = {
    bold: () => insertFormatting('**', '**'),
    italic: () => insertFormatting('*', '*'),
    code: () => insertFormatting('`', '`'),
    heading: () => insertFormatting('# '),
    quote: () => insertFormatting('> '),
    list: () => insertFormatting('- '),
    link: () => insertFormatting('[', '](url)'),
    image: () => insertFormatting('![alt](', ')'),
    table: () => {
      const tableMarkdown = `\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n`;
      insertFormatting(tableMarkdown);
    }
  };

  // We now use MarkdownRenderer for proper rendering

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
        <div className="flex items-center space-x-1">
          {/* View Mode Toggles */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'write' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('write')}
                    className="flex items-center space-x-1"
                  >
                    <Edit3 className="h-4 w-4" />
                    <span className="hidden sm:inline">Write</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit Mode</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'preview' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('preview')}
                    className="flex items-center space-x-1"
                  >
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">Preview</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Preview Mode</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'split' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('split')}
                    className="flex items-center space-x-1"
                  >
                    <Columns className="h-4 w-4" />
                    <span className="hidden sm:inline">Split</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Split View</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Format Toolbar Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showFormatToolbar ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setShowFormatToolbar(!showFormatToolbar)}
                >
                  <Type className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle Formatting Toolbar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          {content.split(' ').filter(Boolean).length} words • {content.length} characters
        </div>
      </div>

      {/* Formatting Toolbar */}
      {showFormatToolbar && (viewMode === 'write' || viewMode === 'split') && (
        <div className="flex items-center space-x-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-wrap">
          <TooltipProvider>
            <div className="flex items-center space-x-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={formatActions.bold}>
                    <Bold className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bold (Ctrl+B)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={formatActions.italic}>
                    <Italic className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Italic (Ctrl+I)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={formatActions.heading}>
                    <Hash className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Heading</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={formatActions.list}>
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bullet List</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={formatActions.quote}>
                    <Quote className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Quote</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={formatActions.code}>
                    <Code className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Inline Code</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={formatActions.table}>
                    <Table className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Insert Table</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={formatActions.link}>
                    <Link className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Link (Ctrl+K)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={formatActions.image}>
                    <Image className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Image</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Write Mode or Split Mode - Left Side */}
        {(viewMode === 'write' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/2 border-r border-gray-200 dark:border-gray-700' : 'w-full'} flex flex-col`}>
            <div className={isFullScreen ? "flex-1 px-24 pb-16 overflow-hidden" : "flex-1 px-6 pb-8 overflow-hidden"}>
              <GuidedHint
                hint="💡 Type '/' anywhere to open AI commands, or just start writing and let AI assist you!"
                showHint={showGettingStartedHint && settings.userExperienceMode === 'simple'}
                onDismiss={onHideHint}
              >
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={handleContentChange}
                  placeholder={placeholder}
                  className={`w-full h-full border-none resize-none outline-none text-gray-700 dark:text-gray-300 bg-transparent transition-colors leading-relaxed placeholder-gray-400 dark:placeholder-gray-500 font-mono ${
                    isFullScreen ? 'text-lg' : 'text-base'
                  }`}
                  style={{ 
                    fontFamily: 'JetBrains Mono, Fira Code, Monaco, monospace',
                    fontSize: isFullScreen ? '16px' : '14px',
                    lineHeight: '1.6'
                  }}
                  onKeyDown={handleKeyboardShortcuts}
                />
              </GuidedHint>
            </div>
          </div>
        )}

        {/* Preview Mode or Split Mode - Right Side */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} flex flex-col bg-white dark:bg-gray-900`}>
            <div className={isFullScreen ? "flex-1 px-24 pb-16 overflow-auto" : "flex-1 px-6 pb-8 overflow-auto"}>
              {content ? (
                <MarkdownRenderer 
                  content={content}
                  className={isFullScreen ? 'prose-lg' : 'prose-base'}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 italic">
                  <p>Start typing to see your content rendered...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}