import OpenAI from "openai";

// UPDATED: Enhanced XML-based system prompts for surgical editing
const DEFAULT_MODEL = "gpt-4o-mini";

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

// Helper function to parse command parameters - UPDATED to handle custom input
function parseCommand(command: string): { 
  baseCommand: string; 
  parameter?: string; 
  customInput?: string; 
} {
  const parts = command.split(':');
  
  if (parts.length >= 3 && parts[1] === 'custom') {
    // Format: command:custom:user_input
    return {
      baseCommand: parts[0],
      parameter: 'custom',
      customInput: parts.slice(2).join(':') // Rejoin in case there were colons in the input
    };
  } else if (parts.length >= 2) {
    // Format: command:parameter
    return {
      baseCommand: parts[0],
      parameter: parts[1]
    };
  } else {
    // Format: command
    return {
      baseCommand: parts[0]
    };
  }
}

// Helper function to analyze content for smart defaults
function analyzeContentContext(content: string, selectionInfo: any): {
  length: 'short' | 'medium' | 'long';
  complexity: 'simple' | 'moderate' | 'complex';
  tone: 'formal' | 'casual' | 'academic' | 'neutral';
  hasSelection: boolean;
} {
  const text = selectionInfo.selectedText || content;
  const wordCount = text.trim().split(/\s+/).length;
  
  return {
    length: wordCount < 50 ? 'short' : wordCount < 200 ? 'medium' : 'long',
    complexity: /\b(furthermore|consequently|nevertheless|however)\b/i.test(text) ? 'complex' : 
               /\b(and|but|so|then)\b/i.test(text) ? 'moderate' : 'simple',
    tone: /\b(research|study|analysis|methodology)\b/i.test(text) ? 'academic' :
          /\b(I think|maybe|kinda|pretty)\b/i.test(text) ? 'casual' :
          /\b(shall|pursuant|hereby|therefore)\b/i.test(text) ? 'formal' : 'neutral',
    hasSelection: Boolean(selectionInfo.selectedText)
  };
}

// Helper function to create system prompts that leverage existing text processing tools - UPDATED
function createToolBasedPrompt(instruction: string, textContext: string, selectionInfo: any, customGuidance?: string): string {
  const hasSelection = Boolean(selectionInfo.selectedText);
  const operationType = hasSelection ? 'selection' : 'document';
  
  // Incorporate custom guidance if provided
  const enhancedInstruction = customGuidance 
    ? `${instruction}\n\nUSER GUIDANCE: ${customGuidance}`
    : instruction;
  
  return `You are an expert writing assistant with access to powerful text processing tools like grep and sed.

TASK: ${enhancedInstruction}

TARGET: ${operationType} (${hasSelection ? selectionInfo.selectedText.length + ' characters selected' : 'entire document'})

CRITICAL INSTRUCTION:
- ALL final output that should appear in the editor MUST be wrapped in <final_output> tags
- Everything else (analysis, thinking, suggestions) will appear in the context panel
- For surgical edits, wrap ONLY the specific text changes in <final_output> tags
- Never include XML tags or technical markers in the final output content itself

EXISTING TEXT PROCESSING CAPABILITIES:
- Use existing grep/sed-like tools for precise text replacement
- Apply surgical edits without affecting surrounding content  
- Maintain document structure and formatting
- Focus on minimal, targeted changes

${hasSelection ? `SELECTED TEXT: "${selectionInfo.selectedText}"` : `DOCUMENT CONTEXT: "${textContext.substring(0, 500)}..."`}

${customGuidance ? `Follow the user's specific guidance while applying the task. The guidance takes priority over default behaviors.` : `Provide a clear, improved version that applies only the necessary changes. For surgical edits, identify specific patterns to find and replace rather than rewriting entire sections.`}`;
}

// NEW: Enhanced style and context analysis function
async function analyzeContentAndContext(content: string, includeContext: boolean = false): Promise<{
  styleAnalysis: {
    tone: string;
    formality: string;
    complexity: string;
    writingStyle: string;
    vocabulary: string;
    structure: string;
  };
  contextSummary?: string;
  researchContext?: string;
}> {
  
  // Basic style analysis based on content patterns
  const wordCount = content.trim().split(/\s+/).length;
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : 0;
  
  // Analyze vocabulary complexity
  const complexWords = content.match(/\b\w{8,}\b/g) || [];
  const complexityRatio = complexWords.length / wordCount;
  
  // Analyze tone indicators
  const academicWords = /\b(research|study|analysis|methodology|hypothesis|evidence|conclusion|furthermore|moreover|therefore)\b/gi;
  const casualWords = /\b(really|pretty|kinda|maybe|I think|you know|awesome|cool)\b/gi;
  const formalWords = /\b(shall|pursuant|hereby|therefore|consequently|nevertheless|furthermore)\b/gi;
  
  const academicCount = (content.match(academicWords) || []).length;
  const casualCount = (content.match(casualWords) || []).length;
  const formalCount = (content.match(formalWords) || []).length;
  
  // Determine style characteristics
  const styleAnalysis = {
    tone: academicCount > casualCount && academicCount > formalCount ? 'academic' :
          casualCount > formalCount ? 'casual' :
          formalCount > 0 ? 'formal' : 'neutral',
    formality: avgSentenceLength > 20 ? 'highly formal' :
              avgSentenceLength > 15 ? 'formal' :
              avgSentenceLength > 10 ? 'moderate' : 'casual',
    complexity: complexityRatio > 0.15 ? 'high' :
               complexityRatio > 0.08 ? 'moderate' : 'accessible',
    writingStyle: content.includes('\n\n## ') || content.includes('# ') ? 'structured/academic' :
                 content.includes('\n- ') || content.includes('\n* ') ? 'list-based' :
                 sentences.length > 0 && avgSentenceLength > 25 ? 'verbose/descriptive' :
                 'narrative/flowing',
    vocabulary: complexityRatio > 0.12 ? 'sophisticated' :
               complexityRatio > 0.06 ? 'standard' : 'simple',
    structure: content.includes('\n\n') ? 'well-paragraphed' :
              content.includes('\n') ? 'line-broken' : 'continuous'
  };
  
  // If context is requested, we would fetch from database here
  // For now, return the style analysis
  return {
    styleAnalysis,
    contextSummary: includeContext ? 'Context integration available' : undefined,
    researchContext: includeContext ? 'Research sources can be integrated' : undefined
  };
}

// Helper function to create context-aware prompts for smart continuation
function createSmartContinuationPrompt(
  content: string, 
  selectionInfo: any, 
  styleAnalysis: any,
  customGuidance?: string,
  contextSummary?: string,
  researchContext?: string
): string {
  const hasSelection = Boolean(selectionInfo.selectedText);
  const operationType = hasSelection ? 'selection' : 'document';
  
  const baseInstruction = customGuidance 
    ? `Continue the text following this specific guidance: ${customGuidance}`
    : `Continue the text intelligently using comprehensive style analysis and available context`;

  return `You are an expert writing assistant with advanced style analysis and context integration capabilities.

<thinkpad>
SMART CONTINUATION TASK: ${baseInstruction}

STYLE ANALYSIS RESULTS:
- Tone: ${styleAnalysis.tone}
- Formality: ${styleAnalysis.formality}  
- Complexity: ${styleAnalysis.complexity}
- Writing Style: ${styleAnalysis.writingStyle}
- Vocabulary Level: ${styleAnalysis.vocabulary}
- Structure Pattern: ${styleAnalysis.structure}

TARGET: ${operationType} (${hasSelection ? selectionInfo.selectedText.length + ' characters selected' : 'entire document'})

${contextSummary ? `CONTEXT SUMMARY: ${contextSummary}` : ''}
${researchContext ? `RESEARCH CONTEXT: ${researchContext}` : ''}

CONTINUATION STRATEGY:
1. Maintain the detected ${styleAnalysis.tone} tone and ${styleAnalysis.formality} formality level
2. Match the ${styleAnalysis.writingStyle} writing style
3. Use ${styleAnalysis.vocabulary} vocabulary consistent with the existing text
4. Follow the ${styleAnalysis.structure} structural pattern
5. Ensure seamless flow and natural progression of ideas
${customGuidance ? `6. Incorporate the specific guidance: ${customGuidance}` : ''}
${contextSummary ? `7. Integrate relevant context where appropriate` : ''}
</thinkpad>

<workspace>
CURRENT TEXT: "${content.length > 1000 ? content.substring(content.length - 1000) + '...' : content}"

LAST PARAGRAPH: "${content.split('\n\n').slice(-1)[0] || content.substring(Math.max(0, content.length - 200))}"
</workspace>

<final_result>
Continue the text naturally, maintaining the established style, tone, and flow. Write 1-3 paragraphs that advance the ideas seamlessly. Match the sophistication level, sentence structure, and vocabulary patterns of the existing content.
</final_result>`;
}

// Define the AI commands handlers for each slash command type
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
  llmProvider: 'openai' | 'ollama' = 'openai',
  llmModel: string = DEFAULT_MODEL,
  includeContext: boolean = false // NEW: Flag to include context analysis
): Promise<{
  result: string;
  message: string;
  replaceSelection?: boolean;
  replaceEntireContent?: boolean;
  appendToContent?: boolean;
  contextOnly?: boolean;
  insertAtCursor?: boolean;
}> {
  // Parse command, parameter, and custom input - UPDATED
  const { baseCommand, parameter, customInput } = parseCommand(command);
  
  // Analyze content for smart defaults
  const context = analyzeContentContext(content, selectionInfo);
  
  // Enhanced context analysis for smart commands (if needed in future)
  let enhancedContext: any = null;
  if (includeContext) {
    enhancedContext = await analyzeContentAndContext(content, includeContext);
  }
  
  // Use the provided LLM provider and model, or default to OpenAI
  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY || "default_key" 
  });
  
  // Determine which model to use based on provider
  const modelToUse = llmProvider === 'openai' ? (llmModel || DEFAULT_MODEL) : llmModel;
  
  // The context is either the selected text (if any) or the entire content
  const textContext = selectionInfo.selectedText || content;
  
  // Default response
  let defaultResponse = {
    result: selectionInfo.selectedText || "",
    message: "Could not process the command.",
    replaceSelection: Boolean(selectionInfo.selectedText),
    replaceEntireContent: false,
    appendToContent: false
  };
  
  // Determine which command to execute
  try {
    let systemPrompt = "";
    let userPrompt = "";
    
    console.log(`Executing slash command: ${baseCommand}${parameter ? `:${parameter}` : ''}${customInput ? ` with custom input: "${customInput}"` : ''}${enhancedContext ? ' [with enhanced context]' : ''}`);
    
    switch (baseCommand) {
      case 'continue':
        const continueInstruction = customInput 
          ? `Continue the text in a seamless way following this specific guidance: ${customInput}`
          : `Continue the text in a seamless way that matches the style and content of what came before. Be creative, coherent, and maintain the same voice and tone. Write at least one substantial paragraph that advances the ideas.`;
        
        systemPrompt = createToolBasedPrompt(
          continueInstruction,
          textContext,
          selectionInfo,
          customInput
        );
        userPrompt = `Continue this content:\n\n${content}`;
        break;


        
      case 'improve':
        if (customInput) {
          systemPrompt = createToolBasedPrompt(
            `You are an expert editor. Improve the text according to this specific guidance: ${customInput}. Make targeted improvements rather than wholesale rewrites.`,
            textContext,
            selectionInfo,
            customInput
          );
        } else if (parameter && parameter !== 'custom') {
          switch (parameter) {
            case 'clarity':
              systemPrompt = createToolBasedPrompt(
                `You are an expert editor focused on clarity. For the given text, identify specific sentences or phrases that need improvement for clarity. Find unclear expressions, ambiguous language, or overly complex sentences and provide precise replacements. DO NOT rewrite the entire text - only fix specific unclear parts.`,
                textContext,
                selectionInfo
              );
              break;
            case 'engagement':
              systemPrompt = createToolBasedPrompt(
                `You are an expert editor focused on engagement. Identify specific weak or boring sentences/phrases and provide more compelling alternatives. Add vivid language and stronger hooks where needed. Make targeted improvements, not wholesale rewrites.`,
                textContext,
                selectionInfo
              );
              break;
            case 'flow':
              systemPrompt = createToolBasedPrompt(
                `You are an expert editor focused on flow. Identify specific transition problems, awkward sentence connections, or logical gaps. Provide targeted fixes to improve transitions and coherence. Focus on specific sentences that break the flow.`,
                textContext,
                selectionInfo
              );
              break;
            case 'word-choice':
              systemPrompt = createToolBasedPrompt(
                `You are an expert editor focused on word choice. Identify specific weak, imprecise, or inappropriate words/phrases and provide stronger alternatives. Make targeted vocabulary improvements while maintaining the original meaning.`,
                textContext,
                selectionInfo
              );
              break;
            default:
              systemPrompt = createToolBasedPrompt(
                `You are an expert editor. Analyze the text and identify specific sentences or phrases that need improvement for clarity, flow, and readability. Provide targeted fixes rather than rewriting everything. Focus on the most impactful changes.`,
                textContext,
                selectionInfo
              );
          }
        } else {
          systemPrompt = createToolBasedPrompt(
            `You are an expert editor. Based on the content's ${context.complexity} complexity and ${context.tone} tone, identify specific problems and provide targeted improvements. Focus on surgical edits rather than wholesale rewrites.`,
            textContext,
            selectionInfo
          );
        }
        userPrompt = `Please improve this text with targeted edits:\n\n${textContext}`;
        break;
        
      case 'summarize':
        const summaryLength = context.length === 'short' ? '2-3 sentences' : 
                            context.length === 'medium' ? '1 paragraph' : '2-3 paragraphs';
        const summaryInstruction = customInput
          ? `Create a summary following this guidance: ${customInput}`
          : `Create a clear, comprehensive summary of the text in approximately ${summaryLength}. Capture all key points while eliminating redundancy and maintaining the essence intact.`;
        
        systemPrompt = createToolBasedPrompt(
          summaryInstruction,
          textContext,
          selectionInfo,
          customInput
        );
        userPrompt = `Summarize this text:\n\n${textContext}`;
        break;
        
      case 'expand':
        if (customInput) {
          systemPrompt = createToolBasedPrompt(
            `Generate additional content that expands upon the given text following this specific guidance: ${customInput}. This content will be added to the existing text.`,
            textContext,
            selectionInfo,
            customInput
          );
        } else if (parameter && parameter !== 'custom') {
          switch (parameter) {
            case 'examples':
              systemPrompt = createToolBasedPrompt(
                `Generate additional content with concrete examples, case studies, or real-world illustrations that support and clarify the main points. This content will be added to the existing text.`,
                textContext,
                selectionInfo
              );
              break;
            case 'detail':
              systemPrompt = createToolBasedPrompt(
                `Generate additional content with more specific details, explanations, and depth that expands on the given text. This content will be added to the existing text.`,
                textContext,
                selectionInfo
              );
              break;
            case 'context':
              systemPrompt = createToolBasedPrompt(
                `Generate additional content with background information, historical context, or broader implications. This content will be added to the existing text.`,
                textContext,
                selectionInfo
              );
              break;
            case 'analysis':
              systemPrompt = createToolBasedPrompt(
                `Generate additional content with deeper analysis, critical thinking, implications, and connections. This content will be added to the existing text.`,
                textContext,
                selectionInfo
              );
              break;
            default:
              systemPrompt = createToolBasedPrompt(
                `Generate additional content that expands upon the given text by adding more detail, examples, evidence, or context. This content will be added to the existing text.`,
                textContext,
                selectionInfo
              );
          }
        } else {
          const expandStyle = context.tone === 'academic' ? 'analysis and evidence' :
                            context.complexity === 'simple' ? 'examples and details' : 'context and depth';
          systemPrompt = createToolBasedPrompt(
            `Generate additional content that expands upon the given text by adding ${expandStyle}. This content will be added to the existing text.`,
            textContext,
            selectionInfo
          );
        }
        userPrompt = `Expand on this content:\n\n${textContext}`;
        break;
        
      case 'list':
        const listInstruction = customInput
          ? `Transform the content into a list format following this guidance: ${customInput}`
          : `Transform the content into a well-structured list format with clear headings and bullet points. Maintain all important information but reorganize it for easier reading and reference. Add appropriate introductory text.`;
        
        systemPrompt = createToolBasedPrompt(
          listInstruction,
          textContext,
          selectionInfo,
          customInput
        );
        userPrompt = `Transform this content into a list:\n\n${textContext}`;
        break;

      case 'rewrite':
        if (customInput) {
          systemPrompt = createToolBasedPrompt(
            `Rewrite the text according to this specific guidance: ${customInput}. Preserve all key information while following the guidance.`,
            textContext,
            selectionInfo,
            customInput
          );
        } else if (parameter && parameter !== 'custom') {
          switch (parameter) {
            case 'simpler':
              systemPrompt = createToolBasedPrompt(
                `Rewrite the text using simpler language, shorter sentences, and clearer structure. Make it accessible to a broader audience while preserving all key information.`,
                textContext,
                selectionInfo
              );
              break;
            case 'formal':
              systemPrompt = createToolBasedPrompt(
                `Rewrite the text in a more formal, professional tone suitable for business or academic contexts. Use sophisticated vocabulary and formal structure.`,
                textContext,
                selectionInfo
              );
              break;
            case 'engaging':
              systemPrompt = createToolBasedPrompt(
                `Rewrite the text to be more engaging, compelling, and interesting. Use vivid language, varied sentence structure, and techniques that capture reader attention.`,
                textContext,
                selectionInfo
              );
              break;
            case 'different-angle':
              systemPrompt = createToolBasedPrompt(
                `Rewrite the text from a completely different angle or viewpoint while preserving the core information. Change the approach, structure, or perspective to offer fresh insights.`,
                textContext,
                selectionInfo
              );
              break;
            default:
              systemPrompt = createToolBasedPrompt(
                `Completely rewrite the text in a fresh way while preserving all the key information and overall message. Change sentence structures, word choices, and flow, but keep the meaning intact.`,
                textContext,
                selectionInfo
              );
          }
        } else {
          systemPrompt = createToolBasedPrompt(
            `Completely rewrite the text in a fresh way while preserving all the key information and overall message. Based on the content's ${context.tone} tone, make it more ${context.complexity === 'complex' ? 'accessible' : 'sophisticated'} while keeping the meaning intact.`,
            textContext,
            selectionInfo
          );
        }
        userPrompt = `Rewrite this content:\n\n${textContext}`;
        break;


        
      case 'suggest':
        const suggestInstruction = customInput
          ? `Based on the given text, suggest new ideas, angles, or directions following this guidance: ${customInput}. Format as numbered suggestions with brief explanations.`
          : `Based on the given text, suggest 3-5 new related ideas, angles, or directions the writer could explore next. Format these as numbered suggestions with a brief explanation of each. Be specific and insightful.`;
        
        systemPrompt = createToolBasedPrompt(
          suggestInstruction,
          textContext,
          selectionInfo,
          customInput
        );
        userPrompt = `Generate ideas based on this content:\n\n${content}`;
        break;

      case 'outline':
        const outlineInstruction = customInput
          ? `Create an outline from the content following this guidance: ${customInput}`
          : `Create a comprehensive, well-structured outline from the content. Use hierarchical headings (I, II, III with A, B, C subpoints) to organize the main ideas and supporting points. Make it suitable for planning or restructuring the content.`;
        
        systemPrompt = createToolBasedPrompt(
          outlineInstruction,
          textContext,
          selectionInfo,
          customInput
        );
        userPrompt = `Create an outline from this content:\n\n${textContext}`;
        break;

      case 'format':
        const formatInstruction = customInput
          ? `Improve the structure and formatting of the text following this guidance: ${customInput}`
          : `Improve the structure and formatting of the text. Add appropriate headings, subheadings, bullet points, numbered lists, and paragraph breaks to make the content more readable and professionally presented. Maintain all content while enhancing its visual organization.`;
        
        systemPrompt = createToolBasedPrompt(
          formatInstruction,
          textContext,
          selectionInfo,
          customInput
        );
        userPrompt = `Improve formatting of this content:\n\n${textContext}`;
        break;
        
      case 'tone':
        if (customInput) {
          systemPrompt = createToolBasedPrompt(
            `Rewrite the text to match this specific tone: ${customInput}. Adjust formality, warmth, authority, and other tone aspects while preserving the core message.`,
            textContext,
            selectionInfo,
            customInput
          );
        } else if (parameter && parameter !== 'custom') {
          switch (parameter) {
            case 'professional':
              systemPrompt = createToolBasedPrompt(
                `Rewrite the text in a professional, business-appropriate tone. Use formal language, clear structure, and authoritative voice suitable for workplace communication.`,
                textContext,
                selectionInfo
              );
              break;
            case 'casual':
              systemPrompt = createToolBasedPrompt(
                `Rewrite the text in a casual, friendly tone as if speaking to a friend. Use conversational language, contractions, and a relaxed approach while maintaining clarity.`,
                textContext,
                selectionInfo
              );
              break;
            case 'academic':
              systemPrompt = createToolBasedPrompt(
                `Rewrite the text in a scholarly, academic tone. Use formal vocabulary, precise language, and analytical approach suitable for academic or research contexts.`,
                textContext,
                selectionInfo
              );
              break;
            case 'friendly':
              systemPrompt = createToolBasedPrompt(
                `Rewrite the text in a friendly, approachable tone. Use warm language, inclusive expressions, and a welcoming voice that builds connection with readers.`,
                textContext,
                selectionInfo
              );
              break;
            case 'authoritative':
              systemPrompt = createToolBasedPrompt(
                `Rewrite the text with confidence and authority. Use decisive language, strong statements, and expert positioning to establish credibility and leadership.`,
                textContext,
                selectionInfo
              );
              break;
            default:
              systemPrompt = createToolBasedPrompt(
                `Rewrite the text to improve its tone, making it more professional, engaging, and appropriate for the apparent context. Adjust formality, warmth, authority, and other tone aspects while preserving the core message.`,
                textContext,
                selectionInfo
              );
          }
        } else {
          const suggestedTone = context.tone === 'casual' ? 'more professional' :
                              context.tone === 'formal' ? 'more approachable' : 'more engaging';
          systemPrompt = createToolBasedPrompt(
            `Rewrite the text to make it ${suggestedTone} while preserving the core message. Adjust formality, warmth, and authority as appropriate.`,
            textContext,
            selectionInfo
          );
        }
        userPrompt = `Adjust tone of this content:\n\n${textContext}`;
        break;
        
      case 'fix':
        const fixInstruction = customInput
          ? `Fix any issues in the text focusing on: ${customInput}. Make minimal changes necessary to address the specified concerns.`
          : `Fix any grammatical errors, spelling mistakes, punctuation problems, or clarity issues in the text. Make minimal changes necessary to ensure correctness and readability. Focus only on errors, not style preferences.`;
        
        systemPrompt = createToolBasedPrompt(
          fixInstruction,
          textContext,
          selectionInfo,
          customInput
        );
        userPrompt = `Fix grammar and spelling in this content:\n\n${textContext}`;
        break;

      case 'translate':
        if (customInput) {
          systemPrompt = createToolBasedPrompt(
            `Translate the text according to this guidance: ${customInput}. Maintain the original meaning, tone, and style while ensuring the translation sounds natural.`,
            textContext,
            selectionInfo,
            customInput
          );
        } else if (parameter && parameter !== 'custom' && parameter !== 'other') {
          systemPrompt = createToolBasedPrompt(
            `Translate the text accurately into ${parameter}. Maintain the original meaning, tone, and style while ensuring the translation sounds natural in the target language.`,
            textContext,
            selectionInfo
          );
        } else {
          systemPrompt = createToolBasedPrompt(
            `Translate the text into Spanish (or ask the user to specify a language if the intent is unclear). Maintain the original meaning, tone, and style while ensuring the translation sounds natural.`,
            textContext,
            selectionInfo
          );
        }
        userPrompt = `Translate this content:\n\n${textContext}`;
        break;
        
      case 'analyze':
        const analyzeInstruction = customInput
          ? `Provide a detailed analysis of the text focusing on: ${customInput}. Be specific and actionable in your analysis.`
          : `Provide a detailed analysis of the text covering:
        
1. **Readability**: Grade level, sentence complexity, accessibility
2. **Style**: Tone, formality level, voice consistency  
3. **Structure**: Organization, flow, logical progression
4. **Vocabulary**: Word choice, variety, precision
5. **Engagement**: Reader interest, clarity, impact
6. **Suggestions**: Top 3 specific improvements

Format your analysis clearly with headers and bullet points. Be specific and actionable.`;
        
        systemPrompt = createToolBasedPrompt(
          analyzeInstruction,
          textContext,
          selectionInfo,
          customInput
        );
        userPrompt = `Analyze this content:\n\n${textContext}`;
        break;

      case 'research':
        if (customInput) {
          // For research commands, the custom input becomes the search query
          // This would need integration with your research functionality
          systemPrompt = `Research the following topic: ${customInput}. Provide comprehensive information with reliable sources.`;
          userPrompt = `Research query: ${customInput}`;
        } else {
          return {
            ...defaultResponse,
            message: "Please specify what topic to research."
          };
        }
        break;
        
      default:
        return defaultResponse;
    }
    
    // Add style context if available
    if (style && Object.keys(style).length > 0) {
      systemPrompt += `\n\nStyle information: ${JSON.stringify(style)}`;
    }
    
    // NEW: Add enhanced context information if available
    if (enhancedContext) {
      systemPrompt += `\n\nEnhanced Context: Style analysis completed with ${enhancedContext.styleAnalysis.tone} tone, ${enhancedContext.styleAnalysis.formality} formality, and ${enhancedContext.styleAnalysis.complexity} complexity.`;
    }
    
    // Make the API call based on provider
    let generatedText = "";
    
    if (llmProvider === 'ollama') {
      // Use Ollama
      if (!modelToUse) {
        throw new Error("Ollama model name is required");
      }
      generatedText = await callOllama(modelToUse, systemPrompt, userPrompt);
    } else {
      // Use OpenAI
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
    
    // Determine the correct edit strategy based on command semantics
    const action = customInput ? `${baseCommand} (custom)` : 
                  parameter && parameter !== 'custom' ? `${baseCommand} (${parameter})` : baseCommand;
    
    // APPEND commands: Add content at cursor position or end of document
    if (['continue', 'expand'].includes(baseCommand)) {
              let message = '';
        if (baseCommand === 'expand') {
          message = `Expanded your content with additional detail.`;
        } else {
          message = `Extended your writing with new content.`;
        }
      
      return {
        result: generatedText,
        message,
        replaceSelection: false,
        replaceEntireContent: false,
        appendToContent: true
      };
    }
    
    // CONTEXT-ONLY commands: Show only in context panel, don't modify document
    if (['suggest', 'analyze'].includes(baseCommand)) {
      let message = '';
      if (baseCommand === 'suggest') {
        message = customInput 
          ? `Generated targeted ideas based on your guidance.`
          : `Generated new ideas based on your content.`;
      } else if (baseCommand === 'analyze') {
        message = customInput
          ? `Generated focused analysis based on your criteria.`
          : `Generated detailed style analysis of your content.`;
      }
      
      return {
        result: generatedText,
        message,
        replaceSelection: false,
        replaceEntireContent: false,
        appendToContent: false,
        contextOnly: true // Special flag for context-only commands
      };
    }
    
    // INSERT commands: Insert at cursor position (or append if no cursor position)
    if (['summarize', 'list', 'outline'].includes(baseCommand)) {
      return {
        result: generatedText,
        message: `Generated ${baseCommand} and inserted at cursor position.`,
        replaceSelection: false,
        replaceEntireContent: false,
        appendToContent: false,
        insertAtCursor: true // Special flag for cursor insertion
      };
    }
    
    // SELECTION-ONLY commands: Only work on selected text, require selection
    if (['improve', 'fix', 'tone', 'rewrite', 'translate', 'format'].includes(baseCommand)) {
      if (selectionInfo.selectedText) {
        return {
          result: generatedText,
          message: `Applied ${action} to the selected text.`,
          replaceSelection: true,
          replaceEntireContent: false,
          appendToContent: false
        };
      } else {
        // For these commands, if no selection, work on entire document but warn user
        return {
          result: generatedText,
          message: `Applied ${action} to the entire document (no text was selected).`,
          replaceSelection: false,
          replaceEntireContent: true,
          appendToContent: false
        };
      }
    }
    

    
    // DEFAULT: Replace selection if available, otherwise entire content
    if (selectionInfo.selectedText) {
      return {
        result: generatedText,
        message: `Applied ${action} to the selected text.`,
        replaceSelection: true,
        replaceEntireContent: false,
        appendToContent: false
      };
    } else {
      return {
        result: generatedText,
        message: `Applied ${action} to your text.`,
        replaceSelection: false,
        replaceEntireContent: true,
        appendToContent: false
      };
    }
  } catch (error: any) {
    console.error(`Error executing slash command ${command}:`, error);
    return {
      ...defaultResponse,
      message: `Error executing ${baseCommand}: ${error.message || "Unknown error"}`
    };
  }
}