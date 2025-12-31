/**
 * Disparo parsing utilities
 * CSV parsing, email extraction, and command processing
 */

export interface CsvLead {
  name: string;
  email?: string;
  whatsapp?: string;
  [key: string]: string | undefined;
}

export interface CsvParseResult {
  leads: CsvLead[];
  rawData: Array<Record<string, string>>;
  headers: string[];
  mappedColumns: {
    name?: string;
    email?: string;
    whatsapp?: string;
  };
  detailedStats?: {
    totalLeads: number;
    validEmails: number;
    duplicatesRemoved: number;
    withWhatsApp: number;
    withoutWhatsApp: number;
    emptyNames: number;
    withNames: number;
    topDomains: Array<{ domain: string; count: number; percent: string }>;
  };
}

/**
 * Parse CSV file with smart column detection
 */
export const parseCSVAdvanced = (content: string): CsvParseResult => {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return { leads: [], rawData: [], headers: [], mappedColumns: {} };
  
  const headers = lines[0].split(/[,;]/).map(h => h.trim().replace(/"/g, ''));
  const headersLower = headers.map(h => h.toLowerCase());
  
  // Smart column detection with fuzzy matching
  const namePatterns = ['nome', 'name', 'aluna', 'aluno', 'cliente', 'pessoa', 'contato', 'lead'];
  const emailPatterns = ['email', 'e-mail', 'mail', 'correio', 'gmail'];
  const whatsappPatterns = ['whatsapp', 'telefone', 'phone', 'celular', 'tel', 'fone', 'numero', 'número', 'zap', 'wpp'];
  
  const findColumnIndex = (patterns: string[]): number => {
    for (const pattern of patterns) {
      const idx = headersLower.findIndex(h => h.includes(pattern));
      if (idx !== -1) return idx;
    }
    return -1;
  };
  
  const nameIdx = findColumnIndex(namePatterns);
  const emailIdx = findColumnIndex(emailPatterns);
  const whatsappIdx = findColumnIndex(whatsappPatterns);
  
  // Parse all raw data preserving original headers
  const rawData = lines.slice(1).map(line => {
    const values = line.split(/[,;]/).map(v => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    return row;
  }).filter(row => Object.values(row).some(v => v.trim()));
  
  // Build leads with mapped columns
  const leads = rawData.map(row => {
    const lead: CsvLead = {
      name: nameIdx >= 0 ? row[headers[nameIdx]] || '' : '',
      email: emailIdx >= 0 ? row[headers[emailIdx]] : undefined,
      whatsapp: whatsappIdx >= 0 ? row[headers[whatsappIdx]]?.replace(/\D/g, '') : undefined,
    };
    // Also preserve all original data
    headers.forEach(header => {
      if (!['name', 'email', 'whatsapp'].includes(header.toLowerCase())) {
        lead[header] = row[header];
      }
    });
    return lead;
  }).filter(l => l.name || l.email);
  
  return {
    leads,
    rawData,
    headers,
    mappedColumns: {
      name: nameIdx >= 0 ? headers[nameIdx] : undefined,
      email: emailIdx >= 0 ? headers[emailIdx] : undefined,
      whatsapp: whatsappIdx >= 0 ? headers[whatsappIdx] : undefined,
    }
  };
};

/**
 * Extract subject, preheader, and HTML from AI response
 */
export const extractSubjectPreheaderAndHtml = (content: string): { subject: string; preheader: string; html: string } => {
  const lines = content.split('\n');
  let subject = '';
  let preheader = '';
  let htmlStartIndex = 0;
  
  // Look for ASSUNTO: and PREHEADER: lines at the start
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    if (line.toUpperCase().startsWith('ASSUNTO:')) {
      subject = line.substring(8).trim();
      htmlStartIndex = i + 1;
    } else if (line.toUpperCase().startsWith('PREHEADER:')) {
      preheader = line.substring(10).trim();
      htmlStartIndex = i + 1;
    }
    // Skip empty lines after metadata
    if (htmlStartIndex > 0 && lines[htmlStartIndex]?.trim() === '') {
      htmlStartIndex++;
    }
  }
  
  // Get HTML part (everything after subject/preheader)
  const html = lines.slice(htmlStartIndex).join('\n')
    .replace(/^```html\n?/i, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/i, '')
    .trim();
  
  return { subject, preheader, html };
};

/**
 * Legacy function for backwards compatibility
 */
export const extractSubjectAndHtml = (content: string): { subject: string; html: string } => {
  const { subject, html } = extractSubjectPreheaderAndHtml(content);
  return { subject, html };
};

/**
 * Extract structured email data from AI response (NOME/ASSUNTO/PREHEADER/CORPO format)
 */
export interface ExtractedEmailData {
  emailName: string;
  subject: string;
  preheader: string;
  body: string;
  isStructuredEmail: boolean;
}

export const extractStructuredEmail = (content: string): ExtractedEmailData => {
  const result: ExtractedEmailData = {
    emailName: '',
    subject: '',
    preheader: '',
    body: '',
    isStructuredEmail: false
  };
  
  // Check if it's the structured format
  const hasEmailFormat = content.includes('---INÍCIO DO EMAIL---') || 
    (content.includes('NOME DO EMAIL:') && content.includes('ASSUNTO:') && content.includes('CORPO:'));
  
  if (!hasEmailFormat) {
    return result;
  }
  
  result.isStructuredEmail = true;
  
  // Extract NOME DO EMAIL
  const nameMatch = content.match(/NOME DO EMAIL:\s*([^\n]+)/i);
  if (nameMatch) result.emailName = nameMatch[1].trim();
  
  // Extract ASSUNTO
  const subjectMatch = content.match(/ASSUNTO:\s*([^\n]+)/i);
  if (subjectMatch) result.subject = subjectMatch[1].trim();
  
  // Extract PREHEADER
  const preheaderMatch = content.match(/PREHEADER:\s*([^\n]+)/i);
  if (preheaderMatch) result.preheader = preheaderMatch[1].trim();
  
  // Extract CORPO (everything after CORPO: until ---FIM DO EMAIL--- or end)
  const bodyMatch = content.match(/CORPO:\s*([\s\S]*?)(?:---FIM DO EMAIL---|$)/i);
  if (bodyMatch) result.body = bodyMatch[1].trim();
  
  return result;
};

/**
 * Remove agent/context prefixes from message content
 */
export const removeAgentPrefix = (content: string): string => {
  return content
    .replace(/\[(Agente:[^\]]+|CONTEXT:[^\]]+|Search)\]\s*/gi, '')
    .replace(/text-copyright/gi, '')
    .trim();
};

/**
 * Strip internal context tags from user messages
 */
export const stripInternalContext = (content: string): string => {
  return content
    .replace(/^\[CONTEXT:copywriting\]\s*/i, '')
    .replace(/^\[CONTEXT:uxui\]\s*/i, '')
    .replace(/^\[CONTEXT:[^\]]+\]\s*/gi, '')
    .replace(/^\[MODEL:[^\]]+\]\s*/gi, '')
    .trim();
};

// CSV Operation Types
export type CsvOperation = 
  | { type: 'REMOVE_DUPLICATES'; field: string }
  | { type: 'REMOVE_COLUMN'; column: string }
  | { type: 'ADD_DDI'; ddi: string }
  | { type: 'FIRST_NAME_ONLY' }
  | { type: 'FILTER_DOMAIN'; domain: string }
  | { type: 'REMOVE_INVALID_EMAILS' }
  | { type: 'FILTER'; column: string; value: string }
  | { type: 'REMOVE_EMPTY'; field: string }
  | { type: 'CLEAN_PHONES' }
  | { type: 'EXPORT' };

/**
 * Parse CSV operations from AI response
 */
export const parseCsvOperations = (content: string): CsvOperation[] => {
  const operations: CsvOperation[] = [];
  const operationPattern = /\[CSV_OPERATION:([^\]]+)\]/g;
  let match;
  
  while ((match = operationPattern.exec(content)) !== null) {
    const parts = match[1].split(':');
    const opType = parts[0];
    
    switch (opType) {
      case 'REMOVE_DUPLICATES':
        operations.push({ type: 'REMOVE_DUPLICATES', field: parts[1] || 'email' });
        break;
      case 'REMOVE_COLUMN':
        if (parts[1]) operations.push({ type: 'REMOVE_COLUMN', column: parts[1] });
        break;
      case 'ADD_DDI':
        operations.push({ type: 'ADD_DDI', ddi: parts[1] || '55' });
        break;
      case 'FIRST_NAME_ONLY':
        operations.push({ type: 'FIRST_NAME_ONLY' });
        break;
      case 'FILTER_DOMAIN':
        if (parts[1]) operations.push({ type: 'FILTER_DOMAIN', domain: parts[1] });
        break;
      case 'REMOVE_INVALID_EMAILS':
        operations.push({ type: 'REMOVE_INVALID_EMAILS' });
        break;
      case 'FILTER':
        if (parts[1] && parts[2]) operations.push({ type: 'FILTER', column: parts[1], value: parts[2] });
        break;
      case 'REMOVE_EMPTY':
        operations.push({ type: 'REMOVE_EMPTY', field: parts[1] || 'email' });
        break;
      case 'CLEAN_PHONES':
        operations.push({ type: 'CLEAN_PHONES' });
        break;
      case 'EXPORT':
        operations.push({ type: 'EXPORT' });
        break;
    }
  }
  
  return operations;
};

/**
 * Strip CSV operation commands from content
 */
export const stripCsvOperations = (content: string): string => {
  return content.replace(/\[CSV_OPERATION:[^\]]+\]/g, '').trim();
};
