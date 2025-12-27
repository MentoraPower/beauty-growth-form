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
  CartesianGrid,
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval, getDay, startOfWeek, addDays, getWeek } from "date-fns";
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
                <div className="w-full bg-muted/50 rounded-lg overflow-hidden" style={{ height: '40px' }}>
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

    case "bar_vertical": {
      const barData = chartData as Array<{ name: string; value: number; color: string }>;
      if (!Array.isArray(barData) || barData.length === 0 || barData.every(d => d.value === 0)) {
        return renderEmptyState();
      }

      // Dynamic sizing based on height
      const barRadius = Math.max(Math.min(height * 0.025, 8), 4);
      const fontSize = Math.max(Math.min(height * 0.035, 12), 9);
      const maxBarWidth = Math.max(Math.min(height * 0.2, 60), 30);

      return (
        <div className="h-full w-full flex flex-col">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={barData} 
              margin={{ top: 30, right: 20, left: 10, bottom: 20 }}
              barCategoryGap="20%"
            >
              <defs>
                {barData.map((entry, index) => (
                  <linearGradient key={`vbar-gradient-${index}`} id={`vbarGradient-${cardId}-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={MODERN_COLORS[index % MODERN_COLORS.length].gradient[0]} stopOpacity={1} />
                    <stop offset="100%" stopColor={MODERN_COLORS[index % MODERN_COLORS.length].gradient[1]} stopOpacity={0.9} />
                  </linearGradient>
                ))}
                <filter id="barShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15"/>
                </filter>
              </defs>
              <CartesianGrid 
                strokeDasharray="4 4" 
                stroke="hsl(var(--border))" 
                vertical={false}
                opacity={0.4}
              />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize, fill: 'hsl(var(--foreground))', fontWeight: 500 }} 
                tickLine={false}
                axisLine={false}
                interval={0}
                dy={8}
              />
              <YAxis 
                tick={{ fontSize: fontSize - 1, fill: 'hsl(var(--muted-foreground))' }} 
                tickLine={false}
                axisLine={false}
                width={35}
              />
              <Tooltip 
                content={<CustomTooltip />} 
                cursor={{ fill: 'hsl(var(--muted) / 0.2)', radius: 4 }} 
              />
              <Bar
                dataKey="value"
                radius={[barRadius, barRadius, 0, 0]}
                maxBarSize={maxBarWidth}
                animationBegin={0}
                animationDuration={800}
                filter="url(#barShadow)"
                label={({ x, y, width, value }) => (
                  <text
                    x={x + width / 2}
                    y={y - 8}
                    fill="hsl(var(--foreground))"
                    textAnchor="middle"
                    fontSize={fontSize - 1}
                    fontWeight="600"
                  >
                    {value}
                  </text>
                )}
              >
                {barData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`url(#vbarGradient-${cardId}-${index})`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    case "heatmap": {
      const heatmapData = chartData as Array<{ date: string; count: number }>;
      if (!Array.isArray(heatmapData) || heatmapData.length === 0) {
        return renderEmptyState();
      }

      // Get last 12 weeks of data
      const today = new Date();
      const startDate = subDays(today, 84); // 12 weeks
      const days = eachDayOfInterval({ start: startDate, end: today });
      
      // Create a map of date to count
      const countMap: Record<string, number> = {};
      heatmapData.forEach(d => {
        const key = d.date;
        countMap[key] = d.count;
      });

      // Find max for color scaling
      const maxCount = Math.max(...heatmapData.map(d => d.count), 1);

      // Group by week
      const weeks: Array<Array<{ date: Date; count: number; dayOfWeek: number }>> = [];
      let currentWeek: Array<{ date: Date; count: number; dayOfWeek: number }> = [];
      
      days.forEach((day, index) => {
        const dayOfWeek = getDay(day);
        const formattedDate = format(day, "dd/MM", { locale: ptBR });
        const count = countMap[formattedDate] || 0;
        
        currentWeek.push({ date: day, count, dayOfWeek });
        
        if (dayOfWeek === 6 || index === days.length - 1) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      });

      const getColorStyle = (count: number) => {
        if (count === 0) return { background: 'hsl(var(--muted) / 0.3)' };
        const ratio = count / maxCount;
        if (ratio < 0.25) return { background: 'linear-gradient(135deg, #fed7aa, #fdba74)' };
        if (ratio < 0.5) return { background: 'linear-gradient(135deg, #fdba74, #fb923c)' };
        if (ratio < 0.75) return { background: 'linear-gradient(135deg, #fb923c, #f97316)' };
        return { background: 'linear-gradient(135deg, #f97316, #ea580c)' };
      };

      const dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

      return (
        <TooltipProvider>
          <div className="h-full w-full flex flex-col p-2">
            <div className="flex-1 flex items-center justify-center">
              {/* Day labels */}
              <div className="flex flex-col gap-[3px] mr-2">
                {dayLabels.map((label, i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-end h-[calc((100%-24px)/7)]"
                    style={{ minHeight: '14px' }}
                  >
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              {/* Weeks grid - fill available space */}
              <div className="flex-1 flex justify-between gap-[3px]">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex-1 flex flex-col gap-[3px]">
                    {Array.from({ length: 7 }).map((_, dayIndex) => {
                      const dayData = week.find(d => d.dayOfWeek === dayIndex);
                      return (
                        <UITooltip key={dayIndex}>
                          <TooltipTrigger asChild>
                            <div 
                              className="flex-1 rounded-sm transition-all duration-200 hover:scale-105 hover:ring-1 hover:ring-primary/50 cursor-pointer"
                              style={{ 
                                minHeight: '14px',
                                aspectRatio: '1',
                                ...(dayData ? getColorStyle(dayData.count) : { background: 'transparent' })
                              }}
                            />
                          </TooltipTrigger>
                          {dayData && (
                            <TooltipContent side="top" className="bg-background/95 backdrop-blur-sm border border-border/50">
                              <p className="font-semibold text-foreground">{format(dayData.date, "dd MMM yyyy", { locale: ptBR })}</p>
                              <p className="text-primary font-bold">{dayData.count} leads</p>
                            </TooltipContent>
                          )}
                        </UITooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-2 pt-2 mt-2 border-t border-border/30">
              <span className="text-[9px] text-muted-foreground font-medium">Menos</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ background: 'hsl(var(--muted) / 0.3)' }} />
                <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #fed7aa, #fdba74)' }} />
                <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #fdba74, #fb923c)' }} />
                <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #fb923c, #f97316)' }} />
                <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }} />
              </div>
              <span className="text-[9px] text-muted-foreground font-medium">Mais</span>
            </div>
          </div>
        </TooltipProvider>
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
