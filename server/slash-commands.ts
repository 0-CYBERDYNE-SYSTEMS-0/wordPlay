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

// Helper function to parse command parameters
function parseCommand(command: string): { baseCommand: string; parameter?: string } {
  const parts = command.split(':');
  return {
    baseCommand: parts[0],
    parameter: parts[1]
  };
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

// Helper function to create system prompts that leverage existing text processing tools
function createToolBasedPrompt(instruction: string, textContext: string, selectionInfo: any): string {
  const hasSelection = Boolean(selectionInfo.selectedText);
  const operationType = hasSelection ? 'selection' : 'document';
  
  return `You are an expert writing assistant with access to powerful text processing tools like grep and sed.

TASK: ${instruction}

TARGET: ${operationType} (${hasSelection ? selectionInfo.selectedText.length + ' characters selected' : 'entire document'})

EXISTING TEXT PROCESSING CAPABILITIES:
- Use existing grep/sed-like tools for precise text replacement
- Apply surgical edits without affecting surrounding content  
- Maintain document structure and formatting
- Focus on minimal, targeted changes

${hasSelection ? `SELECTED TEXT: "${selectionInfo.selectedText}"` : `DOCUMENT CONTEXT: "${textContext.substring(0, 500)}..."`}

Provide a clear, improved version that applies only the necessary changes. For surgical edits, identify specific patterns to find and replace rather than rewriting entire sections.`;
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
  llmModel: string = DEFAULT_MODEL
): Promise<{
  result: string;
  message: string;
  replaceSelection?: boolean;
  replaceEntireContent?: boolean;
  appendToContent?: boolean;
}> {
  // Parse command and parameter
  const { baseCommand, parameter } = parseCommand(command);
  
  // Analyze content for smart defaults
  const context = analyzeContentContext(content, selectionInfo);
  
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
    
    console.log(`Executing slash command: ${baseCommand}`);
    
    switch (baseCommand) {
      case 'continue':
        systemPrompt = createToolBasedPrompt(
          `Continue the text in a seamless way that matches the style and content of what came before. Be creative, coherent, and maintain the same voice and tone. Write at least one substantial paragraph that advances the ideas.`,
          textContext,
          selectionInfo
        );
        userPrompt = `Continue this content:\n\n${content}`;
        break;
        
      case 'improve':
        if (parameter) {
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
        systemPrompt = createToolBasedPrompt(
          `You are a master of concise communication. Create a clear, comprehensive summary of the text in approximately ${summaryLength}. Capture all key points while eliminating redundancy and maintaining the essence intact.`,
          textContext,
          selectionInfo
        );
        userPrompt = `Summarize this text:\n\n${textContext}`;
        break;
        
      case 'expand':
        if (parameter) {
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
        systemPrompt = createToolBasedPrompt(
          `Transform the content into a well-structured list format with clear headings and bullet points. Maintain all important information but reorganize it for easier reading and reference. Add appropriate introductory text.`,
          textContext,
          selectionInfo
        );
        userPrompt = `Transform this content into a list:\n\n${textContext}`;
        break;

      case 'rewrite':
        if (parameter) {
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

      case 'simplify':
        systemPrompt = createToolBasedPrompt(
          `Simplify the text to make it easier to understand for a general audience. Use simpler vocabulary, shorter sentences, and clearer explanations. Break down complex concepts into digestible parts while preserving all important information.`,
          textContext,
          selectionInfo
        );
        userPrompt = `Simplify this content:\n\n${textContext}`;
        break;
        
      case 'suggest':
        systemPrompt = createToolBasedPrompt(
          `Based on the given text, suggest 3-5 new related ideas, angles, or directions the writer could explore next. Format these as numbered suggestions with a brief explanation of each. Be specific and insightful.`,
          textContext,
          selectionInfo
        );
        userPrompt = `Generate ideas based on this content:\n\n${content}`;
        break;

      case 'outline':
        systemPrompt = createToolBasedPrompt(
          `Create a comprehensive, well-structured outline from the content. Use hierarchical headings (I, II, III with A, B, C subpoints) to organize the main ideas and supporting points. Make it suitable for planning or restructuring the content.`,
          textContext,
          selectionInfo
        );
        userPrompt = `Create an outline from this content:\n\n${textContext}`;
        break;

      case 'format':
        systemPrompt = createToolBasedPrompt(
          `Improve the structure and formatting of the text. Add appropriate headings, subheadings, bullet points, numbered lists, and paragraph breaks to make the content more readable and professionally presented. Maintain all content while enhancing its visual organization.`,
          textContext,
          selectionInfo
        );
        userPrompt = `Improve formatting of this content:\n\n${textContext}`;
        break;
        
      case 'tone':
        if (parameter) {
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
        systemPrompt = createToolBasedPrompt(
          `Fix any grammatical errors, spelling mistakes, punctuation problems, or clarity issues in the text. Make minimal changes necessary to ensure correctness and readability. Focus only on errors, not style preferences.`,
          textContext,
          selectionInfo
        );
        userPrompt = `Fix grammar and spelling in this content:\n\n${textContext}`;
        break;

      case 'translate':
        if (parameter && parameter !== 'other') {
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
        systemPrompt = createToolBasedPrompt(
          `Provide a detailed analysis of the text covering:
        
1. **Readability**: Grade level, sentence complexity, accessibility
2. **Style**: Tone, formality level, voice consistency  
3. **Structure**: Organization, flow, logical progression
4. **Vocabulary**: Word choice, variety, precision
5. **Engagement**: Reader interest, clarity, impact
6. **Suggestions**: Top 3 specific improvements

Format your analysis clearly with headers and bullet points. Be specific and actionable.`,
          textContext,
          selectionInfo
        );
        userPrompt = `Analyze this content:\n\n${textContext}`;
        break;
        
      default:
        return defaultResponse;
    }
    
    // Add style context if available
    if (style && Object.keys(style).length > 0) {
      systemPrompt += `\n\nStyle information: ${JSON.stringify(style)}`;
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
    
    // Determine if we should replace the entire content or just the selection
    const replaceEntireContent = ['list', 'suggest', 'outline', 'format', 'analyze'].includes(baseCommand) || 
                                (!selectionInfo.selectedText && 
                                 ['summarize', 'improve'].includes(baseCommand));
    
    // Handle append operations first (expand and continue)
    if (baseCommand === 'expand' || baseCommand === 'continue') {
      const action = parameter ? `${baseCommand} (${parameter})` : baseCommand;
      return {
        result: generatedText,
        message: baseCommand === 'expand' 
          ? `Expanded your content with additional ${parameter || 'information'}.`
          : `Extended your writing with new content.`,
        replaceSelection: false,
        replaceEntireContent: false,
        appendToContent: true
      };
    }
    
    if (replaceEntireContent) {
      // For commands that should be handled as suggestions/insights
      if (baseCommand === 'suggest') {
        return {
          result: generatedText,
          message: `Generated new ideas based on your content.`,
          replaceSelection: false,
          replaceEntireContent: false // We'll handle this special case separately
        };
      } else if (baseCommand === 'analyze') {
        return {
          result: generatedText,
          message: `Generated detailed style analysis of your content.`,
          replaceSelection: false,
          replaceEntireContent: false // We'll handle this special case separately
        };
      } else {
        const action = parameter ? `${baseCommand} (${parameter})` : baseCommand;
        return {
          result: generatedText,
          message: `Applied ${action} to your text.`,
          replaceSelection: false,
          replaceEntireContent: true
        };
      }
    } else {
      // For commands operating on selections
      const action = parameter ? `${baseCommand} (${parameter})` : baseCommand;
      return {
        result: generatedText,
        message: `Applied ${action} to the selected text.`,
        replaceSelection: true,
        replaceEntireContent: false
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