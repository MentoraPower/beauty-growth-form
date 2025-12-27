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
  Tooltip, 
  Funnel,
  FunnelChart,
  LabelList
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
      case "conversion_rate": {
        return pipelines.map((pipeline, index) => ({
          name: pipeline.nome,
          value: leads.filter((l) => l.pipeline_id === pipeline.id).length,
          fill: MODERN_COLORS[index % MODERN_COLORS.length].solid,
        }));
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
                  innerRadius={isLarge ? 45 : 30}
                  outerRadius={isLarge ? 70 : 48}
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
                <p className="text-xl font-bold text-foreground">{total}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Total</p>
              </div>
            </div>
          </div>
          
          {/* Legend sidebar */}
          {isLarge && (
            <div className="w-[120px] flex flex-col justify-center gap-1.5 pl-2">
              {pieData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ background: `linear-gradient(135deg, ${MODERN_COLORS[index % MODERN_COLORS.length].gradient[0]}, ${MODERN_COLORS[index % MODERN_COLORS.length].gradient[1]})` }}
                  />
                  <span className="text-[10px] text-muted-foreground truncate flex-1">{entry.name}</span>
                  <span className="text-[10px] font-semibold text-foreground">{entry.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case "area": {
      const areaData = chartData as Array<{ date: string; count: number }>;
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
      const maxCount = Math.max(...barData.map(d => d.count), 1);
      const barCount = barData.length || 1;
      
      return (
        <TooltipProvider delayDuration={100}>
          <div className="h-full flex flex-col justify-between py-1">
            {barData.map((item, index) => {
              const percentage = (item.count / maxCount) * 100;
              return (
                <div key={index} className="flex items-center gap-2 flex-1 min-h-0">
                  {/* Info icon with tooltip */}
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 cursor-help hover:bg-muted-foreground/20 transition-colors">
                        <Info className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[200px]">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.count} leads</p>
                    </TooltipContent>
                  </UITooltip>
                  
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
                  
                  {/* Info icon right side */}
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 cursor-help hover:bg-muted-foreground/20 transition-colors">
                        <Info className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[200px]">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.count} leads • {Math.round(percentage)}% do total</p>
                    </TooltipContent>
                  </UITooltip>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      );
    }

    case "number": {
      const numberData = chartData as { total: number };
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <div className="relative">
            <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-primary/20 to-primary/10 rounded-full" />
            <div className="relative flex items-center gap-2">
              <Users className="h-8 w-8 text-primary/60" />
              <span className="text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {numberData.total.toLocaleString()}
              </span>
            </div>
          </div>
          {previousPeriodChange && (
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
              previousPeriodChange.direction === "up" 
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            )}>
              {previousPeriodChange.direction === "up" ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>{previousPeriodChange.change}% vs período anterior</span>
            </div>
          )}
        </div>
      );
    }

    case "list": {
      const listData = chartData as Lead[];
      return (
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-2 pr-3">
            {listData.map((lead, index) => (
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
                  {lead.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-xs font-medium text-foreground/80">
                    {format(new Date(lead.created_at), "dd MMM", { locale: ptBR })}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(lead.created_at), "HH:mm")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      );
    }

    case "funnel": {
      const funnelData = chartData as Array<{ name: string; value: number; fill: string }>;
      if (!Array.isArray(funnelData) || funnelData.length === 0) {
        return renderEmptyState();
      }
      
      // Add gradient colors
      const enhancedFunnelData = funnelData.map((item, index) => ({
        ...item,
        fill: MODERN_COLORS[index % MODERN_COLORS.length].solid,
      }));
      
      return (
        <ResponsiveContainer width="100%" height="100%">
          <FunnelChart margin={{ top: 10, right: 80, left: 10, bottom: 10 }}>
            <defs>
              {enhancedFunnelData.map((entry, index) => (
                <linearGradient key={`funnelGradient-${index}`} id={`funnelGradient-${cardId}-${index}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={MODERN_COLORS[index % MODERN_COLORS.length].gradient[1]} />
                  <stop offset="100%" stopColor={MODERN_COLORS[index % MODERN_COLORS.length].gradient[0]} />
                </linearGradient>
              ))}
            </defs>
            <Tooltip content={<CustomTooltip />} />
            <Funnel
              data={enhancedFunnelData.map((item, index) => ({
                ...item,
                fill: `url(#funnelGradient-${cardId}-${index})`,
              }))}
              dataKey="value"
              nameKey="name"
              isAnimationActive
              animationBegin={0}
              animationDuration={800}
            >
              <LabelList 
                position="right" 
                fill="hsl(var(--foreground))" 
                stroke="none" 
                dataKey="name" 
                fontSize={11}
                fontWeight={500}
              />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
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
