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

// Analyze the text style in greater detail
export async function analyzeTextStyle(text: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: 
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
            
            For short text, make appropriate estimates based on the available content.`
        },
        {
          role: "user",
          content: text || "Sample text for analysis."
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
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
