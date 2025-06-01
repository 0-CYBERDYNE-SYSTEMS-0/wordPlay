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
  BarChart2,
  Undo
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import AIProcessingIndicator from './AIProcessingIndicator';
import { createAIResponseParser, type ParsedAIResponse } from '@/lib/aiResponseParser';

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
  },
  {
    id: 'research',
    title: 'Research topic',
    description: 'Search the web for information on a topic',
    icon: <Globe className="h-4 w-4" />,
    action: 'research',
    category: 'utility',
    hasParameters: true,
    parameters: ['topic']
  },
  {
    id: 'cite',
    title: 'Add citation',
    description: 'Reference saved sources from research',
    icon: <FileText className="h-4 w-4" />,
    action: 'cite',
    category: 'utility'
  },
  {
    id: 'undo',
    title: 'Undo last change',
    description: 'Revert the last AI modification',
    icon: <Undo className="h-4 w-4" />,
    action: 'undo',
    category: 'utility',
    shortcut: 'z'
  },
  {
    id: 'help',
    title: 'Help',
    description: 'Show all available commands and examples',
    icon: <Lightbulb className="h-4 w-4" />,
    action: 'help',
    category: 'utility',
    shortcut: '?'
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
  onUndo
}: SlashCommandsPopupProps) {
  const { toast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterText, setFilterText] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const commandRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [contextInfo, setContextInfo] = useState({
    hasSelection: false,
    selectionLength: 0,
    documentLength: 0,
    contextType: 'document' as 'document' | 'selection'
  });
  
  // Filter and sort commands based on filter text
  const filteredCommands = filterText
    ? SLASH_COMMANDS.filter(cmd => 
        cmd.title.toLowerCase().includes(filterText.toLowerCase()) ||
        cmd.action.toLowerCase().includes(filterText.toLowerCase()) ||
        cmd.description.toLowerCase().includes(filterText.toLowerCase())
      ).sort((a, b) => {
        // Prioritize matches that start with the filter text
        const aStartsWithTitle = a.title.toLowerCase().startsWith(filterText.toLowerCase());
        const bStartsWithTitle = b.title.toLowerCase().startsWith(filterText.toLowerCase());
        const aStartsWithAction = a.action.toLowerCase().startsWith(filterText.toLowerCase());
        const bStartsWithAction = b.action.toLowerCase().startsWith(filterText.toLowerCase());
        
        if (aStartsWithTitle && !bStartsWithTitle) return -1;
        if (!aStartsWithTitle && bStartsWithTitle) return 1;
        if (aStartsWithAction && !bStartsWithAction) return -1;
        if (!aStartsWithAction && bStartsWithAction) return 1;
        
        // Alphabetical sort
        return a.title.localeCompare(b.title);
      })
    : SLASH_COMMANDS;

  // Update context info when popup opens
  useEffect(() => {
    if (isOpen) {
      const selectionInfo = getSelectionInfo();
      setContextInfo({
        hasSelection: selectionInfo.selectedText.length > 0,
        selectionLength: selectionInfo.selectedText.length,
        documentLength: content.length,
        contextType: selectionInfo.selectedText.length > 0 ? 'selection' : 'document'
      });
      setSelectedIndex(0); // Reset selection when popup opens
      setFilterText(''); // Reset filter when popup opens
      // Initialize refs array
      commandRefs.current = new Array(SLASH_COMMANDS.length).fill(null);
    }
  }, [isOpen, content]);

  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0);
    // Update refs array size for filtered commands
    commandRefs.current = new Array(filteredCommands.length).fill(null);
  }, [filterText, filteredCommands.length]);

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (isOpen && commandRefs.current[selectedIndex]) {
      const selectedElement = commandRefs.current[selectedIndex];
      const container = scrollContainerRef.current;
      
      if (selectedElement && container) {
        const elementRect = selectedElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Check if element is above the visible area
        if (elementRect.top < containerRect.top) {
          selectedElement.scrollIntoView({ block: 'start', behavior: 'instant' });
        }
        // Check if element is below the visible area
        else if (elementRect.bottom > containerRect.bottom) {
          selectedElement.scrollIntoView({ block: 'end', behavior: 'instant' });
        }
      }
    }
  }, [selectedIndex, isOpen]);
  
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

  // Generate help text with all available commands
  const generateHelpText = () => {
    const categories = {
      'creation': 'Creation Commands',
      'enhancement': 'Enhancement Commands', 
      'organization': 'Organization Commands',
      'utility': 'Utility Commands'
    };
    
    let helpText = '# Slash Command Reference\n\nType "/" to open the command menu, then select a command.\n\n';
    
    Object.entries(categories).forEach(([categoryKey, categoryName]) => {
      const categoryCommands = SLASH_COMMANDS.filter(cmd => cmd.category === categoryKey && cmd.id !== 'help');
      if (categoryCommands.length > 0) {
        helpText += `## ${categoryName}\n\n`;
        categoryCommands.forEach(cmd => {
          const shortcut = cmd.shortcut ? ` (${cmd.shortcut})` : '';
          helpText += `**/${cmd.action}${shortcut}** - ${cmd.description}\n`;
        });
        helpText += '\n';
      }
    });
    
    helpText += '## Tips\n\n';
    helpText += '- Select text before using a command to apply it only to that selection\n';
    helpText += '- Commands work on your entire document when no text is selected\n';
    helpText += '- Use keyboard shortcuts (shown in parentheses) for faster access\n';
    helpText += '- Type /help or /? to see this reference again\n';
    
    return helpText;
  };

  // Mutation for executing commands
  const executeCommand = async (command: string) => {
    const selectionInfo = getSelectionInfo();
    setLoading(true);
    
    // Set specific processing message based on command
    const messages = {
      'continue': 'Continuing your writing...',
      'suggest': 'Generating ideas...',
      'improve': 'Enhancing your text...',
      'expand': 'Adding more detail...',
      'rewrite': 'Rewriting content...',
      'simplify': 'Simplifying language...',
      'format': 'Improving formatting...',
      'fix': 'Fixing grammar and spelling...',
      'tone': 'Adjusting tone...',
      'translate': 'Translating text...',
      'analyze': 'Analyzing writing style...'
    };
    
    setProcessingMessage(messages[command as keyof typeof messages] || 'Processing your request...');
    
    // Create parser instance
    const parser = createAIResponseParser(llmProvider);
    
    // Apply parsed result based on strategy
    const applyParsedResult = async (parsed: ParsedAIResponse, command: string, selectionInfo: any) => {
      switch (parsed.strategy) {
        case 'context-only':
          // Send to Context Panel only
          if (parsed.thinking || parsed.suggestions) {
            const contextContent = [
              parsed.thinking,
              parsed.suggestions?.join('\n\n')
            ].filter(Boolean).join('\n\n');
            
            if (onSuggestions) {
              onSuggestions(contextContent);
            }
            
            toast({
              title: command === 'suggest' ? 'Ideas Generated' : 
                     command === 'analyze' ? 'Style Analysis Complete' : 
                     'Information Generated',
              description: 'Results have been added to the insights panel.'
            });
          }
          break;
          
        case 'append':
          // Add to end of content
          if (parsed.content) {
            setContent(content + '\n\n' + parsed.content);
            toast({
              title: 'Content Added',
              description: 'New content has been added to your document.'
            });
          }
          break;
          
        case 'replace':
          // Replace entire content or selection
          if (parsed.content) {
            if (selectionInfo.selectedText) {
              setContent(
                selectionInfo.beforeSelection + parsed.content + selectionInfo.afterSelection
              );
            } else {
              setContent(parsed.content);
            }
            toast({
              title: 'Content Updated',
              description: 'Your content has been updated.'
            });
          }
          break;
          
        case 'targeted-edit':
          // For targeted edits using existing grep/sed-like tools
          if (parsed.content) {
            if (selectionInfo.selectedText) {
              setContent(
                selectionInfo.beforeSelection + parsed.content + selectionInfo.afterSelection
              );
            } else {
              setContent(parsed.content);
            }
            toast({
              title: 'Content Enhanced',
              description: 'Your content has been improved with targeted edits using existing text processing tools.'
            });
          }
          break;
      }
      
      // Always send thinking to Context Panel if available and not already sent
      if (parsed.thinking && onSuggestions && parsed.strategy !== 'context-only' && parsed.strategy !== 'targeted-edit') {
        onSuggestions(parsed.thinking);
      }
    };
    
    try {
      // Handle help command locally without API call
      if (command === 'help') {
        const helpText = generateHelpText();
        if (onSuggestions) {
          onSuggestions(helpText);
          toast({
            title: 'Help Information',
            description: 'Command reference has been added to the insights panel.'
          });
        } else {
          setContent(content + '\n\n--- Slash Command Help ---\n' + helpText);
          toast({
            title: 'Help Information',
            description: 'Command reference added to document.'
          });
        }
        setLoading(false);
        return;
      }
      
      // Handle undo command locally
      if (command === 'undo') {
        if (onUndo) {
          onUndo();
          toast({
            title: 'Undone',
            description: 'Last change has been reverted.'
          });
        } else {
          toast({
            title: 'Undo not available',
            description: 'No undo functionality available in this context.',
            variant: 'destructive'
          });
        }
        setLoading(false);
        return;
      }
      
      const res = await apiRequest('POST', '/api/ai/slash-command', {
        command,
        content,
        selectionInfo,
        style: null, // You can add style information here if needed
        llmProvider,
        llmModel
      });
      
      const data = await res.json();
      
      // Parse the AI response using the intelligent parser
      setProcessingMessage('Parsing AI response...');
      const parsed = await parser.parseResponse(
        data.result,
        command,
        content,
        selectionInfo
      );
      
      // Apply the parsed result based on strategy
      await applyParsedResult(parsed, command, selectionInfo);
      
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
      setProcessingMessage('');
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
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev === 0 ? filteredCommands.length - 1 : prev - 1);
          break;
        case 'Enter':
          e.preventDefault();
          const selectedCommand = filteredCommands[selectedIndex];
          if (selectedCommand && !loading) {
            onClose();
            executeCommand(selectedCommand.action);
          }
          break;
        case 'Backspace':
          e.preventDefault();
          setFilterText(prev => prev.slice(0, -1));
          break;
        default:
          // Handle letter typing for filtering
          if (e.key.length === 1 && e.key.match(/[a-zA-Z0-9]/)) {
            e.preventDefault();
            setFilterText(prev => prev + e.key.toLowerCase());
          }
          // Handle number shortcuts (only if no filter text)
          else if (!filterText) {
            const num = parseInt(e.key);
            if (num >= 1 && num <= 9) {
              const commandWithShortcut = SLASH_COMMANDS.find(cmd => cmd.shortcut === e.key);
              if (commandWithShortcut && !loading) {
                e.preventDefault();
                onClose();
                executeCommand(commandWithShortcut.action);
              }
            }
            // Handle ? for help
            if (e.key === '?' && !loading) {
              e.preventDefault();
              onClose();
              executeCommand('help');
            }
          }
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selectedIndex, loading, filterText, filteredCommands]);
  
  if (!isOpen) return null;
  
  return (
    <>
      <div 
        ref={menuRef}
        className="absolute z-50 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 w-72"
        style={{ top: position.y, left: position.x }}
      >
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">AI Commands</p>
            {filterText && (
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                "{filterText}" ({filteredCommands.length} matches)
              </div>
            )}
          </div>
          {/* Context indicator */}
          <div className="mt-2 flex items-center gap-2">
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              contextInfo.contextType === 'selection' 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {contextInfo.contextType === 'selection' 
                ? `Applying to selection (${contextInfo.selectionLength} chars)`
                : `Applying to document (${Math.round(contextInfo.documentLength / 250)} words)`
              }
            </div>
          </div>
        </div>
        <div ref={scrollContainerRef} className="max-h-64 overflow-y-auto p-1">
          {filteredCommands.length === 0 ? (
            <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              No commands match "{filterText}"
              <br />
              <span className="text-xs">Press Backspace to clear filter</span>
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
            <button
              key={cmd.id}
              ref={(el) => {
                commandRefs.current[index] = el;
              }}
              onClick={() => {
                onClose();
                executeCommand(cmd.action);
              }}
              className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 ${
                index === selectedIndex 
                  ? 'bg-primary text-white' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              disabled={loading}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                {cmd.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm flex items-center justify-between">
                  <span>{cmd.title}</span>
                  {cmd.shortcut && (
                    <span className={`text-xs px-1 py-0.5 rounded ${
                      index === selectedIndex 
                        ? 'bg-white/20 text-white' 
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                    }`}>
                      {cmd.shortcut}
                    </span>
                  )}
                </div>
                <div className={`text-xs ${
                  index === selectedIndex 
                    ? 'text-white/80' 
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {cmd.description}
                </div>
              </div>
            </button>
            ))
          )}
        </div>
        
        {/* Navigation tips footer */}
        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <span>↑↓ Navigate • Enter Select • Esc Close</span>
            <span>{filterText ? 'Backspace Clear' : 'Type to Filter'}</span>
          </div>
        </div>
      </div>
      
      {/* Loading overlay */}
      {loading && (
        <div className="fixed bottom-4 right-4 bg-primary text-white px-4 py-2 rounded-md shadow-lg flex items-center z-50">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{processingMessage || 'Generating AI content...'}</span>
        </div>
      )}
    </>
  );
}