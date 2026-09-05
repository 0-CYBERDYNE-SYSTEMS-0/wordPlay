import OpenAI from "openai";
import { storage } from './storage';
import { generateWithGemini, DEFAULT_GEMINI_MODEL, type AIRequestOptions } from './openai';

const DEFAULT_MODEL = "mlx-community/gemma-4-e2b-it-4bit";

// Configurable, interactive-friendly timeout for AI calls (ms). Default 120s so
// interactive slash commands fail fast instead of hanging ~5 min on undici's
// default headers timeout.
const AI_REQUEST_TIMEOUT_MS = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '120000', 10);

// Core command types
export type CoreCommandType = 'continue' | 'improve' | 'fix' | 'bullets' | 'table' | 'format';

// Shared Ollama request body (streaming + non-streaming use identical options)
function buildOllamaRequestBody(model: string, systemPrompt: string, userPrompt: string, stream: boolean) {
  return {
    model: model,
    prompt: `System: ${systemPrompt}\n\nUser: ${userPrompt}`,
    stream,
    // Disable thinking mode — qwen3.5 / reasoning models spend their whole
    // token budget on <thinking> and never emit the actual answer. With
    // think:false they answer directly in ~1s instead of hanging for a
    // minute and returning empty/truncated reasoning.
    think: false,
    options: {
      num_ctx: 8192, // Keep context small — Ollama's default 32768 makes 2b models crawl
      num_predict: 2048,
      temperature: 0.3
    }
  };
}

// Helper function to call Ollama API
async function callOllama(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildOllamaRequestBody(model, systemPrompt, userPrompt, false)),
      // Bound slow local models so commands fail honestly instead of hanging.
      signal: AbortSignal.timeout(parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '180000', 10)),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    // qwen3.5 / deepseek-r1 style models put their reasoning in `thinking`
    // and leave `response` empty. Fall back to `thinking` so the pipeline
    // still returns content (the client extracts <thinking> tags from it).
    return data.response || data.thinking || "";
  } catch (error) {
    console.error("Error calling Ollama:", error);
    throw error;
  }
}

// Streaming variant — calls Ollama with stream:true and yields each text chunk.
// Used by /api/ai/slash-command/stream so the editor can render tokens as they
// arrive instead of waiting for the full completion.
export async function* streamOllama(
  model: string,
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<string> {
  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildOllamaRequestBody(model, systemPrompt, userPrompt, true)),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error('Ollama stream returned no body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Ollama NDJSON: one JSON object per line
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line) continue;
        try {
          const data = JSON.parse(line);
          if (data.response) yield data.response;
          if (data.done) return;
        } catch {
          // Partial/invalid JSON line — skip; the stream continues.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Smart text selection helpers
function findParagraphBoundaries(content: string, position: number): { start: number; end: number } {
  const lines = content.split('\n');
  let currentPos = 0;
  let lineIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    if (currentPos + lines[i].length >= position) {
      lineIndex = i;
      break;
    }
    currentPos += lines[i].length + 1;
  }
  
  let paragraphStart = lineIndex;
  let paragraphEnd = lineIndex;
  
  while (paragraphStart > 0 && lines[paragraphStart - 1].trim() !== '') {
    paragraphStart--;
  }
  
  while (paragraphEnd < lines.length - 1 && lines[paragraphEnd + 1].trim() !== '') {
    paragraphEnd++;
  }
  
  let startPos = 0;
  for (let i = 0; i < paragraphStart; i++) {
    startPos += lines[i].length + 1;
  }
  
  let endPos = startPos;
  for (let i = paragraphStart; i <= paragraphEnd; i++) {
    endPos += lines[i].length;
    if (i < paragraphEnd) endPos += 1;
  }
  
  return { start: startPos, end: endPos };
}

function expandSelectionIntelligently(content: string, selectionInfo: any): {
  expandedText: string;
  expandedStart: number;
  expandedEnd: number;
  expansionApplied: string;
} {
  if (!selectionInfo.selectedText || selectionInfo.selectedText.trim() === '') {
    const cursorPosition = selectionInfo.selectionStart || 0;
    const paragraphBounds = findParagraphBoundaries(content, cursorPosition);
    const paragraphText = content.substring(paragraphBounds.start, paragraphBounds.end).trim();
    
    return {
      expandedText: paragraphText,
      expandedStart: paragraphBounds.start,
      expandedEnd: paragraphBounds.end,
      expansionApplied: 'paragraph'
    };
  }
  
  return {
    expandedText: selectionInfo.selectedText || '',
    expandedStart: selectionInfo.selectionStart || 0,
    expandedEnd: selectionInfo.selectionEnd || 0,
    expansionApplied: 'none'
  };
}

// Enhanced context analysis
async function analyzeContentAndContext(content: string, includeContext: boolean = false, projectId?: number) {
  const wordCount = content.trim().split(/\s+/).length;
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : 0;
  
  const complexWords = content.match(/\b\w{8,}\b/g) || [];
  const complexityRatio = complexWords.length / wordCount;
  
  const academicWords = /\b(research|study|analysis|methodology|hypothesis|evidence|conclusion|furthermore|moreover|therefore)\b/gi;
  const casualWords = /\b(really|pretty|kinda|maybe|I think|you know|awesome|cool)\b/gi;
  const formalWords = /\b(shall|pursuant|hereby|therefore|consequently|nevertheless|furthermore)\b/gi;
  
  const academicCount = (content.match(academicWords) || []).length;
  const casualCount = (content.match(casualWords) || []).length;
  const formalCount = (content.match(formalWords) || []).length;
  
  const styleAnalysis = {
    tone: academicCount > casualCount && academicCount > formalCount ? 'academic' :
          casualCount > formalCount ? 'casual' :
          formalCount > 0 ? 'formal' : 'neutral',
    formality: avgSentenceLength > 20 ? 'highly formal' :
              avgSentenceLength > 15 ? 'formal' :
              avgSentenceLength > 10 ? 'moderate' : 'casual',
    complexity: complexityRatio > 0.15 ? 'high' :
               complexityRatio > 0.08 ? 'moderate' : 'accessible',
  };
  
  let projectSources: any[] = [];
  let contextSummary: string | undefined;
  let researchContext: string | undefined;
  
  if (includeContext && projectId) {
    try {
      projectSources = await storage.getSources(projectId);
      
      if (projectSources.length > 0) {
        const sourcesByType = projectSources.reduce((acc, source) => {
          acc[source.type] = (acc[source.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        contextSummary = `Found ${projectSources.length} research sources: ` + 
          Object.entries(sourcesByType).map(([type, count]) => `${count} ${type}`).join(', ');
        
        const researchContent = projectSources
          .map(source => `[${source.type.toUpperCase()}] ${source.name}\n${source.content}`)
          .join('\n\n---\n\n');
        
        researchContext = researchContent.length > 0 ? researchContent : undefined;
      } else {
        contextSummary = 'No research sources found for this project';
      }
    } catch (error) {
      console.error('Error fetching project sources:', error);
      contextSummary = 'Error loading research context';
    }
  }
  
  return {
    styleAnalysis,
    contextSummary,
    researchContext,
    projectSources
  };
}

// Create system prompt for core commands
function createCoreCommandPrompt(
  command: CoreCommandType, 
  textContext: string, 
  selectionInfo: any, 
  enhancedContext?: any
): string {
  const hasSelection = Boolean(selectionInfo.selectedText);
  const operationType = hasSelection ? 'selection' : 'document';
  
  let instruction = '';
  
  switch (command) {
    case 'continue':
      instruction = `Continue the text in a seamless way that matches the style and content of what came before. Be creative, coherent, and maintain the same voice and tone. Write at least one substantial paragraph that advances the ideas.`;
      break;
    case 'improve':
      instruction = `You are an expert editor. Analyze the text and identify specific sentences or phrases that need improvement for clarity, flow, and readability. Provide targeted fixes rather than rewriting everything. Focus on the most impactful changes.`;
      break;
    case 'fix':
      instruction = `Fix any grammatical errors, spelling mistakes, punctuation problems, or clarity issues in the text. Make minimal changes necessary to ensure correctness and readability. Focus only on errors, not style preferences.`;
      break;
    case 'bullets':
      instruction = `Transform the content into a well-structured bullet point list. Maintain all important information but reorganize it for easier reading and reference. Use clear, concise bullet points.`;
      break;
    case 'table':
      instruction = `Transform the content into a well-organized table format with appropriate headers and rows. Structure the information logically and maintain all key details.`;
      break;
    case 'format':
      instruction = `Improve the structure and formatting of the text. Add appropriate headings, subheadings, bullet points, numbered lists, and paragraph breaks to make the content more readable and professionally presented. Maintain all content while enhancing its visual organization.`;
      break;
  }
  
  return `You are an expert writing assistant with access to powerful text processing tools.

TASK: ${instruction}

TARGET: ${operationType} (${hasSelection ? selectionInfo.selectedText.length + ' characters selected' : 'entire document'})

CRITICAL RESPONSE FORMAT:
- Use <thinking> tags for your analysis, reasoning, and planning
- Use <final_output> tags ONLY for content that should appear in the editor
- Everything in <thinking> will appear in the context panel/sidebar
- Everything in <final_output> will replace or be added to the editor content
- Never include XML tags in the actual final output content

EXAMPLE RESPONSE:
<thinking>
I need to analyze this text and improve its clarity. The current sentence structure is overly complex and could be simplified.
</thinking>

<final_output>
Improved content goes here without any XML tags.
</final_output>

${hasSelection ? `SELECTED TEXT: "${selectionInfo.selectedText}"` : `DOCUMENT CONTEXT: "${textContext.substring(0, 500)}..."`}

${enhancedContext?.contextSummary ? `\nAVAILABLE RESEARCH CONTEXT: ${enhancedContext.contextSummary}` : ''}
${enhancedContext?.researchContext ? `\nRESEARCH SOURCES:\n${enhancedContext.researchContext.substring(0, 2000)}${enhancedContext.researchContext.length > 2000 ? '...' : ''}` : ''}

Provide a clear, improved version that applies only the necessary changes.${enhancedContext?.researchContext ? `\n\nYou may reference and incorporate information from the research sources above when relevant to improve the content.` : ''}`;
}

// Execute core commands
export async function executeCoreCommand(
  command: CoreCommandType,
  content: string,
  selectionInfo: {
    selectedText: string;
    selectionStart: number;
    selectionEnd: number;
    beforeSelection?: string;
    afterSelection?: string;
  },
  llmProvider: 'openai' | 'ollama' | 'gemini' = 'openai',
  llmModel: string = DEFAULT_MODEL,
  includeContext: boolean = false,
  projectId?: number,
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
  
  // Smart text selection for improve/fix commands
  let smartSelectionInfo = { ...selectionInfo };
  let expansionApplied = 'none';
  let expandedStart = selectionInfo.selectionStart;
  let expandedEnd = selectionInfo.selectionEnd;
  
  const shouldExpandSelection = (
    ['improve', 'fix'].includes(command) &&
    (
      !selectionInfo.selectedText || 
      selectionInfo.selectedText.trim().length < 10
    )
  );
  
  if (shouldExpandSelection) {
    const expansion = expandSelectionIntelligently(content, selectionInfo);
    
    if (expansion.expansionApplied !== 'none' && expansion.expandedText.trim().length > 0) {
      smartSelectionInfo = {
        ...selectionInfo,
        selectedText: expansion.expandedText,
        selectionStart: expansion.expandedStart,
        selectionEnd: expansion.expandedEnd,
        beforeSelection: content.substring(0, expansion.expandedStart),
        afterSelection: content.substring(expansion.expandedEnd)
      };
      expansionApplied = expansion.expansionApplied;
      expandedStart = expansion.expandedStart;
      expandedEnd = expansion.expandedEnd;
    }
  }
  
  // Enhanced context analysis
  let enhancedContext: any = null;
  if (includeContext) {
    enhancedContext = await analyzeContentAndContext(content, includeContext, projectId);
  }
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "default_key",
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    timeout: AI_REQUEST_TIMEOUT_MS
  });
  
  const modelToUse = llmProvider === 'openai' ? (llmModel || DEFAULT_MODEL) : llmModel;
  const textContext = smartSelectionInfo.selectedText || content;
  
  try {
    const systemPrompt = createCoreCommandPrompt(command, textContext, smartSelectionInfo, enhancedContext);
    const userPrompt = `${command === 'continue' ? 'Continue' : 'Process'} this content:\n\n${textContext}`;
    
    console.log(`Executing core command: ${command}${enhancedContext ? ' [with enhanced context]' : ''}`);
    
    let generatedText = "";
    
    if (llmProvider === 'ollama') {
      if (!modelToUse) {
        throw new Error("Ollama model name is required");
      }
      generatedText = await callOllama(modelToUse, systemPrompt, userPrompt);
    } else if (llmProvider === 'gemini') {
      generatedText = await generateWithGemini(
        textContext,
        {},
        systemPrompt,
        llmModel || DEFAULT_GEMINI_MODEL,
        options as AIRequestOptions
      );
    } else {
      const response = await openai.chat.completions.create({
        model: modelToUse,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user", 
            content: userPrompt
          }
        ],
        max_tokens: 1500,
      });
      
      generatedText = response.choices[0].message.content?.trim() || "";
    }
    
    // Determine response behavior based on command type
    switch (command) {
      case 'continue':
        return {
          result: generatedText,
          message: `Extended your writing with new content.`,
          appendToContent: true
        };
        
      case 'improve':
      case 'fix':
        if (smartSelectionInfo.selectedText) {
          let message = `Applied ${command} to the selected text.`;
          if (expansionApplied !== 'none') {
            message = `Applied ${command} to the current ${expansionApplied} (smart expansion applied).`;
          }
          
          return {
            result: generatedText,
            message,
            replaceSelection: true,
            smartExpansion: expansionApplied !== 'none' ? {
              applied: expansionApplied,
              expandedStart,
              expandedEnd
            } : undefined
          };
        } else {
          return {
            result: `To use /${command}, please select some text first. This helps ensure only the content you want to change is modified.`,
            message: `Please select text to apply ${command} safely.`,
            contextOnly: true
          };
        }
        
      case 'bullets':
      case 'table': 
      case 'format':
        return {
          result: generatedText,
          message: `Generated ${command} format and inserted at cursor position.`,
          insertAtCursor: true
        };
        
      default:
        return {
          result: generatedText,
          message: `Applied ${command} successfully.`,
          replaceSelection: Boolean(smartSelectionInfo.selectedText)
        };
    }
    
  } catch (error: any) {
    console.error(`Error executing core command ${command}:`, error);
    // Re-throw so the route maps this to a real (non-200) HTTP status code.
    throw error;
  }
}

// Streaming variant of executeCoreCommand for Ollama — yields the raw text
// chunks as they arrive so the editor can render tokens live. The final
// behavior metadata (replace/append/insert) is returned as the last yield.
export async function* streamCoreCommand(
  command: CoreCommandType,
  content: string,
  selectionInfo: {
    selectedText: string;
    selectionStart: number;
    selectionEnd: number;
    beforeSelection?: string;
    afterSelection?: string;
  },
  llmModel: string,
  includeContext: boolean = false,
  projectId?: number
): AsyncGenerator<string | { done: boolean; behavior: any }> {
  // Smart text selection for improve/fix commands
  let smartSelectionInfo = { ...selectionInfo };
  let expansionApplied = 'none';
  let expandedStart = selectionInfo.selectionStart;
  let expandedEnd = selectionInfo.selectionEnd;

  const shouldExpandSelection = (
    ['improve', 'fix'].includes(command) &&
    (
      !selectionInfo.selectedText ||
      selectionInfo.selectedText.trim().length < 10
    )
  );

  if (shouldExpandSelection) {
    const expansion = expandSelectionIntelligently(content, selectionInfo);
    if (expansion.expansionApplied !== 'none' && expansion.expandedText.trim().length > 0) {
      smartSelectionInfo = {
        ...selectionInfo,
        selectedText: expansion.expandedText,
        selectionStart: expansion.expandedStart,
        selectionEnd: expansion.expandedEnd,
        beforeSelection: content.substring(0, expansion.expandedStart),
        afterSelection: content.substring(expansion.expandedEnd)
      };
      expansionApplied = expansion.expansionApplied;
      expandedStart = expansion.expandedStart;
      expandedEnd = expansion.expandedEnd;
    }
  }

  let enhancedContext: any = null;
  if (includeContext) {
    enhancedContext = await analyzeContentAndContext(content, includeContext, projectId);
  }

  const textContext = smartSelectionInfo.selectedText || content;
  const systemPrompt = createCoreCommandPrompt(command, textContext, smartSelectionInfo, enhancedContext);
  const userPrompt = `${command === 'continue' ? 'Continue' : 'Process'} this content:\n\n${textContext}`;

  console.log(`Streaming core command: ${command} (ollama)`);

  // Filter the model's raw stream: strip <thinking>...</thinking> blocks and
  // the <final_output> wrapper tags so the editor only ever receives the
  // actual content — no XML tags flash on screen during streaming.
  //
  // Ollama streams token fragments (e.g. "<th", "inking", ">"), so tags are
  // split across chunks. We accumulate a tail and only emit text that is
  // provably outside any tag construct.
  let generatedText = "";
  let inThinking = false;
  let tail = ""; // holds chars that might be the start of a tag
  const TAG_STARTS = ['<thinking>', '<final_output>', '</final_output>', '</thinking>'];

  for await (const chunk of streamOllama(llmModel, systemPrompt, userPrompt)) {
    let combined = tail + chunk;
    tail = '';
    let emit = '';
    let i = 0;

    while (i < combined.length) {
      if (inThinking) {
        // Skip until </thinking> — the closing tag may be split across chunks
        // (e.g. "</th", "inking", ">"), so scan with a moving lookahead.
        const closeIdx = combined.indexOf('</thinking>', i);
        if (closeIdx !== -1) {
          i = closeIdx + '</thinking>'.length;
          inThinking = false;
          continue;
        }
        // Partial closing tag at the end? Hold up to 11 chars in tail so the
        // next chunk can complete it.
        const possibleClose = combined.slice(i).toLowerCase();
        const closeTag = '</thinking>';
        let holdLen = 0;
        for (let n = Math.min(possibleClose.length, closeTag.length); n >= 1; n--) {
          if (closeTag.startsWith(possibleClose.slice(-n))) { holdLen = n; break; }
        }
        if (holdLen > 0) {
          // Only hold if it's at the very end (could continue next chunk)
          if (possibleClose.length - holdLen === 0 || combined.slice(i).endsWith(possibleClose.slice(-holdLen))) {
            tail = possibleClose.slice(-holdLen);
            i = combined.length;
            continue;
          }
        }
        i = combined.length;
        continue;
      }

      const remaining = combined.slice(i);
      const ltIdx = remaining.indexOf('<');
      if (ltIdx === -1) {
        // No '<' — emit everything except a small tail (in case a '<' would
        // arrive at the very start of the next chunk).
        const keepFrom = Math.max(0, remaining.length - 12);
        emit += remaining.slice(0, keepFrom);
        tail = remaining.slice(keepFrom);
        i = combined.length;
        continue;
      }

      const beforeTag = remaining.slice(0, ltIdx);
      if (beforeTag) {
        emit += beforeTag;
        i += ltIdx;
        continue;
      }

      // At a '<' — check whether it's (a) a full known tag, (b) a partial
      // tag that needs more chunks, or (c) a plain '<' in the text.
      const fromHere = remaining;
      const matched = TAG_STARTS.find(t => fromHere.toLowerCase().startsWith(t.toLowerCase()));
      if (matched) {
        if (matched === '<thinking>') inThinking = true;
        i += matched.length;
        continue;
      }
      // Partial tag start: '<' followed by 't' (think) or 'f' (final) or '/'.
      // Hold it in the tail until we can decide. Cap at 14 chars so a plain
      // '<t' in prose still streams.
      const nextTwo = fromHere.slice(1, 2).toLowerCase();
      const couldBeTag = nextTwo === 't' || nextTwo === 'f' || nextTwo === '/';
      if (couldBeTag && fromHere.length <= 14) {
        tail = fromHere;
        i = combined.length;
        continue;
      }
      // Plain '<' that isn't a tag — emit it
      emit += '<';
      i += 1;
    }

    if (emit.length > 0) {
      generatedText += emit;
      yield emit;
    }
  }

  // Flush any remaining tail (text that wasn't a tag)
  if (tail && !TAG_STARTS.some(t => tail.toLowerCase().startsWith(t.toLowerCase()))) {
    generatedText += tail;
    yield tail;
  }

  // If the model never emitted <final_output> (plain response), generatedText
  // already holds the clean text.

  // Final behavior metadata — mirrors executeCoreCommand's switch
  switch (command) {
    case 'continue':
      yield { done: true, behavior: { result: generatedText, message: 'Extended your writing with new content.', appendToContent: true } };
      break;
    case 'improve':
    case 'fix':
      if (smartSelectionInfo.selectedText) {
        let message = `Applied ${command} to the selected text.`;
        if (expansionApplied !== 'none') {
          message = `Applied ${command} to the current ${expansionApplied} (smart expansion applied).`;
        }
        yield {
          done: true,
          behavior: {
            result: generatedText,
            message,
            replaceSelection: true,
            smartExpansion: expansionApplied !== 'none' ? { applied: expansionApplied, expandedStart, expandedEnd } : undefined
          }
        };
      } else {
        yield {
          done: true,
          behavior: {
            result: `To use /${command}, please select some text first. This helps ensure only the content you want to change is modified.`,
            message: `Please select text to apply ${command} safely.`,
            contextOnly: true
          }
        };
      }
      break;
    case 'bullets':
    case 'table':
    case 'format':
      yield { done: true, behavior: { result: generatedText, message: `Generated ${command} format and inserted at cursor position.`, insertAtCursor: true } };
      break;
    default:
      yield { done: true, behavior: { result: generatedText, message: `Applied ${command} successfully.`, replaceSelection: Boolean(smartSelectionInfo.selectedText) } };
  }
}

// Execute custom commands
export async function executeCustomCommand(
  promptTemplate: string,
  content: string,
  selectionInfo: {
    selectedText: string;
    selectionStart: number;
    selectionEnd: number;
    beforeSelection?: string;
    afterSelection?: string;
  },
  llmProvider: 'openai' | 'ollama' | 'gemini' = 'openai',
  llmModel: string = DEFAULT_MODEL,
  includeContext: boolean = false,
  projectId?: number,
  options?: { baseUrl?: string }
): Promise<{
  result: string;
  message: string;
  replaceSelection?: boolean;
  replaceEntireContent?: boolean;
  appendToContent?: boolean;
  contextOnly?: boolean;
  insertAtCursor?: boolean;
}> {
  
  const hasSelection = Boolean(selectionInfo.selectedText);
  const textContext = selectionInfo.selectedText || content;
  
  // Enhanced context analysis
  let enhancedContext: any = null;
  if (includeContext) {
    enhancedContext = await analyzeContentAndContext(content, includeContext, projectId);
  }
  
  const systemPrompt = `You are an expert writing assistant.

TASK: ${promptTemplate}

TARGET: ${hasSelection ? 'selected text' : 'entire document'}

CRITICAL RESPONSE FORMAT:
- Use <thinking> tags for your analysis, reasoning, and planning
- Use <final_output> tags ONLY for content that should appear in the editor
- Everything in <thinking> will appear in the context panel/sidebar
- Everything in <final_output> will replace or be added to the editor content
- Never include XML tags in the actual final output content

${hasSelection ? `SELECTED TEXT: "${selectionInfo.selectedText}"` : `DOCUMENT CONTEXT: "${textContext.substring(0, 500)}..."`}

${enhancedContext?.contextSummary ? `\nAVAILABLE RESEARCH CONTEXT: ${enhancedContext.contextSummary}` : ''}
${enhancedContext?.researchContext ? `\nRESEARCH SOURCES:\n${enhancedContext.researchContext.substring(0, 2000)}${enhancedContext.researchContext.length > 2000 ? '...' : ''}` : ''}

Follow the custom prompt instructions precisely.${enhancedContext?.researchContext ? `\n\nYou may reference and incorporate information from the research sources above when relevant.` : ''}`;

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "default_key",
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    timeout: AI_REQUEST_TIMEOUT_MS
  });
  
  const modelToUse = llmProvider === 'openai' ? (llmModel || DEFAULT_MODEL) : llmModel;
  
  try {
    const userPrompt = `Process this content:\n\n${textContext}`;
    
    let generatedText = "";
    
    if (llmProvider === 'ollama') {
      if (!modelToUse) {
        throw new Error("Ollama model name is required");
      }
      generatedText = await callOllama(modelToUse, systemPrompt, userPrompt);
    } else if (llmProvider === 'gemini') {
      generatedText = await generateWithGemini(
        textContext,
        {},
        systemPrompt,
        llmModel || DEFAULT_GEMINI_MODEL,
        options as AIRequestOptions
      );
    } else {
      const response = await openai.chat.completions.create({
        model: modelToUse,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        max_tokens: 1500,
      });
      
      generatedText = response.choices[0].message.content?.trim() || "";
    }
    
    // Default behavior for custom commands: replace selection if available
    if (hasSelection) {
      return {
        result: generatedText,
        message: `Applied custom command to the selected text.`,
        replaceSelection: true
      };
    } else {
      return {
        result: `To use this custom command, please select some text first. This helps ensure only the content you want to change is modified.`,
        message: `Please select text to apply custom command safely.`,
        contextOnly: true
      };
    }
    
  } catch (error: any) {
    console.error(`Error executing custom command:`, error);
    // Re-throw so the route maps this to a real (non-200) HTTP status code.
    throw error;
  }
}