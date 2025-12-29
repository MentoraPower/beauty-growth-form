import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { DispatchProgressTable } from "./DispatchProgressTable";
import { DispatchPreparingIndicator } from "./DispatchPreparingIndicator";
import { EmailSidePanel, SidePanelMode } from "./EmailSidePanel";
import { CsvSidePanel, CsvLead as CsvLeadType } from "./CsvSidePanel";
import { DispatchData } from "./DispatchAnalysis";
import { EmailGenerationIndicator } from "./EmailGenerationIndicator";
import { AIWorkDetails, WorkStep, WorkSubItem, createLeadsAnalysisStep, createEmailGenerationStep, createDispatchStep, createCustomStep } from "./AIWorkDetails";
import { supabase } from "@/integrations/supabase/client";
import { Clipboard, Check } from "lucide-react";
import disparoLogo from "@/assets/disparo-logo.png";

interface DisparoViewProps {
  subOriginId: string | null;
}

interface MessageComponentData {
  type: 'leads_preview' | 'html_editor' | 'origins_list' | 'dispatch_progress' | 'csv_preview' | 'email_choice' | 'email_generator' | 'copy_choice' | 'copy_input' | 'email_generator_streaming' | 'ai_work_details';
  data?: any;
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  component?: React.ReactNode;
  componentData?: MessageComponentData; // Serializable data for reconstruction
  imageUrl?: string; // Base64 image URL for display
}

// Action history entry for complete AI memory
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

interface CsvLead {
  name: string;
  email?: string;
  whatsapp?: string;
  [key: string]: string | undefined;
}

const CHAT_URL = `https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/grok-chat`;

// Parse CSV file
const parseCSV = (content: string): CsvLead[] => {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].toLowerCase().split(/[,;]/).map(h => h.trim().replace(/"/g, ''));
  const nameIdx = headers.findIndex(h => h === 'nome' || h === 'name');
  const emailIdx = headers.findIndex(h => h === 'email' || h === 'e-mail');
  const whatsappIdx = headers.findIndex(h => h === 'whatsapp' || h === 'telefone' || h === 'phone' || h === 'celular');
  
  if (nameIdx === -1) return [];
  
  return lines.slice(1).map(line => {
    const values = line.split(/[,;]/).map(v => v.trim().replace(/"/g, ''));
    return {
      name: values[nameIdx] || '',
      email: emailIdx >= 0 ? values[emailIdx] : undefined,
      whatsapp: whatsappIdx >= 0 ? values[whatsappIdx]?.replace(/\D/g, '') : undefined,
    };
  }).filter(l => l.name);
};

// Extract subject and HTML from AI response
const extractSubjectAndHtml = (content: string): { subject: string; html: string } => {
  const lines = content.split('\n');
  let subject = '';
  let htmlStartIndex = 0;
  
  // Look for ASSUNTO: line at the start
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (line.toUpperCase().startsWith('ASSUNTO:')) {
      subject = line.substring(8).trim();
      htmlStartIndex = i + 1;
      // Skip empty lines after subject
      while (htmlStartIndex < lines.length && lines[htmlStartIndex].trim() === '') {
        htmlStartIndex++;
      }
      break;
    }
  }
  
  // Get HTML part (everything after subject)
  const html = lines.slice(htmlStartIndex).join('\n')
    .replace(/^```html\n?/i, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/i, '')
    .trim();
  
  return { subject, html };
};

// Remove agent/context prefixes from message content - removes ALL occurrences
const removeAgentPrefix = (content: string): string => {
  // Remove prefixes like [Agente:Copywriting], [CONTEXT:...], [Search], etc. - globally
  // Also remove "text-copyright" which may appear in HTML/copy content
  return content
    .replace(/\[(Agente:[^\]]+|CONTEXT:[^\]]+|Search)\]\s*/gi, '')
    .replace(/text-copyright/gi, '')
    .trim();
};

// Parse markdown-like formatting: **bold** and _italic_
const formatMessageContent = (content: string): React.ReactNode => {
  // First remove any agent prefix
  const cleanContent = removeAgentPrefix(content);
  
  // Split by markdown patterns while preserving the delimiters
  const parts = cleanContent.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  
  return parts.map((part, index) => {
    // Bold: **text**
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    // Italic: _text_
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

export function DisparoView({ subOriginId }: DisparoViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
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
  const [sidePanelGenerating, setSidePanelGenerating] = useState(false);
  const [sidePanelEditing, setSidePanelEditing] = useState(false);
  const [sidePanelContext, setSidePanelContext] = useState<{ subOriginId: string; dispatchType: string } | null>(null);
  const [sidePanelMode, setSidePanelMode] = useState<SidePanelMode>('email'); // Mode: email or dispatch_details
  const [sidePanelDispatchData, setSidePanelDispatchData] = useState<DispatchData | null>(null); // Dispatch data for details view
  const [sidePanelWorkflowSteps, setSidePanelWorkflowSteps] = useState<WorkStep[]>([]); // Workflow steps for AI visualization
  const [sidePanelShowCodePreview, setSidePanelShowCodePreview] = useState(true); // Whether to show code/preview tabs
  const [sidePanelTitle, setSidePanelTitle] = useState<string | undefined>(undefined); // Panel title
  const [htmlSource, setHtmlSource] = useState<'ai' | 'user' | null>(null); // Track who created the HTML
  const [actionHistory, setActionHistory] = useState<ActionEntry[]>([]); // Complete action history for AI memory
  
  // CSV Side Panel state
  const [csvPanelOpen, setCsvPanelOpen] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string>('lista.csv');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const scrollRAFRef = useRef<number | null>(null);
  const streamingBufferRef = useRef("");
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for hydration control - prevent race conditions
  const isHydratingRef = useRef(false); // True when loading from DB
  const skipNextUrlLoadRef = useRef<string | null>(null); // Skip URL load for this conv ID
  const suppressUrlSyncRef = useRef(false); // Suppress URL sync when starting new conversation

  // Snapshot refs (avoid stale closures during streaming/autosave)
  const messagesRef = useRef<Message[]>([]);
  const conversationIdRef = useRef<string | null>(null);
  const isCreatingConversationRef = useRef(false);

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
  // Keep refs in sync even for code paths still using setState directly
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    conversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  // Helper to log actions with timestamp
  const logAction = useCallback((actor: 'user' | 'ai' | 'system', action: string, details?: string) => {
    const entry: ActionEntry = {
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      actor,
      action,
      details
    };
    setActionHistory(prev => [...prev, entry]);
  }, []);

  // Optimized scroll to bottom using RAF
  const scheduleScrollToBottom = useCallback(() => {
    if (scrollRAFRef.current) return; // Already scheduled
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
    
    // If user scrolled UP, disable auto-scroll immediately
    if (currentScrollTop < lastScrollTopRef.current - 5) {
      shouldAutoScrollRef.current = false;
    }
    // Only re-enable when user scrolls very close to bottom
    else if (distanceFromBottom < 20) {
      shouldAutoScrollRef.current = true;
    }
    
    lastScrollTopRef.current = currentScrollTop;
  }, []);

  // Handle showing dispatch details in the side panel
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

  // Handle dispatch errors - notify in chat when emails fail
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

  // Handle dispatch completion - show summary in chat
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

  // Function to reconstruct component from componentData
  function reconstructMessageComponent(componentData: MessageComponentData, messageId: string): React.ReactNode {
    switch (componentData.type) {
      case 'email_choice': {
        const { preview, subOriginId, dispatchType } = (componentData.data || {}) as any;
        if (!preview) return null;
        // Just show preview, questions are now plain text
        return (
          <div className="mt-4 w-full">
            <LeadsPreviewComponent preview={preview} />
          </div>
        );
      }
      case 'leads_preview': {
        const { preview, subOriginId, dispatchType } = (componentData.data || {}) as any;
        if (!preview || !subOriginId || !dispatchType) return null;
        return (
          <div className="mt-4 space-y-4 w-full">
            <LeadsPreviewComponent preview={preview} />
            <HtmlEditorComponent
              onSubmit={(html) => handleHtmlSubmitFromReload(html, subOriginId, dispatchType)}
            />
          </div>
        );
      }
      case 'html_editor': {
        const { subOriginId, dispatchType, initialContent } = (componentData.data || {}) as any;
        if (!subOriginId || !dispatchType) return null;
        return (
          <div className="mt-4 w-full">
            <HtmlEditorComponent
              onSubmit={(html) => handleHtmlSubmitFromReload(html, subOriginId, dispatchType)}
              initialContent={initialContent || ''}
            />
          </div>
        );
      }
      case 'copy_choice': {
        // Questions are now plain text, no component needed
        return null;
      }
      case 'copy_input': {
        // User now sends copy directly in chat, no component needed
        return null;
      }
      case 'email_generator_streaming': {
        const { subOriginId, dispatchType, copyText, companyName, productService } = (componentData.data || {}) as any;
        if (!subOriginId || !dispatchType) return null;
        if (!copyText) {
          return <div className="mt-4 text-sm text-muted-foreground">Geração em andamento…</div>;
        }
        return (
          <div className="mt-4 w-full">
            <CopyToHtmlGenerator
              copyText={copyText}
              companyName={companyName || ''}
              productService={productService || ''}
              onGenerated={(html) => handleEmailGenerated(html, subOriginId, dispatchType)}
            />
          </div>
        );
      }
      case 'email_generator': {
        const { subOriginId, dispatchType } = (componentData.data || {}) as any;
        if (!subOriginId || !dispatchType) return null;
        return (
          <div className="mt-4 p-4 rounded-xl border border-border/40 bg-muted/30">
            <p className="text-sm text-foreground">
              Para continuar, descreva no chat abaixo o email que você quer criar.
            </p>
            <button
              type="button"
              onClick={() => {
                setPendingEmailContext({ subOriginId, dispatchType });
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
            <DispatchProgressTable 
              jobId={jobId} 
              onCommand={handleCommand} 
              onShowDetails={handleShowDispatchDetails}
              onError={handleDispatchError}
              onComplete={handleDispatchComplete}
            />
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
        if (!steps || !Array.isArray(steps)) return null;
        return (
          <div className="mt-3 w-full max-w-md">
            <AIWorkDetails steps={steps} />
          </div>
        );
      }
      default:
        return null;
    }
  }

  // Handle HTML submit from reloaded conversation
  const handleHtmlSubmitFromReload = async (html: string, subOriginId: string, type: string) => {
    handleHtmlSubmit(html, subOriginId, type);
  };

  // Load conversation from URL on mount or when URL changes
  useEffect(() => {
    const convId = searchParams.get('conversation') || searchParams.get('conv');
    
    // Skip if this ID was just set by menu selection (already have messages loaded)
    if (convId && skipNextUrlLoadRef.current === convId) {
      skipNextUrlLoadRef.current = null;
      setInitialLoadDone(true);
      return;
    }
    
    // Don't load from DB if we're actively generating/streaming (prevents race condition)
    if (convId && convId === currentConversationId && (isLoading || sidePanelGenerating)) {
      return;
    }
    
    // If we have a convId and it's different from current, load it
    if (convId && convId !== currentConversationId) {
      const loadConversation = async () => {
        isHydratingRef.current = true;
        try {
          const { data, error } = await supabase
            .from("dispatch_conversations")
            .select("*")
            .eq("id", convId)
            .single();

          if (error) throw error;

          // Handle new format with sidePanelState or old format (just messages array)
          const rawData = data.messages as any;
          const isNewFormat = rawData && typeof rawData === 'object' && 'messages' in rawData && Array.isArray(rawData.messages);
          
          const messagesArray = isNewFormat ? rawData.messages : (Array.isArray(rawData) ? rawData : []);
          
          const loadedMessages: Message[] = messagesArray.map((m: any) => {
            // Fix workflowSteps status when loading from DB - if saved, generation is complete
            let componentData = m.componentData || undefined;
            if (componentData?.data?.workflowSteps) {
              componentData = {
                ...componentData,
                data: {
                  ...componentData.data,
                  workflowSteps: componentData.data.workflowSteps.map((step: any) => ({
                    ...step,
                    status: 'completed',
                    // Fix titles that were saved mid-generation
                    title: step.title
                      .replace(/^Gerando/i, 'Gerado')
                      .replace(/\.\.\.$/, '')
                  }))
                }
              };
            }
            const msg: Message = {
              id: m.id,
              content: m.content,
              role: m.role as "user" | "assistant",
              timestamp: new Date(m.timestamp),
              componentData,
            };
            return msg;
          });

          setCurrentConversationId(convId);
          setMessages(loadedMessages);
          
          // Restore side panel state if available
          if (isNewFormat && rawData.sidePanelState) {
            const { html, subject, isOpen, context, workflowSteps, showCodePreview, title, mode } = rawData.sidePanelState;
            if (html) setSidePanelHtml(html);
            if (subject) setSidePanelSubject(subject);
            if (isOpen) setSidePanelOpen(true);
            if (context) setSidePanelContext(context);
            if (workflowSteps && Array.isArray(workflowSteps)) setSidePanelWorkflowSteps(workflowSteps);
            if (showCodePreview !== undefined) setSidePanelShowCodePreview(showCodePreview);
            if (title) setSidePanelTitle(title);
            if (mode) setSidePanelMode(mode);
          }
          
          // Restore origin data if available
          if (isNewFormat && rawData.selectedOriginData) {
            setSelectedOriginData(rawData.selectedOriginData);
          }
          
          // Restore dispatch type if available
          if (isNewFormat && rawData.dispatchType) {
            setDispatchType(rawData.dispatchType);
          }
          
          // Restore action history if available
          if (isNewFormat && rawData.actionHistory && Array.isArray(rawData.actionHistory)) {
            setActionHistory(rawData.actionHistory);
          }
          
          // Restore htmlSource if available
          if (isNewFormat && rawData.htmlSource) {
            setHtmlSource(rawData.htmlSource);
          }
          
          setInitialLoadDone(true);
        } catch (error) {
          console.error("Error loading conversation from URL:", error);
          // Remove invalid conv param
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('conversation');
          newParams.delete('conv');
          setSearchParams(newParams);
          setInitialLoadDone(true);
        } finally {
          isHydratingRef.current = false;
        }
      };
      loadConversation();
    } else if (!convId && currentConversationId) {
      // URL cleared - start new conversation
      // Suppress URL sync to prevent race condition where old ID gets rewritten to URL
      suppressUrlSyncRef.current = true;
      setCurrentConversationId(null);
      conversationIdRef.current = null;
      setMessages([]);
      messagesRef.current = [];
      setCsvLeads(null);
      setPendingEmailContext(null);
      setSidePanelOpen(false);
      setSidePanelHtml('');
      setSidePanelSubject('');
      setSidePanelContext(null);
      setSelectedOriginData(null);
      setDispatchType(null);
      setActionHistory([]); // Clear action history
      setHtmlSource(null); // Clear htmlSource
      setSidePanelMode('email'); // Reset side panel mode
      setSidePanelDispatchData(null); // Clear dispatch data
      setPendingQuestion(null); // Clear pending question
      setInitialLoadDone(true);
      // Clear suppression after state is reset
      setTimeout(() => { suppressUrlSyncRef.current = false; }, 100);
    } else if (!convId && !initialLoadDone) {
      setInitialLoadDone(true);
    }
  }, [searchParams, currentConversationId, isLoading, sidePanelGenerating]);

  // Reconstruct components after messages are loaded
  useEffect(() => {
    if (initialLoadDone && messages.length > 0) {
      const needsReconstruction = messages.some(m => m.componentData && !m.component);
      if (needsReconstruction) {
        setMessages(prev => prev.map(m => {
          if (m.componentData && !m.component) {
            return {
              ...m,
              component: reconstructMessageComponent(m.componentData, m.id)
            };
          }
          return m;
        }));
      }
    }
  }, [initialLoadDone, messages]);

  // Track last saved signature for content-based dirty checking
  const lastSavedSignatureRef = useRef<string>('');
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate a signature from current state for dirty checking
  const generateStateSignature = useCallback(() => {
    const msgSignature = messages.map(m => 
      `${m.id}:${m.role}:${m.content.length}:${m.componentData ? JSON.stringify(m.componentData).length : 0}`
    ).join('|');
    const panelSignature = `${sidePanelHtml.length}:${sidePanelSubject}:${sidePanelOpen}`;
    return `${msgSignature}::${panelSignature}`;
  }, [messages, sidePanelHtml, sidePanelSubject, sidePanelOpen]);

  // Auto-save conversation - uses refs to avoid stale closures
  const saveConversationNow = useCallback(async (forceCreate = false, customTitle?: string): Promise<string | null> => {
    const currentMessages = messagesRef.current;
    const convId = conversationIdRef.current;
    
    if (currentMessages.length === 0) return null;
    if (isCreatingConversationRef.current && forceCreate) return null; // Prevent double-create

    try {
      if (forceCreate) {
        isCreatingConversationRef.current = true;
      }

      // Generate title
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
            // Clean title: remove internal markers like [CONTEXT:...], [Agente:...], etc.
            let cleanContent = firstUserMessage.content
              .replace(/\[(Agente:[^\]]+|CONTEXT:[^\]]+|Search)\]\s*/gi, '')
              .replace(/^CONTEXT\s*/i, '')
              .replace(/^copy\s*/i, '')
              .replace(/text-copyright/gi, '')
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
      };

      if (convId && !forceCreate) {
        // Update existing
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
        // Create new
        const { data, error } = await supabase
          .from("dispatch_conversations")
          .insert({ 
            messages: conversationData as any,
            title 
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
      if (forceCreate) {
        isCreatingConversationRef.current = false;
      }
    }
  }, [sidePanelHtml, sidePanelSubject, sidePanelOpen, sidePanelContext, sidePanelWorkflowSteps, sidePanelShowCodePreview, sidePanelTitle, sidePanelMode, selectedOriginData, dispatchType, actionHistory, htmlSource]);

  // Auto-save with signature-based dirty check (saves on CONTENT changes, not just length)
  // Goal: save user messages immediately; throttle while assistant is streaming / user is editing.
  useEffect(() => {
    if (!initialLoadDone) return;
    if (messages.length === 0) return;
    if (isHydratingRef.current) return;

    const currentSignature = generateStateSignature();

    // Skip if nothing changed
    if (currentSignature === lastSavedSignatureRef.current) return;

    // Clear any pending save
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }

    const lastMessage = messages[messages.length - 1];
    const isUserJustSent = lastMessage?.role === 'user';

    // First message - create new conversation immediately
    if (!currentConversationId) {
      saveConversationNow(true).then((newId) => {
        if (newId) {
          setCurrentConversationId(newId);
          conversationIdRef.current = newId;
          lastSavedSignatureRef.current = currentSignature;
        }
      });
      return;
    }

    const doSave = () => {
      saveConversationNow().then(() => {
        lastSavedSignatureRef.current = currentSignature;
      });
    };

    // Save immediately when:
    // - user just sent a message
    // - streaming finished (isLoading false)
    // Otherwise, throttle to avoid saving on every streaming chunk / editor keystroke.
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

  // Save on beforeunload (when user closes tab/refreshes)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (conversationIdRef.current && messagesRef.current.length > 0) {
        saveConversationNow();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveConversationNow]);

  // Reset signature when conversation changes
  useEffect(() => {
    lastSavedSignatureRef.current = '';
  }, [currentConversationId]);

  // Sync URL when conversation ID changes (separated from creation to avoid race condition)
  useEffect(() => {
    // Skip sync if suppressed (user just started new conversation)
    if (suppressUrlSyncRef.current) return;
    if (!currentConversationId) return;
    
    const currentUrlConvId = searchParams.get('conversation');
    if (currentUrlConvId !== currentConversationId) {
      setSearchParams({ conversation: currentConversationId }, { replace: true });
    }
  }, [currentConversationId, searchParams, setSearchParams]);

  // Auto-scroll to bottom when messages change (using RAF, only if near bottom)
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scheduleScrollToBottom();
    }
    // Cleanup RAF on unmount
    return () => {
      if (scrollRAFRef.current) {
        cancelAnimationFrame(scrollRAFRef.current);
      }
    };
  }, [messages, scheduleScrollToBottom]);

  // Handle origin selection from table
  const handleOriginSelect = useCallback(async (subOriginId: string, subOriginName: string, originName: string) => {
    setSelectedOriginData({ subOriginId, subOriginName, originName });
    
    // Always use email (WhatsApp removed)
    const type = 'email';
    setDispatchType(type);
    
    // Log this action
    logAction('user', `Selecionou a lista "${subOriginName}" da origem "${originName}"`, 'Disparo por email');
    
    // Auto-send message to fetch leads
    const autoMessage = `Usar a lista "${subOriginName}" da origem "${originName}"`;
    
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: autoMessage,
      role: "user",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Fetch leads for this sub-origin
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: `FETCH_LEADS:${type}:${subOriginId}` }),
      });

      if (!response.ok) throw new Error("Erro ao buscar leads");
      const result = await response.json();

      if (result.type === 'leads_preview') {
        // Create work steps for AI details
        const workSteps: WorkStep[] = [
          createLeadsAnalysisStep('completed', {
            listName: subOriginName,
            validCount: result.data.validLeads,
            totalCount: result.data.totalLeads,
            summary: `Identificamos ${result.data.validLeads} leads válidos com email na lista selecionada.`
          }),
          createEmailGenerationStep('pending'),
          createDispatchStep('pending')
        ];

        // Show email creation question
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          content: `Encontrei ${result.data.validLeads} leads válidos na lista "${subOriginName}".\n\nComo você quer criar o email?\n• Se já tiver o HTML pronto, me envie\n• Se quiser criar com IA, me diga`,
          role: "assistant",
          timestamp: new Date(),
          componentData: {
            type: 'ai_work_details',
            data: { steps: workSteps, preview: result.data, subOriginId, dispatchType: type }
          },
          component: (
            <div className="mt-3 w-full max-w-md">
              <AIWorkDetails steps={workSteps} />
            </div>
          ),
        };
        setMessages(prev => [...prev, assistantMessage]);
        setPendingQuestion({ type: 'email_method', subOriginId, dispatchType: type });
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Erro ao buscar leads");
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  // Show dispatch confirmation via chat (no button - user confirms with text)
  const handleHtmlSubmit = async (html: string, subOriginId: string, type: string) => {
    // Store the HTML in side panel for reference
    setSidePanelContext({ subOriginId, dispatchType: type });
    setSidePanelHtml(html);
    setSidePanelOpen(true);
    
    // Show confirmation message via chat (no button!)
    const confirmMessage: Message = {
      id: crypto.randomUUID(),
      content: `Email pronto! Você pode revisar o conteúdo no painel lateral. 📧\n\n**Quer que eu inicie o disparo agora?** (responda sim, pode, manda, etc.)`,
      role: "assistant",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, confirmMessage]);
    logAction('system', 'Email preparado para disparo', 'Aguardando confirmação via chat');
  };

  // Handle email choice - user has code ready (open side panel)
  const handleEmailChoiceCode = useCallback((subOriginId: string, type: string) => {
    // Open side panel for HTML editing
    setSidePanelContext({ subOriginId, dispatchType: type });
    setSidePanelHtml('');
    setSidePanelSubject('');
    setSidePanelGenerating(false);
    setSidePanelOpen(true);
    logAction('user', 'Escolheu colar código HTML próprio', 'Painel de edição aberto');
    
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      content: `Ótimo! Abri o editor de email na lateral. Cole ou edite o código HTML do seu email lá. Quando terminar, me avise que vou preparar o envio.`,
      role: "assistant",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);
  }, [logAction]);

// Handle email choice - create with AI (show copy question as plain text)
  const handleEmailChoiceAI = useCallback((subOriginId: string, type: string) => {
    logAction('user', 'Escolheu criar email com a IA', 'Iniciando fluxo de criação');
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      content: `Você já tem a copy (texto) do email pronta?\n• Se sim, cole a copy aqui\n• Se não, me descreva o que você quer no email`,
      role: "assistant",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);
    setPendingQuestion({ type: 'has_copy', subOriginId, dispatchType: type });
  }, [logAction]);
  // Note: handleHasCopy removed - user now sends copy directly in chat

  // Handle create copy from scratch - just ask in chat, no form
  const handleCreateCopy = useCallback((subOriginId: string, type: string) => {
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      content: `Perfeito! Vou criar a copy e o HTML do email para você. Me conte mais sobre o que você precisa - descreva seu serviço, produto ou a ideia do email que você quer enviar.`,
      role: "assistant",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);
    // Store context for when user responds
    setPendingEmailContext({ subOriginId, dispatchType: type });
  }, []);

  // Handle generate HTML from existing copy - stream directly to side panel
  const handleGenerateFromCopy = useCallback(async (
    copyText: string, 
    companyName: string, 
    productService: string,
    subOriginId: string, 
    type: string
  ) => {
    // Open side panel with generating state
    setSidePanelContext({ subOriginId, dispatchType: type });
    setSidePanelHtml('');
    setSidePanelSubject('');
    setSidePanelGenerating(true);
    setSidePanelShowCodePreview(true); // Ensure header shows for email
    setSidePanelOpen(true);
    
    // Create work steps for email generation in progress
    const generatingSteps: WorkStep[] = [
      createLeadsAnalysisStep('completed', {
        listName: selectedOriginData?.subOriginName || 'lista',
        summary: 'Leads prontos para o disparo.'
      }),
      createEmailGenerationStep('in_progress', {
        subItems: [
          { id: 'copy', label: `Lendo copy fornecida pelo usuário`, type: 'file', status: 'done' },
          { id: 'generate', label: `Gerando estrutura HTML...`, type: 'action', status: 'in_progress' },
        ]
      }),
      createDispatchStep('pending')
    ];
    
    const loadingMessageId = crypto.randomUUID();
    const loadingMessage: Message = {
      id: loadingMessageId,
      content: `Gerando HTML do email...`,
      role: "assistant",
      timestamp: new Date(),
      componentData: {
        type: 'email_generator_streaming',
        data: { workflowSteps: generatingSteps }
      },
    };
    setMessages(prev => [...prev, loadingMessage]);
    
    // Stream generation to side panel
    try {
      const GENERATE_EMAIL_URL = `https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/generate-email`;
      
      const response = await fetch(GENERATE_EMAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          copyText,
          companyName,
          productService,
          tone: 'profissional',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro ao gerar email");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let generatedHtml = "";

      while (true) {
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
              generatedHtml += content;
              // Extract subject and HTML in real-time
              const { subject, html } = extractSubjectAndHtml(generatedHtml);
              if (subject) setSidePanelSubject(subject);
              setSidePanelHtml(html);
            }
          } catch {
            // Incomplete JSON, continue
          }
        }
      }

      // Final extraction
      const { subject: finalSubject, html: finalHtml } = extractSubjectAndHtml(generatedHtml);
      
      setSidePanelSubject(finalSubject);
      setSidePanelHtml(finalHtml);
      setHtmlSource('ai'); // AI generated this email
      setSidePanelGenerating(false);
      logAction('ai', 'Gerou email HTML a partir da copy', `Assunto: "${finalSubject}", ${finalHtml.length} caracteres`);
      
      // Check if the email has a button_link placeholder
      const hasButtonPlaceholder = finalHtml.includes('{{button_link}}');
      
      // Update loading message with completed steps
      const completedSteps: WorkStep[] = [
        createLeadsAnalysisStep('completed', {
          listName: selectedOriginData?.subOriginName || 'lista',
          summary: 'Leads prontos para o disparo.'
        }),
        createEmailGenerationStep('completed', {
          subItems: [
            { id: 'copy', label: `Lendo copy fornecida pelo usuário`, type: 'file', status: 'done' },
            { id: 'generate', label: `Gerando estrutura HTML`, type: 'action', status: 'done' },
          ],
          summary: `Email gerado com ${finalHtml.length} caracteres.`
        }),
        createDispatchStep('pending')
      ];
      
      // Update the loading message to show completed state - save workflowSteps in componentData
      setMessages(prev => 
        prev.map(m => 
          m.id === loadingMessageId 
            ? { 
                ...m, 
                content: hasButtonPlaceholder 
                  ? `Email gerado! Agora me diz: qual o link do botão? (Ex: https://seusite.com/oferta)`
                  : `Email gerado! Você pode revisar e editar na lateral.`,
                componentData: { 
                  type: 'email_generator_streaming' as const, 
                  data: { workflowSteps: completedSteps, isComplete: true } 
                },
              }
            : m
        )
      );
      toast.success("Email gerado com sucesso!");
      
      // Force immediate save after generation completes
      setTimeout(() => {
        saveConversationNow();
      }, 100);
      
    } catch (error) {
      console.error("Error generating email:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao gerar email");
      setSidePanelGenerating(false);
    }
  }, [logAction]);

  // Handle AI generated email - open in side panel
  const handleEmailGenerated = useCallback((html: string, subOriginId: string, type: string) => {
    // Update side panel with generated HTML
    setSidePanelContext({ subOriginId, dispatchType: type });
    setSidePanelHtml(html);
    setHtmlSource('ai'); // AI generated this email
    setSidePanelGenerating(false);
    setSidePanelShowCodePreview(true); // Ensure header shows for email
    setSidePanelOpen(true);
    logAction('ai', 'Email HTML criado', `${html.length} caracteres`);
    
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      content: `Email criado! Você pode revisar e editar na lateral. Quando estiver pronto, me avise que vou preparar o envio.`,
      role: "assistant",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);
  }, [logAction]);

  // Execute a confirmed dispatch
  const executeDispatch = useCallback(async (command: string) => {
    // Determine dispatch type from command
    const isWhatsApp = command.includes('whatsapp');
    
    // STEP 1: Show preparing indicator immediately
    const preparingMessageId = crypto.randomUUID();
    const preparingMessage: Message = {
      id: preparingMessageId,
      content: "🔄 Preparando disparo...",
      role: "assistant",
      timestamp: new Date(),
      component: <DispatchPreparingIndicator type={isWhatsApp ? 'whatsapp' : 'email'} />,
    };
    setMessages(prev => [...prev, preparingMessage]);
    
    try {
      setIsLoading(true);
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) throw new Error("Command failed");

      const result = await response.json();
      console.log("Dispatch result:", result);

      if (result.type === 'dispatch_started') {
        setActiveJobId(result.data.jobId);
        logAction('system', `Disparo iniciado`, `Enviando para ${result.data.validLeads} leads`);
        
        // STEP 2: Replace preparing message with progress table
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
                  <DispatchProgressTable
                    key={`dispatch-${result.data.jobId}`}
                    jobId={result.data.jobId}
                    onCommand={handleCommand}
                    onError={handleDispatchError}
                    onComplete={handleDispatchComplete}
                  />
                ),
              }
            : m
        ));
        toast.success("Disparo iniciado com sucesso!");
      } else {
        // If dispatch didn't start properly, remove preparing message
        setMessages(prev => prev.filter(m => m.id !== preparingMessageId));
      }
    } catch (error) {
      console.error("Error starting dispatch:", error);
      // Remove preparing message on error
      setMessages(prev => prev.filter(m => m.id !== preparingMessageId));
      toast.error("Erro ao iniciar disparo");
    } finally {
      setIsLoading(false);
    }
  }, [logAction]);

  // Process commands from Grok's response
  const processCommands = async (content: string): Promise<{ cleanContent: string; components: React.ReactNode[] }> => {
    const commandPattern = /\[COMMAND:([^\]]+)\]/g;
    const commands: string[] = [];
    let match;
    
    while ((match = commandPattern.exec(content)) !== null) {
      commands.push(match[1]);
    }

    const components: React.ReactNode[] = [];
    let cleanContent = content;
    
    // ALWAYS clean technical patterns from visible content (safety layer)
    // Even if the AI ignores instructions, we remove these patterns
    cleanContent = cleanContent
      .replace(/\[COMMAND:[^\]]+\]/g, '')
      .replace(/\[TEMPLATE_CONTENT\][\s\S]*?\[\/TEMPLATE_CONTENT\]/g, '')
      .replace(/\[\/TEMPLATE_CONTENT\]/g, '')
      .replace(/\[TEMPLATE_CONTENT\]/g, '')
      // Remove any leftover HTML code blocks that might appear
      .replace(/```html[\s\S]*?```/g, '')
      .replace(/<!DOCTYPE[\s\S]*?<\/html>/gi, '')
      .trim();

    for (const command of commands) {
      // Remove command from content (redundant but safe)
      cleanContent = cleanContent.replace(`[COMMAND:${command}]`, '');

      // START_DISPATCH: Execute directly - user already confirmed verbally via chat
      // The AI only sends this command AFTER the user said "sim", "pode", etc.
      // IMPORTANT: Use the local subOriginId state instead of trusting what the AI sends
      // because the AI might send the list name instead of the UUID
      if (command.startsWith('START_DISPATCH:')) {
        console.log("[INFO] START_DISPATCH detected - executing (user confirmed via chat)");
        
        // Parse the command parts
        const parts = command.split(':');
        const type = parts[1] || 'email';
        const templateType = parts[3] || 'html';
        
        // Use the subOriginId from local state (guaranteed to be the correct UUID)
        // selectedOriginData.subOriginId is set when user selects a list
        // The prop subOriginId is a fallback
        const actualSubOriginId = selectedOriginData?.subOriginId || subOriginId;
        
        if (!actualSubOriginId) {
          console.error("[ERROR] No subOriginId available for dispatch");
          toast.error("Erro: Nenhuma lista selecionada para o disparo.");
          continue;
        }
        
        // Encode HTML and subject to avoid issues with special characters in the command
        const encodedHtml = sidePanelHtml ? btoa(encodeURIComponent(sidePanelHtml)) : '';
        const encodedSubject = sidePanelSubject ? btoa(encodeURIComponent(sidePanelSubject)) : '';
        
        // Build the corrected command with the actual UUID, conversation ID, subject and HTML
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

      // For other commands, process normally
      try {
        const response = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ command }),
        });

        if (!response.ok) throw new Error("Command failed");

        const result = await response.json();
        console.log("Command result:", result);

        if (result.type === 'origins') {
          // Add origins list component with selection handler
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
          const previewComponent = (
            <LeadsPreviewComponent 
              key={`preview-${Date.now()}`}
              preview={result.data} 
            />
          );
          components.push(previewComponent);
        }

        if (result.type === 'dispatch_updated') {
          // Job was updated (paused/resumed/cancelled)
          toast.success(`Disparo ${result.data.status === 'paused' ? 'pausado' : result.data.status === 'running' ? 'retomado' : 'cancelado'}`);
        }

      } catch (error) {
        console.error("Error processing command:", command, error);
      }
    }

    return { cleanContent: cleanContent.trim(), components };
  };

  const handleCommand = async (command: string) => {
    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) throw new Error("Command failed");
      
      const result = await response.json();
      console.log("Command result:", result);

      if (result.type === 'dispatch_updated') {
        toast.success(`Disparo ${result.data.status === 'paused' ? 'pausado' : result.data.status === 'running' ? 'retomado' : 'cancelado'}`);
      }
    } catch (error) {
      console.error("Error executing command:", error);
      toast.error("Erro ao executar comando");
    }
  };

  const handleSend = async (message: string, files?: File[]) => {
    if (!message.trim() && (!files || files.length === 0)) return;
    shouldAutoScrollRef.current = true;
    
    // Check if there's a CSV file or image
    let csvContent = '';
    let csvFileName = '';
    let imageBase64 = '';
    let imageFile: File | null = null;
    
    if (files && files.length > 0) {
      // Check for CSV file
      const csvFile = files.find(f => f.name.endsWith('.csv'));
      if (csvFile) {
        csvFileName = csvFile.name;
        csvContent = await csvFile.text();
        const parsedLeads = parseCSV(csvContent);
        if (parsedLeads.length > 0) {
          setCsvLeads(parsedLeads);
          setCsvFileName(csvFile.name);
          setCsvPanelOpen(true); // Open CSV panel to show the data
          toast.success(`${parsedLeads.length} leads carregados na planilha`);
        }
      }
      
      // Check for image file
      const imgFile = files.find(f => f.type.startsWith('image/'));
      if (imgFile) {
        imageFile = imgFile;
        // Convert to base64
        const reader = new FileReader();
        imageBase64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(imgFile);
        });
      }
    }
    
    // Build message content
    let messageContent = message;
    if (csvFileName) {
      messageContent = `${message}\n\n[Arquivo enviado: ${csvFileName} com ${csvLeads?.length || parseCSV(csvContent).length} leads]`;
    }
    if (imageFile) {
      messageContent = message || 'Analise esta imagem';
    }
    
    // Add user message with image if present
    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: messageContent,
      role: "user",
      timestamp: new Date(),
      imageUrl: imageBase64 || undefined,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Check if we're waiting for a question response
    if (pendingQuestion) {
      const q = pendingQuestion;
      setPendingQuestion(null);
      
      const lowerMsg = message.toLowerCase().trim();
      
      if (q.type === 'email_method') {
        // Check if user wants to use AI or has HTML ready
        const wantsAI = lowerMsg.includes('ia') || lowerMsg.includes('criar') || lowerMsg.includes('gerar') || 
                        lowerMsg.includes('ajuda') || lowerMsg.includes('criar com ia') || lowerMsg.includes('não tenho');
        const hasHtml = lowerMsg.includes('html') || lowerMsg.includes('tenho') || lowerMsg.includes('pronto') ||
                        message.includes('<!DOCTYPE') || message.includes('<html') || message.includes('<body');
        
        if (hasHtml && (message.includes('<') || lowerMsg.includes('tenho o html') || lowerMsg.includes('já tenho'))) {
          // User has HTML - call the code handler
          handleEmailChoiceCode(q.subOriginId, q.dispatchType);
        } else {
          // User wants AI - ask about copy
          handleEmailChoiceAI(q.subOriginId, q.dispatchType);
        }
        setIsLoading(false);
        return;
      }
      
      if (q.type === 'has_copy') {
        // Check if user has copy or wants to create from scratch
        const hasCopyReady = lowerMsg.includes('sim') || lowerMsg.includes('tenho') || lowerMsg.includes('aqui') ||
                             message.length > 100; // Long message likely is the copy itself
        
        if (hasCopyReady && message.length > 50) {
          // User sent the copy directly - generate HTML from it
          setPendingEmailContext({ subOriginId: q.subOriginId, dispatchType: q.dispatchType });
          // Re-trigger with the copy text
          setIsLoading(false);
          handleGenerateFromCopy(message, '', '', q.subOriginId, q.dispatchType);
          return;
        } else if (hasCopyReady) {
          // User said they have copy but didn't send it
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            content: `Ótimo! Cole sua copy aqui e eu vou transformar em um email HTML profissional.`,
            role: "assistant",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
          setPendingQuestion({ type: 'has_copy', subOriginId: q.subOriginId, dispatchType: q.dispatchType });
          setIsLoading(false);
          return;
        } else {
          // User wants to create from scratch
          handleCreateCopy(q.subOriginId, q.dispatchType);
          setIsLoading(false);
          return;
        }
      }
    }

    // Check if user is confirming dispatch via chat
    const lowerUserMsg = message.toLowerCase().trim();
    const isUserConfirming = (
      lowerUserMsg === 'sim' ||
      lowerUserMsg === 's' ||
      lowerUserMsg === 'yes' ||
      lowerUserMsg === 'ok' ||
      lowerUserMsg.includes('pode') ||
      lowerUserMsg.includes('manda') ||
      lowerUserMsg.includes('vai') ||
      lowerUserMsg.includes('confirmo') ||
      lowerUserMsg.includes('inicia') ||
      lowerUserMsg.includes('começa') ||
      lowerUserMsg.includes('dispara') ||
      lowerUserMsg.includes('envia') ||
      (lowerUserMsg.includes('sim') && lowerUserMsg.length < 20)
    );
    
    const hasEverythingReady = sidePanelHtml && 
                               sidePanelHtml.length > 100 && 
                               selectedOriginData?.subOriginId &&
                               !activeJobId;
    
    // Check if the last AI message asked for confirmation
    const lastAiMessage = messages.filter(m => m.role === 'assistant').pop();
    const aiAskedToConfirm = lastAiMessage && (
      lastAiMessage.content.toLowerCase().includes('posso iniciar') ||
      lastAiMessage.content.toLowerCase().includes('quer que eu inicie') ||
      lastAiMessage.content.toLowerCase().includes('pronto para enviar') ||
      lastAiMessage.content.toLowerCase().includes('iniciar o disparo') ||
      lastAiMessage.content.toLowerCase().includes('inicie o disparo')
    );
    
    if (isUserConfirming && hasEverythingReady && aiAskedToConfirm) {
      // Auto-execute dispatch - user confirmed via chat!
      const type = dispatchType || 'email';
      
      // Encode HTML and subject for the command
      const encodedHtml = sidePanelHtml ? btoa(encodeURIComponent(sidePanelHtml)) : '';
      const encodedSubject = sidePanelSubject ? btoa(encodeURIComponent(sidePanelSubject)) : '';
      
      const autoCommand = `START_DISPATCH:${type}:${selectedOriginData.subOriginId}:html:${currentConversationId || ''}:${encodedSubject}:${encodedHtml}`;
      
      const confirmingMessage: Message = {
        id: crypto.randomUUID(),
        content: `Perfeito! Iniciando o disparo agora... 🚀`,
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, confirmingMessage]);
      
      logAction('user', 'Confirmou disparo via chat', `Tipo: ${type}`);
      executeDispatch(autoCommand);
      setIsLoading(false);
      return;
    }

    // Check if we're waiting for email description - stream to side panel
    if (pendingEmailContext) {
      const ctx = pendingEmailContext;
      setPendingEmailContext(null);
      
      // Open side panel with generating state
      setSidePanelContext({ subOriginId: ctx.subOriginId, dispatchType: ctx.dispatchType });
      setSidePanelHtml('');
      setSidePanelSubject('');
      setSidePanelGenerating(true);
      setSidePanelOpen(true);
      
      try {
        const GENERATE_EMAIL_URL = `https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/generate-email`;
        
        const assistantMessageId = crypto.randomUUID();
        let generatedHtml = '';
        
        // Create streaming assistant message with indicator component
        setMessages(prev => [...prev, {
          id: assistantMessageId,
          content: "",
          role: "assistant",
          timestamp: new Date(),
          componentData: { type: 'email_generator_streaming' as const },
        }]);
        
        const response = await fetch(GENERATE_EMAIL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objective: message,
            tone: 'profissional',
            companyName: '',
            productService: '',
            additionalInfo: ''
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Erro ao gerar email");
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
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
                generatedHtml += content;
                // Extract subject and HTML in real-time
                const { subject, html } = extractSubjectAndHtml(generatedHtml);
                if (subject) setSidePanelSubject(subject);
                setSidePanelHtml(html);
              }
            } catch {
              // Incomplete JSON, continue
            }
          }
        }

        // Final extraction
        const { subject: finalSubject, html: cleanHtml } = extractSubjectAndHtml(generatedHtml);

        setSidePanelSubject(finalSubject);
        setSidePanelHtml(cleanHtml);
        setHtmlSource('ai'); // AI generated this email
        setSidePanelGenerating(false);
        logAction('ai', 'Gerou email a partir da descrição', `Assunto: "${finalSubject}", ${cleanHtml.length} caracteres`);

        // Update message - keep the indicator but mark as complete
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: "", componentData: { type: 'email_generator_streaming' as const, data: { isComplete: true } } }
              : m
          )
        );
        
        toast.success("Email gerado com sucesso!");
        
        // Force immediate save after generation completes
        setTimeout(() => {
          saveConversationNow();
        }, 100);
        
      } catch (error) {
        console.error("Error generating email:", error);
        toast.error(error instanceof Error ? error.message : "Erro ao gerar email");
        setSidePanelGenerating(false);
        setMessages(prev => prev.filter(m => m.content !== "Gerando seu email... Você pode acompanhar na lateral."));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Check if user is providing a button link
    const urlPattern = /https?:\/\/[^\s]+/i;
    const urlMatch = messageContent.match(urlPattern);
    const hasButtonPlaceholder = sidePanelHtml && sidePanelHtml.includes('{{button_link}}');
    
    if (hasButtonPlaceholder && urlMatch) {
      // Replace the placeholder with the actual URL
      const newHtml = sidePanelHtml.replace(/\{\{button_link\}\}/g, urlMatch[0]);
      setSidePanelHtml(newHtml);
      setSidePanelEditing(true);
      
      setTimeout(() => {
        setSidePanelEditing(false);
      }, 1500);
      
      const confirmMessage: Message = {
        id: crypto.randomUUID(),
        content: `Link do botão atualizado para: ${urlMatch[0]}. Quando estiver pronto pra enviar, é só me avisar!`,
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, confirmMessage]);
      setIsLoading(false);
      return;
    }

    // Check if user is asking for email edits and we have HTML in the side panel
    const lowerMessage = messageContent.toLowerCase();
    const isAskingForEdit = sidePanelHtml && (
      lowerMessage.includes('altera') ||
      lowerMessage.includes('muda') ||
      lowerMessage.includes('troca') ||
      lowerMessage.includes('modifica') ||
      lowerMessage.includes('ajusta') ||
      lowerMessage.includes('corrige') ||
      lowerMessage.includes('adiciona') ||
      lowerMessage.includes('remove') ||
      lowerMessage.includes('coloca') ||
      lowerMessage.includes('tira') ||
      lowerMessage.includes('melhora') ||
      lowerMessage.includes('edita') ||
      lowerMessage.includes('atualiza')
    );

    if (isAskingForEdit) {
      // Open panel in edit mode and stream the changes
      setSidePanelOpen(true);
      setSidePanelEditing(true);
      setSidePanelGenerating(true);

      const assistantMessageId = crypto.randomUUID();
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        content: "",
        role: "assistant",
        timestamp: new Date(),
        componentData: { type: 'email_generator_streaming' as const, data: { isEditing: true } },
      }]);

      try {
        const GENERATE_EMAIL_URL = `https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/generate-email`;
        
        const response = await fetch(GENERATE_EMAIL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objective: `Modifique o seguinte HTML de email conforme a instrução do usuário. 
            
Instrução do usuário: ${messageContent}

HTML atual:
${sidePanelHtml}

Retorne APENAS o HTML modificado, sem explicações.`,
            tone: 'profissional',
            companyName: '',
            productService: '',
            additionalInfo: ''
          }),
        });

        if (!response.ok) {
          throw new Error("Erro ao editar email");
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let newHtml = "";

        // Clear HTML to show the streaming from scratch
        setSidePanelHtml('');

        while (true) {
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
                newHtml += content;
                // For edits, just clean the HTML (subject stays the same)
                const cleanHtml = newHtml
                  .replace(/^```html\n?/i, '')
                  .replace(/^```\n?/, '')
                  .replace(/\n?```$/i, '');
                setSidePanelHtml(cleanHtml);
              }
            } catch {
              // Incomplete JSON
            }
          }
        }

        const finalHtml = newHtml
          .replace(/^```html\n?/i, '')
          .replace(/^```\n?/, '')
          .replace(/\n?```$/i, '')
          .trim();

        setSidePanelHtml(finalHtml);
        setSidePanelGenerating(false);
        setSidePanelEditing(false);
        logAction('ai', 'Editou o email conforme instrução do usuário', `${finalHtml.length} caracteres`);

        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: "", componentData: { type: 'email_generator_streaming' as const, data: { isComplete: true } } }
              : m
          )
        );

        toast.success("Email atualizado!");

      } catch (error) {
        console.error("Error editing email:", error);
        toast.error("Erro ao editar email");
        setSidePanelGenerating(false);
        setSidePanelEditing(false);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      // Build comprehensive context for the AI to be fully aware
      const contextInfo: string[] = [];
      
      // Current state summary
      contextInfo.push(`=== ESTADO ATUAL DA CONVERSA ===`);
      
      // Dispatch type
      if (dispatchType) {
        contextInfo.push(`• Tipo de disparo escolhido: ${dispatchType === 'email' ? 'EMAIL' : 'WHATSAPP WEB'}`);
      } else {
        contextInfo.push(`• Tipo de disparo: ainda não escolhido`);
      }
      
      // Selected list
      if (selectedOriginData) {
        contextInfo.push(`• Lista selecionada: "${selectedOriginData.originName} > ${selectedOriginData.subOriginName}"`);
      } else {
        contextInfo.push(`• Lista: nenhuma selecionada ainda`);
      }
      
      // Check for generated copy (text content before HTML conversion)
      const lastCopyMessage = [...messages].reverse().find(m => 
        m.role === 'assistant' && 
        m.componentData?.type === 'email_generator_streaming' &&
        m.componentData?.data?.isComplete &&
        m.content.length > 100
      );
      
      if (lastCopyMessage) {
        contextInfo.push(`• COPY CRIADA: ✅ SIM - você (IA) criou uma copy nesta conversa`);
        contextInfo.push(`• Preview da copy:\n---\n${lastCopyMessage.content.slice(0, 400)}${lastCopyMessage.content.length > 400 ? '\n[...]' : ''}\n---`);
        contextInfo.push(`• IMPORTANTE: Use esta copy para criar o email HTML - NÃO pergunte se tem copy pronta!`);
      }
      
      // Email HTML status
      if (sidePanelHtml && sidePanelHtml.length > 0) {
        const sourceText = htmlSource === 'ai' 
          ? 'VOCÊ (a IA) gerou este email durante a conversa' 
          : 'O usuário colou/editou este HTML manualmente';
        contextInfo.push(`• Email HTML: ✅ PRONTO (${sidePanelHtml.length} caracteres)`);
        contextInfo.push(`• Quem criou: ${sourceText}`);
        contextInfo.push(`• Assunto do email: "${sidePanelSubject || '(sem assunto definido)'}"`);
        contextInfo.push(`• Preview do conteúdo:\n---\n${sidePanelHtml.slice(0, 600)}${sidePanelHtml.length > 600 ? '\n[...]' : ''}\n---`);
      } else if (sidePanelGenerating) {
        contextInfo.push(`• Email HTML: ⏳ Gerando agora...`);
      } else if (dispatchType === 'email') {
        contextInfo.push(`• Email HTML: ❌ Ainda não criado`);
      }
      
      // Side panel state
      if (sidePanelOpen) {
        contextInfo.push(`• Painel de edição de email: aberto (usuário pode estar editando)`);
      }
      
      // CSV leads
      if (csvLeads && csvLeads.length > 0) {
        contextInfo.push(`• Leads do CSV: ${csvLeads.length} contatos carregados`);
      }
      
      // Active job
      if (activeJobId) {
        contextInfo.push(`• Disparo ativo: SIM (ID: ${activeJobId})`);
      }
      
      // Pending context
      if (pendingEmailContext) {
        contextInfo.push(`• Contexto pendente de email: aguardando geração`);
      }
      
      contextInfo.push(`=== FIM DO ESTADO ===`);
      
      // Include action history for complete AI memory
      if (actionHistory.length > 0) {
        contextInfo.push(`\n=== HISTÓRICO DE AÇÕES (MEMÓRIA COMPLETA) ===`);
        contextInfo.push(`O que aconteceu nesta conversa, em ordem cronológica:`);
        actionHistory.forEach((entry, i) => {
          const actorLabel = entry.actor === 'ai' ? '🤖 Você (IA)' : entry.actor === 'user' ? '👤 Usuário' : '⚙️ Sistema';
          contextInfo.push(`${i + 1}. [${entry.timestamp}] ${actorLabel}: ${entry.action}${entry.details ? ` - ${entry.details}` : ''}`);
        });
        contextInfo.push(`=== FIM DO HISTÓRICO ===`);
      }
      
      // Build instruction for AI behavior
      const aiInstructions = `
INSTRUÇÕES PARA VOCÊ (A IA):
1. Você tem TOTAL consciência do estado e histórico acima - USE essas informações!
2. O HISTÓRICO DE AÇÕES mostra TUDO que aconteceu - você sabe exatamente o que você fez e o que o usuário fez
3. Se você gerou algo (está no histórico), LEMBRE e mencione naturalmente: "o email que eu criei..."
4. Se já existe um HTML de email, NÃO pergunte se o usuário tem HTML
5. Seja natural e conversacional, como um colega de trabalho prestativo
6. Reconheça o progresso: "já temos a lista, já temos o email que eu criei..."
7. Se algo estiver faltando, mencione de forma natural
8. Evite repetir perguntas sobre coisas que já foram definidas`;

      // Create messages with context injected as system message
      // For messages with images, use multimodal format
      const messagesForAPI = [
        {
          role: 'system' as const,
          content: `${contextInfo.join('\n')}\n${aiInstructions}`
        },
        ...messages.map(m => {
          if (m.imageUrl) {
            // Multimodal message with image
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
        // Current user message
        imageBase64 
          ? {
              role: userMessage.role,
              content: [
                { type: 'text', text: userMessage.content },
                { type: 'image_url', image_url: { url: imageBase64 } }
              ]
            }
          : { role: userMessage.role, content: userMessage.content }
      ];

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: messagesForAPI }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao conectar com o Grok");
      }

      if (!response.body) {
        throw new Error("Resposta sem corpo");
      }

      // Stream the response with throttled updates
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      let assistantMessageId = crypto.randomUUID();
      let pendingUpdate = false;
      let lastUpdateTime = 0;
      const UPDATE_INTERVAL = 50; // Update UI every 50ms max

      // Check if copywriting mode to show panel during streaming
      const isCopywritingMode = messageContent.includes('[CONTEXT:copywriting]');
      
      // Extract a short summary from user prompt for workflow descriptions
      const getPromptSummary = (prompt: string): string => {
        // Remove context tags
        const cleaned = prompt.replace(/\[CONTEXT:[^\]]+\]/g, '').trim();
        // Get first 60 chars, end at word boundary
        const truncated = cleaned.length > 60 
          ? cleaned.substring(0, 60).replace(/\s+\S*$/, '') + '...'
          : cleaned;
        return truncated || 'user request';
      };
      const promptSummary = getPromptSummary(messageContent);
      
      // Initial workflow steps for copywriting with real descriptions
      const initialCopywritingSteps: WorkStep[] = [
        createCustomStep('analysis', 'Analisando contexto', 'in_progress', { 
          icon: 'search',
          description: `Parsing prompt: "${promptSummary}"`,
          summary: 'Extracting key requirements, target audience, and desired tone from user input.'
        }),
        createCustomStep('generation', 'Geração da copy', 'pending', { 
          icon: 'sparkles',
          description: 'Waiting for context analysis to complete'
        }),
        createCustomStep('review', 'Pronto para revisão', 'pending', { 
          icon: 'edit',
          description: 'Content will be available for editing'
        }),
      ];
      
      // If copywriting mode, DON'T open side panel yet - wait until content is ready
      // The panel will open automatically when content threshold is reached (after generation)

      // Create initial assistant message - include workflowSteps in componentData for persistence
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        content: "",
        role: "assistant",
        timestamp: new Date(),
        componentData: isCopywritingMode ? { 
          type: 'email_generator_streaming' as const, 
          data: { workflowSteps: initialCopywritingSteps } 
        } : undefined,
      }]);

      // Track if we've started receiving content (for workflow updates)
      let hasStartedContent = false;
      
      // Throttled update function
      const flushContentToUI = () => {
        pendingUpdate = false;
        
        // Updated workflow steps once content starts
        const generatingSteps: WorkStep[] = [
          createCustomStep('analysis', 'Contexto analisado', 'completed', { 
            icon: 'search',
            description: `Parsed: "${promptSummary}"`,
            summary: 'Identified target audience, tone, and key selling points from user prompt.'
          }),
          createCustomStep('generation', 'Gerando copy...', 'in_progress', { 
            icon: 'sparkles',
            description: 'AI is crafting persuasive content with AIDA structure',
            summary: 'Writing headline, emotional hooks, benefits, objections handling, and CTA.'
          }),
          createCustomStep('review', 'Pronto para revisão', 'pending', { 
            icon: 'edit',
            description: 'Content will be available for editing'
          }),
        ];
        
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessageId 
              ? { 
                  ...m, 
                  content: assistantContent,
                  // Update workflowSteps in componentData when content starts
                  componentData: isCopywritingMode && assistantContent.length > 20 
                    ? { type: 'email_generator_streaming' as const, data: { workflowSteps: generatingSteps } }
                    : m.componentData
                }
              : m
          )
        );
        
        // Update workflow to "generating" once we start receiving content (for visual in side panel)
        if (isCopywritingMode && assistantContent.length > 20 && !hasStartedContent) {
          hasStartedContent = true;
        }
      };

      const scheduleUpdate = () => {
        if (pendingUpdate) return;
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateTime;
        
        if (timeSinceLastUpdate >= UPDATE_INTERVAL) {
          lastUpdateTime = now;
          flushContentToUI();
        } else {
          pendingUpdate = true;
          setTimeout(() => {
            lastUpdateTime = Date.now();
            flushContentToUI();
          }, UPDATE_INTERVAL - timeSinceLastUpdate);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        // Process line-by-line
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              scheduleUpdate(); // Throttled update
            }
          } catch {
            // Incomplete JSON, put it back
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush - ensure all content is displayed
      flushContentToUI();

      // Handle any remaining buffer content
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
            }
          } catch { /* ignore */ }
        }
        // Final flush after processing remaining buffer
        flushContentToUI();
      }

      // Process commands after streaming is complete
      if (assistantContent) {
        const { cleanContent, components } = await processCommands(assistantContent);
        
        // Check if the original message was from copywriting agent
        const isCopywritingMode = messageContent.includes('[CONTEXT:copywriting]');
        
        // Re-extract prompt summary for final steps
        const getPromptSummaryFinal = (prompt: string): string => {
          const cleaned = prompt.replace(/\[CONTEXT:[^\]]+\]/g, '').trim();
          const truncated = cleaned.length > 60 
            ? cleaned.substring(0, 60).replace(/\s+\S*$/, '') + '...'
            : cleaned;
          return truncated || 'user request';
        };
        const promptSummary = getPromptSummaryFinal(messageContent);
        
        // Check if content is large (important copy, emails, etc.)
        const isLargeContent = cleanContent.length > 300;
        
        // If copywriting mode OR large content, show in side panel (not in chat)
        if ((isCopywritingMode || isLargeContent) && cleanContent.length > 50) {
        // Threshold for auto-opening side panel
        const OPEN_PANEL_THRESHOLD = 400;
        
        // Detect if it's HTML email content
        const isHtmlContent = cleanContent.includes('<') && cleanContent.includes('>') && 
          (cleanContent.includes('<html') || cleanContent.includes('<body') || 
           cleanContent.includes('<div') || cleanContent.includes('<p') || 
           cleanContent.includes('<h1') || cleanContent.includes('<table'));
        
        // Final workflow steps for persistence - with real descriptions
        const wordCount = cleanContent.split(/\s+/).length;
        const completedWorkflowSteps: WorkStep[] = [
          createCustomStep('analysis', 'Análise do contexto', 'completed', { 
            icon: 'file',
            description: `Parsed: "${promptSummary}"`,
            summary: 'Extracted target audience, tone, and key messaging points from user input.'
          }),
          createCustomStep('generation', isCopywritingMode ? 'Copy gerada' : 'Conteúdo gerado', 'completed', { 
            icon: 'sparkles',
            description: `Generated ${wordCount} words with persuasive structure`,
            summary: 'Applied AIDA framework: Attention, Interest, Desire, Action. Included emotional hooks, benefits, and CTA.'
          }),
          createCustomStep('review', 'Pronto para revisão', 'completed', { 
            icon: 'edit',
            description: 'Content available in side panel for editing',
            summary: 'You can modify the text, adjust formatting, and refine the message before sending.'
          }),
        ];
        
        // For HTML content - show in panel
        if (isHtmlContent) {
          // Extract subject from HTML if present
          const { subject: extractedSubject, html: extractedHtml } = extractSubjectAndHtml(cleanContent);
          
          setSidePanelHtml(extractedHtml || cleanContent);
          setSidePanelShowCodePreview(true);
          // Preserve existing subject if we have one, otherwise use extracted
          if (extractedSubject) {
            setSidePanelSubject(extractedSubject);
          }
          setSidePanelOpen(cleanContent.length >= OPEN_PANEL_THRESHOLD);
          setSidePanelMode('email');
          
          setMessages(prev => 
            prev.map(m => 
              m.id === assistantMessageId 
                ? { 
                    ...m, 
                    content: 'Email gerado! Visualize e edite na lateral.',
                    componentData: { 
                      type: 'email_generator_streaming' as const, 
                      data: { 
                        isComplete: true, 
                        workflowSteps: completedWorkflowSteps,
                        generatedHtml: cleanContent,
                        subject: extractedSubject || '',
                        mode: 'email' as const
                      } 
                    }
                  }
                : m
            )
          );
        } else {
        // For plain copy/text - SHOW IN CHAT and optionally open panel for large content
          const shouldOpenPanel = cleanContent.length >= OPEN_PANEL_THRESHOLD;
          
          if (shouldOpenPanel) {
            // Extract only the clean copy (content between --- delimiters)
            const extractCleanCopy = (text: string): string => {
              // Try to find content between --- delimiters
              const delimiterMatch = text.match(/---\s*([\s\S]*?)\s*---/);
              if (delimiterMatch && delimiterMatch[1].trim().length > 20) {
                return delimiterMatch[1].trim();
              }
              // Fallback: remove common agent greetings and questions
              let cleaned = text
                // Remove greetings at the start
                .replace(/^(Opa|Olá|Oi|Ei|Hey|E aí|Eai|Bom dia|Boa tarde|Boa noite)[,!]?\s*[^.!?\n]*[.!?]?\s*/gi, '')
                // Remove follow-up questions at the end
                .replace(/\s*(O que achou|Quer que eu|Posso ajustar|Se quiser|Qual tipo|Bora disparar|Pronto pra)[^?]*\?[^]*$/gi, '')
                // Remove "E aí!" style greetings
                .replace(/^E aí[!,]?\s*/gi, '')
                .trim();
              return cleaned || text;
            };
            
            const cleanCopy = extractCleanCopy(cleanContent);
            
            // Format with markdown support - convert **bold** and _italic_ to HTML
            const formattedCopy = cleanCopy
              .replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 700;">$1</strong>')
              .replace(/_([^_]+)_/g, '<em style="font-style: italic;">$1</em>')
              .replace(/\n/g, '<br>');
            
            setSidePanelHtml(`<div style="font-family: 'Inter', Arial, sans-serif; padding: 24px; line-height: 1.9; font-size: 15px; color: #1a1a1a;">${formattedCopy}</div>`);
            setSidePanelShowCodePreview(false);
            setSidePanelSubject('');
            setSidePanelOpen(true);
            setSidePanelMode('email');
            
            // Log the copy generation so AI knows about it
            const wordCount = cleanCopy.split(/\s+/).length;
            logAction('ai', 'Criou copy de texto', `${wordCount} palavras geradas`);
          }
          
          // Always show full content in chat for copy
          const copyHtmlForPanel = shouldOpenPanel 
            ? `<div style="font-family: 'Inter', Arial, sans-serif; padding: 24px; line-height: 1.9; font-size: 15px; color: #1a1a1a;">${cleanContent.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 700;">$1</strong>').replace(/_([^_]+)_/g, '<em style="font-style: italic;">$1</em>').replace(/\n/g, '<br>')}</div>`
            : '';
          
          setMessages(prev => 
            prev.map(m => 
              m.id === assistantMessageId 
                ? { 
                    ...m, 
                    content: cleanContent,
                    componentData: { 
                      type: 'email_generator_streaming' as const, 
                      data: { 
                        isComplete: true, 
                        workflowSteps: completedWorkflowSteps,
                        generatedHtml: copyHtmlForPanel,
                        subject: '',
                        mode: 'copy' as const
                      } 
                    }
                  }
                : m
            )
          );
        }
          
          // Turn off generating state
          setSidePanelGenerating(false);
          setIsLoading(false);
          
          // Force immediate save after streaming completes
          setTimeout(() => {
            saveConversationNow();
          }, 100);
          return;
        }
        
        // Check if user chose "Lista do CRM" - auto-show origins table
        const lowerMessage = messageContent.toLowerCase();
        const mentionsList = lowerMessage.includes('lista') || lowerMessage.includes('list');
        const mentionsCsv = lowerMessage.includes('csv') || lowerMessage.includes('arquivo');
        const mentionsCRM = lowerMessage.includes('crm') || lowerMessage.includes('cadastrada') || lowerMessage.includes('sistema');

        const userChoseCRM = (
          (mentionsList && mentionsCRM) ||
          lowerMessage.includes('lista do crm') ||
          (mentionsList && !mentionsCsv) ||
          lowerMessage.trim() === 'crm'
        );
        
        console.log("User message:", messageContent);
        console.log("userChoseCRM detection:", userChoseCRM);
        
        let finalComponents = components;
        let originsData: any = null;
        
        if (userChoseCRM && components.length === 0) {
          // Auto-fetch origins and show table
          console.log("Auto-fetching origins...");
          try {
            const originsResponse = await fetch(CHAT_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ command: 'LIST_ORIGINS' }),
            });
            
            console.log("Origins response status:", originsResponse.status);
            
            if (originsResponse.ok) {
              const originsResult = await originsResponse.json();
              console.log("Origins result:", originsResult);
              if (originsResult.type === 'origins') {
                originsData = originsResult.data;
                finalComponents = [
                  <OriginsListComponent 
                    key={`origins-${Date.now()}`}
                    origins={originsResult.data}
                    onSelect={handleOriginSelect}
                  />
                ];
              }
            }
          } catch (error) {
            console.error("Error auto-fetching origins:", error);
          }
        }
        
        // NOTE: Auto-dispatch detection removed - dispatch only happens when user explicitly confirms
        // The dispatch flow requires the user to explicitly ask to send
        
        // Determine componentData based on what was shown
        let componentData: MessageComponentData | undefined;
        if (originsData) {
          componentData = {
            type: 'origins_list',
            data: { origins: originsData }
          };
        }
        
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessageId 
              ? { 
                  ...m, 
                  content: cleanContent,
                  componentData,
                  component: finalComponents.length > 0 ? (
                    <div className="mt-4 space-y-4">
                      {finalComponents}
                    </div>
                  ) : undefined
                }
              : m
          )
        );
      }

    } catch (error) {
      console.error("Error calling Grok:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao conectar com o Grok");
      // Remove the empty assistant message if there was an error
      setMessages(prev => prev.filter(m => m.content.trim() !== ""));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle selecting a conversation from menu
  const handleSelectConversation = useCallback((id: string, loadedMessages: Message[]) => {
    // Set flag to skip URL-triggered reload (we already have the messages)
    skipNextUrlLoadRef.current = id;
    conversationIdRef.current = id;
    messagesRef.current = loadedMessages;
    setCurrentConversationId(id);
    setMessages(loadedMessages);
    lastSavedSignatureRef.current = ''; // Reset signature so changes get saved
  }, []);

  // Handle new conversation - reset ALL state
  const handleNewConversation = useCallback(() => {
    // Clear refs
    conversationIdRef.current = null;
    messagesRef.current = [];
    isCreatingConversationRef.current = false;
    lastSavedSignatureRef.current = '';
    skipNextUrlLoadRef.current = null;
    
    // Clear state
    setCurrentConversationId(null);
    setMessages([]);
    setCsvLeads(null);
    setActiveJobId(null);
    setSidePanelOpen(false);
    setSidePanelHtml('');
    setSidePanelSubject('');
    setSidePanelContext(null);
    setSidePanelGenerating(false);
    setSidePanelEditing(false);
    setSidePanelWorkflowSteps([]);
    setSidePanelShowCodePreview(true);
    setSidePanelTitle(undefined);
    setSidePanelMode('email');
    setSidePanelDispatchData(null);
    setSelectedOriginData(null);
    setDispatchType(null);
    setActionHistory([]);
    setHtmlSource(null);
    setPendingEmailContext(null);
    setPendingQuestion(null);
    setCsvPanelOpen(false);
    setInitialLoadDone(true);
    
    // Navigate to disparo without conversation param - use navigate for reliable navigation
    navigate('/admin/disparo', { replace: true });
  }, [navigate]);

  // Handle conversation created (auto-save)
  const handleConversationCreated = useCallback((id: string) => {
    conversationIdRef.current = id;
    setCurrentConversationId(id);
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 flex h-full bg-background overflow-hidden">
      {/* Chat area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* When no messages, center the input */}
        {!hasMessages ? (
          <div className="flex-1 flex items-center justify-center p-6 px-8">
            <div className="w-full max-w-3xl">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-3">
                  <img src={disparoLogo} alt="Logo" className="w-6 h-6" />
                  <h2 className="text-2xl font-semibold text-foreground">
                    Eai, o que vamos disparar hoje?
                  </h2>
                </div>
              </div>
              <PromptInputBox
                onSend={handleSend}
                isLoading={isLoading}
                placeholder="Digite sua mensagem aqui..."
              />
              <p className="text-xs text-muted-foreground text-center mt-3">
                A Scale pode cometer erros. Confira informações importantes.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat messages area */}
            <div 
              ref={chatScrollRef} 
              onScroll={handleChatScroll} 
              className="flex-1 overflow-y-auto min-h-0 p-6 px-8 overscroll-contain [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-foreground/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:min-h-[30px] [&::-webkit-scrollbar-thumb]:max-h-[50px]"
              style={{ 
                scrollBehavior: 'auto',
                WebkitOverflowScrolling: 'touch',
                scrollbarGutter: 'stable',
                willChange: 'scroll-position'
              }}
            >
              <div className={cn(
                "mx-auto space-y-4 transition-all duration-300",
                sidePanelOpen ? "max-w-3xl" : "max-w-5xl"
              )}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col",
                      msg.role === "user" ? "items-end" : "items-start"
                    )}
                  >
                  {msg.role === "user" ? (
                      <div className="bg-white text-foreground px-5 py-4 rounded-2xl max-w-[85%] border border-[#00000010]">
                        {/* Show image if present */}
                        {msg.imageUrl && (
                          <div className="mb-3">
                            <img 
                              src={msg.imageUrl} 
                              alt="Imagem enviada" 
                              className="max-w-full max-h-64 rounded-lg object-contain"
                            />
                          </div>
                        )}
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{removeAgentPrefix(msg.content)}</p>
                      </div>
                    ) : (
                      <div className="max-w-[85%] group">
                        {/* Message content first */}
                        {msg.content && (
                          <div>
                            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-foreground">
                              {formatMessageContent(msg.content)}
                            </p>
                          </div>
                        )}
                        {/* AI Work Details - show workflow steps from msg.componentData (persisted) */}
                        {msg.componentData?.type === 'email_generator_streaming' && 
                         msg.componentData?.data?.workflowSteps && 
                         Array.isArray(msg.componentData.data.workflowSteps) &&
                         msg.componentData.data.workflowSteps.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.1 }}
                            className="mt-3"
                          >
                            <AIWorkDetails steps={msg.componentData.data.workflowSteps as WorkStep[]} />
                          </motion.div>
                        )}
                        {/* Email generation indicator - only show when there's content */}
                        {msg.componentData?.type === 'email_generator_streaming' && (msg.componentData?.data?.generatedHtml || sidePanelHtml) && (
                          <div className="mt-3">
                            <EmailGenerationIndicator
                              isGenerating={sidePanelGenerating && messages[messages.length - 1]?.id === msg.id}
                              isComplete={msg.componentData?.data?.isComplete || !sidePanelGenerating}
                              isEditing={sidePanelEditing || msg.componentData?.data?.isEditing}
                              onTogglePanel={() => {
                                const data = msg.componentData?.data;
                                if (data?.generatedHtml) {
                                  setSidePanelHtml(data.generatedHtml);
                                  setSidePanelSubject(data.subject || '');
                                  setSidePanelMode(data.mode || 'email');
                                  setSidePanelShowCodePreview(data.mode === 'email');
                                  setSidePanelOpen(true);
                                } else {
                                  setSidePanelOpen(!sidePanelOpen);
                                }
                              }}
                              isPanelOpen={sidePanelOpen}
                              previewHtml={msg.componentData?.data?.generatedHtml || sidePanelHtml}
                            />
                          </div>
                        )}
                        {msg.component && (
                          <div className="w-full mt-4">
                            {msg.component}
                          </div>
                        )}
                        {/* Action icons for AI messages */}
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
                {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <span className="relative overflow-hidden">
                      <span className="relative z-10">Pensando...</span>
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-[shimmer_2s_infinite] -translate-x-full" style={{ animation: 'shimmer 2s infinite' }} />
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* AI Chat Input - fixed at bottom */}
            <div className="p-6 px-8 pt-0">
              <div className={cn(
                "mx-auto transition-all duration-300",
                sidePanelOpen ? "max-w-4xl" : "max-w-5xl"
              )}>
                <PromptInputBox
                  onSend={handleSend}
                  isLoading={isLoading}
                  placeholder="Digite sua mensagem aqui..."
                />
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Email Side Panel - animated section alongside chat */}
      <AnimatePresence mode="wait">
        {sidePanelOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="overflow-hidden h-full"
          >
            <EmailSidePanel
              isOpen={sidePanelOpen}
              htmlContent={sidePanelHtml}
              onHtmlChange={(html) => { setSidePanelHtml(html); setHtmlSource('user'); }}
              subject={sidePanelSubject}
              onSubjectChange={setSidePanelSubject}
              isGenerating={sidePanelGenerating}
              isEditing={sidePanelEditing}
              mode={sidePanelMode}
              dispatchData={sidePanelDispatchData}
              showCodePreview={sidePanelShowCodePreview}
              panelTitle={sidePanelTitle}
              onNewDispatch={() => {
                // Reset side panel to email mode and clear dispatch data
                setSidePanelMode('email');
                setSidePanelDispatchData(null);
                setSidePanelWorkflowSteps([]);
                setSidePanelHtml('');
                setSidePanelSubject('');
                setSidePanelOpen(false);
                setSidePanelShowCodePreview(true);
                setSidePanelTitle(undefined);
              }}
              onViewEmail={() => {
                // Switch back to email view mode
                setSidePanelMode('email');
              }}
            />
          </motion.div>
        )}
        
        {/* CSV Side Panel */}
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

// Component to display origins list with grouped selection
function OriginsListComponent({ origins, onSelect }: { origins: Origin[]; onSelect?: (subOriginId: string, subOriginName: string, originName: string) => void }) {
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [selectedSubOriginId, setSelectedSubOriginId] = useState<string | null>(null);

  const selectedOrigin = origins.find(o => o.id === selectedOriginId);

  const handleOriginSelect = (originId: string) => {
    setSelectedOriginId(originId);
    setSelectedSubOriginId(null);
  };

  const handleSubOriginSelect = (subOrigin: { id: string; nome: string }, originName: string) => {
    setSelectedSubOriginId(subOrigin.id);
    onSelect?.(subOrigin.id, subOrigin.nome, originName);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-4 space-y-3"
    >
      {/* Step 1: Select Origin */}
      <div className="text-sm text-muted-foreground mb-2">Selecione a origem:</div>
      <div className="flex flex-wrap gap-2">
        {origins.map(origin => (
          <button
            key={origin.id}
            onClick={() => handleOriginSelect(origin.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm transition-colors",
              selectedOriginId === origin.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-foreground"
            )}
          >
            {origin.nome}
          </button>
        ))}
      </div>

      {/* Step 2: Select Sub-Origin */}
      {selectedOrigin && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3"
        >
          <div className="text-sm text-muted-foreground mb-2">Selecione a lista:</div>
          <div className="flex flex-wrap gap-2">
            {selectedOrigin.crm_sub_origins.map(sub => (
              <button
                key={sub.id}
                onClick={() => handleSubOriginSelect(sub, selectedOrigin.nome)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm transition-colors",
                  selectedSubOriginId === sub.id
                    ? "bg-green-500 text-white"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                )}
              >
                {sub.nome}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// Component to display leads preview - Clean compact format
function LeadsPreviewComponent({ preview }: { preview: LeadsPreview }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-4 my-4"
    >
      <h3 className="font-medium text-foreground mb-3">
        📊 Leads para Disparo
      </h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{preview.totalLeads}</div>
          <div className="text-xs text-muted-foreground">Total de leads</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-500">{preview.validLeads}</div>
          <div className="text-xs text-muted-foreground">
            {preview.dispatchType === 'email' ? 'Com email válido' : 'Com WhatsApp válido'}
          </div>
        </div>
      </div>

      {preview.invalidLeads > 0 && (
        <div className="text-sm text-yellow-600 mb-3">
          ⚠️ {preview.invalidLeads} leads sem {preview.dispatchType === 'email' ? 'email válido' : 'WhatsApp válido'}
        </div>
      )}

      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Lista:</span>
          <span className="text-foreground font-medium">{preview.originName} → {preview.subOriginName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tipo:</span>
          <span className="text-foreground">{preview.dispatchType === 'email' ? '📧 Email' : '📱 WhatsApp'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Intervalo:</span>
          <span className="text-foreground">{preview.intervalSeconds}s entre envios</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tempo estimado:</span>
          <span className="text-foreground">~{preview.estimatedMinutes} min</span>
        </div>
      </div>

      {/* Sample of first leads */}
      {preview.leads && preview.leads.length > 0 && (
        <div className="border-t border-border pt-3">
          <div className="text-xs text-muted-foreground mb-2">
            Primeiros leads ({Math.min(5, preview.leads.length)} de {preview.validLeads}):
          </div>
          <div className="space-y-1.5">
            {preview.leads.slice(0, 5).map((lead, i) => (
              <div key={i} className="flex items-center justify-between text-sm bg-muted/30 px-2 py-1.5 rounded">
                <span className="font-medium text-foreground truncate max-w-[140px]">{lead.name}</span>
                <span className="text-muted-foreground text-xs truncate max-w-[160px]">{lead.contact}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// Component to display CSV leads preview
function CsvLeadsPreviewComponent({ leads, type }: { leads: CsvLead[]; type: 'email' | 'whatsapp' }) {
  const validLeads = leads.filter(l => 
    type === 'email' ? l.email && l.email.includes('@') : l.whatsapp && l.whatsapp.length >= 8
  );
  const invalidLeads = leads.length - validLeads.length;
  const intervalSeconds = 5;
  const estimatedMinutes = Math.ceil((validLeads.length * intervalSeconds) / 60);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-4 my-4"
    >
      <h3 className="font-medium text-foreground mb-3">
        📄 Preview do Arquivo CSV
      </h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{leads.length}</div>
          <div className="text-xs text-muted-foreground">Total de leads</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-500">{validLeads.length}</div>
          <div className="text-xs text-muted-foreground">Leads válidos</div>
        </div>
      </div>

      {invalidLeads > 0 && (
        <div className="text-sm text-yellow-600 mb-3">
          ⚠️ {invalidLeads} leads sem {type === 'email' ? 'email válido' : 'WhatsApp válido'}
        </div>
      )}

      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fonte:</span>
          <span className="text-foreground">Arquivo CSV</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Intervalo:</span>
          <span className="text-foreground">{intervalSeconds}s entre envios</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tempo estimado:</span>
          <span className="text-foreground">~{estimatedMinutes} minutos</span>
        </div>
      </div>

      {validLeads.length > 0 && (
        <div className="border-t border-border pt-3">
          <div className="text-xs text-muted-foreground mb-2">Primeiros leads:</div>
          <div className="space-y-1">
            {validLeads.slice(0, 5).map((lead, i) => (
              <div key={i} className="text-sm text-foreground flex justify-between">
                <span>{lead.name}</span>
                <span className="text-muted-foreground text-xs">
                  {type === 'email' ? lead.email : lead.whatsapp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        Confirme para iniciar o disparo
      </p>
    </motion.div>
  );
}

// Compact feedback button with modern icons
function FeedbackButton({ 
  icon, 
  onClick,
  active = false 
}: { 
  icon: 'copy' | 'like' | 'dislike'; 
  onClick?: () => void;
  active?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleClick = () => {
    if (icon === 'copy') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    onClick?.();
  };

  const iconMap = {
    copy: copied ? (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ) : (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    ),
    like: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
      </svg>
    ),
    dislike: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
      </svg>
    )
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "p-1 rounded transition-colors",
        copied ? "text-green-500" : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50"
      )}
    >
      {iconMap[icon]}
    </button>
  );
}

// Simple syntax highlighting for HTML
function highlightHtml(code: string): React.ReactNode[] {
  if (!code) return [];
  
  const result: React.ReactNode[] = [];
  let remaining = code;
  let key = 0;
  
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
    let processedLine = line;
    const elements: React.ReactNode[] = [];
    
    // Process the line for each pattern
    let lastIndex = 0;
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
        elements.push(<span key={`${lineIndex}-text-${i}`}>{line.slice(currentPos, match.start)}</span>);
      }
      elements.push(<span key={`${lineIndex}-match-${i}`} className={match.className}>{match.text}</span>);
      currentPos = match.end;
    });
    
    if (currentPos < line.length) {
      elements.push(<span key={`${lineIndex}-end`}>{line.slice(currentPos)}</span>);
    }
    
    if (elements.length === 0) {
      elements.push(<span key={`${lineIndex}-empty`}>{line || ' '}</span>);
    }
    
    return (
      <div key={lineIndex} className="min-h-[1.5em]">
        {elements}
      </div>
    );
  });
}

// Shared component for editing generated HTML with tabs
function EmailEditorWithTabs({
  html,
  isGenerating,
  onHtmlChange,
  onRegenerate,
  onUse
}: {
  html: string;
  isGenerating: boolean;
  onHtmlChange: (html: string) => void;
  onRegenerate?: () => void;
  onUse: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('preview');

  const getSanitizedHtml = () => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-4"
    >
      <div className="rounded-xl border border-border/40 overflow-hidden">
        {/* Header with tabs */}
        <div className="px-4 py-2.5 bg-muted/80 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {isGenerating && (
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2" />
            )}
            <button
              onClick={() => setActiveTab('code')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeTab === 'code'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              Código
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeTab === 'preview'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              Preview
            </button>
          </div>
          {!isGenerating && html && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Gerar novamente
            </button>
          )}
        </div>
        
        {/* Content area */}
        <div className="min-h-[300px] max-h-[400px] overflow-auto">
          {activeTab === 'code' ? (
            <textarea
              value={html}
              onChange={(e) => onHtmlChange(e.target.value)}
              className="w-full h-full min-h-[300px] p-4 bg-background text-sm font-mono text-foreground resize-none focus:outline-none"
              placeholder="HTML do email..."
              disabled={isGenerating}
            />
          ) : (
            <div className="bg-white p-4">
              {html ? (
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: getSanitizedHtml() }}
                />
              ) : (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Iniciando geração...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Use email button */}
      {!isGenerating && html && (
        <div className="flex justify-end">
          <button
            onClick={onUse}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
              "bg-foreground text-background hover:bg-foreground/90"
            )}
          >
            Usar este email
          </button>
        </div>
      )}
    </motion.div>
  );
}

// Note: EmailChoiceComponent, CopyChoiceComponent, and CopyInputComponent removed
// Questions are now handled as plain text in the chat flow

// Component for generating HTML from existing copy with streaming
function CopyToHtmlGenerator({ 
  copyText,
  companyName,
  productService,
  onGenerated 
}: { 
  copyText: string;
  companyName: string;
  productService: string;
  onGenerated: (html: string) => void;
}) {
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [isGenerating, setIsGenerating] = useState(true);

  const GENERATE_EMAIL_URL = `https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/generate-email`;

  useEffect(() => {
    const generateHtml = async () => {
      try {
        const response = await fetch(GENERATE_EMAIL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hasCopy: true,
            copyText,
            companyName,
            productService
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Erro ao gerar HTML");
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
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
                setGeneratedHtml(fullContent);
              }
            } catch {
              // Incomplete JSON, continue
            }
          }
        }

        // Clean up the HTML
        let cleanHtml = fullContent
          .replace(/^```html\n?/i, '')
          .replace(/^```\n?/, '')
          .replace(/\n?```$/i, '')
          .trim();

        setGeneratedHtml(cleanHtml);
        setIsGenerating(false);
        toast.success("HTML do email gerado!");

      } catch (error) {
        console.error("Error generating HTML:", error);
        toast.error(error instanceof Error ? error.message : "Erro ao gerar HTML");
        setIsGenerating(false);
      }
    };

    generateHtml();
  }, [copyText, companyName, productService]);

  const handleUseEmail = () => {
    if (generatedHtml.trim()) {
      onGenerated(generatedHtml);
    }
  };

  return (
    <EmailEditorWithTabs
      html={generatedHtml}
      isGenerating={isGenerating}
      onHtmlChange={setGeneratedHtml}
      onUse={handleUseEmail}
    />
  );
}

// Component for AI email generation with streaming - simplified version
function EmailGeneratorComponent({ 
  onGenerated 
}: { 
  onGenerated: (html: string) => void;
}) {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const GENERATE_EMAIL_URL = `https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/generate-email`;

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast.error("Por favor, descreva o seu serviço/produto ou ideia");
      return;
    }

    setIsGenerating(true);
    setGeneratedHtml('');
    setShowPreview(true);

    try {
      const response = await fetch(GENERATE_EMAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: description,
          tone: 'profissional',
          companyName: '',
          productService: '',
          additionalInfo: ''
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro ao gerar email");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
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
              setGeneratedHtml(fullContent);
            }
          } catch {
            // Incomplete JSON, continue
          }
        }
      }

      // Clean up the HTML (remove markdown code blocks if present)
      let cleanHtml = fullContent
        .replace(/^```html\n?/i, '')
        .replace(/^```\n?/, '')
        .replace(/\n?```$/i, '')
        .trim();

      setGeneratedHtml(cleanHtml);
      toast.success("Email gerado com sucesso!");

    } catch (error) {
      console.error("Error generating email:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao gerar email");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseEmail = () => {
    if (generatedHtml.trim()) {
      onGenerated(generatedHtml);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-4"
    >
      {!showPreview ? (
        <div className="space-y-3">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva seu serviço, produto ou a ideia do email..."
            className="w-full min-h-[100px] p-3 rounded-lg border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
          <button
            onClick={handleGenerate}
            disabled={!description.trim() || isGenerating}
            className={cn(
              "w-full px-5 py-2.5 rounded-lg text-sm font-medium transition-all",
              "bg-foreground text-background hover:bg-foreground/90",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            Gerar Email
          </button>
        </div>
      ) : (
        <EmailEditorWithTabs
          html={generatedHtml}
          isGenerating={isGenerating}
          onHtmlChange={setGeneratedHtml}
          onRegenerate={() => setShowPreview(false)}
          onUse={handleUseEmail}
        />
      )}
    </motion.div>
  );
}

// Component for HTML/message input - Modern code editor with syntax highlighting and preview
function HtmlEditorComponent({ onSubmit, initialContent = '' }: { onSubmit: (html: string) => void; initialContent?: string }) {
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>(initialContent ? 'preview' : 'code');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const preRef = React.useRef<HTMLPreElement>(null);

  // Update content when initialContent changes
  React.useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
      setActiveTab('preview');
    }
  }, [initialContent]);

  const handleSubmit = () => {
    if (!content.trim()) {
      toast.error("Por favor, insira o conteúdo do email");
      return;
    }
    setIsSubmitting(true);
    onSubmit(content);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast.success("Copiado!");
  };

  // Sync scroll between textarea and pre
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Handle keyboard shortcut to submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Basic HTML sanitization for preview (removes script tags)
  const getSanitizedHtml = () => {
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="w-full">
        <div className="text-xs text-muted-foreground mb-2 text-left">
          Template do Email · Use <code className="bg-muted px-1 py-0.5 rounded text-xs text-foreground">{"{{name}}"}</code> para personalizar
        </div>
        
        {/* Code editor container */}
        <div className="rounded-xl overflow-hidden border border-border/40 shadow-sm bg-muted/50">
          {/* Header bar with tabs */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/80 border-b border-border/40">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('code')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  activeTab === 'code'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                Código
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  activeTab === 'preview'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                Preview
              </button>
            </div>
            <button 
              onClick={handleCopy}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copiar
            </button>
          </div>
          
          {/* Content area */}
          {activeTab === 'code' ? (
            /* Editor with syntax highlighting overlay */
            <div className="relative min-h-[280px]">
              {/* Highlighted code display */}
              <pre
                ref={preRef}
                className="absolute inset-0 p-5 font-mono text-sm text-foreground pointer-events-none overflow-auto whitespace-pre-wrap break-words"
                aria-hidden="true"
              >
                {content ? highlightHtml(content) : (
                  <span className="text-muted-foreground">
                    {`Cole aqui o HTML do email...

Exemplo:
<h1>Olá {{name}}!</h1>
<p>Temos uma oferta especial.</p>

Cmd/Ctrl + Enter para enviar`}
                  </span>
                )}
              </pre>
              
              {/* Actual textarea for input */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                className="relative w-full min-h-[280px] p-5 bg-transparent font-mono text-sm text-transparent caret-foreground focus:outline-none resize-y"
                spellCheck={false}
              />
            </div>
          ) : (
            /* Preview area */
            <div className="min-h-[280px] p-5 bg-white overflow-auto">
              {content.trim() ? (
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: getSanitizedHtml() }}
                />
              ) : (
                <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
                  Digite o HTML na aba "Código" para visualizar aqui
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Info message */}
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Quando quiser enviar, é só falar que vou preparar o envio
        </p>
      </div>
    </motion.div>
  );
}
