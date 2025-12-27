import { useMemo } from "react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Users, BarChart3, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lead, Pipeline } from "@/types/crm";
import { DataSource, ChartType } from "./types";
import { ScrollArea } from "@/components/ui/scroll-area";

// Modern color palette with gradients
const MODERN_COLORS = [
  { solid: "#6366f1", gradient: ["#818cf8", "#4f46e5"] }, // Indigo
  { solid: "#8b5cf6", gradient: ["#a78bfa", "#7c3aed"] }, // Violet
  { solid: "#ec4899", gradient: ["#f472b6", "#db2777"] }, // Pink
  { solid: "#14b8a6", gradient: ["#2dd4bf", "#0d9488"] }, // Teal
  { solid: "#f59e0b", gradient: ["#fbbf24", "#d97706"] }, // Amber
  { solid: "#3b82f6", gradient: ["#60a5fa", "#2563eb"] }, // Blue
  { solid: "#10b981", gradient: ["#34d399", "#059669"] }, // Emerald
  { solid: "#f43f5e", gradient: ["#fb7185", "#e11d48"] }, // Rose
];

interface ChartRendererProps {
  cardId: string;
  dataSource: DataSource | undefined;
  chartType: ChartType;
  leads: Lead[];
  pipelines: Pipeline[];
  leadTags: Array<{ lead_id: string; name: string; color: string }>;
  height?: number;
  showEmptyState?: boolean;
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl px-4 py-3 shadow-xl">
        {label && <p className="text-xs text-muted-foreground mb-1">{label}</p>}
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-semibold text-foreground">
            {entry.name}: <span style={{ color: entry.color || entry.fill }}>{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function ChartRenderer({
  cardId,
  dataSource,
  chartType,
  leads,
  pipelines,
  leadTags,
  height = 280,
  showEmptyState = true,
}: ChartRendererProps) {
  // Calculate data based on dataSource
  const chartData = useMemo(() => {
    if (!dataSource) return null;
    
    switch (dataSource) {
      case "leads_by_pipeline": {
        return pipelines.map((pipeline, index) => ({
          name: pipeline.nome,
          value: leads.filter((l) => l.pipeline_id === pipeline.id).length,
          color: MODERN_COLORS[index % MODERN_COLORS.length].solid,
        }));
      }
      case "leads_by_mql": {
        const mql = leads.filter((l) => l.is_mql).length;
        const nonMql = leads.filter((l) => !l.is_mql).length;
        return [
          { name: "MQL", value: mql, color: MODERN_COLORS[0].solid },
          { name: "Não-MQL", value: nonMql, color: MODERN_COLORS[4].solid },
        ];
      }
      case "leads_over_time": {
        const last30Days = eachDayOfInterval({
          start: subDays(new Date(), 29),
          end: new Date(),
        });
        return last30Days.map((day) => {
          const dayStart = startOfDay(day);
          const count = leads.filter((l) => {
            const leadDate = startOfDay(new Date(l.created_at));
            return leadDate.getTime() === dayStart.getTime();
          }).length;
          return {
            date: format(day, "dd/MM", { locale: ptBR }),
            count,
          };
        });
      }
      case "total_leads": {
        return { total: leads.length };
      }
      case "recent_leads": {
        return leads
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 8);
      }
      case "leads_by_tag": {
        const tagCounts: Record<string, { name: string; count: number; color: string }> = {};
        leadTags.forEach((tag, index) => {
          if (!tagCounts[tag.name]) {
            tagCounts[tag.name] = { 
              name: tag.name, 
              count: 0, 
              color: tag.color || MODERN_COLORS[index % MODERN_COLORS.length].solid 
            };
          }
          tagCounts[tag.name].count++;
        });
        return Object.values(tagCounts).sort((a, b) => b.count - a.count).slice(0, 10);
      }
      default:
        return null;
    }
  }, [dataSource, leads, pipelines, leadTags]);

  // Get previous period for comparison (for number cards)
  const previousPeriodChange = useMemo(() => {
    if (dataSource !== "total_leads") return null;
    
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const sixtyDaysAgo = subDays(now, 60);
    
    const currentPeriod = leads.filter(l => new Date(l.created_at) >= thirtyDaysAgo).length;
    const previousPeriod = leads.filter(l => {
      const date = new Date(l.created_at);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    }).length;
    
    if (previousPeriod === 0) return { change: 100, direction: "up" as const };
    const change = ((currentPeriod - previousPeriod) / previousPeriod) * 100;
    return {
      change: Math.abs(Math.round(change)),
      direction: change >= 0 ? "up" as const : "down" as const,
    };
  }, [dataSource, leads]);

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">Sem dados</p>
        <p className="text-xs text-muted-foreground/60">Conecte uma fonte de dados</p>
      </div>
    </div>
  );

  if (!dataSource || !chartData) {
    if (showEmptyState) {
      return renderEmptyState();
    }
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Selecione uma fonte de dados
      </div>
    );
  }

  const isLarge = height >= 280;

  switch (chartType) {
    case "pie": {
      const pieData = chartData as Array<{ name: string; value: number; color: string }>;
      if (!Array.isArray(pieData) || pieData.length === 0 || pieData.every(d => d.value === 0)) {
        return renderEmptyState();
      }
      const total = pieData.reduce((acc, cur) => acc + cur.value, 0);
      
      // Dynamic radius based on height - scales proportionally
      const baseRadius = Math.min(height * 0.35, 120); // Max outer radius of 120px
      const outerRadius = Math.max(baseRadius, 40); // Min outer radius of 40px
      const innerRadius = outerRadius * 0.6; // Inner is 60% of outer for donut effect
      
      // Dynamic font sizes based on height
      const totalFontSize = Math.max(Math.min(height * 0.12, 36), 16);
      const labelFontSize = Math.max(Math.min(height * 0.04, 10), 8);
      
      return (
        <div className="relative w-full h-full flex">
          {/* Chart */}
          <div className="flex-1 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {pieData.map((entry, index) => (
                    <linearGradient key={`gradient-${index}`} id={`pieGradient-${cardId}-${index}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={MODERN_COLORS[index % MODERN_COLORS.length].gradient[0]} />
                      <stop offset="100%" stopColor={MODERN_COLORS[index % MODERN_COLORS.length].gradient[1]} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={innerRadius}
                  outerRadius={outerRadius}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                  animationBegin={0}
                  animationDuration={800}
                >
                  {pieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`url(#pieGradient-${cardId}-${index})`}
                      className="drop-shadow-sm"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center total */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="font-bold text-foreground" style={{ fontSize: totalFontSize }}>{total}</p>
                <p className="text-muted-foreground uppercase tracking-wide" style={{ fontSize: labelFontSize }}>Total</p>
              </div>
            </div>
          </div>
          
          {/* Legend sidebar */}
          {isLarge && (
            <div className="w-[130px] flex flex-col justify-center gap-2 pl-3">
              {pieData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full shrink-0" 
                    style={{ background: `linear-gradient(135deg, ${MODERN_COLORS[index % MODERN_COLORS.length].gradient[0]}, ${MODERN_COLORS[index % MODERN_COLORS.length].gradient[1]})` }}
                  />
                  <span className="text-xs text-muted-foreground truncate flex-1">{entry.name}</span>
                  <span className="text-xs font-semibold text-foreground">{entry.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case "area": {
      const areaData = chartData as Array<{ date: string; count: number }>;
      if (!Array.isArray(areaData) || areaData.length === 0) {
        return renderEmptyState();
      }
      const maxValue = Math.max(...areaData.map(d => d.count), 1);
      
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={areaData} margin={{ top: 20, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id={`areaGradient-${cardId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={MODERN_COLORS[0].solid} stopOpacity={0.4} />
                <stop offset="50%" stopColor={MODERN_COLORS[0].solid} stopOpacity={0.15} />
                <stop offset="100%" stopColor={MODERN_COLORS[0].solid} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`lineGradient-${cardId}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={MODERN_COLORS[0].gradient[0]} />
                <stop offset="100%" stopColor={MODERN_COLORS[0].gradient[1]} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              dy={10}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
              tickLine={false}
              axisLine={false}
              domain={[0, maxValue + Math.ceil(maxValue * 0.1)]}
              dx={-5}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              stroke={`url(#lineGradient-${cardId})`}
              fillOpacity={1}
              fill={`url(#areaGradient-${cardId})`}
              strokeWidth={2.5}
              animationBegin={0}
              animationDuration={1000}
              dot={false}
              activeDot={{ 
                r: 5, 
                fill: MODERN_COLORS[0].solid,
                stroke: 'white',
                strokeWidth: 2,
                className: 'drop-shadow-md'
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    case "bar": {
      const barData = chartData as Array<{ name: string; count: number; color: string }>;
      if (!Array.isArray(barData) || barData.length === 0) {
        return renderEmptyState();
      }
      const maxCount = Math.max(...barData.map(d => d.count), 1);
      
      return (
        <div className="h-full flex flex-col justify-between py-1">
          {barData.map((item, index) => {
            const percentage = (item.count / maxCount) * 100;
            return (
              <div key={index} className="flex items-center gap-2 flex-1 min-h-0">
                {/* Bar - height adapts to available space */}
                <div className="flex-1 bg-muted/50 rounded-xl overflow-hidden relative my-1" style={{ height: 'calc(100% - 8px)', minHeight: '32px' }}>
                  <div 
                    className="h-full rounded-xl transition-all duration-700 ease-out"
                    style={{ 
                      width: `${percentage}%`,
                      background: `linear-gradient(90deg, ${MODERN_COLORS[index % MODERN_COLORS.length].gradient[1]}, ${MODERN_COLORS[index % MODERN_COLORS.length].gradient[0]})`,
                    }}
                  />
                  {/* Label inside bar */}
                  <div className="absolute inset-0 flex items-center px-4">
                    <span className={cn(
                      "text-sm font-semibold truncate",
                      percentage > 30 ? "text-white" : "text-foreground"
                    )}>
                      {item.name}
                    </span>
                  </div>
                </div>
                
                {/* Count */}
                <span className="text-base font-bold text-foreground w-10 text-right shrink-0">
                  {item.count}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    case "number": {
      const numberData = chartData as { total: number } | null;
      if (!numberData || typeof numberData.total !== 'number') {
        return renderEmptyState();
      }
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <div className="relative">
            <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-primary/20 to-primary/10 rounded-full" />
            <div className="relative flex items-center gap-2">
              <span className="text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {numberData.total.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      );
    }

    case "list": {
      const listData = chartData as Lead[];
      if (!Array.isArray(listData) || listData.length === 0) {
        return renderEmptyState();
      }
      
      const formatDate = (dateStr: string) => {
        try {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return { date: '-', time: '-' };
          return {
            date: format(date, "dd MMM", { locale: ptBR }),
            time: format(date, "HH:mm")
          };
        } catch {
          return { date: '-', time: '-' };
        }
      };
      
      return (
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-2 pr-3">
            {listData.map((lead, index) => {
              const formattedDate = formatDate(lead.created_at);
              return (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-muted/50 to-transparent hover:from-muted hover:to-muted/50 transition-all duration-200 border border-transparent hover:border-border/50"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold text-white shadow-sm"
                    style={{ 
                      background: `linear-gradient(135deg, ${MODERN_COLORS[index % MODERN_COLORS.length].gradient[0]}, ${MODERN_COLORS[index % MODERN_COLORS.length].gradient[1]})` 
                    }}
                  >
                    {lead.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{lead.name || 'Sem nome'}</p>
                    <p className="text-xs text-muted-foreground truncate">{lead.email || '-'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs font-medium text-foreground/80">
                      {formattedDate.date}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formattedDate.time}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      );
    }

    default:
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Tipo de gráfico não suportado
        </div>
      );
  }
}
