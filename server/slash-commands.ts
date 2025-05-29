import OpenAI from "openai";
import { DEFAULT_MODEL } from "./openai";

// Call Ollama API directly
async function callOllama(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  try {
    // Combine system and user prompts for Ollama
    const fullPrompt = `${systemPrompt}\n\nUser: ${userPrompt}\n\nAssistant:`;
    
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        model, 
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9
        }
      })
    });
    
    if (!res.ok) {
      throw new Error(`Ollama server error: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    if (!data.response) {
      throw new Error('No response from Ollama server');
    }
    
    return data.response.trim();
  } catch (err: any) {
    console.error("Ollama fetch error:", err);
    throw new Error(`Ollama error: ${err.message}`);
  }
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
}> {
  // Use the provided LLM provider and model, or default to OpenAI
  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY || "default_key" 
  });
  
  // Determine which model to use based on provider
  const modelToUse = llmProvider === 'openai' ? (llmModel || DEFAULT_MODEL) : llmModel;
  
  // The context is either the selected text (if any) or the entire content
  const context = selectionInfo.selectedText || content;
  
  // Default response
  let defaultResponse = {
    result: selectionInfo.selectedText || "",
    message: "Could not process the command.",
    replaceSelection: Boolean(selectionInfo.selectedText),
    replaceEntireContent: false
  };
  
  // Determine which command to execute
  try {
    let systemPrompt = "";
    let userPrompt = "";
    
    switch (command) {
      case 'continue':
        systemPrompt = `You are an AI writing assistant. Continue the text in a seamless way 
        that matches the style and content of what came before. Be creative, coherent, and maintain
        the same voice and tone. Write at least one substantial paragraph that advances the ideas.`;
        userPrompt = content;
        break;
        
      case 'improve':
        systemPrompt = `You are an expert editor. Improve the writing while maintaining the core message.
        Enhance clarity, flow, and readability. Fix any grammatical issues, awkward phrasing,
        or structural problems. Make it more compelling while preserving the writer's voice.`;
        userPrompt = context;
        break;
        
      case 'summarize':
        systemPrompt = `You are a master of concise communication. Create a clear, comprehensive summary
        of the text that captures all key points in about 1/3 the length of the original. 
        Focus on the main ideas and eliminate redundancy while keeping the essence intact.`;
        userPrompt = context;
        break;
        
      case 'expand':
        systemPrompt = `You are an expert writer who excels at elaboration. Expand upon the given text
        by adding more detail, examples, evidence, or context. Develop the ideas more fully while
        maintaining coherence with the original content. Add at least twice as much content.`;
        userPrompt = context;
        break;
        
      case 'list':
        systemPrompt = `You are an organizational expert. Transform the content into a well-structured
        list format with clear headings and bullet points. Maintain all important information
        but reorganize it for easier reading and reference. Add appropriate introductory text.`;
        userPrompt = context;
        break;
        
      case 'rewrite':
        systemPrompt = `You are a versatile writer. Completely rewrite the text in a fresh way while
        preserving all the key information and overall message. Change sentence structures,
        word choices, and flow, but keep the meaning intact. Make it feel new but familiar.`;
        userPrompt = context;
        break;
        
      case 'suggest':
        systemPrompt = `You are a creative idea generator. Based on the given text, suggest 3-5 new
        related ideas, angles, or directions the writer could explore next. Format these as
        numbered suggestions with a brief explanation of each. Be specific and insightful.`;
        userPrompt = content;
        break;
        
      case 'tone':
        systemPrompt = `You are a tone specialist. Rewrite the text to improve its tone, making it more
        professional, engaging, and appropriate for the apparent context. Adjust formality,
        warmth, authority, and other tone aspects while preserving the core message.`;
        userPrompt = context;
        break;
        
      case 'fix':
        systemPrompt = `You are a grammar and clarity expert. Fix any grammatical errors, spelling mistakes,
        punctuation problems, or clarity issues in the text. Make minimal changes necessary to
        ensure correctness and readability. Focus only on errors, not style preferences.`;
        userPrompt = context;
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
    const replaceEntireContent = command === 'continue' || command === 'list' || 
                                command === 'suggest' || 
                                (!selectionInfo.selectedText && 
                                 (command === 'summarize' || command === 'improve'));
    
    if (replaceEntireContent) {
      // For commands like continue, we want to add to the existing content
      if (command === 'continue') {
        return {
          result: generatedText,
          message: `Extended your writing with new content.`,
          replaceSelection: false,
          replaceEntireContent: false // We'll handle this special case separately
        };
      } else if (command === 'suggest') {
        return {
          result: generatedText,
          message: `Generated new ideas based on your content.`,
          replaceSelection: false,
          replaceEntireContent: false // We'll handle this special case separately
        };
      } else {
        return {
          result: generatedText,
          message: `Applied ${command} to your text.`,
          replaceSelection: false,
          replaceEntireContent: true
        };
      }
    } else {
      // For commands operating on selections
      return {
        result: generatedText,
        message: `Applied ${command} to the selected text.`,
        replaceSelection: true,
        replaceEntireContent: false
      };
    }
  } catch (error: any) {
    console.error(`Error executing slash command ${command}:`, error);
    return {
      ...defaultResponse,
      message: `Error executing ${command}: ${error.message || "Unknown error"}`
    };
  }
}