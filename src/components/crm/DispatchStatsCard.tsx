import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
  Mail, 
  MousePointerClick, 
  Eye,
  TrendingUp,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export interface DispatchStats {
  jobId: string;
  totalSent: number;
  totalFailed: number;
  opens: number;
  clicks: number;
  lastUpdated: Date;
}

interface DispatchStatsCardProps {
  jobId: string;
  onOpenPanel?: () => void;
}

export function DispatchStatsCard({ jobId, onOpenPanel }: DispatchStatsCardProps) {
  const [stats, setStats] = useState<DispatchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    if (!jobId) return;

    try {
      // Fetch dispatch job data
      const { data: jobData } = await (supabase as any)
        .from('dispatch_jobs')
        .select('sent_count, failed_count')
        .eq('id', jobId)
        .single();

      // Fetch sent email IDs for this job
      const { data: sentEmails } = await (supabase as any)
        .from('sent_emails')
        .select('id')
        .eq('dispatch_job_id', jobId)
        .eq('status', 'sent');

      let opens = 0;
      let clicks = 0;

      if (sentEmails && sentEmails.length > 0) {
        const emailIds = sentEmails.map(e => e.id);
        
        // Fetch tracking events for these emails
        const { data: trackingEvents } = await (supabase as any)
          .from('email_tracking_events')
          .select('event_type')
          .in('sent_email_id', emailIds);

        if (trackingEvents) {
          opens = trackingEvents.filter(e => e.event_type === 'open').length;
          clicks = trackingEvents.filter(e => e.event_type === 'click').length;
        }
      }

      setStats({
        jobId,
        totalSent: jobData?.sent_count || 0,
        totalFailed: jobData?.failed_count || 0,
        opens,
        clicks,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error('Error fetching dispatch stats:', error);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Initial fetch and polling
  useEffect(() => {
    fetchStats();

    // Poll every 5 seconds for real-time updates
    pollRef.current = setInterval(fetchStats, 5000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [fetchStats]);

  if (loading || !stats) {
    return (
      <div className="w-full p-4 rounded-xl border border-border/40 bg-muted/20 animate-pulse">
        <div className="h-20" />
      </div>
    );
  }

  const openRate = stats.totalSent > 0 ? Math.round((stats.opens / stats.totalSent) * 100) : 0;
  const clickRate = stats.opens > 0 ? Math.round((stats.clicks / stats.opens) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full p-4 rounded-xl border border-border/40 bg-gradient-to-br from-card to-muted/30 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <Mail className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Estatísticas do Disparo</h3>
            <p className="text-xs text-muted-foreground">Atualizado em tempo real</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchStats}
          className="h-8 w-8 p-0"
          title="Atualizar"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatBox 
          icon={<Mail className="w-4 h-4" />}
          label="Enviados"
          value={stats.totalSent}
          color="blue"
        />
        <StatBox 
          icon={<Eye className="w-4 h-4" />}
          label="Aberturas"
          value={stats.opens}
          subValue={`${openRate}%`}
          color="green"
        />
        <StatBox 
          icon={<MousePointerClick className="w-4 h-4" />}
          label="Cliques"
          value={stats.clicks}
          subValue={stats.opens > 0 ? `${clickRate}% CTR` : '—'}
          color="purple"
        />
        <StatBox 
          icon={<TrendingUp className="w-4 h-4" />}
          label="Taxa de Abertura"
          value={`${openRate}%`}
          color="amber"
        />
      </div>

      {/* Action Button */}
      {onOpenPanel && (
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenPanel}
          className="w-full gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Ver detalhes completos
        </Button>
      )}
    </motion.div>
  );
}

interface StatBoxProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subValue?: string;
  color: 'blue' | 'green' | 'purple' | 'amber' | 'red';
}

function StatBox({ icon, label, value, subValue, color }: StatBoxProps) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    purple: 'bg-purple-500/10 text-purple-500',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500'
  };

  return (
    <div className="p-3 rounded-lg bg-muted/40 border border-border/20">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", colorClasses[color])}>
          {icon}
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold text-foreground">{value}</span>
        {subValue && <span className="text-xs text-muted-foreground">{subValue}</span>}
      </div>
    </div>
  );
}

export default DispatchStatsCard;
