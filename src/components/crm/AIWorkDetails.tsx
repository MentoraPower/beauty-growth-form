import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, ChevronDown, Loader2, FileText, Zap, Send, Search, Sparkles } from "lucide-react";

export interface WorkSubItem {
  id: string;
  label: string;
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

function StepIcon({ status, icon }: { status: WorkStep['status']; icon?: WorkStep['icon'] }) {
  if (status === 'completed') {
    return (
      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
        <Check className="w-3 h-3 text-white" strokeWidth={3} />
      </div>
    );
  }
  
  if (status === 'in_progress') {
    return (
      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
        <Loader2 className="w-3 h-3 text-primary animate-spin" />
      </div>
    );
  }
  
  // Pending
  const IconComponent = icon ? iconMap[icon] : null;
  return (
    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center flex-shrink-0">
      {IconComponent && <IconComponent className="w-2.5 h-2.5 text-muted-foreground/50" />}
    </div>
  );
}

function SubItemIcon({ status }: { status: WorkSubItem['status'] }) {
  if (status === 'done') {
    return (
      <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
        <Check className="w-2 h-2 text-emerald-600" strokeWidth={3} />
      </div>
    );
  }
  
  if (status === 'in_progress') {
    return (
      <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
        <Loader2 className="w-2.5 h-2.5 text-primary animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/20 flex-shrink-0" />
  );
}

export function AIWorkDetails({ steps, className }: AIWorkDetailsProps) {
  const [openSteps, setOpenSteps] = useState<Set<string>>(() => {
    // Auto-open in_progress or first completed step
    const autoOpen = new Set<string>();
    const inProgressStep = steps.find(s => s.status === 'in_progress');
    if (inProgressStep) {
      autoOpen.add(inProgressStep.id);
    }
    return autoOpen;
  });

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden",
        className
      )}
    >
      <div className="divide-y divide-border/30">
        {steps.map((step, index) => {
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
                    "w-full px-4 py-3 flex items-center gap-3 text-left transition-colors",
                    hasContent && "hover:bg-muted/30 cursor-pointer",
                    !hasContent && "cursor-default"
                  )}
                >
                  <StepIcon status={step.status} icon={step.icon} />
                  
                  <span className={cn(
                    "flex-1 text-sm font-medium",
                    step.status === 'completed' && "text-foreground",
                    step.status === 'in_progress' && "text-foreground",
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
                      <div className="px-4 pb-3 pl-12 space-y-2">
                        {/* Sub-items */}
                        {step.subItems && step.subItems.length > 0 && (
                          <div className="space-y-1.5">
                            {step.subItems.map(item => (
                              <div key={item.id} className="flex items-center gap-2">
                                <SubItemIcon status={item.status} />
                                <span className={cn(
                                  "text-xs",
                                  item.status === 'done' && "text-muted-foreground",
                                  item.status === 'in_progress' && "text-foreground",
                                  item.status === 'pending' && "text-muted-foreground/60"
                                )}>
                                  {item.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Summary text */}
                        {step.summary && (
                          <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border/30">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {step.summary}
                            </p>
                          </div>
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
  }
): WorkStep {
  const subItems: WorkSubItem[] = [];
  
  if (options?.listName) {
    subItems.push({
      id: 'load',
      label: `Carregando lista ${options.listName}...`,
      status: status === 'pending' ? 'pending' : 'done'
    });
  }
  
  if (options?.validCount !== undefined) {
    subItems.push({
      id: 'identify',
      label: `Identificando ${options.validCount} leads válidos`,
      status: status === 'completed' ? 'done' : status === 'in_progress' ? 'in_progress' : 'pending'
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
  }
): WorkStep {
  return {
    id: 'email_generation',
    title: 'Geração do email HTML',
    status,
    icon: 'sparkles',
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
