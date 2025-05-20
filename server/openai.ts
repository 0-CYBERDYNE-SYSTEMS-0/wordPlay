import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const DEFAULT_MODEL = "gpt-4o";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "default_key" 
});

// Generate text based on the current content and user's writing style
export async function generateTextCompletion(
  content: string,
  style: any,
  prompt: string = "Continue this text in the same style."
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an AI writing assistant that helps users create high-quality content. 
          You should adapt to their writing style and preferences.
          Style analysis: ${JSON.stringify(style)}
          Your task is to generate text that continues or expands the provided content while maintaining the same style, tone, and complexity.`
        },
        {
          role: "user",
          content: `${content}\n\n${prompt}`
        }
      ],
      max_tokens: 500,
    });

    return response.choices[0].message.content || "";
  } catch (error: any) {
    console.error("Error generating text completion:", error.message);
    throw new Error("Failed to generate text: " + error.message);
  }
}

// Analyze the text style
export async function analyzeTextStyle(text: string): Promise<{
  formality: number;
  complexity: number;
  engagement: number;
  tone: string;
  averageSentenceLength: number;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: 
            "You are a text analysis expert. Analyze the given text and evaluate its style metrics. Respond with a JSON object containing these metrics: formality (0-1), complexity (0-1), engagement (0-1), tone (descriptive string), and averageSentenceLength (number)."
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      formality: parseFloat(result.formality) || 0.5,
      complexity: parseFloat(result.complexity) || 0.5,
      engagement: parseFloat(result.engagement) || 0.5,
      tone: result.tone || "Neutral",
      averageSentenceLength: parseInt(result.averageSentenceLength) || 15
    };
  } catch (error: any) {
    console.error("Error analyzing text style:", error.message);
    return {
      formality: 0.5,
      complexity: 0.5,
      engagement: 0.5,
      tone: "Neutral",
      averageSentenceLength: 15
    };
  }
}

// Generate suggestions based on document context
export async function generateSuggestions(
  content: string,
  style: any
): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
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
      response_format: { type: "json_object" }
    });

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
  command: string
): Promise<{ result: string; message: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an AI assistant that processes text manipulation commands similar to grep and sed.
          You will receive a document and a command. Parse the command and perform the requested operation on the text.
          Common commands include:
          - grep 'pattern': Find and return all instances of a pattern
          - replace 'old' 'new': Replace all instances of 'old' with 'new'
          - style analyze: Analyze the writing style
          - format paragraph: Improve formatting and readability
          
          Return a JSON object with two fields:
          - result: The resulting text after applying the command
          - message: A description of the changes made`
        },
        {
          role: "user",
          content: `Document:\n${content}\n\nCommand: ${command}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{"result":"","message":""}');
    
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
  title: string
): Promise<{ message: string; suggestions: string[] }> {
  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an AI writing assistant that provides contextual help to users based on their current document.
          Analyze the document content and title, then suggest 3 specific and helpful actions the user might want to take.
          Return a JSON object with:
          - message: A helpful message based on what the user is writing
          - suggestions: An array of 3 specific action items`
        },
        {
          role: "user",
          content: `Title: ${title}\n\nContent: ${content}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{"message":"","suggestions":[]}');
    
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
