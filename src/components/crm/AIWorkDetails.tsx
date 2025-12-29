import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, ChevronDown, Loader2, FileText, Send, Search, Sparkles, Edit3 } from "lucide-react";

export interface WorkSubItem {
  id: string;
  label: string;
  type?: 'file' | 'action' | 'text';
  status: 'pending' | 'in_progress' | 'done';
}

export interface WorkStep {
  id: string;
  title: string;
  description?: string; // English italic description
  status: 'pending' | 'in_progress' | 'completed';
  progress?: { current: number; total: number };
  subItems?: WorkSubItem[];
  summary?: string;
  icon?: 'file' | 'search' | 'sparkles' | 'send' | 'edit';
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
  edit: Edit3,
};

function StepStatusIcon({ status, wasCompleted }: { status: WorkStep['status']; wasCompleted?: boolean }) {
  if (status === 'completed') {
    return (
      <motion.div 
        initial={wasCompleted ? { scale: 1.3 } : { scale: 1 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        className="w-[18px] h-[18px] rounded-full bg-foreground/80 flex items-center justify-center flex-shrink-0 relative z-10"
      >
        <motion.div
          initial={wasCompleted ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: wasCompleted ? 0.1 : 0, duration: 0.2 }}
        >
          <Check className="w-2.5 h-2.5 text-background" strokeWidth={3} />
        </motion.div>
      </motion.div>
    );
  }
  
  if (status === 'in_progress') {
    return (
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-[18px] h-[18px] rounded-full border-2 border-foreground/40 bg-background flex items-center justify-center flex-shrink-0 relative z-10"
      >
        <Loader2 className="w-2.5 h-2.5 text-foreground/60 animate-spin" />
      </motion.div>
    );
  }
  
  // Pending - empty circle with border only
  return (
    <div className="w-[18px] h-[18px] rounded-full border-2 border-foreground/20 bg-background flex-shrink-0 relative z-10" />
  );
}

function FileReferenceItem({ label, status }: { label: string; status: WorkSubItem['status'] }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className={cn(
        "w-5 h-5 rounded flex items-center justify-center flex-shrink-0",
        "bg-muted"
      )}>
        <Edit3 className="w-3 h-3 text-muted-foreground" />
      </div>
      <span className="text-xs text-muted-foreground">
        {label}
      </span>
      {status === 'in_progress' && (
        <Loader2 className="w-3 h-3 text-muted-foreground animate-spin ml-auto" />
      )}
    </div>
  );
}

export function AIWorkDetails({ steps, className }: AIWorkDetailsProps) {
  // All steps start collapsed by default
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set());
  
  // Track previous statuses to detect transitions for animation
  const prevStatusesRef = useRef<Map<string, WorkStep['status']>>(new Map());
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set());
  
  // Detect status changes and animate completions
  useEffect(() => {
    const newlyCompleted = new Set<string>();
    
    steps.forEach(step => {
      const prevStatus = prevStatusesRef.current.get(step.id);
      // If step just became completed (from pending or in_progress)
      if (step.status === 'completed' && prevStatus && prevStatus !== 'completed') {
        newlyCompleted.add(step.id);
      }
      prevStatusesRef.current.set(step.id, step.status);
    });
    
    if (newlyCompleted.size > 0) {
      setJustCompleted(newlyCompleted);
      // Clear the animation flag after animation completes
      const timer = setTimeout(() => setJustCompleted(new Set()), 500);
      return () => clearTimeout(timer);
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
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-lg overflow-hidden bg-background",
        className
      )}
    >
      <div className="space-y-0 relative">
        <AnimatePresence initial={false}>
          {steps.map((step, index) => {
            const isOpen = openSteps.has(step.id);
            const hasContent = (step.subItems && step.subItems.length > 0) || step.summary;
            const isLast = index === steps.length - 1;
            const wasJustCompleted = justCompleted.has(step.id);
            
            return (
              <motion.div 
                key={step.id} 
                className="relative pb-1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: index * 0.08 }}
              >
                {/* Vertical dashed line connecting to next step */}
                {!isLast && (
                  <div 
                    className="absolute left-[8px] top-[26px] h-[calc(100%-18px)] w-0 border-l border-dashed border-foreground/20"
                  />
                )}
                
                <Collapsible
                  open={isOpen}
                  onOpenChange={() => hasContent && toggleStep(step.id)}
                >
                  <CollapsibleTrigger asChild disabled={!hasContent}>
                    <button
                      className={cn(
                        "w-full py-2 flex items-center gap-2.5 text-left transition-colors relative z-10",
                        hasContent && "hover:opacity-80 cursor-pointer",
                        !hasContent && "cursor-default"
                      )}
                    >
                      <StepStatusIcon status={step.status} wasCompleted={wasJustCompleted} />
                      
                      <div className="flex-1 min-w-0">
                        <motion.span 
                          className={cn(
                            "text-sm block",
                            step.status === 'completed' && "text-foreground font-medium",
                            step.status === 'in_progress' && "text-foreground font-medium",
                            step.status === 'pending' && "text-muted-foreground"
                          )}
                          animate={wasJustCompleted ? { scale: [1, 1.02, 1] } : {}}
                          transition={{ duration: 0.3 }}
                        >
                          {step.title}
                        </motion.span>
                        {step.description && (
                          <span className="text-xs text-muted-foreground/70 italic block mt-0.5">
                            {step.description}
                          </span>
                        )}
                      </div>
                      
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
              </motion.div>
            );
          })}
        </AnimatePresence>
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
    description?: string; // English italic description
    subItems?: WorkSubItem[];
    summary?: string;
    progress?: { current: number; total: number };
  }
): WorkStep {
  return {
    id,
    title,
    description: options?.description,
    status,
    icon: options?.icon || 'edit',
    subItems: options?.subItems,
    summary: options?.summary,
    progress: options?.progress
  };
}
