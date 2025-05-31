import OpenAI from "openai";

// UPDATED: Fixed expand command to append instead of replace
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

// Define the AI commands handlers for each slash command type
export async function executeSlashCommand(
  command: string,
  content: string,
  selectionInfo: {
    selectedText: string;
    selectionStart: number;
    selectionEnd: number;
    beforeSelection: string;
    afterSelection: string;
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
    
    switch (baseCommand) {
      case 'continue':
        systemPrompt = `You are an AI writing assistant. Continue the text in a seamless way 
        that matches the style and content of what came before. Be creative, coherent, and maintain
        the same voice and tone. Write at least one substantial paragraph that advances the ideas.`;
        userPrompt = content;
        break;
        
      case 'improve':
        if (parameter) {
          switch (parameter) {
            case 'clarity':
              systemPrompt = `You are an expert editor focused on clarity. Rewrite the text to make it clearer and easier to understand. Eliminate ambiguity, simplify complex sentences, and ensure every idea is expressed precisely.`;
              break;
            case 'engagement':
              systemPrompt = `You are an expert editor focused on engagement. Rewrite the text to make it more compelling, interesting, and engaging for readers. Add vivid language, vary sentence structure, and create stronger hooks.`;
              break;
            case 'flow':
              systemPrompt = `You are an expert editor focused on flow and structure. Rewrite the text to improve logical flow, smooth transitions between ideas, and overall coherence. Ensure ideas build naturally from one to the next.`;
              break;
            case 'word-choice':
              systemPrompt = `You are an expert editor focused on word choice and style. Rewrite the text using more precise, elegant, and impactful vocabulary. Replace weak words with stronger alternatives while maintaining the original meaning.`;
              break;
            default:
              systemPrompt = `You are an expert editor. Improve the writing while maintaining the core message. Based on the content's ${context.complexity} complexity and ${context.tone} tone, enhance clarity, flow, and readability. Fix any grammatical issues, awkward phrasing, or structural problems.`;
          }
        } else {
          // Smart default based on content analysis
          systemPrompt = `You are an expert editor. Improve the writing while maintaining the core message. Based on the content's ${context.complexity} complexity and ${context.tone} tone, enhance clarity, flow, and readability. Fix any grammatical issues, awkward phrasing, or structural problems.`;
        }
        userPrompt = textContext;
        break;
        
      case 'summarize':
        const summaryLength = context.length === 'short' ? '2-3 sentences' : 
                            context.length === 'medium' ? '1 paragraph' : '2-3 paragraphs';
        systemPrompt = `You are a master of concise communication. Create a clear, comprehensive summary
        of the text in approximately ${summaryLength}. Capture all key points while eliminating redundancy 
        and maintaining the essence intact.`;
        userPrompt = textContext;
        break;
        
      case 'expand':
        if (parameter) {
          switch (parameter) {
            case 'examples':
              systemPrompt = `You are an expert writer who excels at illustration. Generate additional content with concrete examples, case studies, or real-world illustrations that support and clarify the main points from the given text. The new content should be written to ADD TO the existing text, not replace it. Write it so it flows naturally after the original content.`;
              break;
            case 'detail':
              systemPrompt = `You are an expert writer who excels at elaboration. Generate additional content with more specific details, explanations, and depth that expands on the given text. The new content should be written to ADD TO the existing text, not replace it. Write it so it flows naturally after the original content.`;
              break;
            case 'context':
              systemPrompt = `You are an expert writer who excels at contextualization. Generate additional content with background information, historical context, or broader implications that expands on the given text. The new content should be written to ADD TO the existing text, not replace it. Write it so it flows naturally after the original content.`;
              break;
            case 'analysis':
              systemPrompt = `You are an expert analyst and writer. Generate additional content with deeper analysis, critical thinking, implications, and connections that expand on the ideas in the given text. The new content should be written to ADD TO the existing text, not replace it. Write it so it flows naturally after the original content.`;
              break;
            default:
              systemPrompt = `You are an expert writer who excels at elaboration. Generate additional content that expands upon the given text by adding more detail, examples, evidence, or context. The new content should be written to ADD TO the existing text, not replace it. Write it so it flows naturally after the original content and develops the ideas more fully.`;
          }
        } else {
          // Smart default based on content analysis
          const expandStyle = context.tone === 'academic' ? 'analysis and evidence' :
                            context.complexity === 'simple' ? 'examples and details' : 'context and depth';
          systemPrompt = `You are an expert writer who excels at elaboration. Generate additional content that expands upon the given text by adding ${expandStyle}. The new content should be written to ADD TO the existing text, not replace it. Write it so it flows naturally after the original content and develops the ideas more fully.`;
        }
        userPrompt = textContext;
        break;
        
      case 'list':
        systemPrompt = `You are an organizational expert. Transform the content into a well-structured
        list format with clear headings and bullet points. Maintain all important information
        but reorganize it for easier reading and reference. Add appropriate introductory text.`;
        userPrompt = textContext;
        break;

      case 'rewrite':
        if (parameter) {
          switch (parameter) {
            case 'simpler':
              systemPrompt = `You are a clarity specialist. Rewrite the text using simpler language, shorter sentences, and clearer structure. Make it accessible to a broader audience while preserving all key information.`;
              break;
            case 'formal':
              systemPrompt = `You are a professional writing expert. Rewrite the text in a more formal, professional tone suitable for business or academic contexts. Use sophisticated vocabulary and formal structure.`;
              break;
            case 'engaging':
              systemPrompt = `You are a creative writing expert. Rewrite the text to be more engaging, compelling, and interesting. Use vivid language, varied sentence structure, and techniques that capture reader attention.`;
              break;
            case 'different-angle':
              systemPrompt = `You are a creative perspective specialist. Rewrite the text from a completely different angle or viewpoint while preserving the core information. Change the approach, structure, or perspective to offer fresh insights.`;
              break;
            default:
              systemPrompt = `You are a versatile writer. Completely rewrite the text in a fresh way while preserving all the key information and overall message. Change sentence structures, word choices, and flow, but keep the meaning intact.`;
          }
        } else {
          // Smart default based on content analysis
          systemPrompt = `You are a versatile writer. Completely rewrite the text in a fresh way while preserving all the key information and overall message. Based on the content's ${context.tone} tone, make it more ${context.complexity === 'complex' ? 'accessible' : 'sophisticated'} while keeping the meaning intact.`;
        }
        userPrompt = textContext;
        break;

      case 'simplify':
        systemPrompt = `You are a clarity specialist. Simplify the text to make it easier to understand for a general audience. Use simpler vocabulary, shorter sentences, and clearer explanations. Break down complex concepts into digestible parts while preserving all important information.`;
        userPrompt = textContext;
        break;
        
      case 'suggest':
        systemPrompt = `You are a creative idea generator. Based on the given text, suggest 3-5 new
        related ideas, angles, or directions the writer could explore next. Format these as
        numbered suggestions with a brief explanation of each. Be specific and insightful.`;
        userPrompt = content;
        break;

      case 'outline':
        systemPrompt = `You are an organizational expert. Create a comprehensive, well-structured outline from the content. Use hierarchical headings (I, II, III with A, B, C subpoints) to organize the main ideas and supporting points. Make it suitable for planning or restructuring the content.`;
        userPrompt = textContext;
        break;

      case 'format':
        systemPrompt = `You are a formatting specialist. Improve the structure and formatting of the text. Add appropriate headings, subheadings, bullet points, numbered lists, and paragraph breaks to make the content more readable and professionally presented. Maintain all content while enhancing its visual organization.`;
        userPrompt = textContext;
        break;
        
      case 'tone':
        if (parameter) {
          switch (parameter) {
            case 'professional':
              systemPrompt = `You are a business writing expert. Rewrite the text in a professional, business-appropriate tone. Use formal language, clear structure, and authoritative voice suitable for workplace communication.`;
              break;
            case 'casual':
              systemPrompt = `You are a conversational writing expert. Rewrite the text in a casual, friendly tone as if speaking to a friend. Use conversational language, contractions, and a relaxed approach while maintaining clarity.`;
              break;
            case 'academic':
              systemPrompt = `You are an academic writing expert. Rewrite the text in a scholarly, academic tone. Use formal vocabulary, precise language, and analytical approach suitable for academic or research contexts.`;
              break;
            case 'friendly':
              systemPrompt = `You are a warm communication expert. Rewrite the text in a friendly, approachable tone. Use warm language, inclusive expressions, and a welcoming voice that builds connection with readers.`;
              break;
            case 'authoritative':
              systemPrompt = `You are an expert in authoritative communication. Rewrite the text with confidence and authority. Use decisive language, strong statements, and expert positioning to establish credibility and leadership.`;
              break;
            default:
              systemPrompt = `You are a tone specialist. Rewrite the text to improve its tone, making it more professional, engaging, and appropriate for the apparent context. Adjust formality, warmth, authority, and other tone aspects while preserving the core message.`;
          }
        } else {
          // Smart default based on content analysis
          const suggestedTone = context.tone === 'casual' ? 'more professional' :
                              context.tone === 'formal' ? 'more approachable' : 'more engaging';
          systemPrompt = `You are a tone specialist. Rewrite the text to make it ${suggestedTone} while preserving the core message. Adjust formality, warmth, and authority as appropriate.`;
        }
        userPrompt = textContext;
        break;
        
      case 'fix':
        systemPrompt = `You are a grammar and clarity expert. Fix any grammatical errors, spelling mistakes,
        punctuation problems, or clarity issues in the text. Make minimal changes necessary to
        ensure correctness and readability. Focus only on errors, not style preferences.`;
        userPrompt = textContext;
        break;

      case 'translate':
        if (parameter && parameter !== 'other') {
          systemPrompt = `You are a professional translator. Translate the text accurately into ${parameter}. Maintain the original meaning, tone, and style while ensuring the translation sounds natural in the target language.`;
        } else {
          systemPrompt = `You are a professional translator. Translate the text into Spanish (or ask the user to specify a language if the intent is unclear). Maintain the original meaning, tone, and style while ensuring the translation sounds natural.`;
        }
        userPrompt = textContext;
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
        max_tokens: 1000,
      });
      
      generatedText = response.choices[0].message.content?.trim() || "";
    }
    
    // Determine if we should replace the entire content or just the selection
    const replaceEntireContent = ['list', 'suggest', 'outline', 'format'].includes(baseCommand) || 
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
      // For other commands that replace entire content
      if (baseCommand === 'suggest') {
        return {
          result: generatedText,
          message: `Generated new ideas based on your content.`,
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