import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronUp, Loader2, FileText, Edit3, Eye, Plus, Terminal, RefreshCw, AlertCircle, CheckCircle2, Mail, User, Hash, Calendar, FileSpreadsheet, Sparkles, Search, Send, Database, Code, Image, Zap } from "lucide-react";

// Action types for sub-items
export type ActionType = 
  | 'creating_file' 
  | 'reading_file' 
  | 'editing_file' 
  | 'executing_command'
  | 'restarting_service'
  | 'analyzing'
  | 'generating'
  | 'sending'
  | 'searching'
  | 'processing'
  | 'validating'
  | 'custom';

// Sub-item for detailed actions
export interface ActionItem {
  id: string;
  type: ActionType;
  label: string;
  detail?: string; // File path, command, etc.
  status: 'pending' | 'in_progress' | 'done' | 'error';
}

// Main insight step
export interface InsightStep {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  timestamp?: string; // e.g., "domingo", "2min atrás"
  actions?: ActionItem[];
  isExpandable?: boolean;
}

interface DataIntelligenceProps {
  steps: InsightStep[];
  className?: string;
}

// Icon mapping for action types
const actionIcons: Record<ActionType, React.ElementType> = {
  creating_file: Plus,
  reading_file: Eye,
  editing_file: Edit3,
  executing_command: Terminal,
  restarting_service: RefreshCw,
  analyzing: Search,
  generating: Sparkles,
  sending: Send,
  searching: Search,
  processing: Zap,
  validating: CheckCircle2,
  custom: FileText,
};

// Label prefixes for action types
const actionLabels: Record<ActionType, string> = {
  creating_file: 'Criando arquivo',
  reading_file: 'Lendo arquivo',
  editing_file: 'Editando arquivo',
  executing_command: 'Executando comando',
  restarting_service: 'Restart development services',
  analyzing: 'Analisando',
  generating: 'Gerando',
  sending: 'Enviando',
  searching: 'Buscando',
  processing: 'Processando',
  validating: 'Validando',
  custom: '',
};

function StepIcon({ status }: { status: InsightStep['status'] }) {
  if (status === 'completed') {
    return (
      <motion.div 
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        className="w-5 h-5 rounded-full bg-foreground/80 flex items-center justify-center flex-shrink-0"
      >
        <Check className="w-3 h-3 text-background" strokeWidth={3} />
      </motion.div>
    );
  }
  
  if (status === 'in_progress') {
    return (
      <div className="w-5 h-5 rounded-full border-2 border-foreground/40 bg-background flex items-center justify-center flex-shrink-0">
        <Loader2 className="w-3 h-3 text-foreground/60 animate-spin" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="w-5 h-5 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center flex-shrink-0">
        <AlertCircle className="w-3 h-3 text-red-500" />
      </div>
    );
  }
  
  return <div className="w-5 h-5 rounded-full border-2 border-foreground/20 bg-background flex-shrink-0" />;
}

function ActionItemCard({ action }: { action: ActionItem }) {
  const Icon = actionIcons[action.type] || FileText;
  const labelPrefix = actionLabels[action.type];
  
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="w-5 h-5 rounded flex items-center justify-center bg-foreground/5 flex-shrink-0">
        <Icon className="w-3 h-3 text-muted-foreground" />
      </div>
      <span className="text-[13px] text-muted-foreground">
        {labelPrefix && `${labelPrefix} `}
      </span>
      {action.detail && (
        <span className="text-[13px] px-2 py-0.5 rounded-md bg-foreground/[0.07] text-foreground/70 font-mono">
          {action.detail}
        </span>
      )}
      {!action.detail && action.label && (
        <span className="text-[13px] px-2 py-0.5 rounded-md bg-foreground/[0.07] text-foreground/70 font-mono">
          {action.label}
        </span>
      )}
      {action.status === 'in_progress' && (
        <Loader2 className="w-3 h-3 text-muted-foreground animate-spin ml-auto" />
      )}
    </div>
  );
}

export function DataIntelligence({ steps, className }: DataIntelligenceProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(() => {
    // Auto-expand steps that have actions
    return new Set(steps.filter(s => s.actions && s.actions.length > 0).map(s => s.id));
  });

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  if (steps.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn("overflow-hidden", className)}
    >
      <div className="space-y-0 relative">
        <AnimatePresence initial={false}>
          {steps.map((step, index) => {
            const isExpanded = expandedSteps.has(step.id);
            const hasActions = step.actions && step.actions.length > 0;
            const isLast = index === steps.length - 1;
            const isExpandable = step.isExpandable !== false && hasActions;
            
            return (
              <motion.div 
                key={step.id} 
                className="relative"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.08 }}
              >
                {/* Vertical dashed line connecting to next step */}
                {!isLast && (
                  <div className="absolute left-[9px] top-[28px] h-[calc(100%-12px)] w-0 border-l border-dashed border-foreground/15" />
                )}
                
                {/* Step header - clickable if expandable */}
                <button
                  onClick={() => isExpandable && toggleStep(step.id)}
                  disabled={!isExpandable}
                  className={cn(
                    "w-full py-2 flex items-start gap-3 text-left transition-colors relative z-10",
                    isExpandable && "hover:opacity-80 cursor-pointer",
                    !isExpandable && "cursor-default"
                  )}
                >
                  <StepIcon status={step.status} />
                  
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[15px] font-medium",
                        step.status === 'completed' && "text-foreground",
                        step.status === 'in_progress' && "text-foreground",
                        step.status === 'pending' && "text-muted-foreground",
                        step.status === 'error' && "text-red-500"
                      )}>
                        {step.title}
                      </span>
                      {isExpandable && (
                        <ChevronDown className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform duration-200",
                          isExpanded && "rotate-180"
                        )} />
                      )}
                    </div>
                    {step.description && (
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {step.description}
                      </p>
                    )}
                  </div>
                  
                  {step.timestamp && (
                    <span className="text-xs text-muted-foreground/60 pt-1">
                      {step.timestamp}
                    </span>
                  )}
                </button>
                
                {/* Expandable actions */}
                <AnimatePresence>
                  {hasActions && isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pb-3 pl-8 space-y-1">
                        {step.actions!.map((action) => (
                          <ActionItemCard key={action.id} action={action} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ============================================
// HELPER FUNCTIONS TO CREATE INTELLIGENT STEPS
// ============================================

// Helper to create a step for CSV file analysis
export function createCsvAnalysisSteps(
  csvData: {
    fileName: string;
    headers: string[];
    rawData: Array<Record<string, string>>;
    mappedColumns: Record<string, string>;
  }
): InsightStep[] {
  const { fileName, headers, rawData, mappedColumns } = csvData;
  const totalRows = rawData.length;
  
  // Analyze email column
  const emailCol = mappedColumns.email;
  const validEmails = emailCol 
    ? rawData.filter(row => row[emailCol]?.includes('@')).length 
    : 0;
  
  const hasName = !!mappedColumns.name;
  const hasEmail = !!mappedColumns.email;
  
  return [
    {
      id: 'csv_read',
      title: 'Analisando lista de leads',
      description: `Arquivo "${fileName}" recebido com ${totalRows} registros e ${headers.length} colunas.`,
      status: 'completed',
      actions: [
        { id: 'read', type: 'reading_file', label: '', detail: fileName, status: 'done' },
        { id: 'parse', type: 'processing', label: 'Parsing CSV', detail: `${headers.length} colunas`, status: 'done' },
      ]
    },
    {
      id: 'csv_mapping',
      title: 'Mapeamento de colunas',
      description: hasName && hasEmail 
        ? `Identificadas colunas de nome (${mappedColumns.name}) e email (${mappedColumns.email}). ${validEmails} emails válidos.`
        : `Atenção: ${!hasName ? 'Coluna de nome não encontrada. ' : ''}${!hasEmail ? 'Coluna de email não encontrada.' : ''}`,
      status: 'completed',
      actions: headers.slice(0, 5).map((h, i) => ({
        id: `col_${i}`,
        type: 'analyzing' as ActionType,
        label: h,
        detail: h === mappedColumns.email ? '(email)' : h === mappedColumns.name ? '(nome)' : undefined,
        status: 'done' as const
      }))
    },
    {
      id: 'csv_ready',
      title: validEmails > 0 ? `${validEmails} leads prontos para disparo` : 'Lista precisa de ajustes',
      status: 'completed',
      isExpandable: false
    }
  ];
}

// Helper to create steps for email generation
export function createEmailGenerationSteps(options?: {
  subject?: string;
  isGenerating?: boolean;
  isComplete?: boolean;
}): InsightStep[] {
  const { subject, isGenerating, isComplete } = options || {};
  
  if (isComplete) {
    return [
      {
        id: 'email_analysis',
        title: 'Contexto analisado',
        status: 'completed',
        actions: [
          { id: 'a1', type: 'analyzing', label: 'Público-alvo', detail: 'identificado', status: 'done' },
          { id: 'a2', type: 'analyzing', label: 'Tom de voz', detail: 'definido', status: 'done' },
        ]
      },
      {
        id: 'email_gen',
        title: 'Email HTML gerado',
        description: subject ? `Assunto: "${subject}"` : undefined,
        status: 'completed',
        actions: [
          { id: 'g1', type: 'generating', label: 'Estrutura AIDA', detail: 'aplicada', status: 'done' },
          { id: 'g2', type: 'creating_file', label: '', detail: 'email.html', status: 'done' },
        ]
      },
      {
        id: 'email_ready',
        title: 'Pronto para revisão',
        status: 'completed',
        isExpandable: false
      }
    ];
  }
  
  if (isGenerating) {
    return [
      {
        id: 'email_analysis',
        title: 'Contexto analisado',
        status: 'completed',
      },
      {
        id: 'email_gen',
        title: 'Gerando email HTML...',
        status: 'in_progress',
        actions: [
          { id: 'g1', type: 'generating', label: 'Estrutura', detail: 'AIDA', status: 'in_progress' },
        ]
      },
      {
        id: 'email_ready',
        title: 'Pronto para revisão',
        status: 'pending',
        isExpandable: false
      }
    ];
  }
  
  return [
    {
      id: 'email_analysis',
      title: 'Analisando contexto...',
      status: 'in_progress',
    }
  ];
}

// Helper to create steps for dispatch/sending
export function createDispatchSteps(options?: {
  total?: number;
  sent?: number;
  isComplete?: boolean;
  isProcessing?: boolean;
}): InsightStep[] {
  const { total = 0, sent = 0, isComplete, isProcessing } = options || {};
  
  if (isComplete) {
    return [
      {
        id: 'dispatch_prep',
        title: 'Disparo preparado',
        status: 'completed',
      },
      {
        id: 'dispatch_send',
        title: `${sent} emails enviados com sucesso`,
        status: 'completed',
        actions: [
          { id: 's1', type: 'sending', label: 'Resend API', detail: 'conectado', status: 'done' },
          { id: 's2', type: 'validating', label: 'Taxa de entrega', detail: '100%', status: 'done' },
        ]
      }
    ];
  }
  
  if (isProcessing) {
    return [
      {
        id: 'dispatch_prep',
        title: 'Disparo iniciado',
        status: 'completed',
      },
      {
        id: 'dispatch_send',
        title: `Enviando emails (${sent}/${total})...`,
        status: 'in_progress',
        actions: [
          { id: 's1', type: 'sending', label: 'Em andamento...', detail: `${Math.round((sent/total)*100)}%`, status: 'in_progress' },
        ]
      }
    ];
  }
  
  return [
    {
      id: 'dispatch_prep',
      title: 'Preparando disparo...',
      status: 'in_progress',
    }
  ];
}

// Generic helper for custom intelligent steps
export function createIntelligentStep(
  id: string,
  title: string,
  status: InsightStep['status'],
  options?: {
    description?: string;
    timestamp?: string;
    actions?: ActionItem[];
    isExpandable?: boolean;
  }
): InsightStep {
  return {
    id,
    title,
    status,
    ...options
  };
}

// Helper to create file operation actions
export function createFileAction(
  type: 'creating_file' | 'reading_file' | 'editing_file',
  filePath: string,
  status: ActionItem['status'] = 'done'
): ActionItem {
  return {
    id: crypto.randomUUID(),
    type,
    label: '',
    detail: filePath,
    status
  };
}

// Helper to create command execution action
export function createCommandAction(
  command: string,
  status: ActionItem['status'] = 'done'
): ActionItem {
  return {
    id: crypto.randomUUID(),
    type: 'executing_command',
    label: '',
    detail: command,
    status
  };
}

// Helper to create restart service action
export function createRestartAction(
  serviceName: string,
  status: ActionItem['status'] = 'done'
): ActionItem {
  return {
    id: crypto.randomUUID(),
    type: 'restarting_service',
    label: serviceName,
    detail: undefined,
    status
  };
}

// ============================================
// COLUMN ANALYSIS TYPES (for detailed CSV view)
// ============================================

export interface ColumnAnalysis {
  name: string;
  type: 'email' | 'name' | 'phone' | 'number' | 'date' | 'text' | 'unknown';
  validCount: number;
  totalCount: number;
  sampleValues: string[];
  issues?: string[];
}

export interface DataStats {
  totalRows: number;
  validEmails: number;
  invalidEmails: number;
  duplicateEmails: number;
  missingNames: number;
  completenessScore: number;
}
