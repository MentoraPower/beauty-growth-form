import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, ChevronDown, Loader2, FileText, Zap, Send, Search, Sparkles } from "lucide-react";

export interface WorkSubItem {
  id: string;
  label: string;
  type?: 'file' | 'action' | 'text'; // 'file' shows as file reference with icon box
  status: 'pending' | 'in_progress' | 'done';
}

export interface WorkStep {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  progress?: { current: number; total: number };
  subItems?: WorkSubItem[];
  summary?: string;
  icon?: 'file' | 'search' | 'sparkles' | 'send' | 'zap';
}

interface AIWorkDetailsProps {
  steps: WorkStep[];
  className?: string;
}

const iconMap = {
  file: FileText,
  search: Search,
  sparkles: Sparkles,
  send: Send,
  zap: Zap,
};

function StepStatusIcon({ status }: { status: WorkStep['status'] }) {
  if (status === 'completed') {
    return (
      <div className="w-[18px] h-[18px] rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
        <Check className="w-3 h-3 text-white" strokeWidth={3} />
      </div>
    );
  }
  
  if (status === 'in_progress') {
    return (
      <div className="w-[18px] h-[18px] rounded-full border-2 border-primary flex items-center justify-center flex-shrink-0">
        <Loader2 className="w-2.5 h-2.5 text-primary animate-spin" />
      </div>
    );
  }
  
  // Pending - empty circle
  return (
    <div className="w-[18px] h-[18px] rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
  );
}

function FileReferenceItem({ label, status }: { label: string; status: WorkSubItem['status'] }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className={cn(
        "w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors",
        status === 'done' && "bg-emerald-100 dark:bg-emerald-500/20",
        status === 'in_progress' && "bg-primary/10",
        status === 'pending' && "bg-muted"
      )}>
        <Zap className={cn(
          "w-3 h-3",
          status === 'done' && "text-emerald-600 dark:text-emerald-400",
          status === 'in_progress' && "text-primary",
          status === 'pending' && "text-muted-foreground/50"
        )} />
      </div>
      <span className={cn(
        "text-xs font-mono",
        status === 'done' && "text-foreground",
        status === 'in_progress' && "text-foreground",
        status === 'pending' && "text-muted-foreground/60"
      )}>
        {label}
      </span>
      {status === 'in_progress' && (
        <Loader2 className="w-3 h-3 text-primary animate-spin ml-auto" />
      )}
    </div>
  );
}

export function AIWorkDetails({ steps, className }: AIWorkDetailsProps) {
  const [openSteps, setOpenSteps] = useState<Set<string>>(() => {
    // Auto-open in_progress or first completed step with content
    const autoOpen = new Set<string>();
    const inProgressStep = steps.find(s => s.status === 'in_progress');
    if (inProgressStep) {
      autoOpen.add(inProgressStep.id);
    } else {
      // Auto-open first completed step that has content
      const firstWithContent = steps.find(s => s.status === 'completed' && ((s.subItems && s.subItems.length > 0) || s.summary));
      if (firstWithContent) {
        autoOpen.add(firstWithContent.id);
      }
    }
    return autoOpen;
  });

  // Auto-open steps when they become in_progress
  useEffect(() => {
    const inProgressStep = steps.find(s => s.status === 'in_progress');
    if (inProgressStep && !openSteps.has(inProgressStep.id)) {
      setOpenSteps(prev => new Set(prev).add(inProgressStep.id));
    }
  }, [steps]);

  const toggleStep = (stepId: string) => {
    setOpenSteps(prev => {
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg overflow-hidden bg-background",
        className
      )}
    >
      <div className="space-y-0">
        {steps.map((step) => {
          const isOpen = openSteps.has(step.id);
          const hasContent = (step.subItems && step.subItems.length > 0) || step.summary;
          
          return (
            <Collapsible
              key={step.id}
              open={isOpen}
              onOpenChange={() => hasContent && toggleStep(step.id)}
            >
              <CollapsibleTrigger asChild disabled={!hasContent}>
                <button
                  className={cn(
                    "w-full py-2 flex items-center gap-2.5 text-left transition-colors",
                    hasContent && "hover:opacity-80 cursor-pointer",
                    !hasContent && "cursor-default"
                  )}
                >
                  <StepStatusIcon status={step.status} />
                  
                  <span className={cn(
                    "flex-1 text-sm",
                    step.status === 'completed' && "text-foreground font-medium",
                    step.status === 'in_progress' && "text-foreground font-medium",
                    step.status === 'pending' && "text-muted-foreground"
                  )}>
                    {step.title}
                  </span>
                  
                  {step.progress && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {step.progress.current}/{step.progress.total}
                    </span>
                  )}
                  
                  {hasContent && (
                    <ChevronDown className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-180"
                    )} />
                  )}
                </button>
              </CollapsibleTrigger>
              
              <AnimatePresence>
                {hasContent && (
                  <CollapsibleContent forceMount>
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={isOpen ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pb-3 pl-7 space-y-1">
                        {/* Sub-items - file references with icon boxes */}
                        {step.subItems && step.subItems.length > 0 && (
                          <div className="space-y-0.5">
                            {step.subItems.map(item => {
                              if (item.type === 'file' || item.label.startsWith('Lendo ') || item.label.includes('arquivo')) {
                                return <FileReferenceItem key={item.id} label={item.label} status={item.status} />;
                              }
                              // Regular text item
                              return (
                                <div key={item.id} className="flex items-center gap-2 py-0.5">
                                  <span className={cn(
                                    "text-xs",
                                    item.status === 'done' && "text-muted-foreground",
                                    item.status === 'in_progress' && "text-foreground",
                                    item.status === 'pending' && "text-muted-foreground/60"
                                  )}>
                                    {item.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* Summary text */}
                        {step.summary && (
                          <p className="text-sm text-muted-foreground leading-relaxed pt-2">
                            {step.summary}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  </CollapsibleContent>
                )}
              </AnimatePresence>
            </Collapsible>
          );
        })}
      </div>
    </motion.div>
  );
}

// Helper to create work steps for common scenarios
export function createLeadsAnalysisStep(
  status: WorkStep['status'],
  options?: { 
    listName?: string; 
    validCount?: number; 
    totalCount?: number;
    summary?: string;
    files?: string[]; // List of files being read
  }
): WorkStep {
  const subItems: WorkSubItem[] = [];
  
  // Add file references
  if (options?.files && options.files.length > 0) {
    options.files.forEach((file, i) => {
      subItems.push({
        id: `file_${i}`,
        label: `Lendo arquivo ${file}`,
        type: 'file',
        status: status === 'pending' ? 'pending' : 'done'
      });
    });
  } else if (options?.listName) {
    subItems.push({
      id: 'load',
      label: `Lendo lista ${options.listName}`,
      type: 'file',
      status: status === 'pending' ? 'pending' : 'done'
    });
  }
  
  return {
    id: 'leads_analysis',
    title: 'Leitura e análise dos leads',
    status,
    icon: 'file',
    subItems: subItems.length > 0 ? subItems : undefined,
    summary: options?.summary
  };
}

export function createEmailGenerationStep(
  status: WorkStep['status'],
  options?: { 
    summary?: string;
    subItems?: WorkSubItem[];
  }
): WorkStep {
  return {
    id: 'email_generation',
    title: 'Geração do email HTML',
    status,
    icon: 'sparkles',
    subItems: options?.subItems,
    summary: options?.summary
  };
}

export function createDispatchStep(
  status: WorkStep['status'],
  options?: { 
    current?: number; 
    total?: number;
    summary?: string;
  }
): WorkStep {
  return {
    id: 'dispatch',
    title: 'Envio do disparo',
    status,
    icon: 'send',
    progress: options?.current !== undefined && options?.total !== undefined 
      ? { current: options.current, total: options.total }
      : undefined,
    summary: options?.summary
  };
}

// Create a step for analyzing context/transcriptions like in the image
export function createAnalysisStep(
  status: WorkStep['status'],
  options?: {
    title?: string;
    files?: { name: string; status: 'pending' | 'in_progress' | 'done' }[];
    summary?: string;
  }
): WorkStep {
  const subItems: WorkSubItem[] = [];
  
  if (options?.files) {
    options.files.forEach((file, i) => {
      subItems.push({
        id: `file_${i}`,
        label: `Lendo arquivo ${file.name}`,
        type: 'file',
        status: file.status
      });
    });
  }
  
  return {
    id: `analysis_${Date.now()}`,
    title: options?.title || 'Leitura e análise dos arquivos',
    status,
    icon: 'file',
    subItems: subItems.length > 0 ? subItems : undefined,
    summary: options?.summary
  };
}

// Create a generic step with custom title
export function createCustomStep(
  id: string,
  title: string,
  status: WorkStep['status'],
  options?: {
    icon?: WorkStep['icon'];
    subItems?: WorkSubItem[];
    summary?: string;
    progress?: { current: number; total: number };
  }
): WorkStep {
  return {
    id,
    title,
    status,
    icon: options?.icon || 'zap',
    subItems: options?.subItems,
    summary: options?.summary,
    progress: options?.progress
  };
}
