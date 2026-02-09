import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
  Mail, 
  MousePointerClick, 
  Eye,
  TrendingUp,
  RefreshCw,
  ChevronsRight,
  CheckCircle,
  Users,
  Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface DispatchStatsData {
  jobId: string;
  totalSent: number;
  totalFailed: number;
  totalLeads: number;
  opens: number;
  uniqueOpens: number;
  clicks: number;
  uniqueClicks: number;
  lastUpdated: Date;
  status: string;
  completedAt: string | null;
  originName: string | null;
  subOriginName: string | null;
}

interface DispatchStatsPanelProps {
  jobId: string;
  onClose?: () => void;
}

export function DispatchStatsPanel({ jobId, onClose }: DispatchStatsPanelProps) {
  const [stats, setStats] = useState<DispatchStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async (showRefresh = false) => {
    if (!jobId) return;
    if (showRefresh) setRefreshing(true);

    try {
      // Fetch dispatch job data
      const { data: jobData } = await (supabase as any)
        .from('dispatch_jobs')
        .select('sent_count, failed_count, valid_leads, status, completed_at, origin_name, sub_origin_name')
        .eq('id', jobId)
        .single();

      // Fetch sent email IDs for this job
      const { data: sentEmails } = await (supabase as any)
        .from('sent_emails')
        .select('id')
        .eq('dispatch_job_id', jobId)
        .eq('status', 'sent');

      let opens = 0;
      let uniqueOpens = 0;
      let clicks = 0;
      let uniqueClicks = 0;

      if (sentEmails && sentEmails.length > 0) {
        const emailIds = sentEmails.map(e => e.id);
        
        // Fetch tracking events for these emails
        const { data: trackingEvents } = await (supabase as any)
          .from('email_tracking_events')
          .select('event_type, sent_email_id')
          .in('sent_email_id', emailIds);

        if (trackingEvents) {
          const openEvents = trackingEvents.filter(e => e.event_type === 'open');
          const clickEvents = trackingEvents.filter(e => e.event_type === 'click');
          
          opens = openEvents.length;
          uniqueOpens = new Set(openEvents.map(e => e.sent_email_id)).size;
          clicks = clickEvents.length;
          uniqueClicks = new Set(clickEvents.map(e => e.sent_email_id)).size;
        }
      }

      setStats({
        jobId,
        totalSent: jobData?.sent_count || 0,
        totalFailed: jobData?.failed_count || 0,
        totalLeads: jobData?.valid_leads || 0,
        opens,
        uniqueOpens,
        clicks,
        uniqueClicks,
        lastUpdated: new Date(),
        status: jobData?.status || 'unknown',
        completedAt: jobData?.completed_at,
        originName: jobData?.origin_name,
        subOriginName: jobData?.sub_origin_name
      });
    } catch (error) {
      console.error('Error fetching dispatch stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [jobId]);

  // Initial fetch and polling
  useEffect(() => {
    fetchStats();

    // Poll every 5 seconds for real-time updates
    pollRef.current = setInterval(() => fetchStats(false), 5000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [fetchStats]);

  if (loading || !stats) {
    return (
      <div className="w-[580px] h-full flex-shrink-0 bg-card flex flex-col rounded-2xl overflow-hidden border border-border">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse space-y-4 w-full px-6">
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-24 bg-muted rounded" />
              <div className="h-24 bg-muted rounded" />
              <div className="h-24 bg-muted rounded" />
              <div className="h-24 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const openRate = stats.totalSent > 0 ? Math.round((stats.uniqueOpens / stats.totalSent) * 100) : 0;
  const clickRate = stats.uniqueOpens > 0 ? Math.round((stats.uniqueClicks / stats.uniqueOpens) * 100) : 0;
  const deliveryRate = stats.totalLeads > 0 ? Math.round((stats.totalSent / stats.totalLeads) * 100) : 0;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="w-[580px] h-full flex-shrink-0 bg-card flex flex-col rounded-2xl overflow-hidden border border-border">
      {/* Header */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full border border-border/30 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors group"
                title="Fechar painel"
              >
                <ChevronsRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Estatísticas do Disparo</h2>
                <p className="text-xs text-muted-foreground">Atualizado em tempo real</p>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="h-8 gap-1.5"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-6">
          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Mail className="w-5 h-5" />}
              label="Emails Enviados"
              value={stats.totalSent}
              subValue={`de ${stats.totalLeads}`}
              color="blue"
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Taxa de Entrega"
              value={`${deliveryRate}%`}
              color="green"
            />
            <StatCard
              icon={<Eye className="w-5 h-5" />}
              label="Aberturas"
              value={stats.uniqueOpens}
              subValue={`${openRate}% taxa`}
              secondaryValue={`${stats.opens} total`}
              color="purple"
            />
            <StatCard
              icon={<MousePointerClick className="w-5 h-5" />}
              label="Cliques"
              value={stats.uniqueClicks}
              subValue={stats.uniqueOpens > 0 ? `${clickRate}% CTR` : '—'}
              secondaryValue={`${stats.clicks} total`}
              color="amber"
            />
          </div>

          {/* Performance Overview */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Performance</h3>
            <div className="space-y-3">
              <ProgressBar 
                label="Taxa de Abertura" 
                value={openRate} 
                color="purple"
              />
              <ProgressBar 
                label="Taxa de Cliques (CTR)" 
                value={clickRate} 
                color="amber"
              />
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Detalhes</h3>
            <div className="bg-muted/40 rounded-lg p-4 space-y-3 text-sm">
              <DetailRow 
                icon={<Users className="w-4 h-4" />}
                label="Lista"
                value={`${stats.originName || '—'} › ${stats.subOriginName || '—'}`}
              />
              <DetailRow 
                icon={<Mail className="w-4 h-4" />}
                label="Total de Leads"
                value={stats.totalLeads.toString()}
              />
              {stats.totalFailed > 0 && (
                <DetailRow 
                  icon={<Mail className="w-4 h-4 text-red-500" />}
                  label="Falhas"
                  value={stats.totalFailed.toString()}
                  valueClassName="text-red-500"
                />
              )}
              <DetailRow 
                icon={<Clock className="w-4 h-4" />}
                label="Concluído em"
                value={formatDate(stats.completedAt)}
              />
            </div>
          </div>

          {/* Last Updated */}
          <p className="text-xs text-center text-muted-foreground">
            Última atualização: {stats.lastUpdated.toLocaleTimeString('pt-BR')}
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subValue?: string;
  secondaryValue?: string;
  color: 'blue' | 'green' | 'purple' | 'amber' | 'red';
}

function StatCard({ icon, label, value, subValue, secondaryValue, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    purple: 'bg-purple-500/10 text-purple-500',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-muted/40 border border-border/20"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", colorClasses[color])}>
          {icon}
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {subValue && <span className="text-xs text-muted-foreground">{subValue}</span>}
      </div>
      {secondaryValue && (
        <p className="text-xs text-muted-foreground mt-1">{secondaryValue}</p>
      )}
    </motion.div>
  );
}

interface ProgressBarProps {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'amber';
}

function ProgressBar({ label, value, color }: ProgressBarProps) {
  const bgClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500'
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(value, 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn("h-full rounded-full", bgClasses[color])}
        />
      </div>
    </div>
  );
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}

function DetailRow({ icon, label, value, valueClassName }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className={cn("font-medium text-foreground", valueClassName)}>{value}</span>
    </div>
  );
}

export default DispatchStatsPanel;
