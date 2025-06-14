import { useState, useCallback } from 'react';
import { SlashCommand } from '@/components/SlashCommandMenu';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface UseSlashCommandsProps {
  content: string;
  setContent: (content: string) => void;
  style?: any;
}

interface SelectionInfo {
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;
  beforeSelection: string;
  afterSelection: string;
}

export function useSlashCommands({
  content,
  setContent,
  style
}: UseSlashCommandsProps) {
  const { toast } = useToast();
  const [isSlashCommandOpen, setIsSlashCommandOpen] = useState(false);
  const [slashCommandFilter, setSlashCommandFilter] = useState('');
  const [slashCommandPosition, setSlashCommandPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo>({
    selectedText: '',
    selectionStart: 0,
    selectionEnd: 0,
    beforeSelection: '',
    afterSelection: ''
  });
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);

  // Helper to get current selection info from the editor
  const getSelectionInfo = useCallback((editorElement: HTMLElement | null): SelectionInfo => {
    if (!editorElement) {
      return {
        selectedText: '',
        selectionStart: 0,
        selectionEnd: 0,
        beforeSelection: content,
        afterSelection: ''
      };
    }

    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0) {
      return {
        selectedText: '',
        selectionStart: 0,
        selectionEnd: 0,
        beforeSelection: content,
        afterSelection: ''
      };
    }

    const range = selection.getRangeAt(0);
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(editorElement);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const selectionStart = preSelectionRange.toString().length;
    const selectionEnd = selectionStart + range.toString().length;

    return {
      selectedText: range.toString(),
      selectionStart,
      selectionEnd,
      beforeSelection: content.substring(0, selectionStart),
      afterSelection: content.substring(selectionEnd)
    };
  }, [content]);

  // Mutation to execute slash commands
  const executeCommandMutation = useMutation({
    mutationFn: async (data: { 
      command: string; 
      selectionInfo: SelectionInfo;
    }) => {
      setIsExecutingCommand(true);
      
      try {
        const res = await apiRequest('POST', '/api/ai/slash-command', {
          command: data.command,
          content,
          selectionInfo: data.selectionInfo,
          style
        });

        return res.json();
      } finally {
        setIsExecutingCommand(false);
      }
    },
    onSuccess: (data) => {
      // Handle different command results based on new backend flags
      if (data.contextOnly) {
        // For context-only commands, don't modify the editor content
        // This hook doesn't have access to context panel, so just show a toast
        toast({
          title: 'AI Analysis Complete',
          description: data.message || 'Analysis complete - results available in context panel.',
        });
      } else if (data.appendToContent) {
        // Append content for expand and continue commands
        setContent(content + '\n\n' + data.result);
        toast({
          title: 'Content Added',
          description: data.message || 'New content has been added to your document.',
        });
      } else if (data.insertAtCursor) {
        // For this hook without cursor access, append to content as fallback
        setContent(content + '\n\n' + data.result);
        toast({
          title: 'Content Inserted',
          description: data.message || 'New content has been inserted.',
        });
      } else if (data.replaceSelection && selectionInfo.selectedText) {
        // Replace just the selection
        setContent(
          selectionInfo.beforeSelection + data.result + selectionInfo.afterSelection
        );
        toast({
          title: 'Selection Updated',
          description: data.message || 'Selected text has been updated.',
        });
      } else if (data.replaceEntireContent) {
        // Replace the entire content with the result
        setContent(data.result);
        toast({
          title: 'Content Updated',
          description: data.message || 'Your content has been updated.',
        });
      } else {
        // Fallback for older API responses
        setContent(data.result);
        toast({
          title: 'Command executed',
          description: data.message || 'AI has processed your request.',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Command failed',
        description: error.message || 'Failed to execute the command.',
        variant: 'destructive',
      });
    }
  });

  // Handle the slash command key detection
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === '/' && !isSlashCommandOpen) {
        // Get position for the slash command menu
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSlashCommandPosition({
            x: rect.left,
            y: rect.bottom + window.scrollY + 10
          });
          
          // Also get selection info for command context
          const editorElement = event.currentTarget;
          setSelectionInfo(getSelectionInfo(editorElement));
          
          // Open slash command menu
          setIsSlashCommandOpen(true);
          setSlashCommandFilter('');
          
          // Prevent the slash character from being typed
          event.preventDefault();
        }
      } else if (event.key === 'Escape' && isSlashCommandOpen) {
        setIsSlashCommandOpen(false);
      }
    },
    [isSlashCommandOpen, getSelectionInfo]
  );
  
  // Handle when a command is selected from the menu
  const handleCommandSelected = useCallback(
    (command: SlashCommand) => {
      executeCommandMutation.mutate({
        command: command.action,
        selectionInfo
      });
    },
    [executeCommandMutation, selectionInfo]
  );

  return {
    isSlashCommandOpen,
    slashCommandFilter,
    slashCommandPosition,
    handleKeyDown,
    handleCommandSelected,
    setIsSlashCommandOpen,
    setSlashCommandFilter,
    isExecutingCommand
  };
}