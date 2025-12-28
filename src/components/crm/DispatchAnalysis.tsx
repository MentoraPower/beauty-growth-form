import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Mail, 
  Users, 
  TrendingUp,
  Calendar,
  FileText,
  AlertCircle
} from "lucide-react";

export interface DispatchData {
  id: string;
  type: string;
  originName: string | null;
  subOriginName: string | null;
  totalLeads: number;
  validLeads: number;
  sentCount: number;
  failedCount: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  subject?: string;
}

interface DispatchAnalysisProps {
  data: DispatchData;
  onNewDispatch?: () => void;
  onViewEmail?: () => void;
}

export function DispatchAnalysis({ data, onNewDispatch, onViewEmail }: DispatchAnalysisProps) {
  const successRate = data.validLeads > 0 
    ? Math.round((data.sentCount / data.validLeads) * 100) 
    : 0;
  
  const getDuration = () => {
    if (!data.startedAt || !data.completedAt) return null;
    const start = new Date(data.startedAt);
    const end = new Date(data.completedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    if (diffMins === 0) return `${diffSecs} segundos`;
    return `${diffMins} min ${diffSecs}s`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const duration = getDuration();
  const isSuccess = data.status === 'completed' && data.failedCount === 0;
  const hasFailures = data.failedCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            isSuccess ? "bg-green-500/20" : hasFailures ? "bg-yellow-500/20" : "bg-muted"
          )}>
            {isSuccess ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : hasFailures ? (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            ) : (
              <Mail className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {isSuccess ? "Disparo Concluído" : hasFailures ? "Disparo Concluído com Falhas" : "Detalhes do Disparo"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {data.completedAt ? formatDate(data.completedAt) : "Em andamento..."}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Mail className="w-4 h-4" />}
            label="Emails Enviados"
            value={data.sentCount.toString()}
            subValue={`de ${data.validLeads}`}
            variant="success"
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Taxa de Sucesso"
            value={`${successRate}%`}
            variant={successRate >= 90 ? "success" : successRate >= 70 ? "warning" : "error"}
          />
          {data.failedCount > 0 && (
            <StatCard
              icon={<XCircle className="w-4 h-4" />}
              label="Falhas"
              value={data.failedCount.toString()}
              variant="error"
            />
          )}
          {duration && (
            <StatCard
              icon={<Clock className="w-4 h-4" />}
              label="Duração Total"
              value={duration}
              variant="neutral"
            />
          )}
        </div>

        {/* Details Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Detalhes
          </h3>
          
          <div className="space-y-3 text-sm">
            <DetailRow
              icon={<Users className="w-4 h-4" />}
              label="Lista utilizada"
              value={`${data.originName || "—"} › ${data.subOriginName || "—"}`}
            />
            <DetailRow
              icon={<Mail className="w-4 h-4" />}
              label="Total de leads na lista"
              value={`${data.totalLeads} leads`}
            />
            <DetailRow
              icon={<CheckCircle className="w-4 h-4" />}
              label="Leads válidos para envio"
              value={`${data.validLeads} leads`}
            />
            {data.subject && (
              <DetailRow
                icon={<FileText className="w-4 h-4" />}
                label="Assunto do email"
                value={data.subject}
              />
            )}
            {data.startedAt && (
              <DetailRow
                icon={<Calendar className="w-4 h-4" />}
                label="Iniciado em"
                value={formatDate(data.startedAt)}
              />
            )}
          </div>
        </div>

        {/* Summary Paragraph */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
          <h4 className="text-sm font-semibold text-foreground mb-2">Resumo</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isSuccess ? (
              <>
                O disparo foi <strong className="text-foreground">concluído com sucesso</strong>. 
                {" "}Foram enviados <strong className="text-foreground">{data.sentCount} emails</strong> para 
                a lista <strong className="text-foreground">{data.subOriginName}</strong>
                {duration && <> em <strong className="text-foreground">{duration}</strong></>}.
                {" "}A taxa de entrega foi de <strong className="text-foreground">{successRate}%</strong>.
              </>
            ) : hasFailures ? (
              <>
                O disparo foi concluído, porém <strong className="text-yellow-600 dark:text-yellow-400">{data.failedCount} emails falharam</strong>.
                {" "}Foram enviados <strong className="text-foreground">{data.sentCount}</strong> de {data.validLeads} emails
                para a lista <strong className="text-foreground">{data.subOriginName}</strong>.
                {" "}Taxa de sucesso: <strong className="text-foreground">{successRate}%</strong>.
              </>
            ) : (
              <>
                O disparo está em andamento. Até o momento, foram enviados{" "}
                <strong className="text-foreground">{data.sentCount}</strong> de {data.validLeads} emails.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center gap-3">
        {onNewDispatch && (
          <button
            onClick={onNewDispatch}
            className="flex-1 px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            Novo Disparo
          </button>
        )}
        {onViewEmail && (
          <button
            onClick={onViewEmail}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Ver Email
          </button>
        )}
      </div>
    </motion.div>
  );
}

// Sub-components
function StatCard({ 
  icon, 
  label, 
  value, 
  subValue, 
  variant = "neutral" 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  subValue?: string;
  variant?: "success" | "warning" | "error" | "neutral";
}) {
  const variantStyles = {
    success: "bg-green-500/10 border-green-500/20",
    warning: "bg-yellow-500/10 border-yellow-500/20",
    error: "bg-red-500/10 border-red-500/20",
    neutral: "bg-muted/50 border-border/50"
  };

  const textStyles = {
    success: "text-green-600 dark:text-green-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    error: "text-red-600 dark:text-red-400",
    neutral: "text-foreground"
  };

  return (
    <div className={cn(
      "p-3 rounded-xl border",
      variantStyles[variant]
    )}>
      <div className="flex items-center gap-2 mb-1">
        <span className={cn("opacity-70", textStyles[variant])}>{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-lg font-semibold", textStyles[variant])}>{value}</span>
        {subValue && <span className="text-xs text-muted-foreground">{subValue}</span>}
      </div>
    </div>
  );
}

function DetailRow({ 
  icon, 
  label, 
  value 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-muted-foreground">{label}:</span>
        <span className="ml-2 text-foreground font-medium break-words">{value}</span>
      </div>
    </div>
  );
}
