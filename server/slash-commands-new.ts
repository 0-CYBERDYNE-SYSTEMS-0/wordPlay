import { executeCoreCommand, executeCustomCommand, type CoreCommandType } from './slash-commands-minimal';
import { storage } from './storage';
import type { CustomCommand } from '@shared/schema';

// Main slash command execution function with unified interface
export async function executeSlashCommand(
  command: string,
  content: string,
  selectionInfo: {
    selectedText: string;
    selectionStart: number;
    selectionEnd: number;
    beforeSelection?: string;
    afterSelection?: string;
  },
  style: any = {},
  llmProvider: 'openai' | 'ollama' | 'gemini' | 'kimi' = 'openai',
  llmModel: string = 'mlx-community/gemma-4-e2b-it-4bit',
  includeContext: boolean = false,
  projectId?: number,
  userId?: number,
  options?: { baseUrl?: string }
): Promise<{
  result: string;
  message: string;
  replaceSelection?: boolean;
  replaceEntireContent?: boolean;
  appendToContent?: boolean;
  contextOnly?: boolean;
  insertAtCursor?: boolean;
  smartExpansion?: {
    applied: string;
    expandedStart: number;
    expandedEnd: number;
  };
}> {
  
  const coreCommands: CoreCommandType[] = ['continue', 'improve', 'fix', 'bullets', 'table', 'format'];
  
  // Check if it's a core command
  if (coreCommands.includes(command as CoreCommandType)) {
    return await executeCoreCommand(
      command as CoreCommandType,
      content,
      selectionInfo,
      llmProvider,
      llmModel,
      includeContext,
      projectId,
      options
    );
  }
  
  // Check if it's a custom command
  if (userId) {
    try {
      const customCommands = await storage.getCustomCommands(userId);
      const customCommand = customCommands.find(cmd => cmd.trigger === `/${command}` && cmd.isActive);
      
      if (customCommand) {
        return await executeCustomCommand(
          customCommand.promptTemplate,
          content,
          selectionInfo,
          llmProvider,
          llmModel,
          includeContext,
          projectId,
          options
        );
      }
    } catch (error) {
      console.error('Error loading custom commands:', error);
    }
  }
  
  // Command not found
  return {
    result: `Command "/${command}" not found. Available commands: /continue, /improve, /fix, /bullets, /table, /format, and your custom commands.`,
    message: `Unknown command: /${command}`,
    contextOnly: true
  };
}

// Get available commands for a user (for autocomplete/UI)
export async function getAvailableCommands(userId?: number): Promise<{
  coreCommands: Array<{ name: string; trigger: string; description: string }>;
  customCommands: Array<{ name: string; trigger: string; description: string }>;
}> {
  const coreCommands = [
    { name: 'Continue', trigger: '/continue', description: 'Extend writing seamlessly' },
    { name: 'Improve', trigger: '/improve', description: 'Enhance selected text' },
    { name: 'Fix', trigger: '/fix', description: 'Fix grammar and spelling' },
    { name: 'Bullets', trigger: '/bullets', description: 'Convert to bullet points' },
    { name: 'Table', trigger: '/table', description: 'Convert to table format' },
    { name: 'Format', trigger: '/format', description: 'Improve structure and formatting' }
  ];
  
  let customCommands: Array<{ name: string; trigger: string; description: string }> = [];
  
  if (userId) {
    try {
      const userCustomCommands = await storage.getCustomCommands(userId);
      customCommands = userCustomCommands.map(cmd => ({
        name: cmd.name,
        trigger: cmd.trigger,
        description: cmd.description || 'Custom command'
      }));
    } catch (error) {
      console.error('Error loading custom commands for user:', error);
    }
  }
  
  return { coreCommands, customCommands };
}

// Helper function to validate custom command input
export function validateCustomCommand(command: {
  name: string;
  trigger: string;
  promptTemplate: string;
  description?: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!command.name || command.name.trim().length === 0) {
    errors.push('Name is required');
  }
  
  if (!command.trigger || !command.trigger.startsWith('/')) {
    errors.push('Trigger must start with /');
  }
  
  if (command.trigger && command.trigger.length < 2) {
    errors.push('Trigger must be at least 2 characters');
  }
  
  if (!command.promptTemplate || command.promptTemplate.trim().length === 0) {
    errors.push('Prompt template is required');
  }
  
  // Check for reserved core commands
  const reservedCommands = ['/continue', '/improve', '/fix', '/bullets', '/table', '/format'];
  if (reservedCommands.includes(command.trigger)) {
    errors.push(`Trigger "${command.trigger}" is reserved for core commands`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Create default custom commands for new users
export async function createDefaultCustomCommands(userId: number): Promise<CustomCommand[]> {
  const defaultCommands = [
    {
      name: 'Academic',
      trigger: '/academic',
      promptTemplate: 'Rewrite the text in a formal academic tone using scholarly vocabulary, precise language, and analytical approach suitable for academic or research contexts.',
      description: 'Convert text to formal academic style',
      userId,
    },
    {
      name: 'Simple',
      trigger: '/simple',
      promptTemplate: 'Rewrite the text using simpler language, shorter sentences, and clearer structure. Make it accessible to a broader audience while preserving all key information.',
      description: 'Simplify text for broader audiences',
      userId,
    },
    {
      name: 'Professional',
      trigger: '/professional',
      promptTemplate: 'Rewrite the text in a professional, business-appropriate tone using formal language, clear structure, and authoritative voice suitable for workplace communication.',
      description: 'Make text professional and business-ready',
      userId,
    }
  ];
  
  const createdCommands: CustomCommand[] = [];
  
  for (const cmd of defaultCommands) {
    try {
      const created = await storage.createCustomCommand(cmd);
      createdCommands.push(created);
    } catch (error) {
      console.error('Error creating default command:', cmd.name, error);
    }
  }
  
  return createdCommands;
}