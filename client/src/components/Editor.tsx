import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Edit, Search, Code, BarChart2, Save, CheckCircle, AlertTriangle, Wifi, WifiOff, Info, Maximize, Minimize } from "lucide-react";
import { useAISuggestions } from "@/hooks/use-ai-suggestions";
import SlashCommandsPopup from "@/components/SlashCommandsPopup";

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
  onToggleFullScreen
}: EditorProps) {
  const { toast } = useToast();
  const [hasFocus, setHasFocus] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  
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
  
  // Handle keyboard events for slash commands
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Detect slash key press
    if (e.key === '/' && !slashCommandsOpen) {
      e.preventDefault(); // Prevent slash from being typed
      
      // Get cursor position for menu placement
      const textarea = e.currentTarget;
      const rect = textarea.getBoundingClientRect();
      const scrollTop = textarea.scrollTop;
      
      // Calculate approximate cursor position
      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = content.substring(0, cursorPosition);
      const lines = textBeforeCursor.split('\n');
      const currentLine = lines.length - 1;
      const charInLine = lines[lines.length - 1].length;
      
      // Rough estimation of cursor position (this could be improved)
      const lineHeight = 24; // Approximate line height
      const charWidth = 10; // Approximate character width
      
      setSlashCommandPosition({
        x: rect.left + (charInLine * charWidth),
        y: rect.top + (currentLine * lineHeight) + lineHeight - scrollTop
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

  // Add this useEffect after your other hooks, inside the Editor component
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerText !== content) {
      editorRef.current.innerText = content;
      
      // Move cursor to end after updating content
      if (content) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }, [content]);

  // Add this useEffect after your other hooks, inside the Editor component
  useEffect(() => {
    if (titleRef.current && titleRef.current.innerText !== title) {
      titleRef.current.innerText = title;
    }
  }, [title]);

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
            
            {/* Context Panel Toggle */}
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
            placeholder="Document Title"
            className={`w-full bg-transparent border-none outline-none placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 font-bold ${
              isFullScreen ? 'text-4xl' : 'text-3xl'
            }`}
          />
        </div>
        
        {/* Content Editor - Full height and width with larger text in full screen */}
        <div className={isFullScreen ? "flex-1 px-24 pb-16 overflow-hidden" : "flex-1 px-12 pb-8 overflow-hidden"}>
          <textarea
            ref={editorRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start writing..."
            className={`w-full h-full border-none resize-none outline-none text-gray-700 dark:text-gray-300 bg-transparent transition-colors leading-relaxed placeholder-gray-400 dark:placeholder-gray-500 ${
              isFullScreen ? 'text-xl' : 'text-lg'
            }`}
            style={{ 
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: isFullScreen ? '20px' : '18px',
              lineHeight: isFullScreen ? '1.9' : '1.8'
            }}
            onKeyDown={handleKeyDown}
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
      />
    </div>
  );
}
