/**
 * Disparo formatting utilities
 * HTML highlighting, message formatting, and display helpers
 */

import React from 'react';
import { removeAgentPrefix } from './parsing';

/**
 * Simple syntax highlighting for HTML
 */
export function highlightHtml(code: string): React.ReactNode[] {
  if (!code) return [];
  
  // Regex patterns for HTML syntax with vibrant colors
  const patterns = [
    { regex: /(&lt;!--[\s\S]*?--&gt;|<!--[\s\S]*?-->)/g, className: 'text-gray-400 italic' }, // Comments
    { regex: /(&lt;\/?[a-zA-Z][a-zA-Z0-9]*|<\/?[a-zA-Z][a-zA-Z0-9]*)/g, className: 'text-rose-500' }, // Tags
    { regex: /(&gt;|>)/g, className: 'text-rose-500' }, // Closing brackets
    { regex: /(\{\{[^}]+\}\})/g, className: 'text-emerald-500 font-semibold bg-emerald-500/10 px-0.5 rounded' }, // Template variables
    { regex: /("[^"]*"|'[^']*')/g, className: 'text-sky-500' }, // Strings
    { regex: /(\s[a-zA-Z-]+)(?==)/g, className: 'text-amber-500' }, // Attributes
  ];
  
  // Simple approach: split by lines and apply highlighting
  const lines = code.split('\n');
  
  return lines.map((line, lineIndex) => {
    const elements: React.ReactNode[] = [];
    
    // Process the line for each pattern
    const matches: { start: number; end: number; text: string; className: string }[] = [];
    
    patterns.forEach(({ regex, className }) => {
      const lineRegex = new RegExp(regex.source, 'g');
      let match;
      while ((match = lineRegex.exec(line)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          className
        });
      }
    });
    
    // Sort matches by start position
    matches.sort((a, b) => a.start - b.start);
    
    // Remove overlapping matches
    const filteredMatches: typeof matches = [];
    for (const match of matches) {
      if (filteredMatches.length === 0 || match.start >= filteredMatches[filteredMatches.length - 1].end) {
        filteredMatches.push(match);
      }
    }
    
    // Build elements
    let currentPos = 0;
    filteredMatches.forEach((match, i) => {
      if (match.start > currentPos) {
        elements.push(React.createElement('span', { key: `${lineIndex}-text-${i}` }, line.slice(currentPos, match.start)));
      }
      elements.push(React.createElement('span', { key: `${lineIndex}-match-${i}`, className: match.className }, match.text));
      currentPos = match.end;
    });
    
    if (currentPos < line.length) {
      elements.push(React.createElement('span', { key: `${lineIndex}-end` }, line.slice(currentPos)));
    }
    
    if (elements.length === 0) {
      elements.push(React.createElement('span', { key: `${lineIndex}-empty` }, line || ' '));
    }
    
    return React.createElement('div', { key: lineIndex, className: 'min-h-[1.5em]' }, ...elements);
  });
}

/**
 * Convert title case to sentence case (only first letter uppercase)
 * "Desperte Sua Essência" → "Desperte sua essência"
 */
const toSentenceCase = (text: string): string => {
  if (!text || text.length < 2) return text;
  // Keep first character as-is, lowercase the rest except after punctuation
  return text.charAt(0) + text.slice(1).replace(/(?<![.!?:]\s)\b[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]/g, (char) => char.toLowerCase());
};

/**
 * Format inline text: **bold** and _italic_
 */
const formatInlineStyles = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  
  return parts.map((part, index) => {
    // Bold: **text**
    if (part.startsWith('**') && part.endsWith('**')) {
      return React.createElement('strong', { key: index, className: 'font-semibold text-foreground' }, part.slice(2, -2));
    }
    // Italic: _text_
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return React.createElement('em', { key: index, className: 'italic' }, part.slice(1, -1));
    }
    return part;
  });
};

/**
 * Formats message content with headings, bullet points, and inline formatting
 * Enhanced typography with larger titles and better spacing for rich copy content
 */
export function formatMessageContent(content: string): React.ReactNode {
  if (!content) return null;
  
  // First remove any agent prefix
  const cleanContent = removeAgentPrefix(content);
  
  const lines = cleanContent.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines but add spacing
    if (trimmedLine === '') {
      elements.push(React.createElement('div', { key: key++, className: 'h-3' }));
      continue;
    }
    
    // ### is subtitle (medium)
    if (trimmedLine.startsWith('###')) {
      const text = toSentenceCase(trimmedLine.slice(3).trimStart());
      elements.push(
        React.createElement('h3', {
          key: key++,
          className: 'text-xl font-semibold text-foreground mt-5 mb-2'
        }, formatInlineStyles(text))
      );
      continue;
    }

    // Check for headings - ## is main title (largest)
    if (trimmedLine.startsWith('##')) {
      const text = toSentenceCase(trimmedLine.slice(2).trimStart());
      elements.push(
        React.createElement('h2', {
          key: key++,
          className: 'text-2xl font-bold text-foreground mt-6 mb-3 first:mt-0 tracking-tight'
        }, formatInlineStyles(text))
      );
      continue;
    }
    
    // Check for bullet points (- or •)
    const bulletMatch = trimmedLine.match(/^([-•])\s+(.*)$/);
    if (bulletMatch) {
      const [, , text] = bulletMatch;
      elements.push(
        React.createElement('div', { 
          key: key++, 
          className: 'flex items-start gap-2.5 text-muted-foreground py-1' 
        }, [
          React.createElement('span', { key: 'dot', className: 'text-primary mt-1.5 text-sm' }, '•'),
          React.createElement('span', { key: 'text', className: 'flex-1 leading-relaxed' }, formatInlineStyles(text))
        ])
      );
      continue;
    }
    
    // Regular paragraph with improved readability
    elements.push(
      React.createElement('p', { 
        key: key++, 
        className: 'text-base text-muted-foreground leading-7' 
      }, formatInlineStyles(trimmedLine))
    );
  }
  
  return React.createElement('div', { className: 'space-y-2' }, elements);
}

/**
 * Convert title case to sentence case for HTML output
 */
const toSentenceCaseString = (text: string): string => {
  if (!text || text.length < 2) return text;
  return text.charAt(0) + text.slice(1).replace(/(?<![.!?:]\s)\b[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]/g, (char) => char.toLowerCase());
};

/**
 * Helper to format inline text: **bold** and _italic_ to HTML string
 */
const formatInlineTextToHtml = (text: string): string => {
  return text
    // Bold: **text**
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 600; color: inherit;">$1</strong>')
    // Italic: _text_
    .replace(/_([^_]+)_/g, '<em style="font-style: italic;">$1</em>');
};

/**
 * Sanitize HTML for safe preview
 */
export const sanitizeHtml = (html: string): string => {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
};

/**
 * Convert markdown-style copy to HTML with rich typography for side panel display
 * Transforms ## titles, ### subtitles, **bold**, _italic_, and bullet points
 */
export const formatCopyToRichHtml = (text: string): string => {
  if (!text) return '';
  
  const lines = text.split('\n');
  const htmlLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines - add spacing
    if (trimmed === '') {
      htmlLines.push('<div style="height: 0.75rem;"></div>');
      continue;
    }
    
    // Subtitle: ### Subtitle
    if (trimmed.startsWith('###')) {
      const subtitleText = formatInlineTextToHtml(toSentenceCaseString(trimmed.slice(3).trimStart()));
      htmlLines.push(`<h3 style="font-size: 1.25rem; font-weight: 600; color: #222; margin: 1.25rem 0 0.5rem 0; line-height: 1.4;">${subtitleText}</h3>`);
      continue;
    }

    // Main title: ## Title
    if (trimmed.startsWith('##')) {
      const titleText = formatInlineTextToHtml(toSentenceCaseString(trimmed.slice(2).trimStart()));
      htmlLines.push(`<h2 style="font-size: 1.5rem; font-weight: 700; color: #111; margin: 1.5rem 0 0.75rem 0; line-height: 1.3;">${titleText}</h2>`);
      continue;
    }
    
    // Bullet points: - or •
    const bulletMatch = trimmed.match(/^([-•])\s+(.*)$/);
    if (bulletMatch) {
      const bulletText = formatInlineTextToHtml(bulletMatch[2]);
      htmlLines.push(`<div style="display: flex; align-items: flex-start; gap: 0.625rem; margin: 0.375rem 0; color: #444;"><span style="color: #666; margin-top: 0.125rem;">•</span><span style="flex: 1; line-height: 1.7;">${bulletText}</span></div>`);
      continue;
    }
    
    // Regular paragraph
    const paragraphText = formatInlineTextToHtml(trimmed);
    htmlLines.push(`<p style="font-size: 1rem; color: #333; line-height: 1.7; margin: 0.5rem 0;">${paragraphText}</p>`);
  }
  
  return htmlLines.join('\n');
};

/**
 * Check if text looks like HTML (has tags)
 */
export const looksLikeHtml = (text: string): boolean => {
  if (!text) return false;
  // Check for common HTML tags
  return /<[a-z][\s\S]*>/i.test(text);
};

/**
 * Extract clean copy from text (content between --- delimiters)
 */
export const extractCleanCopy = (text: string): string => {
  // Try to find content between --- delimiters
  const delimiterMatch = text.match(/---\s*([\s\S]*?)\s*---/);
  if (delimiterMatch && delimiterMatch[1].trim().length > 20) {
    return delimiterMatch[1].trim();
  }
  // Fallback: remove common agent greetings and questions
  let cleaned = text
    // Remove greetings at the start
    .replace(/^(Opa|Olá|Oi|Ei|Hey|E aí|Eai|Bom dia|Boa tarde|Boa noite)[,!]?\s*[^.!?\n]*[.!?]?\s*/gi, '')
    // Remove "Beleza!", "Bora!", "Aqui está!", etc at the start
    .replace(/^(Beleza|Bora|Aqui está|Perfeito|Pronto|Vamos lá|Feito)[,!]?\s*[^.!?\n]*[.!?]?\s*/gi, '')
    // Remove follow-up questions at the end
    .replace(/\s*(O que achou|Quer que eu|Posso ajustar|Se quiser|Qual tipo|Bora disparar|Pronto pra|Alguma alteração|Ficou bom)[^?]*\?[^]*$/gi, '')
    .trim();
  
  return cleaned || text;
};

/**
 * Normalize content to HTML for the side panel
 * Converts markdown to HTML if needed, returns HTML as-is
 */
export const normalizeSidePanelHtml = (text: string): string => {
  if (!text) return '';
  
  // Extract clean copy first
  const cleanText = extractCleanCopy(text);
  
  // If already HTML, return as-is
  if (looksLikeHtml(cleanText)) {
    return cleanText;
  }
  
  // Convert markdown to rich HTML
  return formatCopyToRichHtml(cleanText);
};

/**
 * Get prompt summary for display (truncated)
 */
export const getPromptSummary = (prompt: string, maxLength = 60): string => {
  const cleaned = prompt.replace(/\[CONTEXT:[^\]]+\]/g, '').trim();
  const truncated = cleaned.length > maxLength 
    ? cleaned.substring(0, maxLength).replace(/\s+\S*$/, '') + '...'
    : cleaned;
  return truncated || 'user request';
};
