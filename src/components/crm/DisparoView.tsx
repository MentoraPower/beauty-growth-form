import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AnimatedAIInput, AIModel } from "@/components/ui/animated-ai-input";
import { motion, AnimatePresence } from "framer-motion";

import { toast } from "sonner";

import { DispatchPreparingIndicator } from "./DispatchPreparingIndicator";
import { EmailSidePanel, SidePanelMode } from "./EmailSidePanel";
import { CsvSidePanel, CsvLead as CsvLeadType } from "./CsvSidePanel";
import { DispatchData } from "./DispatchAnalysis";
import { EmailChatCard } from "./EmailChatCard";
import { CsvChatCard } from "./CsvChatCard";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { AIWorkDetails, WorkStep, WorkSubItem, createLeadsAnalysisStep, createEmailGenerationStep, createDispatchStep, createCustomStep } from "./AIWorkDetails";
import { DataIntelligence, InsightStep, createCsvAnalysisSteps } from "./DataIntelligence";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import disparoLogo from "@/assets/disparo-logo.png";
import { useTypewriter } from "@/hooks/useTypewriter";
import { useProgressiveSteps } from "@/hooks/useProgressiveSteps";

// Import extracted components
import { 
  OriginsListComponent, 
  LeadsPreviewComponent, 
  FeedbackButton,
  EmailEditorWithTabs,
  CopyToHtmlGenerator,
  HtmlEditorComponent
} from "./disparo";

// Import extracted utilities
import {
  parseCSVAdvanced,
  extractSubjectPreheaderAndHtml,
  extractSubjectAndHtml,
  extractStructuredEmail,
  removeAgentPrefix,
  stripInternalContext,
  parseCsvOperations,
  stripCsvOperations,
  CsvParseResult,
  CsvLead,
  CsvOperation
} from "@/lib/disparo/parsing";

import {
  highlightHtml,
  formatMessageContent,
  sanitizeHtml,
  extractCleanCopy,
  getPromptSummary,
  formatCopyToRichHtml,
  normalizeSidePanelHtml
} from "@/lib/disparo/formatting";

interface DisparoViewProps {
  subOriginId: string | null;
}

interface MessageComponentData {
  type: 'leads_preview' | 'html_editor' | 'origins_list' | 'dispatch_progress' | 'csv_preview' | 'email_choice' | 'email_generator' | 'copy_choice' | 'copy_input' | 'email_generator_streaming' | 'ai_work_details' | 'data_intelligence' | 'email_setup';
  data?: any;
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  component?: React.ReactNode;
  componentData?: MessageComponentData;
  imageUrl?: string;
}

interface ActionEntry {
  timestamp: string;
  actor: 'user' | 'ai' | 'system';
  action: string;
  details?: string;
}

interface Origin {
  id: string;
  nome: string;
  crm_sub_origins: { id: string; nome: string }[];
}

interface LeadsPreview {
  subOriginId: string;
  originName: string;
  subOriginName: string;
  dispatchType: string;
  totalLeads: number;
  validLeads: number;
  invalidLeads: number;
  intervalSeconds: number;
  estimatedMinutes: number;
  leads: { name: string; contact: string }[];
}

const CHAT_URL = `https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/grok-chat`;

// Execute CSV operations on leads data
const executeCsvOperations = (
  leads: CsvLead[], 
  rawData: Array<Record<string, string>>,
  headers: string[],
  mappedColumns: { name?: string; email?: string; whatsapp?: string },
  operations: CsvOperation[]
): { 
  leads: CsvLead[]; 
  rawData: Array<Record<string, string>>; 
  headers: string[];
  changes: string[];
} => {
  let processedLeads = [...leads];
  let processedRawData = [...rawData];
  let processedHeaders = [...headers];
  const changes: string[] = [];
  const originalCount = leads.length;
  
  for (const op of operations) {
    const countBefore = processedLeads.length;
    
    switch (op.type) {
      case 'REMOVE_DUPLICATES': {
        const seen = new Set<string>();
        const field = op.field.toLowerCase();
        processedLeads = processedLeads.filter(lead => {
          const value = field === 'email' ? lead.email?.toLowerCase() : 
                        field === 'name' ? lead.name?.toLowerCase() : 
                        lead[field]?.toLowerCase();
          if (!value || seen.has(value)) return false;
          seen.add(value);
          return true;
        });
        const seenRaw = new Set<string>();
        const rawField = field === 'email' ? mappedColumns.email : 
                         field === 'name' ? mappedColumns.name : field;
        if (rawField) {
          processedRawData = processedRawData.filter(row => {
            const value = row[rawField]?.toLowerCase();
            if (!value || seenRaw.has(value)) return false;
            seenRaw.add(value);
            return true;
          });
        }
        const removed = countBefore - processedLeads.length;
        changes.push(`Removidos ${removed} duplicados por ${field}`);
        break;
      }
      
      case 'REMOVE_COLUMN': {
        processedHeaders = processedHeaders.filter(h => h.toLowerCase() !== op.column.toLowerCase());
        processedRawData = processedRawData.map(row => {
          const newRow = { ...row };
          const keyToRemove = Object.keys(newRow).find(k => k.toLowerCase() === op.column.toLowerCase());
          if (keyToRemove) delete newRow[keyToRemove];
          return newRow;
        });
        processedLeads = processedLeads.map(lead => {
          const newLead = { ...lead };
          const keyToRemove = Object.keys(newLead).find(k => k.toLowerCase() === op.column.toLowerCase());
          if (keyToRemove && keyToRemove !== 'name' && keyToRemove !== 'email' && keyToRemove !== 'whatsapp') {
            delete newLead[keyToRemove];
          }
          return newLead;
        });
        changes.push(`Coluna "${op.column}" removida`);
        break;
      }
      
      case 'ADD_DDI': {
        processedLeads = processedLeads.map(lead => {
          if (lead.whatsapp && !lead.whatsapp.startsWith(op.ddi)) {
            return { ...lead, whatsapp: op.ddi + lead.whatsapp.replace(/^\+/, '') };
          }
          return lead;
        });
        if (mappedColumns.whatsapp) {
          processedRawData = processedRawData.map(row => {
            const phone = row[mappedColumns.whatsapp!];
            if (phone && !phone.startsWith(op.ddi)) {
              return { ...row, [mappedColumns.whatsapp!]: op.ddi + phone.replace(/^\+/, '') };
            }
            return row;
          });
        }
        changes.push(`DDI ${op.ddi} adicionado aos telefones`);
        break;
      }
      
      case 'FIRST_NAME_ONLY': {
        processedLeads = processedLeads.map(lead => ({
          ...lead,
          name: lead.name?.split(' ')[0] || lead.name
        }));
        if (mappedColumns.name) {
          processedRawData = processedRawData.map(row => ({
            ...row,
            [mappedColumns.name!]: row[mappedColumns.name!]?.split(' ')[0] || row[mappedColumns.name!]
          }));
        }
        changes.push('Mantido apenas primeiro nome');
        break;
      }
      
      case 'FILTER_DOMAIN': {
        const domain = op.domain.toLowerCase();
        processedLeads = processedLeads.filter(lead => 
          lead.email?.toLowerCase().includes(`@${domain}`) || lead.email?.toLowerCase().endsWith(domain)
        );
        if (mappedColumns.email) {
          processedRawData = processedRawData.filter(row => 
            row[mappedColumns.email!]?.toLowerCase().includes(`@${domain}`) || 
            row[mappedColumns.email!]?.toLowerCase().endsWith(domain)
          );
        }
        const removed = countBefore - processedLeads.length;
        changes.push(`Filtrado por domínio ${domain}: ${removed} removidos`);
        break;
      }
      
      case 'REMOVE_INVALID_EMAILS': {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        processedLeads = processedLeads.filter(lead => 
          lead.email && emailRegex.test(lead.email)
        );
        if (mappedColumns.email) {
          processedRawData = processedRawData.filter(row => 
            row[mappedColumns.email!] && emailRegex.test(row[mappedColumns.email!])
          );
        }
        const removed = countBefore - processedLeads.length;
        changes.push(`${removed} emails inválidos removidos`);
        break;
      }
      
      case 'FILTER': {
        const columnKey = Object.keys(processedRawData[0] || {}).find(
          k => k.toLowerCase() === op.column.toLowerCase()
        );
        if (columnKey) {
          processedRawData = processedRawData.filter(row => 
            row[columnKey]?.toLowerCase().includes(op.value.toLowerCase())
          );
          processedLeads = processedRawData.map(row => ({
            name: mappedColumns.name ? row[mappedColumns.name] || '' : '',
            email: mappedColumns.email ? row[mappedColumns.email] : undefined,
            whatsapp: mappedColumns.whatsapp ? row[mappedColumns.whatsapp]?.replace(/\D/g, '') : undefined,
          })).filter(l => l.name || l.email);
          const removed = countBefore - processedLeads.length;
          changes.push(`Filtrado ${op.column}="${op.value}": ${removed} removidos`);
        }
        break;
      }
      
      case 'REMOVE_EMPTY': {
        const field = op.field.toLowerCase();
        processedLeads = processedLeads.filter(lead => {
          const value = field === 'email' ? lead.email : 
                        field === 'whatsapp' ? lead.whatsapp : 
                        field === 'name' ? lead.name : lead[field];
          return value && value.trim().length > 0;
        });
        const rawField = field === 'email' ? mappedColumns.email : 
                         field === 'whatsapp' ? mappedColumns.whatsapp : 
                         field === 'name' ? mappedColumns.name : field;
        if (rawField) {
          processedRawData = processedRawData.filter(row => 
            row[rawField] && row[rawField].trim().length > 0
          );
        }
        const removed = countBefore - processedLeads.length;
        changes.push(`${removed} linhas sem ${field} removidas`);
        break;
      }
      
      case 'CLEAN_PHONES': {
        processedLeads = processedLeads.map(lead => ({
          ...lead,
          whatsapp: lead.whatsapp?.replace(/\D/g, '')
        }));
        if (mappedColumns.whatsapp) {
          processedRawData = processedRawData.map(row => ({
            ...row,
            [mappedColumns.whatsapp!]: row[mappedColumns.whatsapp!]?.replace(/\D/g, '')
          }));
        }
        changes.push('Telefones padronizados (apenas números)');
        break;
      }
      
      case 'EXPORT': {
        changes.push('Lista pronta para download');
        break;
      }
    }
  }
  
  if (processedLeads.length !== originalCount) {
    changes.push(`Total: ${originalCount} → ${processedLeads.length} leads`);
  }
  
  return { leads: processedLeads, rawData: processedRawData, headers: processedHeaders, changes };
};

export function DisparoView({ subOriginId }: DisparoViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [isLoading, setIsLoading] = useState(false);
  const [isConversationLoading, setIsConversationLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [csvLeads, setCsvLeads] = useState<CsvLead[] | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [selectedOriginData, setSelectedOriginData] = useState<{ subOriginId: string; subOriginName: string; originName: string } | null>(null);
  const [dispatchType, setDispatchType] = useState<'email' | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [pendingEmailContext, setPendingEmailContext] = useState<{ subOriginId: string; dispatchType: string } | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<{ type: 'email_method' | 'has_copy'; subOriginId: string; dispatchType: string } | null>(null);
  
  // Side panel state for email editor
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelHtml, setSidePanelHtml] = useState('');
  const [sidePanelSubject, setSidePanelSubject] = useState('');
  const [sidePanelPreheader, setSidePanelPreheader] = useState('');
  const [sidePanelGenerating, setSidePanelGenerating] = useState(false);
  const [sidePanelEditing, setSidePanelEditing] = useState(false);
  const [sidePanelContext, setSidePanelContext] = useState<{ subOriginId: string; dispatchType: string } | null>(null);
  const [sidePanelMode, setSidePanelMode] = useState<SidePanelMode>('email');
  const [sidePanelDispatchData, setSidePanelDispatchData] = useState<DispatchData | null>(null);
  const [sidePanelWorkflowSteps, setSidePanelWorkflowSteps] = useState<WorkStep[]>([]);
  const [sidePanelShowCodePreview, setSidePanelShowCodePreview] = useState(true);
  const [sidePanelTitle, setSidePanelTitle] = useState<string | undefined>(undefined);
  const [htmlSource, setHtmlSource] = useState<'ai' | 'user' | null>(null);
  const [actionHistory, setActionHistory] = useState<ActionEntry[]>([]);
  const [sidePanelRestoredFromDB, setSidePanelRestoredFromDB] = useState(false);
  const isInitialPageLoadRef = useRef(true);
  
  // CSV Side Panel state
  const [csvPanelOpen, setCsvPanelOpen] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string>('lista.csv');
  const [csvRawData, setCsvRawData] = useState<Array<Record<string, string>>>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvListId, setCsvListId] = useState<string | null>(null);
  const [csvMappedColumns, setCsvMappedColumns] = useState<{ name?: string; email?: string; whatsapp?: string }>({});
  
  // Typewriter hook for smooth text streaming (slower for natural typing effect)
  const typewriter = useTypewriter({ 
    charsPerTick: 2, 
    tickInterval: 12, 
    catchUpThreshold: 200,
    catchUpMultiplier: 3 
  });
  
  // Progressive steps hook for Data Intelligence animation
  const progressiveSteps = useProgressiveSteps({
    stepDelay: 350,
    minStepDuration: 500,
  });
  
  // Track which message is currently streaming (for typewriter)
  const streamingMessageIdRef = useRef<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const scrollRAFRef = useRef<number | null>(null);
  const streamingBufferRef = useRef("");
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for hydration control
  const isHydratingRef = useRef(false);
  const loadingConversationIdRef = useRef<string | null>(null);
  const skipNextUrlLoadRef = useRef<string | null>(null);
  const suppressUrlSyncRef = useRef(false);

  // Snapshot refs
  const messagesRef = useRef<Message[]>([]);
  const conversationIdRef = useRef<string | null>(null);
  const isCreatingConversationRef = useRef(false);
  const isProcessingMessageRef = useRef(false);
  
  // Mutex: Promise-based lock to prevent duplicate conversation creation
  const creationLockRef = useRef<Promise<string | null> | null>(null);
  
  // Active request control
  const activeAbortRef = useRef<AbortController | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const activeRunConversationIdRef = useRef<string | null>(null);
  
  // Prevent duplicate saves
  const isSavingRef = useRef(false);
  const lastStreamSaveTimeRef = useRef(0);
  const STREAM_SAVE_INTERVAL = 3000;

  const setConversationId = useCallback((id: string | null) => {
    conversationIdRef.current = id;
    setCurrentConversationId(id);
  }, []);

  const setMessagesSnapshot = useCallback((next: Message[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const updateMessages = useCallback((updater: (prev: Message[]) => Message[]) => {
    const next = updater(messagesRef.current);
    messagesRef.current = next;
    setMessages(next);
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    conversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  // TYPEWRITER SYNC - update message content from typewriter
  const lastTypewriterContentRef = useRef('');
  useEffect(() => {
    const messageId = streamingMessageIdRef.current;
    if (!messageId) return;
    
    const newContent = typewriter.displayedContent;
    // Only update if content actually changed
    if (newContent === lastTypewriterContentRef.current) return;
    lastTypewriterContentRef.current = newContent;
    
    setMessages(prev => 
      prev.map(m => 
        m.id === messageId ? { ...m, content: newContent } : m
      )
    );
  }, [typewriter.displayedContent]);

  // Helper to log actions
  const logAction = useCallback((actor: 'user' | 'ai' | 'system', action: string, details?: string) => {
    const entry: ActionEntry = {
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      actor,
      action,
      details
    };
    setActionHistory(prev => [...prev, entry]);
  }, []);

  // Helper to open dispatch leads panel
  const openDispatchLeadsPanel = useCallback((jobId: string) => {
    setActiveJobId(jobId);
    setSidePanelMode('dispatch_leads');
    setSidePanelShowCodePreview(false);
    setSidePanelOpen(true);
  }, []);

  // Optimized scroll to bottom
  const scheduleScrollToBottom = useCallback(() => {
    if (scrollRAFRef.current) return;
    scrollRAFRef.current = requestAnimationFrame(() => {
      scrollRAFRef.current = null;
      const el = chatScrollRef.current;
      if (!el || !shouldAutoScrollRef.current) return;
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    
    const currentScrollTop = el.scrollTop;
    const distanceFromBottom = el.scrollHeight - currentScrollTop - el.clientHeight;
    
    if (currentScrollTop < lastScrollTopRef.current - 5) {
      shouldAutoScrollRef.current = false;
    } else if (distanceFromBottom < 20) {
      shouldAutoScrollRef.current = true;
    }
    
    lastScrollTopRef.current = currentScrollTop;
  }, []);

  // Handle showing dispatch details
  const handleShowDispatchDetails = useCallback((job: {
    id: string;
    type: string;
    origin_name: string | null;
    sub_origin_name: string | null;
    total_leads: number;
    valid_leads: number;
    sent_count: number;
    failed_count: number;
    status: string;
    started_at: string | null;
    completed_at: string | null;
  }) => {
    const dispatchData: DispatchData = {
      id: job.id,
      type: job.type,
      originName: job.origin_name,
      subOriginName: job.sub_origin_name,
      totalLeads: job.total_leads,
      validLeads: job.valid_leads,
      sentCount: job.sent_count,
      failedCount: job.failed_count,
      status: job.status,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      subject: sidePanelSubject || undefined
    };
    
    setSidePanelDispatchData(dispatchData);
    setSidePanelMode('dispatch_details');
    setSidePanelOpen(true);
    
    logAction('system', 'Disparo concluído', `${job.sent_count} emails enviados com sucesso`);
  }, [sidePanelSubject, logAction]);

  // Handle dispatch errors
  const handleDispatchError = useCallback((error: { failedCount: number; lastError?: string; leadEmail?: string }) => {
    const errorMessage: Message = {
      id: crypto.randomUUID(),
      content: `⚠️ **Falha no envio detectada!**\n\nO Resend retornou um erro: \`${error.lastError || 'Erro desconhecido'}\`${error.leadEmail ? `\nEmail: ${error.leadEmail}` : ''}\n\nTotal de falhas até agora: ${error.failedCount}\n\nO disparo continua para os outros leads.`,
      role: "assistant",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, errorMessage]);
    logAction('system', 'DISPATCH_ERROR', `Failed: ${error.failedCount}, Error: ${error.lastError}`);
  }, [logAction]);

  // Handle dispatch completion
  const handleDispatchComplete = useCallback((result: { sent: number; failed: number; errorLog?: Array<{ leadEmail: string; error: string }> }) => {
    const hasErrors = result.failed > 0;
    
    let content: string;
    if (hasErrors) {
      const errorDetails = result.errorLog?.slice(0, 3).map(e => `• ${e.leadEmail}: ${e.error}`).join('\n') || 'Detalhes indisponíveis';
      content = `📊 **Disparo concluído com falhas**\n\n✅ ${result.sent} emails enviados com sucesso\n❌ ${result.failed} emails falharam\n\n**Principais erros:**\n${errorDetails}`;
    } else {
      content = `🎉 **Disparo concluído com sucesso!**\n\nTodos os ${result.sent} emails foram enviados sem erros.`;
    }
    
    const completeMessage: Message = {
      id: crypto.randomUUID(),
      content,
      role: "assistant",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, completeMessage]);
    logAction('system', 'DISPATCH_COMPLETE', `Sent: ${result.sent}, Failed: ${result.failed}`);
  }, [logAction]);

  // Handler for HTML submit from reload
  const handleHtmlSubmitFromReload = useCallback((html: string, subOriginId: string, dispatchType: string) => {
    setSidePanelHtml(html);
    setSidePanelContext({ subOriginId, dispatchType });
    setSidePanelOpen(true);
    setHtmlSource('user');
    logAction('user', 'Colou HTML do email', `${html.length} caracteres`);
  }, [logAction]);

  // Handler for email generated
  const handleEmailGenerated = useCallback((html: string, subOriginId: string, dispatchType: string) => {
    setSidePanelHtml(html);
    setSidePanelContext({ subOriginId, dispatchType });
    setSidePanelOpen(true);
    setHtmlSource('ai');
    logAction('ai', 'Gerou HTML do email', `${html.length} caracteres`);
  }, [logAction]);

  // Function to reconstruct component from componentData
  function reconstructMessageComponent(componentData: MessageComponentData, messageId: string): React.ReactNode {
    switch (componentData.type) {
      case 'email_choice': {
        // LeadsPreviewComponent removed - not needed in chat
        return null;
      }
      case 'leads_preview': {
        // LeadsPreviewComponent removed - not needed in chat
        return null;
      }
      case 'html_editor': {
        const { subOriginId: soId, dispatchType: dt, initialContent } = (componentData.data || {}) as any;
        if (!soId || !dt) return null;
        return (
          <div className="mt-4 w-full">
            <HtmlEditorComponent
              onSubmit={(html) => handleHtmlSubmitFromReload(html, soId, dt)}
              initialContent={initialContent || ''}
            />
          </div>
        );
      }
      case 'copy_choice':
      case 'copy_input':
        return null;
      case 'email_generator_streaming': {
        const { subOriginId: soId, dispatchType: dt, copyText, companyName, productService } = (componentData.data || {}) as any;
        if (!soId || !dt) return null;
        if (!copyText) {
          return <div className="mt-4 text-sm text-muted-foreground">Geração em andamento…</div>;
        }
        return (
          <div className="mt-4 w-full">
            <CopyToHtmlGenerator
              copyText={copyText}
              companyName={companyName || ''}
              productService={productService || ''}
              onGenerated={(html) => handleEmailGenerated(html, soId, dt)}
            />
          </div>
        );
      }
      case 'email_generator': {
        const { subOriginId: soId, dispatchType: dt } = (componentData.data || {}) as any;
        if (!soId || !dt) return null;
        return (
          <div className="mt-4 p-4 rounded-xl border border-border/40 bg-muted/30">
            <p className="text-sm text-foreground">
              Para continuar, descreva no chat abaixo o email que você quer criar.
            </p>
            <button
              type="button"
              onClick={() => {
                setPendingEmailContext({ subOriginId: soId, dispatchType: dt });
                toast.message("Ok! Agora digite a descrição no chat.");
              }}
              className="mt-3 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
            >
              Continuar
            </button>
          </div>
        );
      }
      case 'dispatch_progress': {
        const { jobId } = (componentData.data || {}) as any;
        if (!jobId) return null;
        return (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openDispatchLeadsPanel(jobId)}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Acompanhar disparo
            </Button>
          </div>
        );
      }
      case 'origins_list': {
        const { origins } = (componentData.data || {}) as any;
        if (!origins) return null;
        return (
          <div className="mt-4 space-y-4">
            <OriginsListComponent origins={origins} onSelect={handleOriginSelect} />
          </div>
        );
      }
      case 'ai_work_details': {
        const { steps } = (componentData.data || {}) as any;
        if (!steps) return null;
        return (
          <div className="mt-4">
            <AIWorkDetails steps={steps} />
          </div>
        );
      }
      case 'data_intelligence': {
        const { insightSteps, emailCard } = (componentData.data || {}) as any;
        return (
          <div className="mt-4 space-y-4 w-full">
            {insightSteps && <DataIntelligence steps={insightSteps} />}
            {emailCard && emailCard.generatedHtml && (
              <EmailChatCard
                subject={emailCard.subject || 'Email gerado'}
                chatName={emailCard.emailName || 'Email'}
                previewHtml={emailCard.generatedHtml}
                onClick={() => {
                  const normalizedHtml = normalizeSidePanelHtml(emailCard.generatedHtml);
                  setSidePanelHtml(normalizedHtml);
                  setSidePanelSubject(emailCard.subject || '');
                  setSidePanelPreheader(emailCard.preheader || '');
                  setSidePanelMode(emailCard.mode || 'email');
                  setSidePanelShowCodePreview(true);
                  setSidePanelOpen(true);
                }}
              />
            )}
          </div>
        );
      }
      case 'email_setup': {
        const { source, title } = (componentData.data || {}) as any;
        const buttonText = source === 'html_ready' ? 'Configurar email' : 'Abrir editor';
        return (
          <div className="mt-4 w-full">
            <EmailChatCard
              subject={title || 'HTML pronto'}
              chatName={buttonText}
              previewHtml=""
              onClick={() => {
                setSidePanelMode('email');
                setSidePanelShowCodePreview(true);
                setSidePanelOpen(true);
              }}
            />
          </div>
        );
      }
      case 'csv_preview': {
        const { fileName, totalRows, columns, previewData, mappedColumns: mc } = (componentData.data || {}) as any;
        if (!fileName) return null;
        return (
          <div className="w-full">
            <CsvChatCard
              fileName={fileName}
              totalRows={totalRows}
              columns={columns}
              previewData={previewData}
              mappedColumns={mc}
            />
          </div>
        );
      }
      default:
        return null;
    }
  }

  // Handle origin selection
  const handleOriginSelect = useCallback(async (subOriginId: string, subOriginName: string, originName: string) => {
    setSelectedOriginData({ subOriginId, subOriginName, originName });
    setDispatchType('email');
    
    logAction('user', `Selecionou a lista "${subOriginName}" da origem "${originName}"`, 'Disparo por email');
    
    const autoMessage = `Usar a lista "${subOriginName}" da origem "${originName}"`;
    
    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: autoMessage,
      role: "user",
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: `FETCH_LEADS:email:${subOriginId}`,
          conversationId: conversationIdRef.current
        }),
      });
      
      if (!response.ok) throw new Error("Failed to list leads");
      
      const result = await response.json();
      
      if (result.type === 'leads_preview') {
        const componentData: MessageComponentData = {
          type: 'leads_preview',
          data: { preview: result.data, subOriginId, dispatchType: 'email' }
        };
        
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          content: `Encontrei **${result.data.totalLeads}** leads na lista "${subOriginName}".\n\n📧 **${result.data.validLeads}** têm email válido para disparo.\n\nAgora sobre o email, qual opção você prefere?\n\n1️⃣ Criar do zero (eu crio a copy + o HTML)\n2️⃣ Já tenho a copy (você envia o texto e eu transformo em HTML)\n3️⃣ Já tenho o HTML pronto (você cola aqui e eu uso direto)\n\nResponda com 1, 2 ou 3.`,
          role: "assistant",
          timestamp: new Date(),
          componentData,
          component: reconstructMessageComponent(componentData, '')
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        logAction('system', 'Leads carregados', `${result.data.validLeads} válidos de ${result.data.totalLeads} total`);
      }
    } catch (error) {
      console.error("Error listing leads:", error);
      toast.error("Erro ao carregar leads");
    } finally {
      setIsLoading(false);
    }
  }, [logAction]);

  const showCrmOriginsList = useCallback(async () => {
    if (isLoading || isConversationLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "LIST_ORIGINS",
          conversationId: conversationIdRef.current,
        }),
      });

      if (!response.ok) throw new Error("Failed to load CRM origins");

      const result = await response.json();

      if (result.type !== "origins") {
        throw new Error(`Unexpected response: ${result?.type || "unknown"}`);
      }

      const componentData: MessageComponentData = {
        type: "origins_list",
        data: { origins: result.data },
      };

      const messageId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: messageId,
        content: "Escolha uma lista do CRM para o disparo:",
        role: "assistant",
        timestamp: new Date(),
        componentData,
        component: reconstructMessageComponent(componentData, messageId),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      logAction("system", "Listas do CRM carregadas");
    } catch (error) {
      console.error("Error loading CRM origins:", error);
      toast.error("Erro ao carregar listas do CRM");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isConversationLoading, logAction]);

  // Load conversation from URL
  useEffect(() => {
    const convId = searchParams.get('conversation') || searchParams.get('conv');
    const isNewConversation = searchParams.get('new') === '1';

    // Guard only when we actually have a conversation id to skip
    if (skipNextUrlLoadRef.current && skipNextUrlLoadRef.current === convId) {
      skipNextUrlLoadRef.current = null;
      return;
    }

    // Handle explicit ?new=1 signal - always reset to fresh state
    if (isNewConversation) {
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
        activeAbortRef.current = null;
      }
      activeRunIdRef.current = null;
      activeRunConversationIdRef.current = null;
      isProcessingMessageRef.current = false;
      isCreatingConversationRef.current = false;

      // Reset UI/state
      suppressUrlSyncRef.current = true;
      setCurrentConversationId(null);
      conversationIdRef.current = null;
      setMessages([]);
      messagesRef.current = [];
      setCsvLeads(null);
      setCsvListId(null);
      setCsvFileName('lista.csv');
      setCsvRawData([]);
      setCsvHeaders([]);
      setCsvMappedColumns({});
      setPendingEmailContext(null);
      setSidePanelOpen(false);
      setSidePanelRestoredFromDB(false);
      setSidePanelHtml('');
      setSidePanelSubject('');
      setSidePanelPreheader('');
      setSidePanelContext(null);
      setSelectedOriginData(null);
      setDispatchType(null);
      setActionHistory([]);
      setSidePanelDispatchData(null);
      setPendingQuestion(null);
      setSidePanelGenerating(false);
      setSidePanelEditing(false);
      setIsLoading(false);
      setInitialLoadDone(true);
      isInitialPageLoadRef.current = false;

      // IMPORTANT: remove ?new=1 right away, so sending the first message doesn't trigger another reset
      setSearchParams({}, { replace: true });

      setTimeout(() => {
        suppressUrlSyncRef.current = false;
      }, 100);
      return;
    }
    
    if (convId && convId !== currentConversationId) {
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
        activeAbortRef.current = null;
      }
      activeRunIdRef.current = null;
      activeRunConversationIdRef.current = null;
      isProcessingMessageRef.current = false;
      isCreatingConversationRef.current = false;
      
      if (isLoading) setIsLoading(false);
      if (sidePanelGenerating) setSidePanelGenerating(false);
      
      if (loadingConversationIdRef.current === convId) return;
      loadingConversationIdRef.current = convId;
      isHydratingRef.current = true;
      setIsConversationLoading(true);
      
      const loadConversation = async () => {
        try {
          const { data, error } = await supabase
            .from("dispatch_conversations")
            .select("*")
            .eq("id", convId)
            .single();
          
          if (error || !data) {
            console.error("Conversation not found:", convId);
            // Reset all state when conversation doesn't exist (deleted)
            setCurrentConversationId(null);
            conversationIdRef.current = null;
            setMessages([]);
            messagesRef.current = [];
            setCsvLeads(null);
            setCsvListId(null);
            setCsvFileName('lista.csv');
            setCsvRawData([]);
            setCsvHeaders([]);
            setCsvMappedColumns({});
            setPendingEmailContext(null);
            setSidePanelOpen(false);
            setSidePanelRestoredFromDB(false);
            setSidePanelHtml('');
            setSidePanelSubject('');
            setSidePanelPreheader('');
            setSidePanelContext(null);
            setSelectedOriginData(null);
            setDispatchType(null);
            setActionHistory([]);
            setSidePanelDispatchData(null);
            setPendingQuestion(null);
            setSidePanelGenerating(false);
            setSidePanelEditing(false);
            setIsLoading(false);
            creationLockRef.current = null;
            
            // Clear URL
            setSearchParams({}, { replace: true });
            setInitialLoadDone(true);
            isHydratingRef.current = false;
            setIsConversationLoading(false);
            loadingConversationIdRef.current = null;
            return;
          }
          
          const rawData = data.messages as any;
          const isNewFormat = rawData && typeof rawData === 'object' && 'messages' in rawData;
          
          const messagesArray = isNewFormat 
            ? (rawData.messages || [])
            : (Array.isArray(rawData) ? rawData : []);
          
          const loadedMessages: Message[] = messagesArray.map((m: any) => ({
            id: m.id,
            content: m.content,
            role: m.role,
            timestamp: new Date(m.timestamp),
            componentData: m.componentData,
          }));
          
          setMessagesSnapshot(loadedMessages);
          setConversationId(convId);
          
          if (isNewFormat && rawData.sidePanelState) {
            const sp = rawData.sidePanelState;
            if (sp.html) {
              const normalizedHtml = normalizeSidePanelHtml(sp.html);
              setSidePanelHtml(normalizedHtml);
            }
            if (sp.subject) setSidePanelSubject(sp.subject);
            if (sp.preheader) setSidePanelPreheader(sp.preheader);
            if (sp.context) setSidePanelContext(sp.context);
            if (sp.workflowSteps) setSidePanelWorkflowSteps(sp.workflowSteps);
            if (sp.showCodePreview !== undefined) setSidePanelShowCodePreview(sp.showCodePreview);
            if (sp.title) setSidePanelTitle(sp.title);
            if (sp.mode) setSidePanelMode(sp.mode);
          }
          
          if (isNewFormat && rawData.selectedOriginData) {
            setSelectedOriginData(rawData.selectedOriginData);
          }
          if (isNewFormat && rawData.dispatchType) {
            setDispatchType(rawData.dispatchType);
          }
          if (isNewFormat && rawData.actionHistory) {
            setActionHistory(rawData.actionHistory);
          }
          if (isNewFormat && rawData.htmlSource) {
            setHtmlSource(rawData.htmlSource);
          }
          
          if (isNewFormat && rawData.csvState) {
            const cs = rawData.csvState as any;
            if (cs.csvListId !== undefined) setCsvListId(cs.csvListId || null);
            if (cs.csvFileName) setCsvFileName(cs.csvFileName);
            if (cs.csvMappedColumns) setCsvMappedColumns(cs.csvMappedColumns);
            
            if (cs.csvListId) {
              const { data: recipients } = await supabase
                .from('dispatch_csv_list_recipients')
                .select('id, name, email, whatsapp')
                .eq('list_id', cs.csvListId)
                .limit(100);
              
              if (recipients && recipients.length > 0) {
                setCsvLeads(recipients.map(r => ({
                  name: r.name || '',
                  email: r.email,
                  whatsapp: r.whatsapp || undefined
                })));
              }
            }
          }

          const { data: activeJob } = await supabase
            .from('dispatch_jobs')
            .select('id, status')
            .eq('conversation_id', convId)
            .in('status', ['pending', 'running'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (activeJob) {
            console.log('[DISPARO] Found active dispatch job:', activeJob.id);
            setActiveJobId(activeJob.id);
            setSidePanelMode('dispatch_leads');
            setSidePanelShowCodePreview(false);
            if (isInitialPageLoadRef.current) {
              setSidePanelRestoredFromDB(true);
            }
            setSidePanelOpen(true);
          }
          
          isInitialPageLoadRef.current = false;
          setInitialLoadDone(true);
        } catch (error) {
          console.error("Error loading conversation from URL:", error);
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('conversation');
          newParams.delete('conv');
          setSearchParams(newParams);
          setInitialLoadDone(true);
        } finally {
          isHydratingRef.current = false;
          if (loadingConversationIdRef.current === convId) {
            setIsConversationLoading(false);
            loadingConversationIdRef.current = null;
          }
        }
      };
      loadConversation();
    } else if (!convId && currentConversationId) {
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
        activeAbortRef.current = null;
      }
      activeRunIdRef.current = null;
      activeRunConversationIdRef.current = null;
      isProcessingMessageRef.current = false;
      isCreatingConversationRef.current = false;
      
      suppressUrlSyncRef.current = true;
      setCurrentConversationId(null);
      conversationIdRef.current = null;
      setMessages([]);
      messagesRef.current = [];
      setCsvLeads(null);
      setCsvListId(null);
      setCsvFileName('lista.csv');
      setCsvRawData([]);
      setCsvHeaders([]);
      setCsvMappedColumns({});
      setPendingEmailContext(null);
      setSidePanelOpen(false);
      setSidePanelRestoredFromDB(false);
      setSidePanelHtml('');
      setSidePanelSubject('');
      setSidePanelPreheader('');
      setSidePanelContext(null);
      setSelectedOriginData(null);
      setDispatchType(null);
      setActionHistory([]);
      setSidePanelDispatchData(null);
      setPendingQuestion(null);
      setIsLoading(false);
      setInitialLoadDone(true);
      setTimeout(() => { suppressUrlSyncRef.current = false; }, 100);
    } else if (!convId && !initialLoadDone) {
      isInitialPageLoadRef.current = false;
      setInitialLoadDone(true);
    }
  }, [searchParams, currentConversationId, isLoading, sidePanelGenerating]);

  // Reconstruct components after messages are loaded (avoid infinite loops)
  useEffect(() => {
    if (!initialLoadDone) return;
    
    // Only process if there are messages that need component reconstruction
    const needsReconstruction = messages.some(m => m.componentData && m.component === undefined);
    if (!needsReconstruction) return;
    
    setMessages((prev) => {
      let hasChanges = false;
      const updated = prev.map((m) => {
        if (m.componentData && m.component === undefined) {
          hasChanges = true;
          return {
            ...m,
            component: reconstructMessageComponent(m.componentData, m.id),
          };
        }
        return m;
      });
      // Only return new array if we actually made changes
      return hasChanges ? updated : prev;
    });
  }, [initialLoadDone]);

  // Track last saved signature
  const lastSavedSignatureRef = useRef<string>('');
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate state signature for dirty checking
  const generateStateSignature = useCallback(() => {
    const msgSignature = messages.map(m => 
      `${m.id}:${m.role}:${m.content.length}:${m.componentData ? JSON.stringify(m.componentData).length : 0}`
    ).join('|');
    const panelSignature = `${sidePanelHtml.length}:${sidePanelSubject}:${sidePanelOpen}`;
    return `${msgSignature}::${panelSignature}`;
  }, [messages, sidePanelHtml, sidePanelSubject, sidePanelOpen]);

  // Auto-save conversation
  const saveConversationNow = useCallback(async (forceCreate = false, customTitle?: string): Promise<string | null> => {
    const currentMessages = messagesRef.current;
    const convId = conversationIdRef.current;
    
    if (currentMessages.length === 0) return null;
    
    if (isSavingRef.current) {
      console.log('[DisparoView] Save already in progress, skipping duplicate');
      return null;
    }
    
    isSavingRef.current = true;

    try {
      let title = customTitle || "Nova conversa";
      
      if (!customTitle) {
        if (sidePanelHtml) {
          const subjectMatch = sidePanelHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (subjectMatch && subjectMatch[1]) {
            title = `📧 ${subjectMatch[1].slice(0, 40)}${subjectMatch[1].length > 40 ? '...' : ''}`;
          }
        }
        
        if (title === "Nova conversa" && sidePanelContext?.dispatchType === 'email') {
          const selectedName = selectedOriginData?.subOriginName || '';
          if (selectedName) {
            title = `📧 Email para ${selectedName.slice(0, 35)}${selectedName.length > 35 ? '...' : ''}`;
          }
        }
        
        if (title === "Nova conversa") {
          const firstUserMessage = currentMessages.find(m => m.role === "user");
          if (firstUserMessage) {
              let cleanContent = firstUserMessage.content
                .replace(/\[(Agente:[^\]]+|CONTEXT:[^\]]+|Search)\]\s*/gi, '')
                .replace(/^CONTEXT\s*/i, '')
                .replace(/^copy\s*/i, '')
                .replace(/text-copyright/gi, '')
                .replace(/\bcrm\b/gi, 'CRM')
                .replace(/^\s*/, '')
                .trim();
            
            if (cleanContent.length > 0) {
              title = cleanContent.slice(0, 50) + (cleanContent.length > 50 ? "..." : "");
            }
          }
        }
      }

      const messagesJson = currentMessages.map(m => {
        const msg: Record<string, any> = {
          id: m.id,
          content: m.content,
          role: m.role,
          timestamp: m.timestamp.toISOString(),
        };
        if (m.componentData) {
          msg.componentData = m.componentData;
        }
        return msg;
      });

      const conversationData = {
        messages: messagesJson,
        sidePanelState: {
          html: sidePanelHtml,
          subject: sidePanelSubject,
          preheader: sidePanelPreheader,
          isOpen: sidePanelOpen,
          context: sidePanelContext,
          workflowSteps: sidePanelWorkflowSteps,
          showCodePreview: sidePanelShowCodePreview,
          title: sidePanelTitle,
          mode: sidePanelMode,
        },
        selectedOriginData,
        dispatchType,
        actionHistory,
        htmlSource,
        csvState: {
          csvListId,
          csvFileName,
          csvMappedColumns,
        },
      };

      if (convId && !forceCreate) {
        const { error } = await supabase
          .from("dispatch_conversations")
          .update({ 
            messages: conversationData as any,
            title,
            updated_at: new Date().toISOString()
          })
          .eq("id", convId);

        if (error) throw error;
        console.log('[DisparoView] Saved conversation', convId, 'with', currentMessages.length, 'messages');
        return convId;
      } else {
        const { data, error } = await supabase
          .from("dispatch_conversations")
          .insert({ 
            messages: conversationData as any,
            title,
            workspace_id: currentWorkspace?.id
          })
          .select()
          .single();

        if (error) throw error;
        console.log('[DisparoView] Created conversation', data.id, 'with', currentMessages.length, 'messages');
        return data.id;
      }
    } catch (error) {
      console.error("Error saving conversation:", error);
      return null;
    } finally {
      isSavingRef.current = false;
      if (forceCreate) {
        isCreatingConversationRef.current = false;
      }
    }
  }, [sidePanelHtml, sidePanelSubject, sidePanelOpen, sidePanelContext, sidePanelWorkflowSteps, sidePanelShowCodePreview, sidePanelTitle, sidePanelMode, selectedOriginData, dispatchType, actionHistory, htmlSource, csvListId, csvFileName, csvMappedColumns, sidePanelPreheader]);

  // Auto-save effect
  useEffect(() => {
    if (!initialLoadDone) return;
    if (messages.length === 0) return;
    if (isHydratingRef.current) return;

    const currentSignature = generateStateSignature();

    if (currentSignature === lastSavedSignatureRef.current) return;

    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }

    const lastMessage = messages[messages.length - 1];
    const isUserJustSent = lastMessage?.role === 'user';

    // CRITICAL: Auto-save should NEVER create new conversations
    // All conversation creation must happen exclusively in handleSend
    if (!currentConversationId) {
      console.log('[DisparoView] Auto-save skipped - no conversation ID (handleSend will create)');
      return;
    }

    const doSave = () => {
      saveConversationNow().then(() => {
        lastSavedSignatureRef.current = currentSignature;
      });
    };

    const shouldSaveImmediately = isUserJustSent || !isLoading;
    const shouldThrottle = !shouldSaveImmediately || sidePanelGenerating || sidePanelEditing;

    if (shouldThrottle) {
      saveDebounceRef.current = setTimeout(doSave, 600);
    } else {
      doSave();
    }

    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
    };
  }, [
    messages,
    sidePanelHtml,
    sidePanelSubject,
    sidePanelOpen,
    currentConversationId,
    initialLoadDone,
    saveConversationNow,
    generateStateSignature,
    isLoading,
    sidePanelGenerating,
    sidePanelEditing,
  ]);

  // Save on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (conversationIdRef.current && messagesRef.current.length > 0) {
        try {
          const conversationData = {
            messages: messagesRef.current.map(m => ({
              id: m.id,
              content: m.content,
              role: m.role,
              timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
              componentData: m.componentData,
            })),
            sidePanelState: {
              html: sidePanelHtml,
              subject: sidePanelSubject,
              isOpen: sidePanelOpen,
            },
          };
          
          const url = `https://ytdfwkchsumgdvcroaqg.supabase.co/rest/v1/dispatch_conversations?id=eq.${conversationIdRef.current}`;
          const payload = JSON.stringify({
            messages: conversationData,
            updated_at: new Date().toISOString()
          });
          
          navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
        } catch (error) {
          console.error('[DisparoView] beforeunload save error:', error);
        }
        
        saveConversationNow();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveConversationNow, sidePanelHtml, sidePanelSubject, sidePanelOpen]);

  // Reset signature when conversation changes
  useEffect(() => {
    lastSavedSignatureRef.current = '';
  }, [currentConversationId]);

  // Sync URL when conversation ID changes
  useEffect(() => {
    if (suppressUrlSyncRef.current) return;
    if (!currentConversationId) return;
    
    const urlConvId = searchParams.get('conversation') || searchParams.get('conv');
    
    if (urlConvId && urlConvId !== currentConversationId) {
      return;
    }
    
    if (!urlConvId) {
      setSearchParams({ conversation: currentConversationId }, { replace: true });
    }
  }, [currentConversationId, searchParams, setSearchParams]);

  // Auto-scroll effect
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scheduleScrollToBottom();
    }
    return () => {
      if (scrollRAFRef.current) {
        cancelAnimationFrame(scrollRAFRef.current);
      }
    };
  }, [messages, scheduleScrollToBottom]);

  // Execute dispatch command
  const executeDispatch = useCallback(async (command: string) => {
    const preparingMessageId = crypto.randomUUID();
    const preparingMessage: Message = {
      id: preparingMessageId,
      content: "⏳ Preparando disparo...",
      role: "assistant",
      timestamp: new Date(),
      component: <DispatchPreparingIndicator />,
    };
    setMessages(prev => [...prev, preparingMessage]);
    
    setIsLoading(true);

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, conversationId: conversationIdRef.current }),
      });

      if (!response.ok) throw new Error("Dispatch failed");

      const result = await response.json();
      console.log("Dispatch result:", result);

      if (result.type === 'dispatch_started') {
        openDispatchLeadsPanel(result.data.jobId);
        logAction('system', `Disparo iniciado`, `Enviando para ${result.data.validLeads} leads`);
        
        setMessages(prev => prev.map(m => 
          m.id === preparingMessageId 
            ? {
                ...m,
                content: `🚀 Disparo iniciado! Enviando para ${result.data.validLeads} leads...`,
                componentData: {
                  type: 'dispatch_progress' as const,
                  data: { jobId: result.data.jobId }
                },
                component: (
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDispatchLeadsPanel(result.data.jobId)}
                      className="gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Acompanhar disparo
                    </Button>
                  </div>
                ),
              }
            : m
        ));
        toast.success("Disparo iniciado com sucesso!");
      } else {
        setMessages(prev => prev.filter(m => m.id !== preparingMessageId));
      }
    } catch (error) {
      console.error("Error starting dispatch:", error);
      setMessages(prev => prev.filter(m => m.id !== preparingMessageId));
      toast.error("Erro ao iniciar disparo");
    } finally {
      setIsLoading(false);
    }
  }, [logAction, openDispatchLeadsPanel]);

  // Process commands from Grok's response
  const processCommands = async (content: string): Promise<{ cleanContent: string; components: React.ReactNode[]; csvChanged: boolean }> => {
    const commandPattern = /\[COMMAND:([^\]]+)\]/g;
    const commands: string[] = [];
    let match;
    
    while ((match = commandPattern.exec(content)) !== null) {
      commands.push(match[1]);
    }

    const components: React.ReactNode[] = [];
    let cleanContent = content;
    let csvChanged = false;
    
    // Process CSV operations if present
    const csvOperations = parseCsvOperations(content);
    if (csvOperations.length > 0 && csvLeads && csvLeads.length > 0) {
      console.log('[DisparoView] Processing CSV operations:', csvOperations);
      
      const result = executeCsvOperations(
        csvLeads, 
        csvRawData, 
        csvHeaders, 
        csvMappedColumns, 
        csvOperations
      );
      
      setCsvLeads(result.leads);
      setCsvRawData(result.rawData);
      setCsvHeaders(result.headers);
      csvChanged = true;
      
      result.changes.forEach(change => {
        logAction('system', 'CSV tratado', change);
      });
      
      if (csvListId) {
        try {
          await supabase
            .from('dispatch_csv_list_recipients')
            .delete()
            .eq('list_id', csvListId);
          
          const recipients = result.leads
            .filter(l => l.email && l.email.includes('@'))
            .map(l => ({
              list_id: csvListId,
              name: l.name || '',
              email: l.email!,
              whatsapp: l.whatsapp
            }));
          
          if (recipients.length > 0) {
            await supabase
              .from('dispatch_csv_list_recipients')
              .insert(recipients);
          }
          
          console.log('[DisparoView] CSV list updated in database:', csvListId, 'with', recipients.length, 'leads');
        } catch (error) {
          console.error('[DisparoView] Error updating CSV in database:', error);
        }
      }
      
      toast.success(`Lista tratada! ${result.leads.length} leads restantes`);
    }
    
    cleanContent = stripCsvOperations(cleanContent);
    
    cleanContent = cleanContent
      .replace(/\[COMMAND:[^\]]+\]/g, '')
      .replace(/\[TEMPLATE_CONTENT\][\s\S]*?\[\/TEMPLATE_CONTENT\]/g, '')
      .replace(/\[\/TEMPLATE_CONTENT\]/g, '')
      .replace(/\[TEMPLATE_CONTENT\]/g, '')
      .replace(/```html[\s\S]*?```/g, '')
      .replace(/<!DOCTYPE[\s\S]*?<\//gi, '')
      .trim();

    for (const command of commands) {
      cleanContent = cleanContent.replace(`[COMMAND:${command}]`, '');

      if (command.startsWith('START_DISPATCH:')) {
        console.log("[INFO] START_DISPATCH detected - executing (user confirmed via chat)");
        
        const parts = command.split(':');
        const type = parts[1] || 'email';
        const templateType = parts[3] || 'html';
        
        if (csvListId) {
          console.log("[INFO] Using CSV list for dispatch:", csvListId);
          const encodedHtml = sidePanelHtml ? btoa(encodeURIComponent(sidePanelHtml)) : '';
          const encodedSubject = sidePanelSubject ? btoa(encodeURIComponent(sidePanelSubject)) : '';
          
          const csvCommand = `START_DISPATCH_CSV:${type}:${csvListId}:${templateType}:${currentConversationId || ''}:${encodedSubject}:${encodedHtml}`;
          console.log("[INFO] CSV dispatch command:", { 
            type, 
            csvListId, 
            templateType, 
            hasSubject: !!sidePanelSubject, 
            hasHtml: !!sidePanelHtml 
          });
          
          await executeDispatch(csvCommand);
          continue;
        }
        
        const actualSubOriginId = selectedOriginData?.subOriginId || subOriginId;
        
        if (!actualSubOriginId) {
          console.error("[ERROR] No subOriginId or csvListId available for dispatch");
          toast.error("Erro: Nenhuma lista selecionada para o disparo.");
          continue;
        }
        
        const encodedHtml = sidePanelHtml ? btoa(encodeURIComponent(sidePanelHtml)) : '';
        const encodedSubject = sidePanelSubject ? btoa(encodeURIComponent(sidePanelSubject)) : '';
        
        const correctedCommand = `START_DISPATCH:${type}:${actualSubOriginId}:${templateType}:${currentConversationId || ''}:${encodedSubject}:${encodedHtml}`;
        console.log("[INFO] Corrected command with HTML/Subject:", { 
          type, 
          actualSubOriginId, 
          templateType, 
          hasSubject: !!sidePanelSubject, 
          hasHtml: !!sidePanelHtml,
          subjectPreview: sidePanelSubject?.substring(0, 50)
        });
        
        await executeDispatch(correctedCommand);
        continue;
      }

      try {
        const response = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, conversationId: conversationIdRef.current }),
        });

        if (!response.ok) throw new Error("Command failed");

        const result = await response.json();
        console.log("Command result:", result);

        if (result.type === 'origins') {
          const originsComponent = (
            <OriginsListComponent 
              key={`origins-${Date.now()}`}
              origins={result.data}
              onSelect={handleOriginSelect}
            />
          );
          components.push(originsComponent);
        }

        if (result.type === 'leads_preview') {
          // LeadsPreviewComponent removed - not needed in chat
        }

        if (result.type === 'dispatch_updated') {
          toast.success(`Disparo ${result.data.status === 'paused' ? 'pausado' : result.data.status === 'running' ? 'retomado' : 'cancelado'}`);
        }

      } catch (error) {
        console.error("Error processing command:", command, error);
      }
    }

    return { cleanContent: cleanContent.trim(), components, csvChanged };
  };

  // Handle sending messages - main function (large, continues with chat logic)
  const handleSend = async (message: string, files?: File[], model?: AIModel) => {
    if (!message.trim() && (!files || files.length === 0)) return;
    
    if (isProcessingMessageRef.current) {
      console.log('[DisparoView] Already processing message, ignoring duplicate');
      return;
    }
    
    if (activeAbortRef.current) {
      activeAbortRef.current.abort();
    }
    
    const abortController = new AbortController();
    activeAbortRef.current = abortController;
    const runId = crypto.randomUUID();
    activeRunIdRef.current = runId;
    activeRunConversationIdRef.current = conversationIdRef.current;
    
    isProcessingMessageRef.current = true;
    
    shouldAutoScrollRef.current = true;
      
    let csvContent = '';
    let csvFileNameLocal = '';
    let imageBase64 = '';
    let imageFile: File | null = null;
    let csvParseResult: CsvParseResult | null = null;
    
    if (files && files.length > 0) {
      const csvFile = files.find(f => f.name.endsWith('.csv'));
      if (csvFile) {
        csvFileNameLocal = csvFile.name;
        csvContent = await csvFile.text();
        csvParseResult = parseCSVAdvanced(csvContent);
        
        if (csvParseResult.leads.length > 0) {
          setCsvLeads(csvParseResult.leads);
          setCsvFileName(csvFile.name);
          setCsvRawData(csvParseResult.rawData);
          setCsvHeaders(csvParseResult.headers);
          setCsvMappedColumns(csvParseResult.mappedColumns);
        }
      }
      
      const imgFile = files.find(f => f.type.startsWith('image/'));
      if (imgFile) {
        imageFile = imgFile;
        const reader = new FileReader();
        imageBase64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(imgFile);
        });
      }
    }
    
    const displayMessageContent = stripInternalContext(message);
    
    let messageContent = displayMessageContent;
    if (imageFile) {
      messageContent = displayMessageContent || 'Analise esta imagem';
    }
    
    // Early detection: open side panel IMMEDIATELY if user chose "HTML pronto"
    const userChoseHtmlReadyEarly = /\b(3|três|opção\s*3|tenho\s+(o\s+)?html|já\s+tenho\s+(o\s+)?html|html\s+pronto|colar\s+(o\s+)?html|quero\s+colar|vou\s+colar)\b/i.test(messageContent);
    
    // Early detection: user confirming dispatch
    const userConfirmingDispatch = /^\s*(sim|pode|ok|vamos|disparar|pode disparar|enviar|manda|confirmo|confirma|bora|vai|envie|dispara)\s*[.!]?\s*$/i.test(messageContent);
    
    // Handle "HTML pronto" - open panel and add EmailChatCard
    if (userChoseHtmlReadyEarly && !sidePanelHtml) {
      setSidePanelHtml('');
      setSidePanelSubject('');
      setSidePanelPreheader('');
      setSidePanelMode('email');
      setSidePanelShowCodePreview(true);
      setSidePanelOpen(true);
      setHtmlSource('user');
      logAction('system', 'Painel aberto para colar HTML', 'Usuário escolheu opção 3');
      
      // Add user message first
      const userMsg: Message = {
        id: crypto.randomUUID(),
        content: messageContent,
        role: "user",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMsg]);
      
      // Add assistant message with EmailChatCard component
      const emailSetupComponentData: MessageComponentData = {
        type: 'email_setup' as const,
        data: { source: 'html_ready', title: 'Configurar email (HTML pronto)' }
      };
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        content: "Perfeito! Abri o painel lateral para você. Cole seu HTML na aba 'Código', preencha o assunto e preheader, e depois me avise quando estiver pronto!",
        role: "assistant",
        timestamp: new Date(),
        componentData: emailSetupComponentData,
        component: (
          <div className="mt-4 w-full">
            <EmailChatCard
              subject="Configurar email (HTML pronto)"
              chatName="Abrir editor"
              previewHtml=""
              onClick={() => {
                setSidePanelMode('email');
                setSidePanelShowCodePreview(true);
                setSidePanelOpen(true);
              }}
            />
          </div>
        )
      };
      setMessages(prev => [...prev, assistantMsg]);
      
      // Save conversation
      setTimeout(() => saveConversationNow(), 100);
      
      isProcessingMessageRef.current = false;
      return; // Skip AI call for this flow
    }
    
    // Handle dispatch confirmation - trigger dispatch directly
    if (userConfirmingDispatch) {
      const hasHtml = sidePanelHtml && sidePanelHtml.length > 50;
      const hasDestination = selectedOriginData?.subOriginId || csvListId;
      
      if (hasHtml && hasDestination) {
        // Add user message
        const userMsg: Message = {
          id: crypto.randomUUID(),
          content: messageContent,
          role: "user",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);
        
        // Build dispatch command and execute directly
        const encodedHtml = btoa(encodeURIComponent(sidePanelHtml));
        const encodedSubject = sidePanelSubject ? btoa(encodeURIComponent(sidePanelSubject)) : '';
        const convId = conversationIdRef.current || currentConversationId || '';
        
        let dispatchCommand: string;
        if (csvListId) {
          dispatchCommand = `START_DISPATCH_CSV:email:${csvListId}:html:${convId}:${encodedSubject}:${encodedHtml}`;
        } else {
          dispatchCommand = `START_DISPATCH:email:${selectedOriginData!.subOriginId}:html:${convId}:${encodedSubject}:${encodedHtml}`;
        }
        
        console.log('[DisparoView] Direct dispatch triggered by user confirmation');
        isProcessingMessageRef.current = false;
        
        // Execute dispatch directly
        executeDispatch(dispatchCommand);
        return; // Skip AI call
      } else {
        // Missing prerequisites - let AI respond
        console.log('[DisparoView] User confirmed but missing prerequisites:', { hasHtml, hasDestination });
      }
    }
    
    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: csvParseResult ? '' : messageContent,
      role: "user",
      timestamp: new Date(),
      imageUrl: imageBase64 || undefined,
      componentData: csvParseResult ? {
        type: 'csv_preview' as const,
        data: {
          fileName: csvFileNameLocal,
          totalRows: csvParseResult.leads.length,
          columns: csvParseResult.headers,
          previewData: csvParseResult.rawData,
          mappedColumns: csvParseResult.mappedColumns
        }
      } : undefined,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    
    const isFirstMessage = !currentConversationId && !conversationIdRef.current;
    let targetConversationId = conversationIdRef.current;
    
    if (isFirstMessage) {
      // Use Promise-based mutex to prevent race conditions
      if (creationLockRef.current) {
        console.log('[DisparoView] Waiting for existing creation lock...');
        try {
          const existingId = await creationLockRef.current;
          if (existingId) {
            console.log('[DisparoView] Reusing conversation from lock:', existingId);
            targetConversationId = existingId;
          }
        } catch {
          // Lock failed, proceed to create
        }
      }
      
      // Double-check after awaiting lock
      if (conversationIdRef.current) {
        console.log('[DisparoView] Conversation already exists after lock:', conversationIdRef.current);
        targetConversationId = conversationIdRef.current;
      } else if (!creationLockRef.current) {
        // Create new conversation with Promise lock
        isCreatingConversationRef.current = true;
        
        const creationPromise = (async (): Promise<string | null> => {
          try {
            const titleBase = csvParseResult 
              ? `📊 ${csvFileNameLocal} (${csvParseResult.leads.length} leads)`
              : messageContent;
            const title = titleBase.length > 50 
              ? titleBase.substring(0, 50).trim() + '...' 
              : titleBase || "Nova conversa";
            
            const conversationData = {
              messages: [{ 
                id: userMessage.id, 
                content: userMessage.content, 
                role: userMessage.role, 
                timestamp: userMessage.timestamp.toISOString() 
              }],
              sidePanelState: {},
              selectedOriginData: null,
              dispatchType: null,
              actionHistory: [],
              htmlSource: null
            };
            
            const { data, error } = await supabase
              .from("dispatch_conversations")
              .insert({ 
                messages: conversationData as any,
                title,
                workspace_id: currentWorkspace?.id
              })
              .select()
              .single();
            
            if (error) throw error;
            
            // Update refs IMMEDIATELY before any async operations
            conversationIdRef.current = data.id;
            skipNextUrlLoadRef.current = data.id;
            setConversationId(data.id);
            setSearchParams({ conversation: data.id }, { replace: true });
            
            localStorage.setItem('disparo-submenu-should-open', 'true');
            window.dispatchEvent(new Event('disparo-submenu-open'));
            
            console.log('[DisparoView] Created conversation:', data.id);
            return data.id;
          } catch (error) {
            console.error('[DisparoView] Error creating conversation:', error);
            throw error;
          }
        })();
        
        creationLockRef.current = creationPromise;
        
        try {
          targetConversationId = await creationPromise;
        } catch (error) {
          isProcessingMessageRef.current = false;
          isCreatingConversationRef.current = false;
          creationLockRef.current = null;
          setIsLoading(false);
          toast.error('Erro ao criar conversa');
          return;
        } finally {
          isCreatingConversationRef.current = false;
          // Clear lock after a short delay to allow concurrent calls to complete
          setTimeout(() => {
            creationLockRef.current = null;
          }, 100);
        }
      }
    }

    // Persist CSV list in background
    if (csvParseResult && csvParseResult.leads.length > 0 && targetConversationId) {
      (async () => {
        try {
          const recipients = csvParseResult.leads
            .filter(l => l.email && l.email.includes('@'))
            .map(l => ({
              name: l.name || '',
              email: l.email!,
              whatsapp: l.whatsapp
            }));
          
          if (recipients.length === 0) {
            console.log('[DisparoView] No valid recipients to persist');
            return;
          }
          
          const response = await supabase.functions.invoke('save-csv-dispatch-list', {
            body: {
              conversationId: targetConversationId,
              fileName: csvFileNameLocal,
              mappedColumns: csvParseResult.mappedColumns,
              recipients
            }
          });
          
          if (response.error) throw response.error;
          
          const listId = response.data?.listId;
          if (listId) {
            setCsvListId(listId);
            console.log('[DisparoView] CSV list persisted with ID:', listId);
          }
        } catch (error) {
          console.error('[DisparoView] Error persisting CSV list:', error);
        }
      })();
    }

    // Continue with chat logic - sending to Grok
    try {
      // Build context for AI
      const contextInfo: string[] = [];
      contextInfo.push(`=== ESTADO ATUAL DA CONVERSA ===`);
      
      if (dispatchType) {
        contextInfo.push(`• Tipo de disparo escolhido: ${dispatchType === 'email' ? 'EMAIL' : 'WHATSAPP WEB'}`);
      } else {
        contextInfo.push(`• Tipo de disparo: ainda não escolhido`);
      }
      
      if (selectedOriginData) {
        contextInfo.push(`• Lista selecionada: "${selectedOriginData.originName} > ${selectedOriginData.subOriginName}"`);
      } else {
        contextInfo.push(`• Lista: nenhuma selecionada ainda`);
      }
      
      if (sidePanelHtml && sidePanelHtml.length > 0) {
        const sourceText = htmlSource === 'ai' 
          ? 'VOCÊ (a IA) gerou este email durante a conversa' 
          : 'O usuário colou/editou este HTML manualmente';
        
        contextInfo.push(`\n=== EMAIL/COPY ATUAL (painel lateral) ===`);
        contextInfo.push(`• Status: ✅ PRONTO (${sidePanelHtml.length} caracteres)`);
        contextInfo.push(`• Quem criou: ${sourceText}`);
        contextInfo.push(`• Assunto: "${sidePanelSubject || '(sem assunto definido)'}"`);
        contextInfo.push(`• Preheader: "${sidePanelPreheader || '(sem preheader)'}"`);
        
        // Include full content so AI can edit it (limit to 8000 chars)
        const contentPreview = sidePanelHtml.length > 8000 
          ? sidePanelHtml.substring(0, 8000) + '\n[... conteúdo truncado ...]'
          : sidePanelHtml;
        
        contextInfo.push(`\nCONTEÚDO COMPLETO DO EMAIL/COPY:\n${contentPreview}`);
        contextInfo.push(`=== FIM DO EMAIL/COPY ===`);
      } else if (sidePanelGenerating) {
        contextInfo.push(`• Email HTML: ⏳ Gerando agora...`);
      } else if (dispatchType === 'email') {
        contextInfo.push(`• Email HTML: ❌ Ainda não criado`);
      }
      
      if (csvLeads && csvLeads.length > 0) {
        contextInfo.push(`\n=== LISTA CSV CARREGADA ===`);
        contextInfo.push(`• Total de leads: ${csvLeads.length}`);
        contextInfo.push(`• Arquivo: ${csvFileName}`);
        
        const leadsWithEmail = csvLeads.filter(l => l.email && l.email.includes('@')).length;
        contextInfo.push(`• Leads com email válido: ${leadsWithEmail}`);
      }
      
      if (activeJobId) {
        contextInfo.push(`• Disparo ativo: SIM (ID: ${activeJobId})`);
      }
      
      contextInfo.push(`=== FIM DO ESTADO ===`);
      
      if (actionHistory.length > 0) {
        contextInfo.push(`\n=== HISTÓRICO DE AÇÕES ===`);
        actionHistory.slice(-10).forEach((entry, i) => {
          const actorLabel = entry.actor === 'ai' ? '🤖 IA' : entry.actor === 'user' ? '👤 Usuário' : '⚙️ Sistema';
          contextInfo.push(`${i + 1}. [${entry.timestamp}] ${actorLabel}: ${entry.action}${entry.details ? ` - ${entry.details}` : ''}`);
        });
        contextInfo.push(`=== FIM DO HISTÓRICO ===`);
      }

      // Build messages for API
      const messagesForAPI = [
        {
          role: 'system' as const,
          content: contextInfo.join('\n')
        },
        ...messages.map(m => {
          if (m.imageUrl) {
            return {
              role: m.role,
              content: [
                { type: 'text', text: m.content },
                { type: 'image_url', image_url: { url: m.imageUrl } }
              ]
            };
          }
          return { role: m.role, content: m.content };
        }),
        (() => {
          let content = userMessage.content;
          
          // Add model prefix based on selected model
          const modelPrefix = model === 'Grok' ? '[MODEL:grok]' : 
                             model === 'Copywriting' ? '[MODEL:gpt][CONTEXT:copywriting]' : 
                             '[MODEL:gpt]';
          
          if (csvParseResult && csvParseResult.leads.length > 0) {
            const stats = csvParseResult.detailedStats;
            const totalLeads = stats?.totalLeads ?? csvParseResult.leads.length;
            const validEmails = stats?.validEmails ?? csvParseResult.leads.filter(l => l.email && l.email.includes('@')).length;
            const hasName = !!csvParseResult.mappedColumns.name;
            const hasEmail = !!csvParseResult.mappedColumns.email;
            
            const csvContext = `[NOVA LISTA CSV RECEBIDA]\nArquivo: "${csvFileNameLocal}"\nTotal de leads: ${totalLeads}\nEmails válidos: ${validEmails}\nColuna de NOME: ${hasName ? `✅ "${csvParseResult.mappedColumns.name}"` : '❌ Não identificada'}\nColuna de EMAIL: ${hasEmail ? `✅ "${csvParseResult.mappedColumns.email}"` : '❌ Não identificada'}`;
            content = `${modelPrefix} ${csvContext}`;
          } else {
            content = `${modelPrefix} ${content}`;
          }
          
          if (imageBase64) {
            return {
              role: userMessage.role,
              content: [
                { type: 'text', text: content },
                { type: 'image_url', image_url: { url: imageBase64 } }
              ]
            };
          }
          return { role: userMessage.role, content };
        })()
      ];

      // Check mode from message or selected model
      const isCopywritingMode = model === 'Copywriting' || message.includes('[CONTEXT:copywriting]') || message.includes('[Agente:Copywriting]');
      
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: messagesForAPI, 
          conversationId: targetConversationId,
          stream: true,
          mode: isCopywritingMode ? 'copywriting' : 'default'
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro na resposta do servidor");
      }

      if (!response.body) throw new Error("No response body");

      // Setup streaming
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      
      const assistantMessageId = crypto.randomUUID();
      streamingMessageIdRef.current = assistantMessageId;
      
      // Show data intelligence for CSV analysis
      const isCsvAnalysis = csvParseResult && csvParseResult.leads.length > 0;
      
      let initialComponentData: MessageComponentData | undefined;
      if (isCsvAnalysis) {
        const csvAnalysisSteps = createCsvAnalysisSteps({
          fileName: csvFileNameLocal,
          headers: csvParseResult.headers,
          rawData: csvParseResult.rawData,
          mappedColumns: csvParseResult.mappedColumns
        });
        initialComponentData = {
          type: 'data_intelligence' as const,
          data: { insightSteps: csvAnalysisSteps }
        };
        progressiveSteps.startAnimation(csvAnalysisSteps);
      }
      
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        content: "",
        role: "assistant",
        timestamp: new Date(),
        componentData: initialComponentData,
        component: initialComponentData ? (
          <div className="mt-4 w-full">
            <DataIntelligence steps={progressiveSteps.visibleSteps} />
          </div>
        ) : undefined
      }]);

      // Read stream
      while (true) {
        if (abortController.signal.aborted) {
          console.log('[DisparoView] Stream aborted - cleaning up');
          break;
        }
        
        if (activeRunIdRef.current !== runId) {
          console.log('[DisparoView] Run ID mismatch - stopping stream');
          break;
        }
        
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullContent += content;
              // Apply cleanup and use setFullContent with the entire cleaned content
              typewriter.setFullContent(removeAgentPrefix(fullContent));
            }
          } catch {
            // Incomplete JSON
          }
        }
      }

      // Process complete response
      streamingMessageIdRef.current = null;
      lastTypewriterContentRef.current = '';
      typewriter.reset();
      
      if (activeRunIdRef.current !== runId) {
        console.log('[DisparoView] Discarding stale stream result');
        isProcessingMessageRef.current = false;
        return;
      }

      // Process commands and clean content
      const { cleanContent, components, csvChanged } = await processCommands(fullContent);
      
      // Note: Side panel opening for "HTML pronto" is now handled earlier in handleSend (before streaming)
      
      // Check for structured email format
      const structuredEmail = extractStructuredEmail(cleanContent);
      const promptSummary = getPromptSummary(messageContent);
      
      if (structuredEmail.isStructuredEmail) {
        // Handle structured email - convert to HTML
        setSidePanelSubject(structuredEmail.subject);
        setSidePanelPreheader(structuredEmail.preheader);
        
        const wordCount = structuredEmail.body.split(/\s+/).length;
        
        const chatDisplayContent = `**${structuredEmail.emailName || 'Email criado'}**\n\n**Assunto:** ${structuredEmail.subject}\n\n${structuredEmail.body}\n\n---\n*Gostou? Clique no card abaixo para revisar o email visual.*`;
        
        // Generate HTML from copy
        try {
          setSidePanelGenerating(true);
          const GENERATE_EMAIL_URL = `https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/generate-email`;
          
          const htmlResponse = await fetch(GENERATE_EMAIL_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              hasCopy: true,
              copyText: structuredEmail.body,
              companyName: '',
              productService: '',
              tone: 'profissional',
            }),
          });

          if (!htmlResponse.ok) throw new Error("Erro ao gerar HTML do email");
          if (!htmlResponse.body) throw new Error("No response body");

          const htmlReader = htmlResponse.body.getReader();
          const htmlDecoder = new TextDecoder();
          let htmlBuffer = "";
          let generatedContent = "";

          while (true) {
            const { done, value } = await htmlReader.read();
            if (done) break;

            htmlBuffer += htmlDecoder.decode(value, { stream: true });

            let nlIndex: number;
            while ((nlIndex = htmlBuffer.indexOf("\n")) !== -1) {
              let hLine = htmlBuffer.slice(0, nlIndex);
              htmlBuffer = htmlBuffer.slice(nlIndex + 1);

              if (hLine.endsWith("\r")) hLine = hLine.slice(0, -1);
              if (hLine.startsWith(":") || hLine.trim() === "") continue;
              if (!hLine.startsWith("data: ")) continue;

              const hJsonStr = hLine.slice(6).trim();
              if (hJsonStr === "[DONE]") break;

              try {
                const hParsed = JSON.parse(hJsonStr);
                const hContent = hParsed.choices?.[0]?.delta?.content as string | undefined;
                if (hContent) {
                  generatedContent += hContent;
                  const { html } = extractSubjectPreheaderAndHtml(generatedContent);
                  if (html) setSidePanelHtml(html);
                }
              } catch {
                // Incomplete JSON
              }
            }
          }

          const { html: finalHtml } = extractSubjectPreheaderAndHtml(generatedContent);
          
          setSidePanelHtml(finalHtml);
          setHtmlSource('ai');
          setSidePanelGenerating(false);
          setSidePanelShowCodePreview(true);
          setSidePanelMode('email');
          
          // Update message with completed state
          const emailCardData = {
            generatedHtml: finalHtml,
            subject: structuredEmail.subject,
            preheader: structuredEmail.preheader,
            emailName: structuredEmail.emailName,
            mode: 'email' as const
          };
          
          setMessages(prev => 
            prev.map(m => {
              if (m.id !== assistantMessageId) return m;
              
              if (m.componentData?.type === 'data_intelligence') {
                return { 
                  ...m, 
                  content: chatDisplayContent,
                  componentData: {
                    ...m.componentData,
                    data: {
                      ...m.componentData.data,
                      emailCard: emailCardData
                    }
                  }
                };
              }
              
              return { 
                ...m, 
                content: chatDisplayContent,
                componentData: { 
                  type: 'email_generator_streaming' as const, 
                  data: { 
                    isComplete: true, 
                    ...emailCardData
                  } 
                }
              };
            })
          );
          
          logAction('ai', 'Converteu copy para HTML', `${wordCount} palavras → ${finalHtml.length} caracteres HTML`);
          toast.success("Email HTML gerado!");
          
        } catch (error) {
          console.error("[DisparoView] Error generating HTML from structured email:", error);
          setSidePanelGenerating(false);
          toast.error("Erro ao converter email para HTML");
        }
        
        setTimeout(() => saveConversationNow(), 100);
        setIsLoading(false);
        isProcessingMessageRef.current = false;
        return;
      }

      // Regular content - update message
      const finalCleanContent = removeAgentPrefix(cleanContent);
      
      // Check if this is an edit response that should update the side panel
      // Detect if the AI returned HTML code that should update the side panel
      const containsHtmlCode = /<(!DOCTYPE|html|head|body|div|table|style)/i.test(finalCleanContent);
      const isEditRequest = /\b(adicione|adiciona|coloque|coloca|mude|muda|altere|altera|troque|troca|remove|remova|tire|tira|edite|edita|modifique|modifica|atualize|atualiza|insira|insere|botão|button|link|cor|color|título|title|texto|text|dourado|golden|vermelho|red|azul|blue|verde|green)\b/i.test(messageContent);
      
      // If user asked for an edit and AI returned HTML, update the side panel
      if (isEditRequest && containsHtmlCode && sidePanelHtml) {
        // Extract HTML from the response (remove markdown code blocks if present)
        let updatedHtml = finalCleanContent
          .replace(/^```html\n?/i, '')
          .replace(/\n?```$/i, '')
          .replace(/^[\s\S]*?(<!DOCTYPE|<html)/i, '$1') // Remove text before HTML
          .trim();
        
        // If the response contains full HTML, update the side panel
        if (updatedHtml.includes('<') && updatedHtml.includes('>')) {
          setSidePanelHtml(updatedHtml);
          setHtmlSource('ai');
          if (!sidePanelOpen) {
            setSidePanelOpen(true);
            setSidePanelShowCodePreview(true);
          }
          toast.success("Email atualizado no painel lateral!");
          logAction('ai', 'Atualizou o email/copy', `Edição solicitada: ${messageContent.substring(0, 50)}...`);
          scheduleScrollToBottom();
        }
      }
      
      // Only show EmailChatCard when in copywriting mode AND user explicitly requested copy generation
      // Don't show for regular chat responses, instructions, or dispatch preparation
      const userRequestedCopy = /\b(crie|cria|gere|gera|escreve|escreva|faça|faz|redige|redija|elabore|elabora)\s+(uma?\s+)?(copy|email|e-mail|texto|headline|assunto|subject)\b/i.test(messageContent);
      const shouldShowCard = isCopywritingMode && userRequestedCopy && finalCleanContent.length > 300;
      
      setMessages(prev => 
        prev.map(m => {
          if (m.id !== assistantMessageId) return m;
          
          if (m.componentData?.type === 'data_intelligence') {
            return { 
              ...m, 
              content: finalCleanContent
            };
          }
          
          if (shouldShowCard && finalCleanContent.length > 50) {
            const cleanCopy = extractCleanCopy(finalCleanContent);
            const formattedCopy = cleanCopy
              .replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 700;">$1</strong>')
              .replace(/_([^_]+)_/g, '<em style="font-style: italic;">$1</em>')
              .replace(/\n/g, '<br>');
            const copyHtml = `<div style="font-family: 'Inter', Arial, sans-serif; padding: 24px; line-height: 1.9; font-size: 15px; color: #1a1a1a;">${formattedCopy}</div>`;
            
            return { 
              ...m, 
              content: finalCleanContent,
              componentData: { 
                type: 'email_generator_streaming' as const, 
                data: { 
                  isComplete: true, 
                  generatedHtml: copyHtml,
                  subject: 'Copy gerada',
                  mode: 'copy' as const
                } 
              }
            };
          }
          
          return { ...m, content: finalCleanContent };
        })
      );
      
      // Add any command components
      if (components.length > 0) {
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.id === assistantMessageId) {
            return prev.map(m => 
              m.id === assistantMessageId 
                ? { ...m, component: <>{components}</> }
                : m
            );
          }
          return prev;
        });
      }
      
      progressiveSteps.completeAllSteps();
      setSidePanelGenerating(false);
      setIsLoading(false);
      isProcessingMessageRef.current = false;
      
      setTimeout(() => saveConversationNow(), 100);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[DisparoView] Request aborted');
      } else {
        console.error("Error sending message:", error);
        toast.error(error.message || "Erro ao enviar mensagem");
      }
      setIsLoading(false);
      isProcessingMessageRef.current = false;
      progressiveSteps.completeAllSteps();
    }
  };

  // Computed busy state
  const isBusy = isLoading || sidePanelGenerating;

  // Render
  return (
    <div className="flex h-full bg-background p-3 gap-3">
      {/* Chat Area */}
      <div className={cn(
        "flex flex-col overflow-hidden transition-all duration-300",
        sidePanelOpen || csvPanelOpen ? "flex-1 min-w-0" : "flex-1"
      )}>
        {/* Loading state */}
        {isConversationLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-3 text-muted-foreground">
              <img src={disparoLogo} alt="" className="w-5 h-5 animate-pulse" />
              <span className="text-sm">Instante...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Messages area */}
            <div 
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              className="flex-1 overflow-y-auto px-8 py-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className={cn(
                "mx-auto space-y-6 transition-all duration-300",
                sidePanelOpen ? "max-w-4xl" : "max-w-5xl"
              )}>
                {/* Empty state with animated entrance */}
                {messages.length === 0 && (
                  <motion.div 
                    className="flex flex-col items-center justify-center min-h-[calc(100vh-280px)] text-center gap-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div 
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ 
                        duration: 0.6, 
                        delay: 0.7,
                        ease: [0.16, 1, 0.3, 1]
                      }}
                    >
                      <img src={disparoLogo} alt="Scale" className="w-8 h-8" />
                      <h2 className="text-3xl font-medium text-foreground">
                        Hey, ready to get started?
                      </h2>
                    </motion.div>
                    <motion.div 
                      className="w-full max-w-2xl"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ 
                        duration: 0.6, 
                        delay: 0.9,
                        ease: [0.16, 1, 0.3, 1]
                      }}
                    >
                      <AnimatedAIInput
                        onSubmit={(value, model) => handleSend(value, undefined, model)}
                        isLoading={isBusy}
                        placeholder="Digite sua mensagem aqui..."
                        headerText="Ask Scale to create"
                      />
                      <p className="text-center text-xs text-gray-400 mt-2">
                        A Scale pode cometer erros. Confira informações importantes.
                      </p>
                    </motion.div>
                  </motion.div>
                )}
                
                {/* Messages */}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col w-full",
                      msg.role === "user" ? "items-end" : "items-start"
                    )}
                  >
                    {msg.role === "user" ? (
                      <div className="flex flex-col items-end gap-2 w-full">
                        {msg.imageUrl && (
                          <img 
                            src={msg.imageUrl} 
                            alt="Uploaded" 
                            className="max-w-xs rounded-lg shadow-sm"
                          />
                        )}
                        {msg.componentData?.type === 'csv_preview' ? (
                          <div className="w-full max-w-md">
                            {reconstructMessageComponent(msg.componentData, msg.id)}
                          </div>
                        ) : msg.content && (
                          <div className="bg-foreground text-background px-4 py-2.5 rounded-2xl rounded-tr-md max-w-[85%]">
                            <p className="text-sm whitespace-pre-wrap">{stripInternalContext(msg.content)}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-start gap-1 w-full">
                        {/* Data Intelligence component */}
                        {msg.componentData?.type === 'data_intelligence' && msg.componentData.data?.insightSteps && (
                          <div className="w-full mb-3">
                            <DataIntelligence 
                              steps={streamingMessageIdRef.current === msg.id 
                                ? progressiveSteps.visibleSteps 
                                : msg.componentData.data.insightSteps
                              } 
                            />
                          </div>
                        )}
                        
                        {/* Message content */}
                        {msg.content && (
                          <div className="text-foreground text-sm whitespace-pre-wrap">
                            {formatMessageContent(msg.content.replace(/\bcrm\b/gi, 'CRM'))}
                          </div>
                        )}
                        
                        {/* Email card - only for copy/email creation */}
                        {msg.componentData?.type === 'email_generator_streaming' && msg.componentData.data?.generatedHtml && msg.componentData.data?.isComplete && (
                          <div className="mt-3 w-full">
                            <EmailChatCard
                              subject={msg.componentData.data.subject || 'Copy gerada'}
                              chatName={msg.componentData.data.emailName || 'Copy'}
                              previewHtml={msg.componentData.data.generatedHtml}
                              onClick={() => {
                                const data = msg.componentData?.data;
                                if (data) {
                                  const normalizedHtml = normalizeSidePanelHtml(data.generatedHtml);
                                  setSidePanelHtml(normalizedHtml);
                                  setSidePanelSubject(data.subject || '');
                                  setSidePanelPreheader(data.preheader || '');
                                  setSidePanelMode(data.mode || 'email');
                                  setSidePanelShowCodePreview(true);
                                  setSidePanelOpen(true);
                                }
                              }}
                            />
                          </div>
                        )}
                        
                        {/* Other components */}
                        {msg.component && (
                          <div className="w-full">
                            {msg.component}
                          </div>
                        )}
                        
                        {/* Action icons */}
                        {msg.content && (
                          <div className="flex items-center gap-0.5 mt-2">
                            <FeedbackButton 
                              icon="copy"
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                toast.success("Copiado!");
                              }}
                            />
                            <FeedbackButton icon="like" />
                            <FeedbackButton icon="dislike" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Loading indicator */}
                {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                  <ThinkingIndicator />
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input area - only show when there are messages */}
            {messages.length > 0 && (
              <motion.div 
                className="px-8 p-6 pt-0"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
              >
                <div className={cn(
                  "mx-auto transition-all duration-300",
                  sidePanelOpen ? "max-w-4xl" : "max-w-5xl"
                )}>
                  <AnimatedAIInput
                    onSubmit={(value, model) => handleSend(value, undefined, model)}
                    isLoading={isBusy}
                    placeholder="Digite sua mensagem aqui..."
                    headerText="Ask Scale to create"
                  />
                  <p className="text-center text-xs text-gray-400 mt-2">
                    A Scale pode cometer erros. Confira informações importantes.
                  </p>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
      
      {/* Side Panels */}
      <AnimatePresence mode="wait">
        {sidePanelOpen && (
          <motion.div
            key="email-panel"
            initial={sidePanelRestoredFromDB ? false : { width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="overflow-hidden h-full"
            onAnimationComplete={() => {
              if (sidePanelRestoredFromDB) setSidePanelRestoredFromDB(false);
            }}
          >
            <EmailSidePanel
              isOpen={sidePanelOpen}
              htmlContent={sidePanelHtml}
              onHtmlChange={(html) => { setSidePanelHtml(html); setHtmlSource('user'); }}
              subject={sidePanelSubject}
              onSubjectChange={setSidePanelSubject}
              preheader={sidePanelPreheader}
              onPreheaderChange={setSidePanelPreheader}
              isGenerating={sidePanelGenerating}
              isEditing={sidePanelEditing}
              mode={sidePanelMode}
              dispatchData={sidePanelDispatchData}
              showCodePreview={sidePanelShowCodePreview}
              panelTitle={sidePanelTitle}
              forcePreviewTab={!sidePanelGenerating && !sidePanelEditing && sidePanelHtml.length > 0}
              dispatchJobId={activeJobId}
              onDispatchCommand={async (command: string) => {
                try {
                  const response = await fetch(CHAT_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ command, conversationId: conversationIdRef.current }),
                  });
                  if (!response.ok) throw new Error("Command failed");
                  const result = await response.json();
                  if (result.type === 'dispatch_updated') {
                    toast.success(`Disparo ${result.data.status === 'paused' ? 'pausado' : result.data.status === 'running' ? 'retomado' : 'cancelado'}`);
                  }
                } catch (error) {
                  console.error("Error executing command:", error);
                  toast.error("Erro ao executar comando");
                }
              }}
              onClose={() => setSidePanelOpen(false)}
              onSave={() => {
                saveConversationNow();
                toast.success('Email salvo!');
              }}
              onNewDispatch={() => {
                setSidePanelMode('email');
                setSidePanelDispatchData(null);
                setSidePanelWorkflowSteps([]);
                setSidePanelHtml('');
                setSidePanelSubject('');
                setSidePanelPreheader('');
                setSidePanelOpen(false);
                setSidePanelShowCodePreview(true);
                setSidePanelTitle(undefined);
              }}
              onViewEmail={() => {
                setSidePanelMode('email');
              }}
            />
          </motion.div>
        )}
        
        {csvPanelOpen && csvLeads && csvLeads.length > 0 && (
          <motion.div
            key="csv-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="overflow-hidden"
          >
            <CsvSidePanel
              isOpen={csvPanelOpen}
              leads={csvLeads}
              onLeadsChange={(newLeads) => setCsvLeads(newLeads)}
              onClose={() => setCsvPanelOpen(false)}
              fileName={csvFileName}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
