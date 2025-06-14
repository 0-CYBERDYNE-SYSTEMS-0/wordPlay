import { apiRequest } from './queryClient';

export interface ParsedAIResponse {
  content: string;           // Goes to editor
  thinking?: string;         // Goes to Context Panel  
  suggestions?: string[];    // Goes to Context Panel
  metadata?: any;           // Additional info
  strategy: 'replace' | 'append' | 'targeted-edit' | 'context-only' | 'insert-at-cursor';
}

export class AIResponseParser {
  private llmProvider: 'openai' | 'ollama';
  private parsingModel: string;

  constructor(llmProvider: 'openai' | 'ollama') {
    this.llmProvider = llmProvider;
    // Use correct available models based on user requirements
    this.parsingModel = llmProvider === 'ollama' ? 'qwen3:0.6b' : 'gpt-4.1-nano';
  }

  async parseResponse(
    rawResponse: string, 
    command: string, 
    originalContent: string,
    selectionInfo: any
  ): Promise<ParsedAIResponse> {
    
    // For complex editing commands, let the existing agent tools handle surgical edits
    const complexEditCommands = ['improve', 'fix', 'format', 'tone'];
    if (complexEditCommands.includes(command)) {
      // Simple strategy: let the agent tools do the heavy lifting
      return {
        content: rawResponse.trim(),
        strategy: 'targeted-edit'
      };
    }
    
    // Extract all thinking blocks for the Context Panel
    const thinkingMatches = Array.from(rawResponse.matchAll(/<(?:think|thinkpad|thinking|reasoning)>([\s\S]*?)<\/(?:think|thinkpad|thinking|reasoning)>/gi));
    
    // Extract the final output that should go to the editor
    const finalOutputMatch = rawResponse.match(/<final_output>([\s\S]*?)<\/final_output>/i);
    
    // Combine thinking blocks for context panel
    const thinking = thinkingMatches.length > 0
      ? thinkingMatches.map(m => m[1].trim()).join('\n\n')
      : undefined;

    // Get content for the editor
    let content: string;
    if (finalOutputMatch) {
      // If there's a final_output tag, use its content
      content = finalOutputMatch[1].trim();
    } else {
      // Otherwise, remove all special tags and their content
      content = rawResponse
        // Remove thinking/reasoning blocks and their tags
        .replace(/<(?:think|thinkpad|thinking|reasoning)>[\s\S]*?<\/(?:think|thinkpad|thinking|reasoning)>/gi, '')
        // Remove final_output tags if they exist without content
        .replace(/<\/?final_output>/gi, '')
        // Remove any other XML-like tags
        .replace(/<\/?[^>]+(>|$)/g, '')
        .trim();
    }

    // If no content after cleaning, use original response
    if (!content && rawResponse) {
      content = rawResponse.trim();
    }

    const strategy = this.getDefaultStrategy(command);

    return {
      content,
      thinking,
      strategy,
      suggestions: strategy === 'context-only' ? [content] : undefined
    };
  }

  private getDefaultStrategy(command: string): ParsedAIResponse['strategy'] {
    const strategyMap: Record<string, ParsedAIResponse['strategy']> = {
      'continue': 'append',
      'expand': 'append',
      'suggest': 'context-only',
      'analyze': 'context-only',
      'help': 'context-only',
      'improve': 'targeted-edit',
      'fix': 'targeted-edit',
      'rewrite': 'targeted-edit',
      'tone': 'targeted-edit',
      'translate': 'targeted-edit',
      'format': 'targeted-edit',
      'summarize': 'insert-at-cursor',
      'list': 'insert-at-cursor',
      'outline': 'insert-at-cursor'
    };

    return strategyMap[command] || 'replace';
  }
}

export const createAIResponseParser = (llmProvider: 'openai' | 'ollama') => {
  return new AIResponseParser(llmProvider);
}; 