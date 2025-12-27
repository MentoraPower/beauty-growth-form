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
  RadialBarChart,
  RadialBar,
  LineChart,
  Line,
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Users, BarChart3, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lead, Pipeline } from "@/types/crm";
import { DataSource, ChartType } from "./types";
import { ScrollArea } from "@/components/ui/scroll-area";

// Modern color palette with black, dark gray and orange gradient
const MODERN_COLORS = [
  { solid: "#f97316", gradient: ["#fb923c", "#ea580c"] }, // Orange (primary)
  { solid: "#1a1a1a", gradient: ["#2d2d2d", "#0a0a0a"] }, // Black
  { solid: "#404040", gradient: ["#525252", "#262626"] }, // Dark Gray
  { solid: "#f97316", gradient: ["#fdba74", "#c2410c"] }, // Orange variant
  { solid: "#171717", gradient: ["#262626", "#0a0a0a"] }, // Darker Black
  { solid: "#525252", gradient: ["#737373", "#3f3f46"] }, // Medium Gray
  { solid: "#ea580c", gradient: ["#f97316", "#c2410c"] }, // Deep Orange
  { solid: "#292929", gradient: ["#3d3d3d", "#171717"] }, // Charcoal
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
      
      // Dynamic radius based on height - smaller to make room for labels
      const baseRadius = Math.min(height * 0.25, 80);
      const outerRadius = Math.max(baseRadius, 30);
      const innerRadius = outerRadius * 0.6;
      
      // Dynamic font sizes based on height
      const totalFontSize = Math.max(Math.min(height * 0.09, 24), 12);
      const labelFontSize = Math.max(Math.min(height * 0.032, 9), 7);

      // Custom label with leader line
      const renderCustomLabel = ({ cx, cy, midAngle, outerRadius: oR, index, name, value }: any) => {
        const RADIAN = Math.PI / 180;
        const sin = Math.sin(-RADIAN * midAngle);
        const cos = Math.cos(-RADIAN * midAngle);
        
        // Start point (on the pie edge)
        const sx = cx + (oR + 6) * cos;
        const sy = cy + (oR + 6) * sin;
        
        // Middle point
        const mx = cx + (oR + 20) * cos;
        const my = cy + (oR + 20) * sin;
        
        // End point (horizontal line)
        const ex = mx + (cos >= 0 ? 1 : -1) * 18;
        const ey = my;
        
        const textAnchor = cos >= 0 ? 'start' : 'end';
        const color = MODERN_COLORS[index % MODERN_COLORS.length].solid;

        return (
          <g>
            {/* Leader line */}
            <path
              d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
              stroke={color}
              strokeWidth={1.5}
              fill="none"
              opacity={0.6}
            />
            {/* Label text - name and value on same line */}
            <text
              x={ex + (cos >= 0 ? 5 : -5)}
              y={ey}
              textAnchor={textAnchor}
              dominantBaseline="central"
              style={{ fontSize: labelFontSize }}
            >
              <tspan className="fill-muted-foreground">{name} </tspan>
              <tspan className="fill-foreground font-semibold">{value}</tspan>
            </text>
          </g>
        );
      };
      
      return (
        <div className="relative w-full h-full flex items-center justify-center">
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
                label={renderCustomLabel}
                labelLine={false}
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
        <div className="h-full flex flex-col justify-between py-1 gap-1">
          {barData.map((item, index) => {
            const percentage = (item.count / maxCount) * 100;
            return (
              <div key={index} className="flex flex-col gap-1 flex-1 min-h-0 justify-center">
                {/* Label row - always visible above bar */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-medium text-foreground truncate max-w-[70%]">
                    {item.name}
                  </span>
                  <span className="text-sm font-bold text-foreground shrink-0">
                    {item.count}
                  </span>
                </div>
                {/* Bar */}
                <div className="w-full bg-muted/50 rounded-lg overflow-hidden" style={{ height: '12px' }}>
                  <div 
                    className="h-full rounded-lg transition-all duration-700 ease-out"
                    style={{ 
                      width: `${Math.max(percentage, 2)}%`,
                      background: `linear-gradient(90deg, ${MODERN_COLORS[index % MODERN_COLORS.length].gradient[1]}, ${MODERN_COLORS[index % MODERN_COLORS.length].gradient[0]})`,
                    }}
                  />
                </div>
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

    case "donut": {
      const donutData = chartData as Array<{ name: string; value: number; color: string }>;
      if (!Array.isArray(donutData) || donutData.length === 0 || donutData.every(d => d.value === 0)) {
        return renderEmptyState();
      }
      const total = donutData.reduce((acc, cur) => acc + cur.value, 0);
      const outerRadius = Math.min(height * 0.35, 100);
      const innerRadius = outerRadius * 0.7;
      
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {donutData.map((_, index) => (
                  <linearGradient key={`donut-gradient-${index}`} id={`donutGradient-${cardId}-${index}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={MODERN_COLORS[index % MODERN_COLORS.length].gradient[0]} />
                    <stop offset="100%" stopColor={MODERN_COLORS[index % MODERN_COLORS.length].gradient[1]} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
                animationBegin={0}
                animationDuration={800}
              >
                {donutData.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`url(#donutGradient-${cardId}-${index})`}
                    className="drop-shadow-lg"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-4xl font-bold text-foreground">{total}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
            </div>
          </div>
        </div>
      );
    }

    case "radial": {
      const radialData = chartData as Array<{ name: string; value: number; color: string }>;
      if (!Array.isArray(radialData) || radialData.length === 0) {
        return renderEmptyState();
      }
      const total = radialData.reduce((acc, cur) => acc + cur.value, 0);
      const mainValue = radialData[0]?.value || 0;
      const percentage = total > 0 ? Math.round((mainValue / total) * 100) : 0;
      
      const radialChartData = [
        { name: radialData[0]?.name || 'Principal', value: percentage, fill: `url(#radialGradient-${cardId})` }
      ];
      
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="90%"
              barSize={12}
              data={radialChartData}
              startAngle={90}
              endAngle={-270}
            >
              <defs>
                <linearGradient id={`radialGradient-${cardId}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={MODERN_COLORS[0].gradient[0]} />
                  <stop offset="100%" stopColor={MODERN_COLORS[0].gradient[1]} />
                </linearGradient>
              </defs>
              <RadialBar
                background={{ fill: 'hsl(var(--muted) / 0.3)' }}
                dataKey="value"
                cornerRadius={10}
                animationDuration={1000}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">{percentage}%</p>
              <p className="text-xs text-muted-foreground">{radialData[0]?.name || 'MQL'}</p>
            </div>
          </div>
        </div>
      );
    }

    case "progress": {
      const progressData = chartData as Array<{ name: string; value: number; color: string }>;
      if (!Array.isArray(progressData) || progressData.length === 0) {
        return renderEmptyState();
      }
      const total = progressData.reduce((acc, cur) => acc + cur.value, 0);
      
      return (
        <div className="h-full flex flex-col gap-4 py-2">
          {progressData.map((item, index) => {
            const percentage = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <div key={index} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{percentage.toFixed(0)}%</span>
                    <span className="text-sm font-bold text-foreground">{item.value}</span>
                  </div>
                </div>
                <div className="relative h-3 bg-muted/40 rounded-full overflow-hidden">
                  <div 
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                    style={{ 
                      width: `${percentage}%`,
                      background: `linear-gradient(90deg, ${MODERN_COLORS[index % MODERN_COLORS.length].gradient[1]}, ${MODERN_COLORS[index % MODERN_COLORS.length].gradient[0]})`,
                      boxShadow: `0 0 10px ${MODERN_COLORS[index % MODERN_COLORS.length].solid}40`
                    }}
                  />
                  {/* Glow effect */}
                  <div 
                    className="absolute inset-y-0 rounded-full blur-sm opacity-50"
                    style={{ 
                      width: `${percentage}%`,
                      background: `linear-gradient(90deg, ${MODERN_COLORS[index % MODERN_COLORS.length].gradient[1]}, ${MODERN_COLORS[index % MODERN_COLORS.length].gradient[0]})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    case "sparkline": {
      const sparkData = chartData as Array<{ date: string; count: number }>;
      if (!Array.isArray(sparkData) || sparkData.length === 0) {
        return renderEmptyState();
      }
      const total = sparkData.reduce((acc, cur) => acc + cur.count, 0);
      const lastValue = sparkData[sparkData.length - 1]?.count || 0;
      const prevValue = sparkData[sparkData.length - 2]?.count || 0;
      const trend = lastValue >= prevValue ? 'up' : 'down';
      
      return (
        <div className="h-full flex flex-col justify-between py-2">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold text-foreground">{total}</span>
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              trend === 'up' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
            )}>
              {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(lastValue - prevValue)}
            </div>
          </div>
          <div className="flex-1 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id={`sparklineGradient-${cardId}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={MODERN_COLORS[0].gradient[1]} />
                    <stop offset="100%" stopColor={MODERN_COLORS[0].gradient[0]} />
                  </linearGradient>
                </defs>
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={`url(#sparklineGradient-${cardId})`}
                  strokeWidth={2}
                  dot={false}
                  animationDuration={1000}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
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
