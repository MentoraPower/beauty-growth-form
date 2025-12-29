import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Code2, Eye, Copy, Check, BarChart3, Mail, X, Pause, Play, Loader2, ChevronsRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useResilientChannel } from "@/hooks/useResilientChannel";
import { DispatchAnalysis, DispatchData } from "./DispatchAnalysis";
import { motion } from "framer-motion";

// Format text with markdown-like syntax: **bold**, _italic_, ~strikethrough~, `code`
const formatTextContent = (text: string): string => {
  return text
    // Bold: **text** or *text*
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    // Italic: _text_
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    // Strikethrough: ~text~
    .replace(/~([^~]+)~/g, '<s>$1</s>')
    // Inline code: `text`
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>');
};

interface EditOperation {
  type: 'insert' | 'delete' | 'replace';
  startIndex: number;
  endIndex?: number;
  newText?: string;
}

interface DispatchLead {
  id: string;
  name: string;
  email: string;
}

interface DispatchJob {
  id: string;
  type: string;
  sub_origin_id: string;
  origin_name: string | null;
  sub_origin_name: string | null;
  total_leads: number;
  valid_leads: number;
  sent_count: number;
  failed_count: number;
  status: string;
  current_lead_name: string | null;
}

export type SidePanelMode = 'email' | 'dispatch_details' | 'workflow' | 'dispatch_leads';

interface EmailSidePanelProps {
  isOpen: boolean;
  htmlContent: string;
  onHtmlChange: (html: string) => void;
  isGenerating?: boolean;
  isEditing?: boolean;
  editOperation?: EditOperation | null;
  subject?: string;
  onSubjectChange?: (subject: string) => void;
  preheader?: string;
  onPreheaderChange?: (preheader: string) => void;
  // New props for dispatch details mode
  mode?: SidePanelMode;
  dispatchData?: DispatchData | null;
  onNewDispatch?: () => void;
  onViewEmail?: () => void;
  // Whether to show code/preview tabs (only for email visuals)
  showCodePreview?: boolean;
  // Title for the panel when showing workflow/copy (REMOVED - no longer used)
  panelTitle?: string;
  // Force initial tab when content is loaded externally
  forcePreviewTab?: boolean;
  // Props for dispatch_leads mode
  dispatchJobId?: string | null;
  onDispatchCommand?: (command: string) => void;
  // Close panel callback
  onClose?: () => void;
  // Save callback - persists content
  onSave?: () => void;
}

// Syntax highlighting for HTML with dark purple for strings
const highlightHtml = (code: string, highlightRange?: { start: number; end: number }): React.ReactNode => {
  if (!code) return null;
  
  const parts: React.ReactNode[] = [];
  let remaining = code;
  let keyIndex = 0;
  let currentIndex = 0;

  while (remaining.length > 0) {
    let matched = false;

    // Check if we're in highlight range
    const isInHighlight = highlightRange && 
      currentIndex >= highlightRange.start && 
      currentIndex < highlightRange.end;

    // Comments
    const commentMatch = remaining.match(/^(<!--[\s\S]*?-->)/);
    if (commentMatch) {
      const content = <span key={keyIndex++} className={cn("text-muted-foreground italic", isInHighlight && "bg-primary/20 rounded")}>{commentMatch[1]}</span>;
      parts.push(content);
      currentIndex += commentMatch[1].length;
      remaining = remaining.slice(commentMatch[1].length);
      matched = true;
      continue;
    }

    // Opening/closing tags
    const tagMatch = remaining.match(/^(<\/?)([\w-]+)/);
    if (tagMatch) {
      parts.push(<span key={keyIndex++} className={cn("text-pink-500", isInHighlight && "bg-primary/20 rounded")}>{tagMatch[1]}</span>);
      parts.push(<span key={keyIndex++} className={cn("text-blue-500", isInHighlight && "bg-primary/20 rounded")}>{tagMatch[2]}</span>);
      currentIndex += tagMatch[0].length;
      remaining = remaining.slice(tagMatch[0].length);
      matched = true;
      continue;
    }

    // Attributes
    const attrMatch = remaining.match(/^(\s+)([\w-]+)(=)("([^"]*)")?/);
    if (attrMatch) {
      parts.push(<span key={keyIndex++} className={isInHighlight ? "bg-primary/20 rounded" : ""}>{attrMatch[1]}</span>);
      parts.push(<span key={keyIndex++} className={cn("text-orange-400", isInHighlight && "bg-primary/20 rounded")}>{attrMatch[2]}</span>);
      parts.push(<span key={keyIndex++} className={cn("text-foreground", isInHighlight && "bg-primary/20 rounded")}>{attrMatch[3]}</span>);
      if (attrMatch[4]) {
        parts.push(<span key={keyIndex++} className={cn("text-purple-600 dark:text-purple-400", isInHighlight && "bg-primary/20 rounded")}>{attrMatch[4]}</span>);
      }
      currentIndex += attrMatch[0].length;
      remaining = remaining.slice(attrMatch[0].length);
      matched = true;
      continue;
    }

    // Closing bracket
    const closeBracket = remaining.match(/^(\/?>)/);
    if (closeBracket) {
      parts.push(<span key={keyIndex++} className={cn("text-pink-500", isInHighlight && "bg-primary/20 rounded")}>{closeBracket[1]}</span>);
      currentIndex += closeBracket[1].length;
      remaining = remaining.slice(closeBracket[1].length);
      matched = true;
      continue;
    }

    // Text content
    const textMatch = remaining.match(/^([^<]+)/);
    if (textMatch) {
      parts.push(<span key={keyIndex++} className={cn("text-foreground", isInHighlight && "bg-primary/20 rounded")}>{textMatch[1]}</span>);
      currentIndex += textMatch[1].length;
      remaining = remaining.slice(textMatch[1].length);
      matched = true;
      continue;
    }

    // Fallback: single character
    if (!matched) {
      parts.push(<span key={keyIndex++} className={isInHighlight ? "bg-primary/20 rounded" : ""}>{remaining[0]}</span>);
      currentIndex += 1;
      remaining = remaining.slice(1);
    }
  }

  return parts;
};

// Calculate line number and position from character index
const getLineInfo = (text: string, charIndex: number): { line: number; lineStart: number } => {
  const lines = text.slice(0, charIndex).split('\n');
  const line = lines.length;
  const lineStart = charIndex - (lines[lines.length - 1]?.length || 0);
  return { line, lineStart };
};

export function EmailSidePanel({ 
  isOpen, 
  htmlContent, 
  onHtmlChange,
  isGenerating = false,
  isEditing = false,
  editOperation = null,
  subject = "",
  onSubjectChange,
  preheader = "",
  onPreheaderChange,
  mode = 'email',
  dispatchData = null,
  onNewDispatch,
  onViewEmail,
  showCodePreview = true,
  panelTitle,
  forcePreviewTab = false,
  dispatchJobId = null,
  onDispatchCommand,
  onClose,
  onSave
}: EmailSidePanelProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('preview');
  const [copied, setCopied] = useState(false);
  const [displayedContent, setDisplayedContent] = useState("");
  const [highlightRange, setHighlightRange] = useState<{ start: number; end: number } | undefined>();
  const [editingIndicator, setEditingIndicator] = useState<{ line: number; action: string } | null>(null);
  const [showPreviewLoading, setShowPreviewLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const displayedIndexRef = useRef(0);
  const previousContentRef = useRef("");
  const editAnimationRef = useRef<number | null>(null);
  const wasGeneratingRef = useRef(false);
  const prevHtmlLengthRef = useRef(0);

  // Dispatch leads mode state
  const [dispatchJob, setDispatchJob] = useState<DispatchJob | null>(null);
  const [dispatchLeads, setDispatchLeads] = useState<DispatchLead[]>([]);
  const [sentLeadIds, setSentLeadIds] = useState<Set<string>>(new Set());
  const [sentEmails, setSentEmails] = useState<Set<string>>(new Set()); // For CSV: track by email
  const [dispatchLoading, setDispatchLoading] = useState(true);

  // Fetch dispatch job data
  const fetchDispatchData = useCallback(async () => {
    if (!dispatchJobId) return;

    const { data: jobData } = await supabase
      .from('dispatch_jobs')
      .select('*')
      .eq('id', dispatchJobId)
      .single();

    if (jobData) {
      setDispatchJob(jobData as unknown as DispatchJob);

      // Check if this is a CSV dispatch (has csv_list_id)
      const isCsvDispatch = !!(jobData as any).csv_list_id;

      if (isCsvDispatch) {
        // Fetch recipients from CSV list
        const { data: csvRecipients } = await supabase
          .from('dispatch_csv_list_recipients')
          .select('id, name, email')
          .eq('list_id', (jobData as any).csv_list_id)
          .order('name');

        if (csvRecipients) {
          setDispatchLeads(csvRecipients.map(r => ({
            id: r.id,
            name: r.name || 'Lead',
            email: r.email
          })));
        }

        // For CSV: fetch sent emails by email address
        const { data: sentEmailsData } = await supabase
          .from('sent_emails')
          .select('lead_email')
          .eq('dispatch_job_id', dispatchJobId)
          .eq('status', 'sent');

        if (sentEmailsData) {
          setSentEmails(new Set(sentEmailsData.map(e => e.lead_email)));
        }
      } else {
        // CRM dispatch - original flow
        const { data: leadsData } = await supabase
          .from('leads')
          .select('id, name, email')
          .eq('sub_origin_id', jobData.sub_origin_id)
          .not('email', 'is', null)
          .order('name');

        if (leadsData) {
          setDispatchLeads(leadsData.filter(l => l.email && l.email.includes('@')).map(l => ({
            id: l.id,
            name: l.name,
            email: l.email
          })));
        }

        // Fetch sent emails for this job
        const { data: sentEmailsData } = await supabase
          .from('sent_emails')
          .select('lead_id')
          .eq('dispatch_job_id', dispatchJobId)
          .eq('status', 'sent');

        if (sentEmailsData) {
          setSentLeadIds(new Set(sentEmailsData.map(e => e.lead_id).filter(Boolean)));
        }
      }
    }

    setDispatchLoading(false);
  }, [dispatchJobId]);

  // Load dispatch data when mode changes to dispatch_leads
  useEffect(() => {
    if (mode === 'dispatch_leads' && dispatchJobId) {
      setDispatchLoading(true);
      fetchDispatchData();
    }
  }, [mode, dispatchJobId, fetchDispatchData]);

  // Real-time updates for the job
  useResilientChannel({
    channelName: `dispatch-panel-${dispatchJobId}`,
    table: 'dispatch_jobs',
    event: 'UPDATE',
    filter: dispatchJobId ? `id=eq.${dispatchJobId}` : undefined,
    onPayload: (payload) => {
      setDispatchJob(payload.new as DispatchJob);
    },
    pollingFallback: {
      enabled: mode === 'dispatch_leads',
      intervalMs: 2000,
      fetchFn: fetchDispatchData,
      shouldPoll: () => dispatchJob?.status === 'running',
    },
  });

  // Real-time updates for sent emails
  useResilientChannel({
    channelName: `dispatch-emails-${dispatchJobId}`,
    table: 'sent_emails',
    event: 'INSERT',
    filter: dispatchJobId ? `dispatch_job_id=eq.${dispatchJobId}` : undefined,
    onPayload: (payload) => {
      const newEmail = payload.new as { lead_id: string | null; lead_email: string; status: string };
      if (newEmail.status === 'sent') {
        // Support both CRM (lead_id) and CSV (lead_email) tracking
        if (newEmail.lead_id) {
          setSentLeadIds(prev => new Set([...prev, newEmail.lead_id!]));
        }
        setSentEmails(prev => new Set([...prev, newEmail.lead_email]));
      }
    },
  });
  
  // Force preview tab when content is loaded externally (e.g., user pasted HTML)
  useEffect(() => {
    if (forcePreviewTab && htmlContent && htmlContent.length > 0 && prevHtmlLengthRef.current === 0) {
      setActiveTab('preview');
    }
    prevHtmlLengthRef.current = htmlContent.length;
  }, [htmlContent, forcePreviewTab]);

  // Handle preview content edit
  const handlePreviewBlur = useCallback(() => {
    if (previewRef.current && !isGenerating && !isEditing) {
      const newHtml = previewRef.current.innerHTML;
      if (newHtml !== htmlContent) {
        onHtmlChange(newHtml);
      }
    }
  }, [htmlContent, isGenerating, isEditing, onHtmlChange]);

  // Detect content changes and animate edits
  useEffect(() => {
    const prevContent = previousContentRef.current;
    const newContent = htmlContent;
    
    if (!prevContent || !newContent || isGenerating) {
      previousContentRef.current = newContent;
      return;
    }

    // Find the difference between old and new content
    const findDiff = () => {
      let startDiff = 0;
      let endDiffOld = prevContent.length;
      let endDiffNew = newContent.length;

      // Find start of difference
      while (startDiff < prevContent.length && startDiff < newContent.length && prevContent[startDiff] === newContent[startDiff]) {
        startDiff++;
      }

      // Find end of difference (from the back)
      while (endDiffOld > startDiff && endDiffNew > startDiff && prevContent[endDiffOld - 1] === newContent[endDiffNew - 1]) {
        endDiffOld--;
        endDiffNew--;
      }

      return { startDiff, endDiffOld, endDiffNew };
    };

    if (prevContent !== newContent && isEditing) {
      const { startDiff, endDiffOld, endDiffNew } = findDiff();
      const lineInfo = getLineInfo(newContent, startDiff);
      const oldPart = prevContent.slice(startDiff, endDiffOld);
      const newPart = newContent.slice(startDiff, endDiffNew);
      const isDeleting = oldPart.length > newPart.length;
      const isInserting = newPart.length > oldPart.length;
      
      // Determine action text
      let actionText = 'Editando...';
      if (isDeleting && newPart.length === 0) {
        actionText = 'Removendo...';
      } else if (isInserting && oldPart.length === 0) {
        actionText = 'Inserindo...';
      } else {
        actionText = 'Substituindo...';
      }
      
      // Show editing indicator
      setEditingIndicator({
        line: lineInfo.line,
        action: actionText
      });

      // Scroll to the edit position smoothly
      if (preRef.current) {
        const lineHeight = 18;
        const scrollTarget = (lineInfo.line - 5) * lineHeight;
        preRef.current.scrollTo({
          top: Math.max(0, scrollTarget),
          behavior: 'smooth'
        });
      }

      // Cancel any existing animation
      if (editAnimationRef.current) {
        cancelAnimationFrame(editAnimationRef.current);
      }

      const beforePart = prevContent.slice(0, startDiff);
      const afterPart = newContent.slice(endDiffNew);
      
      // Phase 1: If deleting, show deletion animation first
      if (isDeleting || (oldPart.length > 0 && newPart !== oldPart)) {
        let deleteIndex = oldPart.length;
        
        const animateDelete = () => {
          if (deleteIndex > 0) {
            deleteIndex = Math.max(0, deleteIndex - 3); // Delete 3 chars at a time
            const currentOldPart = oldPart.slice(0, deleteIndex);
            setDisplayedContent(beforePart + currentOldPart + afterPart);
            setHighlightRange({ 
              start: startDiff, 
              end: startDiff + deleteIndex 
            });
            editAnimationRef.current = requestAnimationFrame(() => {
              setTimeout(animateDelete, 12);
            });
          } else {
            // Phase 2: Now insert new content
            if (newPart.length > 0) {
              let insertIndex = 0;
              const animateInsert = () => {
                if (insertIndex <= newPart.length) {
                  const currentNewPart = newPart.slice(0, insertIndex);
                  setDisplayedContent(beforePart + currentNewPart + afterPart);
                  setHighlightRange({ 
                    start: startDiff, 
                    end: startDiff + insertIndex 
                  });
                  insertIndex += 2; // Insert 2 chars at a time
                  editAnimationRef.current = requestAnimationFrame(() => {
                    setTimeout(animateInsert, 10);
                  });
                } else {
                  finishAnimation();
                }
              };
              animateInsert();
            } else {
              finishAnimation();
            }
          }
        };
        
        animateDelete();
      } else {
        // Just inserting new content
        let insertIndex = 0;
        const animateInsert = () => {
          if (insertIndex <= newPart.length) {
            const currentNewPart = newPart.slice(0, insertIndex);
            setDisplayedContent(beforePart + currentNewPart + afterPart);
            setHighlightRange({ 
              start: startDiff, 
              end: startDiff + insertIndex 
            });
            insertIndex += 2;
            editAnimationRef.current = requestAnimationFrame(() => {
              setTimeout(animateInsert, 10);
            });
          } else {
            finishAnimation();
          }
        };
        animateInsert();
      }
      
      const finishAnimation = () => {
        setDisplayedContent(newContent);
        displayedIndexRef.current = newContent.length;
        
        // Keep highlight visible briefly then fade out
        setTimeout(() => {
          setHighlightRange(undefined);
          setEditingIndicator(null);
        }, 1000);
      };
    }

    previousContentRef.current = newContent;
  }, [htmlContent, isEditing, isGenerating]);

  // Typewriter effect for initial generation
  useEffect(() => {
    if (!isGenerating && !isEditing) {
      // When not generating/editing, show full content immediately
      setDisplayedContent(htmlContent);
      displayedIndexRef.current = htmlContent.length;
      return;
    }

    if (isGenerating) {
      // Typewriter animation during initial generation
      const targetLength = htmlContent.length;
      
      if (displayedIndexRef.current >= targetLength) return;

      const interval = setInterval(() => {
        const currentIndex = displayedIndexRef.current;
        const charsToAdd = Math.min(3, targetLength - currentIndex);
        
        if (charsToAdd > 0) {
          displayedIndexRef.current = currentIndex + charsToAdd;
          setDisplayedContent(htmlContent.slice(0, displayedIndexRef.current));
        }
        
        if (displayedIndexRef.current >= targetLength) {
          clearInterval(interval);
        }
      }, 10);

      return () => clearInterval(interval);
    }
  }, [htmlContent, isGenerating, isEditing]);

  // Handle tab switching: code during generation, then preview with loading
  useEffect(() => {
    if (isGenerating || isEditing) {
      setActiveTab('code');
      wasGeneratingRef.current = true;
    } else if (wasGeneratingRef.current && htmlContent) {
      // Generation/editing just finished - switch to preview with loading
      wasGeneratingRef.current = false;
      setShowPreviewLoading(true);
      setActiveTab('preview');
      
      // Show loading for a brief moment then reveal
      setTimeout(() => {
        setShowPreviewLoading(false);
      }, 800);
    }
  }, [isGenerating, isEditing, htmlContent]);

  // Auto-scroll during generation
  useEffect(() => {
    if (isGenerating && preRef.current && !isEditing) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [displayedContent, isGenerating, isEditing]);

  const handleCopy = () => {
    navigator.clipboard.writeText(htmlContent);
    setCopied(true);
    toast.success("HTML copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const getSanitizedHtml = (applyFormatting = false) => {
    let content = htmlContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');
    
    // Apply text formatting if requested (for text-only mode)
    if (applyFormatting) {
      content = formatTextContent(content);
    }
    
    return content;
  };

  if (!isOpen) return null;

  // Render Dispatch Leads mode (spreadsheet-style list)
  if (mode === 'dispatch_leads' && dispatchJobId) {
    const progress = dispatchJob && dispatchJob.valid_leads > 0 
      ? Math.round(((dispatchJob.sent_count + dispatchJob.failed_count) / dispatchJob.valid_leads) * 100) 
      : 0;

    const isRunning = dispatchJob?.status === 'running';
    const isPaused = dispatchJob?.status === 'paused';
    const isCompleted = dispatchJob?.status === 'completed';

    return (
      <div className="w-[640px] h-full flex-shrink-0 bg-card flex flex-col mt-2 mb-2 mr-2 rounded-2xl overflow-hidden" style={{ border: '1px solid #00000010' }}>
        {/* Header with progress bar */}
        <div className="border-b border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <span className="font-medium">Disparo de Emails</span>
            </div>
            <div className="flex items-center gap-3">
              {isCompleted && (
                <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                  <Check className="w-4 h-4" />
                  <span>Concluído</span>
                </div>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors group"
                  title="Fechar painel"
                >
                  <ChevronsRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{dispatchJob?.sent_count || 0} de {dispatchJob?.valid_leads || 0} enviados</span>
              <span className="font-semibold text-foreground">{progress}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "h-full rounded-full",
                  isCompleted ? "bg-green-500" : "bg-primary"
                )}
              />
            </div>
          </div>

          {/* Controls */}
          {dispatchJob && (isRunning || isPaused) && (
            <div className="flex items-center gap-2">
              {isRunning ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDispatchCommand?.(`PAUSE_DISPATCH:${dispatchJob.id}`)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Pause className="w-3 h-3" />
                  Pausar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDispatchCommand?.(`RESUME_DISPATCH:${dispatchJob.id}`)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Play className="w-3 h-3" />
                  Retomar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDispatchCommand?.(`CANCEL_DISPATCH:${dispatchJob.id}`)}
                className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
              >
                <X className="w-3 h-3" />
                Cancelar
              </Button>
            </div>
          )}
        </div>

        {/* Leads table */}
        <ScrollArea className="flex-1">
          {dispatchLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Header */}
              <div className="grid grid-cols-[40px_1fr_1.5fr] gap-3 px-5 py-2.5 bg-muted/50 text-xs font-medium text-muted-foreground sticky top-0">
                <div></div>
                <div>Nome</div>
                <div>Email</div>
              </div>

              {/* Rows */}
              {dispatchLeads.map((lead) => {
                // Check if sent by lead_id (CRM) or email (CSV)
                const isSent = sentLeadIds.has(lead.id) || sentEmails.has(lead.email);
                const isCurrentlySending = isRunning && dispatchJob?.current_lead_name?.includes(lead.name);
                
                return (
                  <motion.div
                    key={lead.id}
                    initial={false}
                    animate={{ 
                      backgroundColor: isSent ? 'hsl(var(--muted) / 0.3)' : 'transparent'
                    }}
                    className={cn(
                      "grid grid-cols-[40px_1fr_1.5fr] gap-3 px-5 py-3 items-center text-sm",
                      isCurrentlySending && "bg-primary/5"
                    )}
                  >
                    {/* Checkbox */}
                    <div className="flex items-center justify-center">
                      <motion.div
                        initial={false}
                        animate={{ 
                          scale: isSent ? 1 : 0.8,
                          opacity: isSent ? 1 : 0.3
                        }}
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center",
                          isSent 
                            ? "bg-green-500 border-green-500" 
                            : isCurrentlySending 
                              ? "border-primary animate-pulse" 
                              : "border-muted-foreground/30"
                        )}
                      >
                        {isSent && <Check className="w-3 h-3 text-white" />}
                        {isCurrentlySending && !isSent && (
                          <Loader2 className="w-3 h-3 text-primary animate-spin" />
                        )}
                      </motion.div>
                    </div>

                    {/* Name */}
                    <div className={cn(
                      "truncate font-medium",
                      isSent ? "text-muted-foreground" : "text-foreground"
                    )}>
                      {lead.name}
                    </div>

                    {/* Email */}
                    <div className={cn(
                      "truncate text-xs font-mono",
                      isSent ? "text-muted-foreground" : "text-muted-foreground"
                    )}>
                      {lead.email}
                    </div>
                  </motion.div>
                );
              })}

              {dispatchLeads.length === 0 && !dispatchLoading && (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Nenhum lead encontrado
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  // Render Dispatch Details mode
  if (mode === 'dispatch_details' && dispatchData) {
    return (
      <div className="w-[640px] h-full flex-shrink-0 bg-card flex flex-col mt-2 mb-2 mr-2 rounded-2xl overflow-hidden" style={{ border: '1px solid #00000010' }}>
        <DispatchAnalysis
          data={dispatchData}
          onNewDispatch={onNewDispatch}
          onViewEmail={onViewEmail}
        />
      </div>
    );
  }

  return (
    <div className="w-[640px] h-full flex-shrink-0 bg-card flex flex-col mt-2 mb-2 mr-2 rounded-2xl overflow-hidden" style={{ border: '1px solid #00000010' }}>
      {/* Tabs - always at the top when showCodePreview is true */}
      {showCodePreview && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            {/* Close button - circle with >> icon */}
            {onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors group"
                title="Fechar painel"
              >
                <ChevronsRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            )}
            
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
              <button
                onClick={() => setActiveTab('preview')}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  activeTab === 'preview'
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  activeTab === 'code'
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                <Code2 className="w-4 h-4" />
                Código
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!htmlContent}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}
      
      {/* Email Subject/Preheader Header */}
      {showCodePreview && (
        <div className="px-5 py-4 border-b border-border bg-card">
          <div className="space-y-3">
            {/* Subject - editable */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Assunto</label>
              <input
                type="text"
                value={subject || ''}
                onChange={(e) => onSubjectChange?.(e.target.value)}
                placeholder={isGenerating ? "Gerando assunto..." : "Assunto do email..."}
                className={cn(
                  "w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none border-b border-border/50 pb-2",
                  isGenerating && "animate-pulse"
                )}
              />
            </div>
            {/* Preheader - editable */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Preheader</label>
              <input
                type="text"
                value={preheader || ''}
                onChange={(e) => onPreheaderChange?.(e.target.value)}
                placeholder="Texto de preview na caixa de entrada..."
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                maxLength={150}
              />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {showCodePreview ? (
          // Code/Preview mode with tabs
          activeTab === 'code' ? (
            <div className="relative h-full w-full overflow-hidden">
              {/* Editing indicator overlay */}
              {editingIndicator && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-primary/90 text-primary-foreground px-4 py-2 rounded-full shadow-lg animate-fade-in">
                  <div className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />
                  <span className="text-xs font-medium">
                    Linha {editingIndicator.line}: {editingIndicator.action}
                  </span>
                </div>
              )}

              {/* Highlighted code display */}
              <pre
                ref={preRef}
                className="absolute inset-0 p-5 font-mono text-xs leading-relaxed pointer-events-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-all [word-break:break-all] [overflow-wrap:anywhere]"
                aria-hidden="true"
              >
                {displayedContent ? (
                  <>
                    {highlightHtml(displayedContent, highlightRange)}
                    {(isGenerating || isEditing) && (
                      <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    {isGenerating ? "Gerando HTML..." : "O HTML do email aparecerá aqui..."}
                  </span>
                )}
              </pre>
              
              {/* Actual textarea */}
              <textarea
                ref={textareaRef}
                value={htmlContent}
                onChange={(e) => onHtmlChange(e.target.value)}
                onScroll={handleScroll}
                className="absolute inset-0 w-full h-full p-5 font-mono text-xs leading-relaxed bg-transparent text-transparent caret-foreground resize-none focus:outline-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-all [word-break:break-all] [overflow-wrap:anywhere]"
                spellCheck={false}
                placeholder=""
              />
              
            </div>
          ) : (
            <div className="h-full overflow-auto bg-card">
              {showPreviewLoading ? (
                // Skeleton loading state
                <div className="p-6 space-y-4 animate-pulse">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 text-muted-foreground text-sm">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      Carregando preview...
                    </div>
                  </div>
                  {/* Header skeleton */}
                  <div className="h-8 bg-muted rounded-md w-3/4 mx-auto" />
                  <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
                  {/* Body skeleton */}
                  <div className="space-y-3 mt-8">
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-5/6" />
                    <div className="h-4 bg-muted rounded w-4/5" />
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </div>
                  {/* Button skeleton */}
                  <div className="flex justify-center mt-8">
                    <div className="h-12 bg-muted rounded-lg w-48" />
                  </div>
                  {/* Footer skeleton */}
                  <div className="mt-8 pt-4 border-t border-muted">
                    <div className="h-3 bg-muted rounded w-1/3 mx-auto" />
                  </div>
                </div>
              ) : htmlContent ? (
                <div
                  ref={previewRef}
                  className="p-6 min-h-full focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-inset cursor-text break-all [word-break:break-all] [overflow-wrap:anywhere]"
                  contentEditable={!isGenerating && !isEditing}
                  suppressContentEditableWarning
                  onBlur={handlePreviewBlur}
                  dangerouslySetInnerHTML={{ __html: getSanitizedHtml() }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  {isGenerating ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      <span>Gerando preview...</span>
                    </div>
                  ) : (
                    "O preview do email aparecerá aqui"
                  )}
                </div>
              )}
            </div>
          )
        ) : (
          // Text-only mode (for copy/content without code preview)
          <div className="h-full overflow-auto bg-card">
            {htmlContent ? (
              <div
                ref={previewRef}
                className="p-6 min-h-full focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-inset break-words [overflow-wrap:anywhere] text-sm text-foreground leading-relaxed"
                contentEditable={!isGenerating && !isEditing}
                suppressContentEditableWarning
                onBlur={handlePreviewBlur}
                dangerouslySetInnerHTML={{ __html: getSanitizedHtml(true) }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <span>Gerando conteúdo...</span>
                  </div>
                ) : (
                  "O conteúdo aparecerá aqui"
                )}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
