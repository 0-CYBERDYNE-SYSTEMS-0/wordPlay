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
    
    // Improved XML parsing with better tag handling
    console.log('Parsing AI response for command:', command);
    console.log('Raw response length:', rawResponse.length);
    
    // Extract all thinking blocks for the Context Panel (multiple patterns)
    const thinkingPatterns = [
      /<thinking>([\s\S]*?)<\/thinking>/gi,
      /<think>([\s\S]*?)<\/think>/gi,
      /<thinkpad>([\s\S]*?)<\/thinkpad>/gi,
      /<reasoning>([\s\S]*?)<\/reasoning>/gi
    ];
    
    let allThinkingContent: string[] = [];
    let cleanedResponse = rawResponse;
    
    // Extract and remove all thinking blocks
    thinkingPatterns.forEach(pattern => {
      const matches = Array.from(cleanedResponse.matchAll(pattern));
      matches.forEach(match => {
        allThinkingContent.push(match[1].trim());
      });
      // Remove the thinking blocks from the response
      cleanedResponse = cleanedResponse.replace(pattern, '');
    });
    
    // Extract final output content
    const finalOutputMatch = cleanedResponse.match(/<final_output>([\s\S]*?)<\/final_output>/i);
    
    let content: string;
    if (finalOutputMatch) {
      // Use content from final_output tags
      content = finalOutputMatch[1].trim();
      console.log('Found final_output tag, extracted content length:', content.length);
    } else {
      // No final_output tag, clean the response of any remaining XML
      content = cleanedResponse
        // Remove any remaining final_output tags (opening/closing without content)
        .replace(/<\/?final_output>/gi, '')
        // Remove any other XML-like tags but preserve content
        .replace(/<\/?[a-zA-Z][^>]*>/g, '')
        // Clean up extra whitespace
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
      console.log('No final_output tag, cleaned content length:', content.length);
    }

    // Combine thinking content for context panel
    const thinking = allThinkingContent.length > 0
      ? allThinkingContent.join('\n\n---\n\n')
      : undefined;

    // If still no content after all cleaning, check for complex edit commands
    const complexEditCommands = ['improve', 'fix', 'format', 'tone'];
    if (!content && complexEditCommands.includes(command)) {
      // For complex edits, use the raw response but clean it
      content = rawResponse
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<thinkpad>[\s\S]*?<\/thinkpad>/gi, '')
        .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
        .replace(/<\/?final_output>/gi, '')
        .replace(/<\/?[a-zA-Z][^>]*>/g, '')
        .trim();
    }

    // Final fallback - if still no content, something went wrong
    if (!content) {
      console.warn('No content extracted, using cleaned response as fallback');
      content = cleanedResponse.trim() || rawResponse.trim();
      
      // If still no content after all attempts, provide a helpful error message
      if (!content) {
        console.error('AI response parsing failed completely - no content found');
        content = `**Error**: The AI response could not be processed. This might be due to:
- Network connectivity issues
- AI service temporarily unavailable  
- Malformed response from the AI

Please try the command again. If the problem persists, try:
- Selecting less text
- Using a simpler command like /fix or /improve
- Checking your internet connection`;
        
        // Override strategy to context-only for error messages
        const errorResponse: ParsedAIResponse = {
          content: '',
          thinking: content,
          strategy: 'context-only',
          suggestions: [content]
        };
        return errorResponse;
      }
    }

    // Safety check for excessively long content
    const MAX_CONTENT_LENGTH = 50000; // ~10k words
    if (content.length > MAX_CONTENT_LENGTH) {
      console.warn(`Content length ${content.length} exceeds maximum, truncating`);
      content = content.substring(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated due to length - please try with smaller sections]';
    }

    const strategy = this.getDefaultStrategy(command);
    
    console.log('Final parsed content length:', content.length);
    console.log('Thinking content length:', thinking?.length || 0);
    console.log('Strategy:', strategy);

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