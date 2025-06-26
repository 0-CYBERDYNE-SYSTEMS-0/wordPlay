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
  Undo,
  Table,
  Image,
  TrendingUp,
  Database,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useApiProcessing } from '@/hooks/use-api-processing';
import AIProcessingIndicator from './AIProcessingIndicator';
import { createAIResponseParser, type ParsedAIResponse } from '@/lib/aiResponseParser';
import { useSettings } from '@/providers/SettingsProvider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  category: string;
  hasParameters?: boolean;
  parameters?: string[];
  shortcut?: string;
}

export const ALL_SLASH_COMMANDS: SlashCommand[] = [
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

// Expert mode commands - AI content generation
export const EXPERT_SLASH_COMMANDS: SlashCommand[] = [
  ...ALL_SLASH_COMMANDS,
  {
    id: 'table',
    title: 'Create table',
    description: 'Convert selected text into a formatted table',
    icon: <Table className="h-4 w-4" />,
    action: 'table',
    category: 'creation',
    hasParameters: true,
    parameters: ['replace', 'augment'],
    shortcut: 't'
  },
  {
    id: 'chart',
    title: 'Create chart',
    description: 'Generate data visualization from text or data',
    icon: <TrendingUp className="h-4 w-4" />,
    action: 'chart',
    category: 'creation',
    hasParameters: true,
    parameters: ['bar', 'line', 'pie', 'scatter', 'auto'],
    shortcut: 'c'
  },
  {
    id: 'image',
    title: 'Generate image',
    description: 'Create AI-generated image using Gemini 2.0 Flash',
    icon: <Image className="h-4 w-4" />,
    action: 'image',
    category: 'creation',
    hasParameters: true,
    parameters: ['realistic', 'artistic', 'diagram', 'icon']
  }
];

// Simple mode commands - essential features only
export const SIMPLE_SLASH_COMMANDS: SlashCommand[] = [
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
    id: 'improve',
    title: 'Improve writing',
    description: 'Enhance clarity and readability',
    icon: <Sparkles className="h-4 w-4" />,
    action: 'improve',
    category: 'enhancement',
    shortcut: '2'
  },
  {
    id: 'fix',
    title: 'Fix grammar',
    description: 'Correct grammar and spelling',
    icon: <CheckSquare className="h-4 w-4" />,
    action: 'fix',
    category: 'utility',
    shortcut: '3'
  },
  {
    id: 'summarize',
    title: 'Summarize',
    description: 'Create a concise summary',
    icon: <FileText className="h-4 w-4" />,
    action: 'summarize',
    category: 'organization',
    shortcut: '4'
  },
  {
    id: 'rewrite',
    title: 'Rewrite',
    description: 'Rewrite the selected text',
    icon: <Pencil className="h-4 w-4" />,
    action: 'rewrite',
    category: 'enhancement',
    shortcut: '5'
  },
  {
    id: 'table',
    title: 'Create table',
    description: 'Convert selected text into a formatted table',
    icon: <Table className="h-4 w-4" />,
    action: 'table',
    category: 'creation',
    hasParameters: true,
    parameters: ['replace', 'augment'],
    shortcut: 't'
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
  onUndo,
  activeProjectId
}: SlashCommandsPopupProps) {
  const { toast } = useToast();
  const { startProcessing, stopProcessing, updateMessage } = useApiProcessing();
  const { settings } = useSettings();
  const menuRef = useRef<HTMLDivElement>(null);
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
  const [includeResearchContext, setIncludeResearchContext] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    command: string;
    commandTitle: string;
    message: string;
  }>({
    isOpen: false,
    command: '',
    commandTitle: '',
    message: ''
  });
  
  const [inputDialog, setInputDialog] = useState<{
    isOpen: boolean;
    command: string;
    title: string;
    placeholder: string;
    value: string;
  }>({
    isOpen: false,
    command: '',
    title: '',
    placeholder: '',
    value: ''
  });
  
  // Use appropriate command set based on user experience mode
  const SLASH_COMMANDS = settings.userExperienceMode === 'simple' ? SIMPLE_SLASH_COMMANDS : 
                         settings.userExperienceMode === 'expert' ? EXPERT_SLASH_COMMANDS : 
                         ALL_SLASH_COMMANDS;
  
  // Get operation type and visual indicator for commands
  const getCommandOperationType = (commandAction: string) => {
    const operationTypes = {
      // Context-only operations (don't modify document)
      'suggest': { type: 'Context Only', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
      'analyze': { type: 'Context Only', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
      'help': { type: 'Context Only', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
      
      // Append operations (add to document)
      'continue': { type: 'Adds Content', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
      'expand': { type: 'Adds Content', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
      
      // Insert operations (insert at cursor)
      'summarize': { type: 'Inserts at Cursor', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      'list': { type: 'Inserts at Cursor', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      'outline': { type: 'Inserts at Cursor', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      
      // Modify operations (changes selection or document)
      'improve': { type: contextInfo.hasSelection ? 'Modifies Selection' : 'Modifies Document', 
                  color: contextInfo.hasSelection ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400',
                  bg: contextInfo.hasSelection ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20' },
      'fix': { type: contextInfo.hasSelection ? 'Modifies Selection' : 'Modifies Document', 
              color: contextInfo.hasSelection ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400',
              bg: contextInfo.hasSelection ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20' },
      'rewrite': { type: contextInfo.hasSelection ? 'Modifies Selection' : 'Modifies Document', 
                  color: contextInfo.hasSelection ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400',
                  bg: contextInfo.hasSelection ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20' },
      'tone': { type: contextInfo.hasSelection ? 'Modifies Selection' : 'Modifies Document', 
               color: contextInfo.hasSelection ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400',
               bg: contextInfo.hasSelection ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20' },
      'translate': { type: contextInfo.hasSelection ? 'Modifies Selection' : 'Modifies Document', 
                    color: contextInfo.hasSelection ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400',
                    bg: contextInfo.hasSelection ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20' },
      'format': { type: contextInfo.hasSelection ? 'Modifies Selection' : 'Modifies Document', 
                 color: contextInfo.hasSelection ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400',
                 bg: contextInfo.hasSelection ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20' }
    };
    
    return operationTypes[commandAction as keyof typeof operationTypes] || 
           { type: 'Modifies Content', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/20' };
  };
  
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

  // Check if command requires input prompt
  const checkForInputPrompt = (command: string) => {
    const inputCommands = {
      'research': {
        title: 'Research Topic',
        placeholder: 'Enter the topic you want to research (e.g., "artificial intelligence", "climate change")'
      },
      'translate': {
        title: 'Translation Language',
        placeholder: 'Enter target language (e.g., "Spanish", "French", "German") or leave blank for Spanish'
      }
    };
    
    if (inputCommands[command as keyof typeof inputCommands]) {
      const config = inputCommands[command as keyof typeof inputCommands];
      setInputDialog({
        isOpen: true,
        command,
        title: config.title,
        placeholder: config.placeholder,
        value: ''
      });
      return true; // Needs input
    }
    return false; // No input needed
  };

  // Check if command requires confirmation for whole-document operation
  const checkForConfirmation = (command: string, selectionInfo: any) => {
    const destructiveCommands = ['improve', 'fix', 'tone', 'rewrite', 'translate', 'format'];
    const commandTitles = {
      'improve': 'Improve Writing',
      'fix': 'Fix Grammar',
      'tone': 'Change Tone', 
      'rewrite': 'Rewrite',
      'translate': 'Translate',
      'format': 'Format Text'
    };
    
    if (destructiveCommands.includes(command) && !selectionInfo.selectedText) {
      const wordCount = Math.round(content.length / 250);
      setConfirmationDialog({
        isOpen: true,
        command,
        commandTitle: commandTitles[command as keyof typeof commandTitles] || command,
        message: `You're about to apply "${commandTitles[command as keyof typeof commandTitles]}" to your entire document (~${wordCount} words). This will replace all your content. Are you sure?`
      });
      return true; // Needs confirmation
    }
    return false; // No confirmation needed
  };

  // Main command execution function  
  const executeCommand = async (command: string) => {
    const selectionInfo = getSelectionInfo();
    
    // Check if this command needs input prompt first
    if (checkForInputPrompt(command)) {
      return; // Will show input dialog, don't proceed yet
    }
    
    // Check if this command needs confirmation for whole-document operation
    if (checkForConfirmation(command, selectionInfo)) {
      return; // Will show confirmation dialog, don't proceed yet
    }
    
    // Execute directly if no input or confirmation needed
    await executeCommandConfirmed(command);
  };

  // Execute command with custom input
  const executeCommandWithInput = async (command: string, customInput: string) => {
    const commandWithInput = customInput.trim() 
      ? `${command}:custom:${customInput.trim()}`
      : command;
    
    const selectionInfo = getSelectionInfo();
    
    // Check if this command still needs confirmation for whole-document operation
    if (checkForConfirmation(command, selectionInfo)) {
      return; // Will show confirmation dialog, don't proceed yet
    }
    
    // Execute with the custom input
    await executeCommandConfirmed(commandWithInput);
  };

  // Execute command after confirmation (or directly if no confirmation needed)
  const executeCommandConfirmed = async (command: string) => {
    const selectionInfo = getSelectionInfo();
    
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
      'analyze': 'Analyzing writing style...',
      'table': 'Creating data table...',
      'chart': 'Generating visualization...',
      'image': 'Creating image with Gemini 2.0 Flash...'
    };
    
    const message = messages[command as keyof typeof messages] || 'Processing your request...';
    startProcessing(message);
    
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
        stopProcessing();
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
        stopProcessing();
        return;
      }
      
      const res = await apiRequest('POST', '/api/ai/slash-command', {
        command,
        content,
        selectionInfo,
        style: null, // You can add style information here if needed
        llmProvider,
        llmModel,
        includeContext: includeResearchContext,
        projectId: activeProjectId,
        userId: 1 // Using default user ID as per app convention
      });
      
      const data = await res.json();
      
      // Parse the AI response using the intelligent parser
      updateMessage('Parsing AI response...');
      const parser = createAIResponseParser(llmProvider);
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
      
    } catch (error: any) {
      console.error('Error executing command:', error);
      
      // Enhanced error handling with better user feedback
      let errorTitle = 'Command Failed';
      let errorDescription = 'Failed to execute command';
      let showRetry = false;
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorTitle = 'Network Error';
        errorDescription = 'Unable to connect to the AI service. Please check your internet connection and try again.';
        showRetry = true;
      } else if (error.status === 429) {
        errorTitle = 'Rate Limited';
        errorDescription = 'Too many requests. Please wait a moment before trying again.';
        showRetry = true;
      } else if (error.status === 500) {
        errorTitle = 'Server Error';
        errorDescription = 'The AI service is temporarily unavailable. Please try again in a few moments.';
        showRetry = true;
      } else if (error.message?.includes('timeout')) {
        errorTitle = 'Request Timeout';
        errorDescription = 'The AI service took too long to respond. Try breaking your content into smaller sections.';
        showRetry = true;
      } else if (error.message?.includes('parse')) {
        errorTitle = 'AI Response Error';
        errorDescription = 'The AI response was malformed. This usually resolves by trying again.';
        showRetry = true;
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription + (showRetry ? '\n\nTip: Try the command again or select less text.' : ''),
        variant: 'destructive',
        duration: showRetry ? 8000 : 5000 // Longer duration for retryable errors
      });
      
      // For certain errors, suggest alternative approaches
      if (command === 'continue' && error.message?.includes('context')) {
        setTimeout(() => {
          toast({
            title: 'Alternative Suggestion',
            description: 'Try selecting the last paragraph and using /improve or /expand instead.',
            variant: 'default'
          });
        }, 2000);
      }
    } finally {
      stopProcessing();
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
          if (selectedCommand) {
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
              if (commandWithShortcut) {
                e.preventDefault();
                onClose();
                executeCommand(commandWithShortcut.action);
              }
            }
            // Handle ? for help
            if (e.key === '?') {
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
  }, [isOpen, onClose, selectedIndex, filterText, filteredCommands]);
  
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
        // Send thinking to context panel
        if (parsed.thinking && onSuggestions) {
          onSuggestions(parsed.thinking);
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
        // Send thinking to context panel
        if (parsed.thinking && onSuggestions) {
          onSuggestions(parsed.thinking);
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
        // Send thinking to context panel for targeted edits too
        if (parsed.thinking && onSuggestions) {
          onSuggestions(parsed.thinking);
        }
        break;
        
      case 'insert-at-cursor':
        // Insert content at current cursor position
        if (parsed.content) {
          const cursorPosition = selectionInfo.selectedText 
            ? selectionInfo.selectionEnd  // If there's a selection, insert after it
            : selectionInfo.selectionStart; // Otherwise, insert at cursor
          
          const newContent = 
            content.substring(0, cursorPosition) + 
            '\n\n' + parsed.content + '\n\n' + 
            content.substring(cursorPosition);
          
          setContent(newContent);
          
          // Update cursor position to after inserted content
          setTimeout(() => {
            if (editorRef.current) {
              const newCursorPos = cursorPosition + parsed.content.length + 4; // +4 for newlines
              editorRef.current.setSelectionRange(newCursorPos, newCursorPos);
              editorRef.current.focus();
            }
          }, 10);
          
          toast({
            title: 'Content Inserted',
            description: 'Content has been inserted at cursor position.'
          });
        }
        // Send thinking to context panel
        if (parsed.thinking && onSuggestions) {
          onSuggestions(parsed.thinking);
        }
        break;
    }
    
    // Send thinking to Context Panel for any remaining strategies not handled above
    if (parsed.thinking && onSuggestions && 
        parsed.strategy !== 'context-only' && 
        parsed.strategy !== 'targeted-edit' && 
        parsed.strategy !== 'append' && 
        parsed.strategy !== 'replace') {
      onSuggestions(parsed.thinking);
    }
  };

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
          {/* Enhanced Context indicator */}
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
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
            
            {/* Warning for whole-document operations */}
            {contextInfo.contextType === 'document' && contextInfo.documentLength > 500 && (
              <div className="flex items-start gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md">
                <AlertTriangle className="h-3 w-3 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-orange-800 dark:text-orange-200">
                  <strong>No text selected.</strong> Commands like improve, fix, rewrite will modify your entire document.
                  <div className="mt-1 text-orange-600 dark:text-orange-300">
                    Tip: Select specific text first for targeted changes.
                  </div>
                </div>
              </div>
            )}
            
            {/* Success indicator for selections */}
            {contextInfo.contextType === 'selection' && (
              <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
                <CheckCircle className="h-3 w-3" />
                <span>Commands will only modify the selected text</span>
              </div>
            )}
          </div>
          
          {/* Research context toggle */}
          <div className="mt-2 flex items-center justify-between">
            <label htmlFor="research-toggle" className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
              <Database className="h-3 w-3" />
              <span>Include research context</span>
            </label>
            <button
              id="research-toggle"
              onClick={() => setIncludeResearchContext(!includeResearchContext)}
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                includeResearchContext 
                  ? 'bg-blue-600 dark:bg-blue-500' 
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  includeResearchContext ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </button>
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
              className={`w-full text-left px-2 py-1.5 rounded-md flex items-center space-x-3 ${
                index === selectedIndex
                  ? 'bg-gray-100 dark:bg-gray-700'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                {cmd.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{cmd.title}</span>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const opType = getCommandOperationType(cmd.action);
                      return (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${opType.bg} ${opType.color}`}>
                          {opType.type}
                        </span>
                      );
                    })()}
                    {cmd.shortcut && (
                      <kbd className="text-xs text-gray-500 dark:text-gray-400">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {cmd.description}
                </p>
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
      
      {/* Input Dialog for Commands Requiring Parameters */}
      <Dialog 
        open={inputDialog.isOpen} 
        onOpenChange={(open) => setInputDialog(prev => ({ ...prev, isOpen: open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{inputDialog.title}</DialogTitle>
            <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
              {inputDialog.placeholder}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={inputDialog.value}
              onChange={(e) => setInputDialog(prev => ({ ...prev, value: e.target.value }))}
              placeholder={inputDialog.command === 'research' ? 'Research topic...' : 'Target language...'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const command = inputDialog.command;
                  const value = inputDialog.value;
                  setInputDialog(prev => ({ ...prev, isOpen: false }));
                  onClose(); // Close the slash command menu
                  executeCommandWithInput(command, value);
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setInputDialog(prev => ({ ...prev, isOpen: false }))}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                const command = inputDialog.command;
                const value = inputDialog.value;
                setInputDialog(prev => ({ ...prev, isOpen: false }));
                onClose(); // Close the slash command menu
                executeCommandWithInput(command, value);
              }}
            >
              Execute Command
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Confirmation Dialog for Destructive Operations */}
      <AlertDialog 
        open={confirmationDialog.isOpen} 
        onOpenChange={(open) => setConfirmationDialog(prev => ({ ...prev, isOpen: open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Confirm Whole Document Operation
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-600 dark:text-gray-400">
              {confirmationDialog.message}
              <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md">
                <p className="text-xs text-orange-800 dark:text-orange-200">
                  <strong>Tip:</strong> Select specific text first to apply commands only to that selection, 
                  or use /undo after the operation to revert changes.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                const command = confirmationDialog.command;
                setConfirmationDialog(prev => ({ ...prev, isOpen: false }));
                onClose(); // Close the slash command menu
                await executeCommandConfirmed(command);
              }}
              className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700"
            >
              Yes, Apply to Entire Document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}