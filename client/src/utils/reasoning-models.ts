// Known reasoning models that produce thinking/reasoning content
const REASONING_MODELS = {
  openai: [
    'o1-preview',
    'o1-mini',
    'gpt-4o-reasoning',
    'gpt-4o-with-reasoning'
  ],
  ollama: [
    'qwen2.5-coder', // Has reasoning capabilities
    'deepthink', // Custom reasoning model
    'thinking-llama', // Models with "thinking" in name
    'reasoning-model' // Generic reasoning models
  ]
};

export function isReasoningModel(provider: 'openai' | 'ollama', model: string): boolean {
  const providerModels = REASONING_MODELS[provider];
  return providerModels.some(reasoningModel => 
    model.toLowerCase().includes(reasoningModel.toLowerCase()) ||
    model.toLowerCase().includes('reasoning') ||
    model.toLowerCase().includes('thinking') ||
    model.toLowerCase().includes('o1')
  );
}

export function getReasoningCapabilities(provider: 'openai' | 'ollama', model: string): {
  hasThinking: boolean;
  streamingSupported: boolean;
  thinkingFormat: 'markdown' | 'text' | 'structured';
} {
  if (!isReasoningModel(provider, model)) {
    return {
      hasThinking: false,
      streamingSupported: false,
      thinkingFormat: 'text'
    };
  }

  // OpenAI o1 models
  if (provider === 'openai' && model.toLowerCase().includes('o1')) {
    return {
      hasThinking: true,
      streamingSupported: true,
      thinkingFormat: 'markdown'
    };
  }

  // Ollama reasoning models
  if (provider === 'ollama') {
    return {
      hasThinking: true,
      streamingSupported: true,
      thinkingFormat: 'text'
    };
  }

  // Default for other reasoning models
  return {
    hasThinking: true,
    streamingSupported: false,
    thinkingFormat: 'text'
  };
}

export interface ThinkingChunk {
  type: 'thinking' | 'response';
  content: string;
  timestamp: number;
  complete: boolean;
}

export class ThinkingStreamParser {
  private buffer: string = '';
  private currentChunk: ThinkingChunk | null = null;

  parseChunk(rawChunk: string): ThinkingChunk[] {
    this.buffer += rawChunk;
    const chunks: ThinkingChunk[] = [];

    // Look for thinking delimiters
    const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/g;
    const responseRegex = /<response>([\s\S]*?)<\/response>/g;

    let match;

    // Parse thinking blocks
    while ((match = thinkingRegex.exec(this.buffer)) !== null) {
      chunks.push({
        type: 'thinking',
        content: match[1].trim(),
        timestamp: Date.now(),
        complete: true
      });
    }

    // Parse response blocks
    while ((match = responseRegex.exec(this.buffer)) !== null) {
      chunks.push({
        type: 'response',
        content: match[1].trim(),
        timestamp: Date.now(),
        complete: true
      });
    }

    // If no structured format, treat as streaming response
    if (chunks.length === 0 && this.buffer.trim()) {
      // Check if this looks like thinking content
      const isThinking = this.buffer.includes('thinking') || 
                        this.buffer.includes('reasoning') ||
                        this.buffer.includes('consider') ||
                        this.buffer.includes('analyze');

      chunks.push({
        type: isThinking ? 'thinking' : 'response',
        content: this.buffer.trim(),
        timestamp: Date.now(),
        complete: false
      });
    }

    return chunks;
  }

  reset() {
    this.buffer = '';
    this.currentChunk = null;
  }
} 