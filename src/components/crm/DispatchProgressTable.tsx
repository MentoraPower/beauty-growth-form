import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Pause, Play, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
}

interface DispatchProgressTableProps {
  jobId: string;
  onCommand: (command: string) => void;
}

export function DispatchProgressTable({ jobId, onCommand }: DispatchProgressTableProps) {
  const [job, setJob] = useState<DispatchJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    const fetchJob = async () => {
      const { data, error } = await supabase
        .from('dispatch_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (!error && data) {
        setJob(data as DispatchJob);
      }
      setLoading(false);
    };

    fetchJob();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`dispatch-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'dispatch_jobs',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          console.log('Dispatch job update:', payload.new);
          setJob(payload.new as DispatchJob);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

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
        return { icon: Loader2, color: 'text-blue-500', label: 'Enviando...', animate: true };
      case 'paused':
        return { icon: Pause, color: 'text-yellow-500', label: 'Pausado', animate: false };
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-500', label: 'Concluído', animate: false };
      case 'failed':
        return { icon: AlertCircle, color: 'text-red-500', label: 'Falhou', animate: false };
      case 'cancelled':
        return { icon: X, color: 'text-gray-500', label: 'Cancelado', animate: false };
      default:
        return { icon: Loader2, color: 'text-muted-foreground', label: 'Pendente', animate: false };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  const getTypeLabel = () => {
    switch (job.type) {
      case 'email': return '📧 Email';
      case 'whatsapp_web': return '📱 WhatsApp Web';
      case 'whatsapp_business': return '💼 WhatsApp Business';
      default: return job.type;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-4"
    >
      {/* Simple Progress Bar with percentage on the edge */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              className={cn(
                "h-full rounded-full",
                job.status === 'completed' ? "bg-green-500" :
                job.status === 'failed' ? "bg-red-500" :
                job.status === 'paused' ? "bg-yellow-500" :
                "bg-primary"
              )}
            />
          </div>
          <span className="text-sm font-medium text-foreground min-w-[40px] text-right">
            {progress}%
          </span>
        </div>
        
        {/* Minimal status text */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {job.status === 'completed' ? (
            <span>Enviado com sucesso</span>
          ) : job.status === 'running' && remainingLeads > 0 ? (
            <span>~{estimatedMinutes}min restantes</span>
          ) : job.status === 'paused' ? (
            <span>Pausado</span>
          ) : null}
        </div>
        
        {/* Results when completed */}
        {job.status === 'completed' && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
            <span><span className="font-semibold">Enviados:</span> {job.sent_count}</span>
            {job.failed_count > 0 && (
              <span><span className="font-semibold">Falhas:</span> {job.failed_count}</span>
            )}
          </div>
        )}
      </div>

      {/* Compact action buttons */}
      {(job.status === 'running' || job.status === 'paused') && (
        <div className="flex items-center gap-2 mt-2">
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
