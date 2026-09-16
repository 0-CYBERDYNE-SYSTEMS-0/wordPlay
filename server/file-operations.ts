import { Document, InsertDocument } from "@shared/schema";
import RE2 from "re2";

// Text manipulation functions similar to grep and sed.
// Patterns compile through re2, which rejects JS-only syntax (lookaheads,
// backreferences) at compile time; that compile error is surfaced in the
// result so a valid-but-unsupported pattern doesn't read as "no matches".
export function grepText(content: string, pattern: string): { matches: string[]; count: number; error?: string } {
  try {
    const regex = new RE2(pattern, "gi");
    const matches = content.match(regex) || [];

    return {
      matches: matches,
      count: matches.length
    };
  } catch (error: any) {
    console.error("Error in grep operation:", error.message);
    return {
      matches: [],
      count: 0,
      error: error.message
    };
  }
}

export function replaceText(content: string, oldPattern: string, newPattern: string): {
  result: string;
  count: number;
  error?: string;
} {
  try {
    const regex = new RE2(oldPattern, "gi");
    const originalContent = content;
    const newContent = content.replace(regex, newPattern);

    // Count replacements by comparing the lengths
    const lengthDiff = Math.abs(originalContent.length - newContent.length);
    const replacementCount = lengthDiff > 0
      ? Math.ceil(lengthDiff / Math.abs(oldPattern.length - newPattern.length))
      : (originalContent !== newContent ? 1 : 0);

    return {
      result: newContent,
      count: replacementCount
    };
  } catch (error: any) {
    console.error("Error in replace operation:", error.message);
    return {
      result: content,
      count: 0,
      error: error.message
    };
  }
}

export function countWords(content: string): number {
  // Split by whitespace and filter out empty strings
  const words = content.split(/\s+/).filter(word => word.length > 0);
  return words.length;
}

export function extractStructure(content: string): {
  title: string;
  paragraphs: { id: number; text: string; }[];
} {
  // Split content into paragraphs
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // First paragraph is often the title or introduction
  const title = paragraphs[0]?.trim() || "Untitled Document";
  
  // Map paragraphs to structured format
  const structuredParagraphs = paragraphs.map((text, index) => ({
    id: index,
    text: text.trim()
  }));
  
  return {
    title,
    paragraphs: structuredParagraphs
  };
}

// Calculate document statistics
export function analyzeDocument(content: string): {
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  sentenceCount: number;
  estimatedReadingTime: number; // in minutes
} {
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const wordCount = countWords(content);
  const characterCount = content.length;
  
  // Average reading speed is about 200-250 words per minute
  const estimatedReadingTime = Math.ceil(wordCount / 225);
  
  return {
    wordCount,
    characterCount,
    paragraphCount: paragraphs.length,
    sentenceCount: sentences.length,
    estimatedReadingTime
  };
}
