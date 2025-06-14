import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { Edit, Search, Code, BarChart2, Save, CheckCircle, AlertTriangle, Wifi, WifiOff, Info, Maximize, Minimize, Undo, Redo } from "lucide-react";
import { useAISuggestions } from "@/hooks/use-ai-suggestions";
import { useUndoRedo } from "@/hooks/use-undo-redo";
import SlashCommandsPopup from "@/components/SlashCommandsPopup";
import { GuidedHint } from "@/components/HelpTooltip";
import { useSettings } from "@/providers/SettingsProvider";
import RichMarkdownEditor from "@/components/RichMarkdownEditor";

interface EditorProps {
  title: string;
  setTitle: (title: string) => void;
  content: string;
  setContent: (content: string) => void;
  isSaving: boolean;
  isDirty: boolean;
  saveError: string | null;
  autoSaveEnabled: boolean;
  saveDocument: (isManual?: boolean) => Promise<void>;
  llmProvider: 'openai' | 'ollama';
  llmModel: string;
  contextPanelOpen: boolean;
  onToggleContextPanel: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onSuggestions?: (suggestions: string) => void;
}

export default function Editor({
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
  contextPanelOpen,
  onToggleContextPanel,
  isFullScreen,
  onToggleFullScreen,
  onSuggestions
}: EditorProps) {
  const { toast } = useToast();
  const { settings } = useSettings();
  const [hasFocus, setHasFocus] = useState(false);
  const [showGettingStartedHint, setShowGettingStartedHint] = useState(
    settings.userExperienceMode === 'simple' && settings.hasCompletedOnboarding && content.length < 50
  );
  const editorRef = useRef<HTMLTextAreaElement>(null);
  
  // State for slash commands popup
  const [slashCommandsOpen, setSlashCommandsOpen] = useState(false);
  const [slashCommandPosition, setSlashCommandPosition] = useState({ x: 0, y: 0 });
  
  // Get AI suggestions based on content (disabled auto-generation)
  const {
    generateTextCompletion,
    isGenerating
  } = useAISuggestions({
    content,
    enabled: false, // Disabled auto-generation
    llmProvider,
    llmModel
  });
  
  // Initialize undo/redo system
  const undoRedo = useUndoRedo(
    { title, content },
    { maxHistorySize: 50, debounceMs: 1000 }
  );
  
  // Debounce content and title changes for undo/redo
  const debouncedTitle = useDebounce(title, 1000);
  const debouncedContent = useDebounce(content, 1000);
  
  // Track when debounced content changes to add to history (not on every keystroke)
  useEffect(() => {
    // Only add to history if we're not currently applying undo/redo and values have actually changed
    if (!undoRedo.isApplyingHistory() && (debouncedTitle || debouncedContent)) {
      undoRedo.pushState({ title: debouncedTitle, content: debouncedContent });
    }
  }, [debouncedTitle, debouncedContent, undoRedo]);
  
  // Handle undo
  const handleUndo = () => {
    const previousState = undoRedo.undo();
    if (previousState) {
      setTitle(previousState.title);
      setContent(previousState.content);
    }
  };
  
  // Handle redo
  const handleRedo = () => {
    const nextState = undoRedo.redo();
    if (nextState) {
      setTitle(nextState.title);
      setContent(nextState.content);
    }
  };
  
  // Handle keyboard events for slash commands
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle undo/redo shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (e.key === 's') {
        e.preventDefault();
        handleManualSave();
        return;
      }
    }

    // Detect slash key press - simplified and more reliable
    if (e.key === '/' && !slashCommandsOpen) {
      e.preventDefault(); // Prevent slash from being typed
      
      // Get cursor position for menu placement - simplified approach
      const textarea = e.currentTarget;
      const rect = textarea.getBoundingClientRect();
      const scrollTop = textarea.scrollTop;
      const scrollLeft = textarea.scrollLeft;
      
      // Use cursor position in the textarea
      const cursorPosition = textarea.selectionStart;
      
      // Simple position calculation - place menu near cursor
      // For better positioning, we could calculate exact line/char position
      // but this simpler approach should be more reliable
      const approximateX = rect.left + 50; // Simple offset from left edge
      const approximateY = rect.top + 50 - scrollTop; // Simple offset from top edge
      
      setSlashCommandPosition({
        x: Math.max(approximateX, rect.left + 10), // Ensure it's within bounds
        y: Math.max(approximateY, rect.top + 10)   // Ensure it's within bounds
      });
      
      // Show slash commands popup
      setSlashCommandsOpen(true);
    }
    
    // Close menu with escape
    if (e.key === 'Escape' && slashCommandsOpen) {
      setSlashCommandsOpen(false);
    }
  };
  
  // Handle manual save
  const handleManualSave = async () => {
    if (!isDirty) {
      toast({
        title: "Nothing to save",
        description: "Your document is already up to date.",
      });
      return;
    }
    
    try {
      await saveDocument(true); // true = manual save
      if (!saveError) {
        toast({
          title: "Document saved",
          description: "Your changes have been saved successfully.",
        });
      }
    } catch (error) {
      // Error is already handled in the hook, but we can add additional feedback here if needed
    }
  };
  
  // Render save status with appropriate icon and message
  const renderSaveStatus = () => {
    if (isSaving) {
      return (
        <div className="flex items-center text-yellow-600 dark:text-yellow-400">
          <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Saving...
        </div>
      );
    }
    
    if (saveError) {
      return (
        <div className="flex items-center text-red-600 dark:text-red-400" title={`Save error: ${saveError}`}>
          <AlertTriangle className="h-4 w-4 mr-1" />
          Save failed
        </div>
      );
    }
    
    if (isDirty) {
      return (
        <div className="flex items-center text-orange-600 dark:text-orange-400">
          <div className="h-2 w-2 bg-orange-500 rounded-full mr-2"></div>
          {autoSaveEnabled ? "Unsaved changes" : "Autosave disabled"}
        </div>
      );
    }
    
    return (
      <div className="flex items-center text-green-600 dark:text-green-400">
        <CheckCircle className="h-4 w-4 mr-1" />
        Saved
      </div>
    );
  };
  
  // DISABLED: Auto-suggestion display removed per user request
  // Users will use agent or slash commands instead
  /*
  // Show suggestion after typing and when suggestions are available
  useEffect(() => {
    if (hasFocus && suggestions.length > 0 && !showSuggestion) {
      const timer = setTimeout(() => {
        setShowSuggestion(true);
        setSelectedSuggestion(suggestions[0]);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [suggestions, hasFocus, showSuggestion]);
  */
  
  // Handle generating a paragraph
  const generateParagraph = async () => {
    try {
      const result = await generateTextCompletion("Continue this text with a new paragraph that follows logically.");
      if (result.generated) {
        setContent(content + "\n\n" + result.generated);
        
        toast({
          title: "Paragraph generated",
          description: "A new paragraph has been added to your document."
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate paragraph.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Editor Header - hide in full screen */}
      {!isFullScreen && (
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-3 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-medium text-gray-700 dark:text-gray-300">Editor</h2>
          </div>
          
          {/* Save Status and Controls */}
          <div className="flex items-center space-x-3">
            {/* Autosave Status Indicator */}
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400" title={autoSaveEnabled ? "Autosave is enabled" : "Autosave is disabled due to errors"}>
              {autoSaveEnabled ? (
                <Wifi className="h-3 w-3 mr-1" />
              ) : (
                <WifiOff className="h-3 w-3 mr-1" />
              )}
              Auto
            </div>
            
            {/* Save Status Indicator */}
            <div className="flex items-center text-sm">
              {renderSaveStatus()}
            </div>
            
            {/* Context Panel Toggle - Only in advanced mode */}
            {settings.userExperienceMode === 'advanced' && (
              <Button
                onClick={onToggleContextPanel}
                variant="ghost"
                size="sm"
                className={`flex items-center ${contextPanelOpen ? 'bg-primary/10 text-primary' : ''}`}
                title="Toggle document insights"
              >
                <Info className="h-4 w-4 mr-1" />
                Insights
              </Button>
            )}

            {/* Undo/Redo Buttons */}
            <div className="flex items-center space-x-1">
              <Button
                onClick={handleUndo}
                disabled={!undoRedo.canUndo}
                variant="ghost"
                size="sm"
                className="flex items-center"
                title="Undo (Ctrl+Z)"
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleRedo}
                disabled={!undoRedo.canRedo}
                variant="ghost"
                size="sm"
                className="flex items-center"
                title="Redo (Ctrl+Y)"
              >
                <Redo className="h-4 w-4" />
              </Button>
              {/* History indicator for debugging */}
              <span className="text-xs text-gray-400 ml-2" title={`History: ${undoRedo.currentIndex + 1}/${undoRedo.historySize}`}>
                {undoRedo.currentIndex + 1}/{undoRedo.historySize}
              </span>
            </div>
            
            {/* Full Screen Toggle */}
            <Button
              onClick={onToggleFullScreen}
              variant="ghost"
              size="sm"
              className={`flex items-center ${isFullScreen ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''}`}
              title={isFullScreen ? "Exit full screen" : "Enter full screen"}
            >
              {isFullScreen ? <Minimize className="h-4 w-4 mr-1" /> : <Maximize className="h-4 w-4 mr-1" />}
              {isFullScreen ? "Exit Full Screen" : "Full Screen"}
            </Button>
            
            {/* Manual Save Button */}
            <Button
              onClick={handleManualSave}
              disabled={isSaving || (!isDirty && !saveError)}
              variant="outline"
              size="sm"
              className="flex items-center"
              title="Save your changes manually (Ctrl+S)"
            >
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      )}
      
      {/* Main Editor Area - Full viewport in full screen mode */}
      <div className={`flex-1 flex flex-col bg-white dark:bg-gray-900 overflow-hidden ${
        isFullScreen ? 'h-screen' : ''
      }`}>
        {/* Title Input - Adjust padding for full screen */}
        <div className={isFullScreen ? "px-24 pt-16 pb-8" : "px-12 pt-8 pb-4"}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              // Handle undo/redo shortcuts in title field too
              if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) {
                  e.preventDefault();
                  handleUndo();
                  return;
                }
                if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
                  e.preventDefault();
                  handleRedo();
                  return;
                }
                if (e.key === 's') {
                  e.preventDefault();
                  handleManualSave();
                  return;
                }
              }
            }}
            placeholder="Document Title"
            className={`w-full bg-transparent border-none outline-none placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 font-bold ${
              isFullScreen ? 'text-4xl' : 'text-3xl'
            }`}
          />
        </div>
        
        {/* Rich Markdown Editor */}
        <div className="flex-1 overflow-hidden">
          <RichMarkdownEditor
            content={content}
            setContent={setContent}
            placeholder={settings.userExperienceMode === 'simple' 
              ? "Start writing your ideas here... Type '/' for AI assistance!" 
              : "Start writing..."
            }
            isFullScreen={isFullScreen}
            showGettingStartedHint={showGettingStartedHint && settings.userExperienceMode === 'simple'}
            onHideHint={() => setShowGettingStartedHint(false)}
            onKeyDown={handleKeyDown}
            editorRef={editorRef}
          />
        </div>
      </div>
      
      {/* Slash Commands Popup */}
      <SlashCommandsPopup
        isOpen={slashCommandsOpen}
        onClose={() => setSlashCommandsOpen(false)}
        position={slashCommandPosition}
        content={content}
        setContent={setContent}
        editorRef={editorRef}
        llmProvider={llmProvider}
        llmModel={llmModel}
        onSuggestions={onSuggestions}
        onUndo={handleUndo}
      />
    </div>
  );
}