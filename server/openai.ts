import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
// import fetch from "node-fetch"; // Remove this line for Node 18+

// Default local MLX model: Gemma 4 E2B (4-bit, OpenAI-compatible via mlx_lm.server)
export const DEFAULT_MODEL = "mlx-community/gemma-4-e2b-it-4bit";
const DEFAULT_PROVIDER = "openai";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

// Per-request overrides for endpoints. API keys are SERVER-SIDE ONLY
// (process.env): values sent from the browser are ignored, so a shared
// deployment never round-trips keys through clients.
export interface AIRequestOptions {
  baseUrl?: string;
}

function effectiveOpenAIKey(_options?: AIRequestOptions): string {
  return process.env.OPENAI_API_KEY || "default_key";
}

function effectiveGeminiKey(_options?: AIRequestOptions): string {
  return process.env.GEMINI_API_KEY || "";
}

function effectiveBaseUrl(options?: AIRequestOptions): string | undefined {
  return options?.baseUrl || process.env.OPENAI_BASE_URL || undefined;
}

// Connection test interfaces
export interface AIServiceStatus {
  service: 'openai' | 'ollama' | 'gemini';
  available: boolean;
  error?: string;
  latency?: number;
  models?: string[];
}

export interface ConnectionTestResult {
  openai: AIServiceStatus;
  ollama: AIServiceStatus;
  recommended: 'openai' | 'ollama' | 'none';
}

// Helper function to detect if a model is an o3 model
export function isO3Model(model: string): boolean {
  return model.startsWith('o3') || model.startsWith('o-3');
}

// Helper function to prepare parameters for o3 models
export function prepareO3Parameters(params: any): any {
  if (!isO3Model(params.model)) {
    return params;
  }
  
  // Remove unsupported parameters for o3 models
  const { 
    temperature, 
    top_p, 
    presence_penalty, 
    frequency_penalty, 
    logprobs, 
    top_logprobs, 
    logit_bias, 
    max_tokens,
    ...o3Params 
  } = params;
  
  // Use max_completion_tokens instead of max_tokens for o3
  if (max_tokens) {
    o3Params.max_completion_tokens = max_tokens;
  }
  
  // Add reasoning_effort parameter for o3 models
  if (!o3Params.reasoning_effort) {
    o3Params.reasoning_effort = "medium";
  }
  
  return o3Params;
}

// Configurable timeout for OpenAI-compatible calls (ms). Interactive paths
// (slash commands) set a shorter one; this is the fallback for module-level use.
const AI_REQUEST_TIMEOUT_MS = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '180000', 10);

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "default_key",
  baseURL: process.env.OPENAI_BASE_URL || undefined,
  timeout: AI_REQUEST_TIMEOUT_MS
});

// Connection testing utilities
export async function testOpenAIConnection(): Promise<AIServiceStatus> {
  const startTime = Date.now();
  
  try {
    // Check if API key is properly configured
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "default_key") {
      return {
        service: 'openai',
        available: false,
        error: 'OpenAI API key not configured. Set OPENAI_API_KEY environment variable.',
        latency: 0
      };
    }

    // Test connection by listing models
    const models = await openai.models.list();
    const latency = Date.now() - startTime;
    
    const modelNames = models.data.map(model => model.id);
    
    // Check if our default model is available
    const hasDefaultModel = modelNames.includes(DEFAULT_MODEL);
    
    return {
      service: 'openai',
      available: true,
      latency,
      models: modelNames.slice(0, 10), // Return first 10 models
      error: hasDefaultModel ? undefined : `Default model ${DEFAULT_MODEL} not available. Available models: ${modelNames.slice(0, 5).join(', ')}`
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;
    
    let errorMessage = 'Unknown OpenAI connection error';
    
    if (error.status === 401) {
      errorMessage = 'Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable.';
    } else if (error.status === 429) {
      errorMessage = 'OpenAI API rate limit exceeded. Please try again later.';
    } else if (error.status === 503) {
      errorMessage = 'OpenAI API is temporarily unavailable. Please try again later.';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorMessage = 'Cannot connect to OpenAI API. Please check your internet connection.';
    } else if (error.message) {
      errorMessage = `OpenAI API error: ${error.message}`;
    }
    
    return {
      service: 'openai',
      available: false,
      error: errorMessage,
      latency
    };
  }
}

export async function testOllamaConnection(): Promise<AIServiceStatus> {
  const startTime = Date.now();
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  
  try {
    // Test if Ollama server is reachable
    const healthResponse = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!healthResponse.ok) {
      throw new Error(`Ollama server responded with status ${healthResponse.status}`);
    }
    
    const data = await healthResponse.json();
    const latency = Date.now() - startTime;
    
    const models = data.models || [];
    const modelNames = models.map((model: any) => model.name);
    
    // Check if our default model is available
    const hasDefaultModel = modelNames.some((name: string) => name.includes('qwen3'));
    
    return {
      service: 'ollama',
      available: true,
      latency,
      models: modelNames,
      error: hasDefaultModel ? undefined : 'Default model qwen3:4b not available. Please run: ollama pull qwen3:4b'
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;
    
    let errorMessage = 'Unknown Ollama connection error';
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = `Cannot connect to Ollama server at ${ollamaUrl}. Please ensure Ollama is running and accessible.`;
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = `Ollama server not found at ${ollamaUrl}. Please check the OLLAMA_URL environment variable.`;
    } else if (error.message) {
      errorMessage = `Ollama error: ${error.message}`;
    }
    
    return {
      service: 'ollama',
      available: false,
      error: errorMessage,
      latency
    };
  }
}

export async function testAIConnections(): Promise<ConnectionTestResult> {  const [openaiStatus, ollamaStatus] = await Promise.all([
    testOpenAIConnection(),
    testOllamaConnection()
  ]);
  
  // Determine recommended service
  let recommended: 'openai' | 'ollama' | 'none' = 'none';
  
  if (openaiStatus.available && ollamaStatus.available) {
    // Prefer OpenAI if both are available (generally more reliable)
    recommended = 'openai';
  } else if (openaiStatus.available) {
    recommended = 'openai';
  } else if (ollamaStatus.available) {
    recommended = 'ollama';
  }
  
  return {
    openai: openaiStatus,
    ollama: ollamaStatus,
    recommended
  };
}

export async function testGeminiConnection(): Promise<AIServiceStatus> {
  const startTime = Date.now();

  if (!process.env.GEMINI_API_KEY) {
    return {
      service: 'gemini',
      available: false,
      error: 'Gemini API key not configured. Set GEMINI_API_KEY or enter it in Settings → AI.',
      latency: 0
    };
  }

  try {
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = client.getGenerativeModel({ model: DEFAULT_GEMINI_MODEL });
    const result = await model.generateContent("Reply with the single word: ok");
    const ok = result.response.text().toLowerCase().includes('ok');
    return {
      service: 'gemini',
      available: ok,
      latency: Date.now() - startTime,
      error: ok ? undefined : 'Gemini responded but the content was unexpected.'
    };
  } catch (error: any) {
    return {
      service: 'gemini',
      available: false,
      error: `Gemini API error: ${error?.message || 'Unknown error'}`,
      latency: Date.now() - startTime
    };
  }
}

// Utility function to build OpenAI API parameters based on model type
export function buildOpenAIParams(model: string, baseParams: any): any {
  const isO3 = isO3Model(model);
  const params = { model, ...baseParams };
  
  if (isO3) {
    // For o3 models, remove unsupported parameters
    delete params.temperature;
    delete params.top_p;
    delete params.presence_penalty;
    delete params.frequency_penalty;
    delete params.logprobs;
    delete params.top_logprobs;
    delete params.logit_bias;
    
    // Convert max_tokens to max_completion_tokens for o3
    if (params.max_tokens) {
      params.max_completion_tokens = params.max_tokens;
      delete params.max_tokens;
    }
    
    // Add reasoning_effort for o3 models (default to medium)
    if (!params.reasoning_effort) {
      params.reasoning_effort = 'medium';
    }
  }
  
  return params;
}

export async function callOllama(model: string, prompt: string, requestJson: boolean = false): Promise<string> {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    
    // Use chat endpoint for modern Ollama with tool/JSON support
    const messages = [
      { role: "user", content: prompt }
    ];
    
    const requestBody: any = {
      model,
      messages,
      stream: false,
      // Disable thinking mode — qwen3.5 / reasoning models burn their whole
      // token budget on <thinking> and never emit the actual answer. With
      // think:false they answer directly in ~1s instead of hanging and
      // returning empty content.
      think: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_ctx: 8192 // Keep context small — Ollama's 32768 default makes 2b models crawl
      }
    };
    
    // Add JSON format request if needed
    if (requestJson) {
      requestBody.format = "json";
    }
    
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      // Bound the request — without this, a slow local model (e.g. a large
      // chart/table prompt on a small Ollama model) hangs until undici's
      // ~5-minute header timeout and the UI shows an endless spinner.
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS)
    });
    
    if (!res.ok) {
      throw new Error(`Ollama server error: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    if (!data.message?.content) {
      throw new Error('No response from Ollama server');
    }
    
    return data.message.content;
  } catch (err: any) {
    console.error("Ollama fetch error:", err);
    
    // Provide specific error messages for common issues
    if (err.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to Ollama server at ${process.env.OLLAMA_URL || 'http://localhost:11434'}. Please ensure Ollama is running.`);
    } else if (err.code === 'ENOTFOUND') {
      throw new Error(`Ollama server not found. Please check your OLLAMA_URL environment variable.`);
    } else if (err.message.includes('404')) {
      throw new Error(`Model '${model}' not found. Please run: ollama pull ${model}`);
    } else if (err.message.includes('timeout')) {
      throw new Error(`Ollama request timed out. The model might be loading or the server is overloaded.`);
    }
    
    throw new Error(`Ollama error: ${err.message}`);
  }
}

// Enhanced function with automatic fallback
export async function callAIWithFallback(
  prompt: string,
  preferredProvider: 'openai' | 'ollama' | 'gemini' = 'openai',
  model?: string,
  style?: any,
  options?: AIRequestOptions
): Promise<{ result: string; provider: 'openai' | 'ollama' | 'gemini'; error?: string }> {
  const order: ('openai' | 'ollama' | 'gemini')[] =
    preferredProvider === 'openai' ? ['openai', 'gemini', 'ollama']
    : preferredProvider === 'ollama' ? ['ollama', 'openai', 'gemini']
    : ['gemini', 'openai', 'ollama'];
  
  let lastError = '';
  
  for (const provider of order) {
    try {
      const result = await generateTextCompletion('', style || {}, prompt, provider, model, options);
      return { result, provider };
    } catch (error: any) {
      lastError = error.message;
      console.warn(`${provider} failed, trying fallback:`, error.message);
      continue;
    }
  }
  
  throw new Error(`All AI providers failed. Last error: ${lastError}`);
}

// Generate text based on the current content and user's writing style
export async function generateTextCompletion(
  content: string,
  style: any,
  prompt: string = "Continue this text in the same style.",
  llmProvider: 'openai' | 'ollama' | 'gemini' = 'openai',
  llmModel?: string,
  options?: AIRequestOptions
): Promise<string> {
  if (llmProvider === 'ollama') {
    try {
      const systemPrompt = `You are an AI writing assistant. Continue or modify the given text based on the provided prompt. Maintain the same style and tone.`;
      const fullPrompt = `${systemPrompt}\n\nText: ${content}\n\nPrompt: ${prompt}\n\nContinuation:`;
      
      const response = await callOllama(llmModel || 'qwen3:4b', fullPrompt);
      return response.trim();
    } catch (error: any) {
      console.error("Error generating text with Ollama:", error);
      throw new Error(`Failed to generate text: ${error.message}`);
    }
  }

  if (llmProvider === 'gemini') {
    return await generateWithGemini(
      content,
      style,
      prompt,
      llmModel || DEFAULT_GEMINI_MODEL,
      options
    );
  }

  try {
    const openai = new OpenAI({
      apiKey: effectiveOpenAIKey(options),
      baseURL: effectiveBaseUrl(options),
      timeout: AI_REQUEST_TIMEOUT_MS
    });

    const requestParams = prepareO3Parameters({
      model: llmModel || DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an AI that helps users create high-quality content. 
          You should adapt to their writing style and preferences.
          Style analysis: ${JSON.stringify(style)}
          
          CRITICAL INSTRUCTION:
          - Your final output that should appear in the editor MUST be wrapped in <final_output> tags
          - Everything else (analysis, thinking, suggestions) will appear in the context panel
          - Never include XML tags or technical markers in the final output content itself
          
          Your task is to generate text that continues or expands the provided content while maintaining the same style, tone, and complexity.`
        },
        {
          role: "user",
          content: `${content}\n\n${prompt}`
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
      top_p: 0.9
    });
    
    const response = await openai.chat.completions.create(requestParams);

    return response.choices[0].message.content || "";
  } catch (error: any) {
    console.error("Error generating text completion:", error.message);
    
    // Provide specific error messages for common OpenAI issues
    if (error.status === 401) {
      throw new Error("Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable.");
    } else if (error.status === 429) {
      throw new Error("OpenAI API rate limit exceeded. Please try again later or check your usage limits.");
    } else if (error.status === 503) {
      throw new Error("OpenAI API is temporarily unavailable. Please try again later.");
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error("Cannot connect to OpenAI API. Please check your internet connection.");
    } else if (error.message?.includes('model')) {
      throw new Error(`Model error: ${error.message}. Try using a different model.`);
    }
    
    throw new Error("Failed to generate text: " + error.message);
  }
}

// Gemini text generation (shared prompt convention with the OpenAI path).
export async function generateWithGemini(
  content: string,
  style: any,
  prompt: string,
  model: string,
  options?: AIRequestOptions
): Promise<string> {
  const apiKey = effectiveGeminiKey(options);
  if (!apiKey) {
    throw new Error("Gemini API key not configured. Set GEMINI_API_KEY or enter it in Settings → AI.");
  }

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const geminiModel = client.getGenerativeModel({ model });

    const systemPrompt = `You are an AI that helps users create high-quality content.
    You should adapt to their writing style and preferences.
    Style analysis: ${JSON.stringify(style)}

    CRITICAL INSTRUCTION:
    - Your final output that should appear in the editor MUST be wrapped in <final_output> tags
    - Everything else (analysis, thinking, suggestions) will appear in the context panel
    - Never include XML tags or technical markers in the final output content itself

    Your task is to generate text that continues or expands the provided content while maintaining the same style, tone, and complexity.`;

    const result = await geminiModel.generateContent(
      `${systemPrompt}\n\n${content}\n\n${prompt}`
    );

    return result.response.text().trim();
  } catch (error: any) {
    console.error("Error generating text with Gemini:", error?.message || error);
    const msg = (error?.message || String(error)).toLowerCase();
    if (error?.status === 401 || error?.status === 403 || msg.includes('api key')) {
      throw new Error("Invalid Gemini API key. Please check your Gemini API key.");
    } else if (msg.includes('rate limit') || error?.status === 429) {
      throw new Error("Gemini API rate limit exceeded. Please try again later.");
    } else if (error?.status === 404 || msg.includes('not found') || msg.includes('model')) {
      throw new Error(`Gemini model error: ${error?.message || 'model not found'}. Try a different model.`);
    }
    throw new Error(`Gemini error: ${error?.message || "Unknown error"}`);
  }
}

// Analyze the text style in greater detail
export async function analyzeTextStyle(
  text: string,
  llmProvider: 'openai' | 'ollama' | 'gemini' = 'openai',
  llmModel?: string,
  options?: AIRequestOptions
): Promise<any> {
  try {
    const systemPrompt = 
      `You are a text analysis expert. Analyze the given text and evaluate its style metrics. 
      Return a JSON object with the following properties:
      
      - metrics: An object containing:
        - formality: 0-100 (how formal the writing is)
        - complexity: 0-100 (complexity of vocabulary and sentence structure)
        - coherence: 0-100 (how well the text flows and ideas connect)
        - engagement: 0-100 (how engaging/interesting the content is)
        - conciseness: 0-100 (how efficiently ideas are expressed)
        
      - readability: An object containing:
        - score: 0-100 (overall readability score)
        - grade: string (e.g., "College Level", "High School", etc.)
      
      - wordDistribution: An object containing:
        - unique: number (count of unique words)
        - repeated: number (count of repeated words)
        - rare: number (count of uncommon/specialized words)
        
      - commonPhrases: Array of strings (frequent phrases or patterns)
      - suggestions: Array of strings (improvement suggestions)
      - toneAnalysis: string (detailed analysis of the tone)
      
      For short text, make appropriate estimates based on the available content.`;

    let rawContent = '{}';
    if (llmProvider === 'ollama') {
      rawContent = await callOllama(llmModel || 'qwen3:4b', `${systemPrompt}\n\nText: ${text || "Sample text for analysis."}`, true);
    } else if (llmProvider === 'gemini') {
      rawContent = await generateWithGemini(
        text || "Sample text for analysis.",
        {},
        `${systemPrompt}\n\nReturn only the JSON object.`,
        llmModel || DEFAULT_GEMINI_MODEL,
        options
      );
    } else {
      const openai = new OpenAI({
        apiKey: effectiveOpenAIKey(options),
        baseURL: effectiveBaseUrl(options),
        timeout: AI_REQUEST_TIMEOUT_MS
      });
      const requestParams = prepareO3Parameters({
        model: llmModel || DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text || "Sample text for analysis." }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const response = await openai.chat.completions.create(requestParams);
      rawContent = response.choices[0].message.content || '{}';
    }

    // mlx_lm.server ignores response_format: json_object, so the model may wrap
    // output in ```json fences — strip them before parsing.
    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    const result = JSON.parse(cleaned);
    
    // If text is very short, provide reasonable default values
    if (!text || text.length < 20) {
      return {
        formality: 50,
        complexity: 50,
        coherence: 50,
        engagement: 50,
        conciseness: 50,
        commonPhrases: ["Not enough text for analysis"],
        suggestions: ["Add more content to get detailed analysis"],
        toneAnalysis: "Not enough text to determine tone",
        readability: {
          score: 50,
          grade: "Not determined"
        },
        wordDistribution: {
          unique: 0,
          repeated: 0,
          rare: 0
        }
      };
    }
    
    // Normalize the metrics to ensure values are between 0-100
    const normalizeValue = (value: any, defaultVal = 50) => {
      const num = parseFloat(value);
      if (isNaN(num)) return defaultVal;
      if (num <= 1) return Math.round(num * 100); // Convert 0-1 scale to 0-100
      return Math.min(100, Math.max(0, Math.round(num))); // Ensure 0-100 range
    };
    
    return {
      formality: normalizeValue(result.metrics?.formality),
      complexity: normalizeValue(result.metrics?.complexity),
      coherence: normalizeValue(result.metrics?.coherence),
      engagement: normalizeValue(result.metrics?.engagement),
      conciseness: normalizeValue(result.metrics?.conciseness),
      commonPhrases: Array.isArray(result.commonPhrases) ? result.commonPhrases : ["Clear writing", "Effective communication"],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : ["Continue developing your ideas", "Add supporting evidence", "Consider your audience"],
      toneAnalysis: result.toneAnalysis || "The text has a neutral, informative tone",
      readability: {
        score: normalizeValue(result.readability?.score),
        grade: result.readability?.grade || "General Audience"
      },
      wordDistribution: {
        unique: parseInt(result.wordDistribution?.unique) || Math.ceil(text.split(/\s+/).filter(Boolean).length * 0.7),
        repeated: parseInt(result.wordDistribution?.repeated) || Math.floor(text.split(/\s+/).filter(Boolean).length * 0.2),
        rare: parseInt(result.wordDistribution?.rare) || Math.floor(text.split(/\s+/).filter(Boolean).length * 0.1)
      }
    };
  } catch (error: any) {
    console.error("Error analyzing text style:", error.message);
    // Return fallback metrics if analysis fails
    const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
    return {
      formality: 50,
      complexity: 50,
      coherence: 50,
      engagement: 50,
      conciseness: 50,
      commonPhrases: ["Analysis unavailable"],
      suggestions: ["Try again with more text", "Check your connection", "Ensure text is meaningful"],
      toneAnalysis: "Analysis unavailable",
      readability: {
        score: 50,
        grade: "Analysis unavailable"
      },
      wordDistribution: {
        unique: Math.ceil(wordCount * 0.7),
        repeated: Math.floor(wordCount * 0.2),
        rare: Math.floor(wordCount * 0.1)
      }
    };
  }
}

// Generate suggestions based on document context
export async function generateSuggestions(
  content: string,
  style: any,
  llmProvider: 'openai' | 'ollama' | 'gemini' = 'openai',
  llmModel?: string,
  options?: AIRequestOptions
): Promise<string[]> {
  if (llmProvider === 'ollama') {
    try {
      const systemPrompt = `You are an AI writing assistant. Based on the given text, generate 3 possible continuations or sentence completions that match the writing style. You must respond with a valid JSON array of exactly 3 strings.`;
      const prompt = `${systemPrompt}\n\nText: ${content}\n\nRespond with a JSON array format: ["suggestion 1", "suggestion 2", "suggestion 3"]`;
      
      const raw = await callOllama(llmModel || 'qwen3:4b', prompt, true);
      
      try {
        // Try to parse as JSON first
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, 3);
        }
        // If it's an object with suggestions property
        if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
          return parsed.suggestions.slice(0, 3);
        }
      } catch (e) {
        // Try to find JSON within the response
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
              return parsed.slice(0, 3);
            }
            if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
              return parsed.suggestions.slice(0, 3);
            }
          } catch (innerE) {
            // Fall through to line splitting
          }
        }
        
        // If JSON parsing fails, try to split by newlines and clean up
        const suggestions = raw
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('[') && !line.startsWith(']'))
          .slice(0, 3);
          
        if (suggestions.length > 0) {
          return suggestions;
        }
      }
      
      // If all else fails, return the raw response as a single suggestion
      return [raw];
    } catch (error: any) {
      console.error("Error generating suggestions with Ollama:", error);
      return ["[Unable to generate suggestions. Please try again.]"];
    }
  }

  if (llmProvider === 'gemini') {
    try {
      const raw = await generateWithGemini(
        content,
        style,
        `Generate 3 possible continuations or sentence completions that match the writing style. Respond with a JSON object: {"suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]}`,
        llmModel || DEFAULT_GEMINI_MODEL,
        options
      );
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed.suggestions)) return parsed.suggestions.slice(0, 3);
      }
      return [raw];
    } catch (error: any) {
      console.error("Error generating suggestions with Gemini:", error.message);
      return [];
    }
  }

  try {
    const openai = new OpenAI({
      apiKey: effectiveOpenAIKey(options),
      baseURL: effectiveBaseUrl(options),
      timeout: AI_REQUEST_TIMEOUT_MS
    });
    const requestParams = prepareO3Parameters({
      model: llmModel || DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an AI writing assistant that provides helpful suggestions to improve the user's writing.
          Based on their current document, generate 3 possible continuations or sentence completions that match their writing style.
          Style analysis: ${JSON.stringify(style)}
          Respond with a JSON array containing the 3 suggestions.`
        },
        {
          role: "user",
          content: content
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    
    const response = await openai.chat.completions.create(requestParams);

    const result = JSON.parse(response.choices[0].message.content || '{"suggestions":[]}');
    return result.suggestions || [];
  } catch (error: any) {
    console.error("Error generating suggestions:", error.message);
    return [];
  }
}

// Process command-based text manipulations
export async function processTextCommand(
  content: string,
  command: string,
  llmProvider: 'openai' | 'ollama' | 'gemini' = 'openai',
  llmModel?: string,
  options?: AIRequestOptions
): Promise<{ result: string; message: string }> {
  try {
    const systemPrompt = `You are an AI assistant that processes text manipulation commands similar to grep and sed.
    You will receive a document and a command. Parse the command and perform the requested operation on the text.
    Common commands include:
    - grep 'pattern': Find and return all instances of a pattern
    - replace 'old' 'new': Replace all instances of 'old' with 'new'
    - style analyze: Analyze the writing style
    - format paragraph: Improve formatting and readability
    
    Return a JSON object with two fields:
    - result: The resulting text after applying the command
    - message: A description of the changes made`;

    let rawResult = '';
    if (llmProvider === 'ollama') {
      rawResult = await callOllama(llmModel || 'qwen3:4b', `${systemPrompt}\n\nDocument:\n${content}\n\nCommand: ${command}`, true);
    } else if (llmProvider === 'gemini') {
      rawResult = await generateWithGemini(
        content,
        {},
        `${systemPrompt}\n\nCommand: ${command}\n\nReturn only the JSON object.`,
        llmModel || DEFAULT_GEMINI_MODEL,
        options
      );
    } else {
      const openai = new OpenAI({
        apiKey: effectiveOpenAIKey(options),
        baseURL: effectiveBaseUrl(options),
        timeout: AI_REQUEST_TIMEOUT_MS
      });
      const requestParams = prepareO3Parameters({
        model: llmModel || DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Document:\n${content}\n\nCommand: ${command}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const response = await openai.chat.completions.create(requestParams);
      rawResult = response.choices[0].message.content || '{"result":"","message":""}';
    }

    const result = JSON.parse(rawResult || '{"result":"","message":""}');
    
    return {
      result: result.result || content,
      message: result.message || "Command processed successfully."
    };
  } catch (error: any) {
    console.error("Error processing text command:", error.message);
    return {
      result: content,
      message: "Failed to process command: " + error.message
    };
  }
}

// Generate contextual assistance based on the current document
export async function generateContextualAssistance(
  content: string,
  title: string,
  llmProvider: 'openai' | 'ollama' | 'gemini' = 'openai',
  llmModel?: string,
  options?: AIRequestOptions
): Promise<{ message: string; suggestions: string[] }> {
  try {
    const systemPrompt = `You are an AI writing assistant that provides contextual help to users based on their current document.
    Analyze the document content and title, then suggest 3 specific and helpful actions the user might want to take.
    Return a JSON object with:
    - message: A helpful message based on what the user is writing
    - suggestions: An array of 3 specific action items`;

    let rawResult = '';
    if (llmProvider === 'ollama') {
      rawResult = await callOllama(llmModel || 'qwen3:4b', `${systemPrompt}\n\nTitle: ${title}\n\nContent: ${content}`, true);
    } else if (llmProvider === 'gemini') {
      rawResult = await generateWithGemini(
        content,
        {},
        `${systemPrompt}\n\nTitle: ${title}\n\nReturn only the JSON object.`,
        llmModel || DEFAULT_GEMINI_MODEL,
        options
      );
    } else {
      const openai = new OpenAI({
        apiKey: effectiveOpenAIKey(options),
        baseURL: effectiveBaseUrl(options),
        timeout: AI_REQUEST_TIMEOUT_MS
      });
      const requestParams = prepareO3Parameters({
        model: llmModel || DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Title: ${title}\n\nContent: ${content}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      });

      const response = await openai.chat.completions.create(requestParams);
      rawResult = response.choices[0].message.content || '{"message":"","suggestions":[]}';
    }

    const result = JSON.parse(rawResult || '{"message":"","suggestions":[]}');
    
    return {
      message: result.message || "How can I help with your writing?",
      suggestions: result.suggestions || [
        "Research recent trends in this topic",
        "Suggest improvements to structure",
        "Generate additional content"
      ]
    };
  } catch (error: any) {
    console.error("Error generating contextual assistance:", error.message);
    return {
      message: "How can I help with your writing?",
      suggestions: [
        "Research recent trends in this topic",
        "Suggest improvements to structure",
        "Generate additional content"
      ]
    };
  }
}
