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
  BarChart, 
  Bar,
  Funnel,
  FunnelChart,
  LabelList
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Folder, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Lead, Pipeline } from "@/types/crm";
import { DataSource, ChartType } from "./types";
import { ScrollArea } from "@/components/ui/scroll-area";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
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
        return pipelines.map((pipeline) => ({
          name: pipeline.nome,
          value: leads.filter((l) => l.pipeline_id === pipeline.id).length,
          color: pipeline.cor,
        }));
      }
      case "leads_by_mql": {
        const mql = leads.filter((l) => l.is_mql).length;
        const nonMql = leads.filter((l) => !l.is_mql).length;
        return [
          { name: "MQL", value: mql, color: "hsl(var(--primary))" },
          { name: "Não-MQL", value: nonMql, color: "hsl(var(--muted))" },
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
        leadTags.forEach((tag) => {
          if (!tagCounts[tag.name]) {
            tagCounts[tag.name] = { name: tag.name, count: 0, color: tag.color };
          }
          tagCounts[tag.name].count++;
        });
        return Object.values(tagCounts).sort((a, b) => b.count - a.count).slice(0, 10);
      }
      case "conversion_rate": {
        return pipelines.map((pipeline, index) => ({
          name: pipeline.nome,
          value: leads.filter((l) => l.pipeline_id === pipeline.id).length,
          fill: COLORS[index % COLORS.length],
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
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div className="w-16 h-12 bg-muted/60 rounded-lg flex items-center justify-center">
        <Folder className="h-8 w-8 text-muted-foreground/50" fill="currentColor" strokeWidth={1} />
      </div>
      <span className="text-muted-foreground text-sm">Conecte uma fonte de dados</span>
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
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={isLarge ? 50 : 30}
              outerRadius={isLarge ? 80 : 50}
              paddingAngle={2}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number, name: string) => [value, name]}
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    case "area": {
      const areaData = chartData as Array<{ date: string; count: number }>;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`colorCount-${cardId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }} 
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis 
              tick={{ fontSize: 10 }} 
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--primary))"
              fillOpacity={1}
              fill={`url(#colorCount-${cardId})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    case "bar": {
      const barData = chartData as Array<{ name: string; count: number; color: string }>;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {barData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }

    case "number": {
      const numberData = chartData as { total: number };
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <span className="text-4xl font-bold text-foreground">{numberData.total}</span>
          {previousPeriodChange && (
            <div className={cn(
              "flex items-center gap-1 mt-2 text-sm",
              previousPeriodChange.direction === "up" ? "text-green-600" : "text-red-600"
            )}>
              {previousPeriodChange.direction === "up" ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              <span>{previousPeriodChange.change}% vs últimos 30 dias</span>
            </div>
          )}
        </div>
      );
    }

    case "list": {
      const listData = chartData as Lead[];
      return (
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-2 pr-2">
            {listData.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                  {lead.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(lead.created_at), "dd/MM", { locale: ptBR })}
                </span>
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
      return (
        <ResponsiveContainer width="100%" height="100%">
          <FunnelChart>
            <Tooltip
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Funnel
              data={funnelData}
              dataKey="value"
              nameKey="name"
              isAnimationActive
            >
              <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="name" fontSize={11} />
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
