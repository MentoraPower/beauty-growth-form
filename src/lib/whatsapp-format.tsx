import React from "react";

/**
 * Parses WhatsApp text formatting and returns React elements
 * Supports:
 * - *text* = bold
 * - _text_ = italic  
 * - ~text~ = strikethrough
 * - ```text``` = monospace (code block)
 * - `text` = inline code
 */
export function formatWhatsAppText(text: string): React.ReactNode {
  if (!text) return null;

  // Process in order: code blocks first, then inline formatting
  let keyIndex = 0;

  // Regex patterns for WhatsApp formatting
  const patterns = [
    { regex: /```([\s\S]*?)```/g, wrapper: (content: string, key: number) => <code key={key} className="block bg-muted/50 px-2 py-1 rounded text-xs font-mono whitespace-pre-wrap">{content}</code> },
    { regex: /`([^`]+)`/g, wrapper: (content: string, key: number) => <code key={key} className="bg-muted/50 px-1 rounded text-xs font-mono">{content}</code> },
    { regex: /\*([^*]+)\*/g, wrapper: (content: string, key: number) => <strong key={key} className="font-semibold">{content}</strong> },
    { regex: /_([^_]+)_/g, wrapper: (content: string, key: number) => <em key={key}>{content}</em> },
    { regex: /~([^~]+)~/g, wrapper: (content: string, key: number) => <s key={key} className="line-through">{content}</s> },
  ];

  // Process text with all patterns
  const processText = (input: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // Find all matches for all patterns
    interface Match {
      index: number;
      length: number;
      content: string;
      patternIndex: number;
    }
    
    const allMatches: Match[] = [];
    
    patterns.forEach((pattern, patternIndex) => {
      const regex = new RegExp(pattern.regex.source, 'g');
      let match;
      while ((match = regex.exec(input)) !== null) {
        allMatches.push({
          index: match.index,
          length: match[0].length,
          content: match[1],
          patternIndex,
        });
      }
    });
    
    // Sort matches by index
    allMatches.sort((a, b) => a.index - b.index);
    
    // Filter overlapping matches (keep first one)
    const filteredMatches: Match[] = [];
    let lastEnd = 0;
    for (const match of allMatches) {
      if (match.index >= lastEnd) {
        filteredMatches.push(match);
        lastEnd = match.index + match.length;
      }
    }
    
    // Build result
    for (const match of filteredMatches) {
      // Add text before match
      if (match.index > lastIndex) {
        result.push(input.slice(lastIndex, match.index));
      }
      
      // Add formatted element
      const pattern = patterns[match.patternIndex];
      result.push(pattern.wrapper(match.content, keyIndex++));
      
      lastIndex = match.index + match.length;
    }
    
    // Add remaining text
    if (lastIndex < input.length) {
      result.push(input.slice(lastIndex));
    }
    
    return result.length > 0 ? result : [input];
  };

  return <>{processText(text)}</>;
}

/**
 * Strips WhatsApp formatting markers and returns plain text
 * Useful for preview/truncated text contexts
 */
export function stripWhatsAppFormatting(text: string): string {
  if (!text) return "";
  
  return text
    .replace(/```([\s\S]*?)```/g, '$1')  // Code blocks
    .replace(/`([^`]+)`/g, '$1')          // Inline code
    .replace(/\*([^*]+)\*/g, '$1')        // Bold
    .replace(/_([^_]+)_/g, '$1')          // Italic
    .replace(/~([^~]+)~/g, '$1');         // Strikethrough
}
