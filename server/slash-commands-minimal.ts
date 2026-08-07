import OpenAI from "openai";
import { storage } from './storage';

const DEFAULT_MODEL = "gpt-4.1-mini";

// Core command types
export type CoreCommandType = 'continue' | 'improve' | 'fix' | 'bullets' | 'table' | 'format';

// Helper function to call Ollama API
async function callOllama(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: `System: ${systemPrompt}\n\nUser: ${userPrompt}`,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || "";
  } catch (error) {
    console.error("Error calling Ollama:", error);
    throw error;
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
  llmProvider: 'openai' | 'ollama' = 'openai',
  llmModel: string = DEFAULT_MODEL,
  includeContext: boolean = false,
  projectId?: number
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
    apiKey: process.env.OPENAI_API_KEY || "default_key" 
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
    return {
      result: smartSelectionInfo.selectedText || "",
      message: `Error executing ${command}: ${error.message || "Unknown error"}`,
      replaceSelection: Boolean(smartSelectionInfo.selectedText)
    };
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
  llmProvider: 'openai' | 'ollama' = 'openai',
  llmModel: string = DEFAULT_MODEL,
  includeContext: boolean = false,
  projectId?: number
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
    apiKey: process.env.OPENAI_API_KEY || "default_key" 
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
    return {
      result: selectionInfo.selectedText || "",
      message: `Error executing custom command: ${error.message || "Unknown error"}`,
      replaceSelection: Boolean(selectionInfo.selectedText)
    };
  }
}