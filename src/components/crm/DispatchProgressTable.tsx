import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, X, CheckCircle, AlertCircle, Loader2, Mail, User, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResilientChannel } from "@/hooks/useResilientChannel";

interface ErrorLogEntry {
  leadId: string;
  leadName: string;
  leadEmail: string;
  error: string;
  timestamp: string;
}

interface DispatchJob {
  id: string;
  type: string;
  origin_name: string | null;
  sub_origin_name: string | null;
  total_leads: number;
  valid_leads: number;
  sent_count: number;
  failed_count: number;
  status: string;
  interval_seconds: number;
  current_lead_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  error_log: ErrorLogEntry[] | null;
}

interface DispatchProgressTableProps {
  jobId: string;
  onCommand: (command: string) => void;
  onShowDetails?: (job: DispatchJob) => void;
  onError?: (error: { failedCount: number; lastError?: string; leadEmail?: string }) => void;
  onComplete?: (result: { sent: number; failed: number; errorLog?: ErrorLogEntry[] }) => void;
}

// Global set to track which jobs have already been notified as complete
// This persists across component remounts to prevent duplicate notifications
const notifiedCompletedJobs = new Set<string>();

export function DispatchProgressTable({ jobId, onCommand, onShowDetails, onError, onComplete }: DispatchProgressTableProps) {
  const [job, setJob] = useState<DispatchJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Track last notified values to avoid duplicate notifications
  const lastFailedCountRef = useRef(0);
  
  // Track if the job was already completed when we first loaded it
  // If so, we should NOT notify (user is just viewing history)
  const wasCompletedOnLoadRef = useRef<boolean | null>(null);

  // Fetch job data
  const fetchJob = useCallback(async () => {
    const { data, error } = await supabase
      .from('dispatch_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!error && data) {
      const jobData = data as unknown as DispatchJob;
      console.log('[DispatchProgress] Fetched job:', jobData.sent_count, '/', jobData.valid_leads, 'status:', jobData.status);
      setJob(jobData);
      setLastUpdate(new Date());
      if (loading) {
        lastFailedCountRef.current = jobData.failed_count;
        // Mark if job was already completed on initial load
        if (wasCompletedOnLoadRef.current === null) {
          const isAlreadyComplete = jobData.status === 'completed' || jobData.status === 'cancelled';
          wasCompletedOnLoadRef.current = isAlreadyComplete;
          // If already complete, add to notified set to prevent any future notifications
          if (isAlreadyComplete) {
            notifiedCompletedJobs.add(jobId);
          }
        }
      }
    }
    setLoading(false);
  }, [jobId, loading]);

  // Initial fetch - validate jobId first
  useEffect(() => {
    if (!jobId || jobId === 'null' || jobId === 'undefined') {
      console.warn('[DispatchProgress] Invalid jobId, skipping fetch');
      setLoading(false);
      return;
    }
    fetchJob();
  }, [fetchJob, jobId]);

  // Check if job is still active (for polling control)
  const isJobActive = useCallback(() => {
    return job && ['pending', 'running', 'paused'].includes(job.status);
  }, [job]);

  // Use resilient channel with polling fallback
  useResilientChannel({
    channelName: `dispatch-progress-${jobId}`,
    table: 'dispatch_jobs',
    event: 'UPDATE',
    filter: `id=eq.${jobId}`,
    onPayload: (payload) => {
      console.log('[DispatchProgress] Realtime update:', payload.new);
      setJob(payload.new as DispatchJob);
      setLastUpdate(new Date());
    },
    onStatusChange: (status) => {
      console.log('[DispatchProgress] Channel status:', status);
    },
    pollingFallback: {
      enabled: true,
      intervalMs: 3000, // Poll every 3 seconds
      fetchFn: fetchJob,
      shouldPoll: isJobActive,
    },
  });

  // Handle error and completion notifications
  useEffect(() => {
    if (!job) return;
    
    // Notify when there are NEW failures
    if (job.failed_count > lastFailedCountRef.current && onError) {
      const errorLog = job.error_log || [];
      const lastError = errorLog[errorLog.length - 1];
      onError({
        failedCount: job.failed_count,
        lastError: lastError?.error,
        leadEmail: lastError?.leadEmail
      });
      lastFailedCountRef.current = job.failed_count;
    }
    
    // Notify when job completes (only once - using global set to survive remounts)
    const isCompleted = job.status === 'completed' || job.status === 'cancelled';
    const alreadyNotified = notifiedCompletedJobs.has(jobId);
    
    if (isCompleted && !alreadyNotified && onComplete) {
      notifiedCompletedJobs.add(jobId);
      onComplete({
        sent: job.sent_count,
        failed: job.failed_count,
        errorLog: job.error_log || undefined
      });
    }
  }, [job, jobId, onError, onComplete]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Job não encontrado
      </div>
    );
  }

  const progress = job.valid_leads > 0 
    ? Math.round(((job.sent_count + job.failed_count) / job.valid_leads) * 100) 
    : 0;

  const remainingLeads = job.valid_leads - job.sent_count - job.failed_count;
  const estimatedSeconds = remainingLeads * job.interval_seconds;
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

  const getStatusInfo = () => {
    switch (job.status) {
      case 'running':
        return { icon: Loader2, color: 'text-blue-500', bgColor: 'bg-blue-500', label: 'Enviando...', animate: true };
      case 'paused':
        return { icon: Pause, color: 'text-yellow-500', bgColor: 'bg-yellow-500', label: 'Pausado', animate: false };
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-500', label: 'Concluído', animate: false };
      case 'failed':
        return { icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-500', label: 'Falhou', animate: false };
      case 'cancelled':
        return { icon: X, color: 'text-gray-500', bgColor: 'bg-gray-500', label: 'Cancelado', animate: false };
      default:
        return { icon: Loader2, color: 'text-muted-foreground', bgColor: 'bg-muted', label: 'Pendente', animate: false };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-4 bg-muted/30 border border-border rounded-xl p-4"
    >
      {/* Header with status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center",
            job.status === 'completed' ? "bg-green-500/20" : 
            job.status === 'running' ? "bg-blue-500/20" : "bg-muted"
          )}>
            <StatusIcon className={cn(
              "w-3.5 h-3.5",
              statusInfo.color,
              statusInfo.animate && "animate-spin"
            )} />
          </div>
          <span className="text-sm font-medium text-foreground">{statusInfo.label}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="w-3 h-3" />
          <span>{job.sent_count}/{job.valid_leads}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full transition-colors",
                job.status === 'completed' ? "bg-green-500" :
                job.status === 'failed' ? "bg-red-500" :
                job.status === 'paused' ? "bg-yellow-500" :
                "bg-primary"
              )}
            />
          </div>
          <span className="text-sm font-semibold text-foreground min-w-[45px] text-right">
            {progress}%
          </span>
        </div>
        
        {/* Current lead being processed */}
        <AnimatePresence mode="wait">
          {job.status === 'running' && job.current_lead_name && (
            <motion.div
              key={job.current_lead_name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <User className="w-3 h-3" />
              <span>Enviando para <span className="text-foreground font-medium">{job.current_lead_name}</span></span>
              <span className="animate-pulse">•</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Status details */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {job.status === 'completed' ? (
              <span className="text-green-600 dark:text-green-400 font-medium">✓ Todos os emails enviados</span>
            ) : job.status === 'running' && remainingLeads > 0 ? (
              <span>~{estimatedMinutes} min restantes</span>
            ) : job.status === 'paused' ? (
              <span className="text-yellow-600 dark:text-yellow-400">Disparo pausado</span>
            ) : null}
          </div>
          
          {job.failed_count > 0 && (
            <span className="text-red-500">
              {job.failed_count} falha{job.failed_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        {/* Results when completed */}
        {job.status === 'completed' && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between text-xs pt-2 border-t border-border mt-2"
          >
            <div className="flex items-center gap-4">
              <span className="text-green-600 dark:text-green-400">
                <span className="font-semibold">{job.sent_count}</span> enviados
              </span>
              {job.failed_count > 0 && (
                <span className="text-red-500">
                  <span className="font-semibold">{job.failed_count}</span> falhas
                </span>
              )}
            </div>
            {onShowDetails && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onShowDetails(job)}
                className="h-7 px-2 text-xs gap-1.5"
              >
                <BarChart3 className="w-3 h-3" />
                Ver detalhes
              </Button>
            )}
          </motion.div>
        )}
      </div>

      {/* Action buttons */}
      {(job.status === 'running' || job.status === 'paused') && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          {job.status === 'running' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCommand(`PAUSE_DISPATCH:${job.id}`)}
              className="h-7 px-2 text-xs"
            >
              <Pause className="w-3 h-3 mr-1" />
              Pausar
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCommand(`RESUME_DISPATCH:${job.id}`)}
              className="h-7 px-2 text-xs"
            >
              <Play className="w-3 h-3 mr-1" />
              Retomar
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCommand(`CANCEL_DISPATCH:${job.id}`)}
            className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
          >
            <X className="w-3 h-3 mr-1" />
            Cancelar
          </Button>
        </div>
      )}
    </motion.div>
  );
}
