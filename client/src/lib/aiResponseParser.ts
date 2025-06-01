import { apiRequest } from './queryClient';

export interface ParsedAIResponse {
  content: string;           // Goes to editor
  thinking?: string;         // Goes to Context Panel  
  suggestions?: string[];    // Goes to Context Panel
  metadata?: any;           // Additional info
  strategy: 'replace' | 'append' | 'targeted-edit' | 'context-only';
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
    const complexEditCommands = ['improve', 'fix', 'simplify', 'format', 'tone'];
    if (complexEditCommands.includes(command)) {
      // Simple strategy: let the agent tools do the heavy lifting
      return {
        content: rawResponse.trim(),
        strategy: 'targeted-edit'
      };
    }
    
    // Simple fallback parsing for other commands
    const thinkMatch = rawResponse.match(/<(?:think|thinkpad)>([\s\S]*?)<\/(?:think|thinkpad)>/i);
    const thinking = thinkMatch ? thinkMatch[1].trim() : undefined;
    
    // Clean up the response
    let content = rawResponse
      .replace(/<(?:think|thinkpad)>[\s\S]*?<\/(?:think|thinkpad)>/gi, '')
      .replace(/<workspace>[\s\S]*?<\/workspace>/gi, '')
      .replace(/<final_result>([\s\S]*?)<\/final_result>/gi, '$1')
      .replace(/\*\*Key Adjustments:\*\*[\s\S]*$/, '')
      .replace(/\*\*Revised Version:\*\*\s*/, '')
      .trim();

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
      'suggest': 'context-only',
      'analyze': 'context-only',
      'help': 'context-only',
      'improve': 'targeted-edit',
      'fix': 'targeted-edit',
      'rewrite': 'replace',
      'expand': 'targeted-edit',
      'simplify': 'targeted-edit',
      'summarize': 'replace',
      'list': 'replace',
      'outline': 'replace',
      'format': 'targeted-edit',
      'tone': 'targeted-edit',
      'translate': 'replace'
    };

    return strategyMap[command] || 'replace';
  }
}

export const createAIResponseParser = (llmProvider: 'openai' | 'ollama') => {
  return new AIResponseParser(llmProvider);
}; 