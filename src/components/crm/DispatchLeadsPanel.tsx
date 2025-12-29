import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Pause, Play, X, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useResilientChannel } from "@/hooks/useResilientChannel";

interface Lead {
  id: string;
  name: string;
  email: string;
  sent: boolean;
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

interface DispatchLeadsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
  onCommand: (command: string) => void;
}

export function DispatchLeadsPanel({ isOpen, onClose, jobId, onCommand }: DispatchLeadsPanelProps) {
  const [job, setJob] = useState<DispatchJob | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sentLeadIds, setSentLeadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Fetch job and leads data
  const fetchData = useCallback(async () => {
    if (!jobId) return;

    // Fetch job
    const { data: jobData } = await supabase
      .from('dispatch_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobData) {
      setJob(jobData as unknown as DispatchJob);

      // Fetch leads for this sub_origin
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, name, email')
        .eq('sub_origin_id', jobData.sub_origin_id)
        .not('email', 'is', null)
        .order('name');

      if (leadsData) {
        setLeads(leadsData.filter(l => l.email && l.email.includes('@')).map(l => ({
          id: l.id,
          name: l.name,
          email: l.email,
          sent: false
        })));
      }

      // Fetch sent emails for this job
      const { data: sentEmails } = await supabase
        .from('sent_emails')
        .select('lead_id')
        .eq('dispatch_job_id', jobId)
        .eq('status', 'sent');

      if (sentEmails) {
        setSentLeadIds(new Set(sentEmails.map(e => e.lead_id)));
      }
    }

    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    if (isOpen && jobId) {
      setLoading(true);
      fetchData();
    }
  }, [isOpen, jobId, fetchData]);

  // Real-time updates for the job
  useResilientChannel({
    channelName: `dispatch-panel-${jobId}`,
    table: 'dispatch_jobs',
    event: 'UPDATE',
    filter: `id=eq.${jobId}`,
    onPayload: (payload) => {
      setJob(payload.new as DispatchJob);
    },
    pollingFallback: {
      enabled: true,
      intervalMs: 2000,
      fetchFn: fetchData,
      shouldPoll: () => job?.status === 'running',
    },
  });

  // Real-time updates for sent emails
  useResilientChannel({
    channelName: `dispatch-emails-${jobId}`,
    table: 'sent_emails',
    event: 'INSERT',
    filter: `dispatch_job_id=eq.${jobId}`,
    onPayload: (payload) => {
      const newEmail = payload.new as { lead_id: string; status: string };
      if (newEmail.status === 'sent') {
        setSentLeadIds(prev => new Set([...prev, newEmail.lead_id]));
      }
    },
  });

  if (!isOpen) return null;

  const progress = job && job.valid_leads > 0 
    ? Math.round(((job.sent_count + job.failed_count) / job.valid_leads) * 100) 
    : 0;

  const isRunning = job?.status === 'running';
  const isPaused = job?.status === 'paused';
  const isCompleted = job?.status === 'completed';

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed right-0 top-0 h-full w-[420px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
    >
      {/* Header with progress bar */}
      <div className="border-b border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Disparo de Emails</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{job?.sent_count || 0} de {job?.valid_leads || 0} enviados</span>
            <span className="font-semibold text-foreground">{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
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
        {job && (isRunning || isPaused) && (
          <div className="flex items-center gap-2">
            {isRunning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCommand(`PAUSE_DISPATCH:${job.id}`)}
                className="h-8 text-xs gap-1.5"
              >
                <Pause className="w-3 h-3" />
                Pausar
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCommand(`RESUME_DISPATCH:${job.id}`)}
                className="h-8 text-xs gap-1.5"
              >
                <Play className="w-3 h-3" />
                Retomar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCommand(`CANCEL_DISPATCH:${job.id}`)}
              className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
            >
              <X className="w-3 h-3" />
              Cancelar
            </Button>
          </div>
        )}

        {isCompleted && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Check className="w-4 h-4" />
            <span>Disparo concluído</span>
          </div>
        )}
      </div>

      {/* Leads table */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Header */}
            <div className="grid grid-cols-[32px_1fr_1.2fr] gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground sticky top-0">
              <div></div>
              <div>Nome</div>
              <div>Email</div>
            </div>

            {/* Rows */}
            {leads.map((lead) => {
              const isSent = sentLeadIds.has(lead.id);
              const isCurrentlySending = isRunning && job?.current_lead_name?.includes(lead.name);
              
              return (
                <motion.div
                  key={lead.id}
                  initial={false}
                  animate={{ 
                    backgroundColor: isSent ? 'hsl(var(--muted) / 0.3)' : 'transparent'
                  }}
                  className={cn(
                    "grid grid-cols-[32px_1fr_1.2fr] gap-2 px-4 py-2.5 items-center text-sm",
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
                    "truncate text-xs",
                    isSent ? "text-muted-foreground" : "text-muted-foreground"
                  )}>
                    {lead.email}
                  </div>
                </motion.div>
              );
            })}

            {leads.length === 0 && !loading && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhum lead encontrado
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </motion.div>
  );
}
