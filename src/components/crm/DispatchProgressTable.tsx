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
      className="bg-card border border-border rounded-xl p-4 space-y-4 my-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-medium">{getTypeLabel()}</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground text-sm">
            {job.origin_name} / {job.sub_origin_name}
          </span>
        </div>
        <div className={cn("flex items-center gap-1.5", statusInfo.color)}>
          <StatusIcon className={cn("w-4 h-4", statusInfo.animate && "animate-spin")} />
          <span className="text-sm font-medium">{statusInfo.label}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
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
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {job.sent_count} de {job.valid_leads} enviados
            {job.failed_count > 0 && (
              <span className="text-red-500 ml-2">({job.failed_count} falhas)</span>
            )}
          </span>
          <span className="font-medium">{progress}%</span>
        </div>
      </div>

      {/* Current Lead & Time */}
      {job.status === 'running' && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {job.current_lead_name && (
              <>Enviando para: <span className="text-foreground">{job.current_lead_name}</span></>
            )}
          </span>
          <span>
            ⏱️ ~{estimatedMinutes} min restantes
          </span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2 py-2">
        <div className="text-center">
          <div className="text-2xl font-semibold text-foreground">{job.total_leads}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-semibold text-foreground">{job.valid_leads}</div>
          <div className="text-xs text-muted-foreground">Válidos</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-semibold text-green-500">{job.sent_count}</div>
          <div className="text-xs text-muted-foreground">Enviados</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-semibold text-red-500">{job.failed_count}</div>
          <div className="text-xs text-muted-foreground">Falhas</div>
        </div>
      </div>

      {/* Actions */}
      {(job.status === 'running' || job.status === 'paused') && (
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          {job.status === 'running' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCommand(`PAUSE_DISPATCH:${job.id}`)}
              className="flex-1"
            >
              <Pause className="w-4 h-4 mr-2" />
              Pausar
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCommand(`RESUME_DISPATCH:${job.id}`)}
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              Retomar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCommand(`CANCEL_DISPATCH:${job.id}`)}
            className="flex-1 text-red-500 hover:text-red-600 hover:border-red-300"
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        </div>
      )}

      {/* Completed/Cancelled message */}
      {job.status === 'completed' && (
        <div className="text-center text-sm text-green-600 pt-2 border-t border-border">
          ✅ Disparo concluído com sucesso!
        </div>
      )}
      {job.status === 'cancelled' && (
        <div className="text-center text-sm text-muted-foreground pt-2 border-t border-border">
          Disparo cancelado pelo usuário
        </div>
      )}
    </motion.div>
  );
}
