// Helper functions for document processing

// Count words in a text
export function countWords(text: string): number {
  return text.split(/\s+/).filter(s => s.length > 0).length;
}

// Calculate reading time in minutes
export function calculateReadingTime(text: string): number {
  const words = countWords(text);
  // Average reading speed is 225 words per minute
  return Math.ceil(words / 225);
}

// Split text into paragraphs
export function getParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
}

// Extract document structure for outline view
export function extractStructure(text: string): { 
  title: string; 
  paragraphs: { id: number; text: string; type: string }[] 
} {
  const paragraphs = getParagraphs(text);
  let title = "Untitled Document";
  
  const structuredParagraphs = paragraphs.map((text, index) => {
    let type = "paragraph";
    
    // Check if the paragraph looks like a heading
    if (text.trim().length < 100 && (index === 0 || text.trim().endsWith(":"))) {
      type = "heading";
      // If it's the first paragraph and looks like a heading, use as title
      if (index === 0) {
        title = text.trim();
      }
    }
    
    return {
      id: index,
      text: text.trim(),
      type
    };
  });
  
  return {
    title,
    paragraphs: structuredParagraphs
  };
}

// Generate a short preview/snippet of a paragraph
export function createSnippet(text: string, maxLength = 60): string {
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength).trim() + "...";
}

// Process text command similar to grep
export function grepText(text: string, pattern: string): { 
  matches: string[]; 
  count: number 
} {
  try {
    const regex = new RegExp(pattern, "gi");
    const matches = text.match(regex) || [];
    
    return {
      matches,
      count: matches.length
    };
  } catch (error) {
    console.error("Invalid regex pattern:", error);
    return {
      matches: [],
      count: 0
    };
  }
}

// Process text command similar to sed
export function replaceText(text: string, pattern: string, replacement: string): {
  result: string;
  count: number;
} {
  try {
    const regex = new RegExp(pattern, "gi");
    const originalText = text;
    const newText = text.replace(regex, replacement);
    
    // Count replacements
    const count = (originalText.match(regex) || []).length;
    
    return {
      result: newText,
      count
    };
  } catch (error) {
    console.error("Invalid regex pattern:", error);
    return {
      result: text,
      count: 0
    };
  }
}
