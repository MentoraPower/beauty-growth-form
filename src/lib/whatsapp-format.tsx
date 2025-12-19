import React from "react";

/**
 * Parses WhatsApp text formatting and returns React elements
 * Supports:
 * - *text* = bold
 * - _text_ = italic  
 * - ~text~ = strikethrough
 * - ```text``` = monospace (code block)
 * - `text` = inline code
 * - URLs = clickable links
 */
export function formatWhatsAppText(text: string | unknown): React.ReactNode {
  // Handle null, undefined, or non-string values
  if (!text) return null;
  if (typeof text !== 'string') {
    // If it's an object, try to get a meaningful string representation
    if (typeof text === 'object') {
      // Handle common object shapes that might accidentally be passed
      const obj = text as Record<string, unknown>;
      if (obj.text && typeof obj.text === 'string') return formatWhatsAppText(obj.text);
      if (obj.message && typeof obj.message === 'string') return formatWhatsAppText(obj.message);
      if (obj.content && typeof obj.content === 'string') return formatWhatsAppText(obj.content);
      // Last resort - return empty to avoid showing [object Object]
      console.warn('[formatWhatsAppText] Received non-string value:', text);
      return null;
    }
    // For other non-string primitives, convert to string
    return String(text);
  }

  // Process in order: code blocks first, then inline formatting
  let keyIndex = 0;

  // URL regex pattern
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;

  // Regex patterns for WhatsApp formatting
  const patterns = [
    { regex: /```([\s\S]*?)```/g, wrapper: (content: string, key: number) => <code key={key} className="block bg-muted/50 px-2 py-1 rounded text-xs font-mono whitespace-pre-wrap">{content}</code> },
    { regex: /`([^`]+)`/g, wrapper: (content: string, key: number) => <code key={key} className="bg-muted/50 px-1 rounded text-xs font-mono">{content}</code> },
    { regex: /\*([^*]+)\*/g, wrapper: (content: string, key: number) => <strong key={key} className="font-semibold">{content}</strong> },
    { regex: /_([^_]+)_/g, wrapper: (content: string, key: number) => <em key={key}>{content}</em> },
    { regex: /~([^~]+)~/g, wrapper: (content: string, key: number) => <s key={key} className="line-through">{content}</s> },
  ];

  // Process URLs in text
  const processUrls = (input: string, startKey: number): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let currentKey = startKey;
    
    const regex = new RegExp(urlRegex.source, 'g');
    while ((match = regex.exec(input)) !== null) {
      // Add text before URL
      if (match.index > lastIndex) {
        result.push(input.slice(lastIndex, match.index));
      }
      
      // Add clickable link
      const url = match[1];
      result.push(
        <a 
          key={currentKey++} 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < input.length) {
      result.push(input.slice(lastIndex));
    }
    
    return result.length > 0 ? result : [input];
  };

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
      // Add text before match (process URLs in plain text)
      if (match.index > lastIndex) {
        const plainText = input.slice(lastIndex, match.index);
        result.push(...processUrls(plainText, keyIndex));
        keyIndex += 10; // Reserve some keys for URLs
      }
      
      // Add formatted element
      const pattern = patterns[match.patternIndex];
      result.push(pattern.wrapper(match.content, keyIndex++));
      
      lastIndex = match.index + match.length;
    }
    
    // Add remaining text (process URLs)
    if (lastIndex < input.length) {
      const remainingText = input.slice(lastIndex);
      result.push(...processUrls(remainingText, keyIndex));
    }
    
    return result.length > 0 ? result : processUrls(input, keyIndex);
  };

  return <>{processText(text)}</>;
}

/**
 * Strips WhatsApp formatting markers and returns plain text
 * Useful for preview/truncated text contexts
 */
export function stripWhatsAppFormatting(text: string | unknown): string {
  if (!text) return "";
  if (typeof text !== 'string') {
    if (typeof text === 'object') {
      const obj = text as Record<string, unknown>;
      if (obj.text && typeof obj.text === 'string') return stripWhatsAppFormatting(obj.text);
      if (obj.message && typeof obj.message === 'string') return stripWhatsAppFormatting(obj.message);
      return "";
    }
    return String(text);
  }
  
  return text
    .replace(/```([\s\S]*?)```/g, '$1')  // Code blocks
    .replace(/`([^`]+)`/g, '$1')          // Inline code
    .replace(/\*([^*]+)\*/g, '$1')        // Bold
    .replace(/_([^_]+)_/g, '$1')          // Italic
    .replace(/~([^~]+)~/g, '$1');         // Strikethrough
}
