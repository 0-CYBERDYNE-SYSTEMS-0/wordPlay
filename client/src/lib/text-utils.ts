/**
 * Utility functions for text processing and transformation
 */

/**
 * Fix reversed text by always reversing it
 * This function always reverses the text to correct the backwards display issue
 */
export function fixReversedText(text: string): string {
  if (!text) return text;
  
  // Always reverse the text to correct the backwards rendering
  return text.split('').reverse().join('');
}