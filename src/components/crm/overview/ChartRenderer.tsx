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
  { solid: "#a3a3a3", gradient: ["#d4d4d4", "#737373"] }, // Neutral Gray
  { solid: "#78716c", gradient: ["#a8a29e", "#57534e"] }, // Warm Gray
  { solid: "#fb923c", gradient: ["#fdba74", "#f97316"] }, // Light Orange
  { solid: "#9ca3af", gradient: ["#d1d5db", "#6b7280"] }, // Cool Gray
  { solid: "#737373", gradient: ["#a3a3a3", "#525252"] }, // Medium Gray
  { solid: "#ea580c", gradient: ["#f97316", "#c2410c"] }, // Deep Orange
  { solid: "#b8b8b8", gradient: ["#d4d4d4", "#8a8a8a"] }, // Silver
];

interface CustomField {
  id: string;
  field_label: string;
  field_key: string;
  field_type: string;
}

interface CustomFieldResponse {
  field_id: string;
  lead_id: string;
  response_value: string | null;
}

interface ChartRendererProps {
  cardId: string;
  dataSource: DataSource | undefined;
  chartType: ChartType;
  leads: Lead[];
  pipelines: Pipeline[];
  leadTags: Array<{ lead_id: string; name: string; color: string }>;
  height?: number;
  showEmptyState?: boolean;
  pipelineCounts?: Record<string, number>;
  totalLeadCount?: number;
  customFieldId?: string;
  customFields?: CustomField[];
  customFieldResponses?: CustomFieldResponse[];
  skipAnimation?: boolean;
}

// Custom tooltip component
// Translate recharts data keys to Portuguese
const translateName = (name: string): string => {
  const translations: Record<string, string> = {
    count: "Quantidade",
    value: "Valor",
    total: "Total",
  };
  return translations[name?.toLowerCase()] || name;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
        {label && <p className="text-xs text-muted-foreground mb-1">{label}</p>}
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-semibold text-foreground">
            {translateName(entry.name)}: <span style={{ color: entry.color || entry.fill }}>{entry.value}</span>
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
  pipelineCounts,
  totalLeadCount,
  customFieldId,
  customFields = [],
  customFieldResponses = [],
  skipAnimation = false,
}: ChartRendererProps) {
  const animDuration = skipAnimation ? 0 : 800;
  // Calculate data based on dataSource
  const chartData = useMemo(() => {
    if (!dataSource) return null;
    
    switch (dataSource) {
      case "leads_over_time": {
        const last7Days = eachDayOfInterval({
          start: subDays(new Date(), 6),
          end: new Date(),
        });
        return last7Days.map((day) => {
          const dayStart = startOfDay(day);
          const count = leads.filter((l) => {
            const leadDate = startOfDay(new Date(l.created_at));
            return leadDate.getTime() === dayStart.getTime();
          }).length;
          return {
            date: format(day, "EEE", { locale: ptBR }),
            fullDate: format(day, "dd/MM", { locale: ptBR }),
            count,
          };
        });
      }
      case "total_leads": {
        // Use exact count if available, otherwise fallback to leads.length
        return { total: totalLeadCount ?? leads.length };
      }
      case "recent_leads": {
        return leads
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 8);
      }
      case "leads_by_tag": {
        const tagCounts: Record<string, { name: string; count: number; value: number; color: string }> = {};
        leadTags.forEach((tag, index) => {
          if (!tagCounts[tag.name]) {
            tagCounts[tag.name] = { 
              name: tag.name, 
              count: 0, 
              value: 0,
              color: tag.color || MODERN_COLORS[index % MODERN_COLORS.length].solid 
            };
          }
          tagCounts[tag.name].count++;
          tagCounts[tag.name].value++;
        });
        return Object.values(tagCounts).sort((a, b) => b.count - a.count).slice(0, 10);
      }
      case "leads_by_utm": {
        const counts: Record<string, number> = {};
        leads.forEach((lead) => {
          // Combine utm_source and utm_medium for better grouping
          const source = (lead as any).utm_source;
          const medium = (lead as any).utm_medium;
          const campaign = (lead as any).utm_campaign;
          
          let label = "Sem UTM";
          if (source || medium || campaign) {
            const parts = [source, medium, campaign].filter(Boolean);
            label = parts.join(" / ") || "Sem UTM";
          }
          
          counts[label] = (counts[label] || 0) + 1;
        });
        return Object.entries(counts)
          .map(([name, value], index) => ({
            name,
            value,
            count: value, // for horizontal bar compatibility
            color: MODERN_COLORS[index % MODERN_COLORS.length].solid,
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
      }
      case "leads_by_custom_field": {
        if (!customFieldId) return null;
        
        const field = customFields.find(f => f.id === customFieldId);
        if (!field) return null;

        // Group leads by custom field response value
        const counts: Record<string, number> = {};
        leads.forEach((lead) => {
          const response = customFieldResponses.find(
            r => r.lead_id === lead.id && r.field_id === customFieldId
          );
          const value = response?.response_value?.trim() || "Sem resposta";
          counts[value] = (counts[value] || 0) + 1;
        });

        return Object.entries(counts)
          .map(([name, value], index) => ({
            name,
            value,
            count: value,
            color: MODERN_COLORS[index % MODERN_COLORS.length].solid,
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
      }
      case "custom_field_avg": {
        if (!customFieldId) return null;
        const field = customFields.find(f => f.id === customFieldId);
        if (!field) return null;

        const values: number[] = [];
        leads.forEach((lead) => {
          const response = customFieldResponses.find(
            r => r.lead_id === lead.id && r.field_id === customFieldId
          );
          if (response?.response_value) {
            const num = parseFloat(response.response_value);
            if (!isNaN(num)) values.push(num);
          }
        });

        if (values.length === 0) return null;
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);
        return { avg: Math.round(avg * 10) / 10, max, min, count: values.length, fieldLabel: field.field_label };
      }
      case "custom_field_fill_rate": {
        if (!customFieldId) return null;
        const field2 = customFields.find(f => f.id === customFieldId);
        if (!field2) return null;

        const totalLeads = leads.length;
        const filledCount = leads.filter((lead) => {
          const response = customFieldResponses.find(
            r => r.lead_id === lead.id && r.field_id === customFieldId
          );
          return response?.response_value && response.response_value.trim() !== "";
        }).length;

        const rate = totalLeads > 0 ? Math.round((filledCount / totalLeads) * 100) : 0;
        return { total: rate, filled: filledCount, totalLeads, fieldLabel: field2.field_label, isPercentage: true };
      }
      default:
        return null;
    }
  }, [dataSource, leads, pipelines, leadTags, pipelineCounts, totalLeadCount, customFieldId, customFields, customFieldResponses]);

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
      if (!Array.isArray(pieData) || pieData.length === 0 || pieData.every((d) => d.value === 0)) {
        return renderEmptyState();
      }

      const total = pieData.reduce((acc, cur) => acc + cur.value, 0);

      // Keep the pie reasonably large; labels are laid out with collision avoidance.
      const baseRadius = Math.min(height * 0.26, 85);
      const outerRadius = Math.max(baseRadius, 35);
      const innerRadius = outerRadius * 0.6;

      const totalFontSize = Math.max(Math.min(height * 0.1, 28), 16);
      const labelFontSize = Math.max(Math.min(height * 0.04, 12), 9);

      const minLabelSpacing = labelFontSize + 6;

      const calculateLabelPositions = (data: typeof pieData, cx: number, cy: number, oR: number) => {
        const RADIAN = Math.PI / 180;
        let currentAngle = 0;

        const labelDistance = oR + Math.max(28, oR * 0.35);

        const labels = data.map((item, index) => {
          const sliceAngle = (item.value / total) * 360;
          const midAngle = currentAngle + sliceAngle / 2;
          currentAngle += sliceAngle;

          const sin = Math.sin(-RADIAN * midAngle);
          const cos = Math.cos(-RADIAN * midAngle);

          const sx = cx + (oR + 4) * cos;
          const sy = cy + (oR + 4) * sin;
          const initialY = cy + labelDistance * sin;

          return {
            index,
            name: item.name,
            value: item.value,
            midAngle,
            cos,
            sin,
            sx,
            sy,
            side: cos >= 0 ? "right" : "left",
            initialY,
            finalY: initialY,
            color: MODERN_COLORS[index % MODERN_COLORS.length].solid,
          };
        });

        const rightLabels = labels.filter((l) => l.side === "right").sort((a, b) => a.initialY - b.initialY);
        const leftLabels = labels.filter((l) => l.side === "left").sort((a, b) => a.initialY - b.initialY);

        const resolveCollisions = (sideLabels: typeof labels) => {
          if (sideLabels.length <= 1) return;

          // Push-down pass
          for (let i = 1; i < sideLabels.length; i++) {
            const prev = sideLabels[i - 1];
            const curr = sideLabels[i];
            const minY = prev.finalY + minLabelSpacing;
            if (curr.finalY < minY) curr.finalY = minY;
          }

          // Clamp block within bounds and re-center if needed
          const maxY = cy + height * 0.43;
          const minY = cy - height * 0.43;

          const first = sideLabels[0];
          const last = sideLabels[sideLabels.length - 1];

          if (last.finalY > maxY) {
            const overflow = last.finalY - maxY;
            sideLabels.forEach((l) => (l.finalY -= overflow));
          }

          if (first.finalY < minY) {
            const offset = minY - first.finalY;
            sideLabels.forEach((l) => (l.finalY += offset));
          }
        };

        resolveCollisions(rightLabels);
        resolveCollisions(leftLabels);

        return labels;
      };

      // Cache computed layout per render (Recharts calls label renderer once per slice)
      let layoutCache: ReturnType<typeof calculateLabelPositions> | null = null;
      let layoutCx: number | null = null;
      let layoutCy: number | null = null;

      const renderCustomLabel = (props: any) => {
        const { cx, cy, index } = props;

        if (!layoutCache || layoutCx !== cx || layoutCy !== cy) {
          layoutCache = calculateLabelPositions(pieData, cx, cy, outerRadius);
          layoutCx = cx;
          layoutCy = cy;
        }

        const label = layoutCache[index];
        if (!label) return null;

        const xOffset = Math.max(42, Math.min(90, outerRadius * 1.05));
        const labelX = label.side === "right" ? cx + outerRadius + xOffset : cx - outerRadius - xOffset;
        const endX = labelX - (label.side === "right" ? 6 : -6);

        const mx = cx + (outerRadius + 14) * label.cos;
        const my = cy + (outerRadius + 14) * label.sin;

        const textAnchor = label.side === "right" ? "start" : "end";
        const safeName = typeof label.name === "string" && label.name.length > 18 ? `${label.name.slice(0, 16)}…` : label.name;

        return (
          <g>
            <path
              d={`M${label.sx},${label.sy} L${mx},${my} L${endX},${label.finalY}`}
              stroke={label.color}
              strokeWidth={1}
              fill="none"
              opacity={0.55}
            />
            <circle cx={label.sx} cy={label.sy} r={2} fill={label.color} opacity={0.75} />
            <text
              x={labelX}
              y={label.finalY}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              style={{ fontSize: labelFontSize }}
            >
              <tspan className="fill-muted-foreground font-medium">{safeName} </tspan>
              <tspan className="fill-foreground font-bold">{label.value}</tspan>
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
                  <linearGradient
                    key={`gradient-${index}`}
                    id={`pieGradient-${cardId}-${index}`}
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                  >
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
                animationDuration={animDuration}
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
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="font-bold text-foreground" style={{ fontSize: totalFontSize }}>
                {total}
              </p>
              <p className="text-muted-foreground uppercase tracking-wide" style={{ fontSize: labelFontSize }}>
                Total
              </p>
            </div>
          </div>
        </div>
      );
    }

    case "area": {
      const areaData = chartData as Array<{ date: string; fullDate?: string; count: number }>;
      if (!Array.isArray(areaData) || areaData.length === 0) {
        return renderEmptyState();
      }
      const maxValue = Math.max(...areaData.map(d => d.count), 1);
      
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id={`areaGradient-${cardId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.08} />
                <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }} 
              tickLine={false}
              axisLine={false}
              interval={0}
              dy={8}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
              tickLine={false}
              axisLine={false}
              domain={[0, maxValue + Math.ceil(maxValue * 0.2)]}
              allowDecimals={false}
              dx={-5}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-popover border border-border/30 dark:border-white/10 rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-xs text-muted-foreground">{data.fullDate || data.date}</p>
                    <p className="text-sm font-semibold text-foreground">{data.count} leads</p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              name="Quantidade"
              stroke="hsl(var(--muted-foreground) / 0.25)"
              fillOpacity={1}
              fill={`url(#areaGradient-${cardId})`}
              strokeWidth={1.5}
              animationBegin={0}
              animationDuration={animDuration}
              dot={false}
              activeDot={false}
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
      const totalCount = barData.reduce((sum, d) => sum + d.count, 0);
      
      return (
        <div className="h-full flex flex-col justify-between py-1 gap-1">
          {barData.map((item, index) => {
            const barPercentage = (item.count / maxCount) * 100;
            const sharePercentage = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : '0';
            return (
              <div key={index} className="flex flex-col gap-1 flex-1 min-h-0 justify-center">
                {/* Label row - always visible above bar */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-medium text-foreground truncate max-w-[60%]">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {sharePercentage}%
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {item.count}
                    </span>
                  </div>
                </div>
                {/* Bar */}
                <div className="w-full bg-muted/50 rounded-lg overflow-hidden" style={{ height: '40px' }}>
                  <div 
                    className={`h-full rounded-lg ${skipAnimation ? '' : 'transition-all duration-700 ease-out'}`}
                    style={{ 
                      width: `${Math.max(barPercentage, 2)}%`,
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
      const numberData = chartData as { total: number; filled?: number; totalLeads?: number; fieldLabel?: string; isPercentage?: boolean } | null;
      if (!numberData || typeof numberData.total !== 'number') {
        return renderEmptyState();
      }
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <span className="text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {numberData.isPercentage ? `${numberData.total}%` : numberData.total.toLocaleString()}
          </span>
          {numberData.isPercentage && numberData.filled !== undefined && (
            <div className="flex flex-col items-center gap-1">
              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-700"
                  style={{ width: `${numberData.total}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {numberData.filled} de {numberData.totalLeads} leads
              </span>
            </div>
          )}
        </div>
      );
    }

    case "gauge": {
      const gaugeData = chartData as { avg: number; max: number; min: number; count: number; fieldLabel: string } | null;
      if (!gaugeData) {
        return renderEmptyState();
      }

      const { avg, max, min, count, fieldLabel } = gaugeData;
      // Gauge angle: map avg from min-max to 0-180 degrees
      const range = max - min || 1;
      const percentage = Math.min(((avg - min) / range) * 100, 100);
      const angle = (percentage / 100) * 180;
      const uniqueId = `gauge-${cardId}`;

      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
          <div className="relative w-full max-w-[200px]" style={{ aspectRatio: '2/1' }}>
            <svg
              className="w-full h-full"
              viewBox="0 0 200 110"
              preserveAspectRatio="xMidYMax meet"
            >
              {/* Background track */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="14"
                strokeLinecap="round"
              />
              {/* Progress arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke={`url(#${uniqueId})`}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${(angle / 180) * 251.33} 251.33`}
              />
              <defs>
                <linearGradient id={uniqueId} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ea580c" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
              <span className="text-3xl font-bold text-foreground">{avg}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">média</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Min: <strong className="text-foreground">{min}</strong></span>
            <span>Max: <strong className="text-foreground">{max}</strong></span>
            <span>{count} leads</span>
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
                animationDuration={animDuration}
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

      // Get last 8 weeks of data (56 days)
      const today = new Date();
      const startDate = subDays(today, 55);
      const days = eachDayOfInterval({ start: startDate, end: today });
      
      // Create a map of date to count
      const countMap: Record<string, number> = {};
      heatmapData.forEach(d => {
        countMap[d.date] = d.count;
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

      const getColorStyle = (count: number, isDark: boolean) => {
        if (count === 0) return { background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)' };
        const ratio = count / maxCount;
        if (ratio < 0.25) return { background: 'linear-gradient(135deg, #fed7aa, #fdba74)' };
        if (ratio < 0.5) return { background: 'linear-gradient(135deg, #fdba74, #fb923c)' };
        if (ratio < 0.75) return { background: 'linear-gradient(135deg, #fb923c, #f97316)' };
        return { background: 'linear-gradient(135deg, #f97316, #ea580c)' };
      };

      const isDark = document.documentElement.classList.contains('dark');
      const dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

      // Get month labels for top
      const monthLabels: Array<{ label: string; colStart: number; colSpan: number }> = [];
      let lastMonth = -1;
      weeks.forEach((week, weekIndex) => {
        const firstDay = week[0]?.date;
        if (firstDay) {
          const month = firstDay.getMonth();
          if (month !== lastMonth) {
            const label = format(firstDay, "MMM", { locale: ptBR });
            monthLabels.push({ label, colStart: weekIndex, colSpan: 1 });
            lastMonth = month;
          } else if (monthLabels.length > 0) {
            monthLabels[monthLabels.length - 1].colSpan++;
          }
        }
      });

      // Total count
      const totalCount = heatmapData.reduce((sum, d) => sum + d.count, 0);

      return (
        <TooltipProvider>
          <div className="h-full w-full flex flex-col p-3 overflow-hidden">
            {/* Month labels row */}
            <div className="flex mb-1.5 shrink-0" style={{ paddingLeft: '20px' }}>
              {monthLabels.map((m, i) => (
                <div 
                  key={i} 
                  className="text-[10px] text-muted-foreground font-medium capitalize"
                  style={{ 
                    flex: m.colSpan,
                  }}
                >
                  {m.label}
                </div>
              ))}
            </div>

            {/* Main grid container */}
            <div className="flex-1 flex min-h-0">
              {/* Day labels column */}
              <div 
                className="flex flex-col justify-between pr-1.5 py-[1px]"
                style={{ height: '100%', width: '18px' }}
              >
                {dayLabels.map((label, i) => (
                  <div key={i} className="flex-1 flex items-center justify-end">
                    <span className="text-[9px] text-muted-foreground/70 font-medium leading-none">
                      {i % 2 === 1 ? label : ''}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Weeks grid */}
              <div 
                className="flex-1 grid min-w-0"
                style={{ 
                  gridTemplateColumns: `repeat(${weeks.length}, 1fr)`,
                  gridTemplateRows: 'repeat(7, 1fr)',
                  gap: '3px',
                }}
              >
                {weeks.map((week, weekIndex) => (
                  Array.from({ length: 7 }).map((_, dayIndex) => {
                    const dayData = week.find(d => d.dayOfWeek === dayIndex);
                    return (
                      <UITooltip key={`${weekIndex}-${dayIndex}`}>
                        <TooltipTrigger asChild>
                          <div 
                            className="w-full h-full rounded-[3px] transition-all duration-150 hover:ring-1.5 hover:ring-foreground/20 cursor-pointer"
                            style={{ 
                              gridColumn: weekIndex + 1,
                              gridRow: dayIndex + 1,
                              minHeight: '2px',
                              ...(dayData ? getColorStyle(dayData.count, isDark) : { background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)' })
                            }}
                          />
                        </TooltipTrigger>
                        {dayData && (
                          <TooltipContent side="top" className="bg-popover border border-border/30 dark:border-white/10 rounded-lg px-3 py-2 shadow-lg">
                            <p className="text-xs text-muted-foreground">{format(dayData.date, "dd MMM yyyy", { locale: ptBR })}</p>
                            <p className="text-sm font-semibold text-foreground">{dayData.count} leads</p>
                          </TooltipContent>
                        )}
                      </UITooltip>
                    );
                  })
                ))}
              </div>
            </div>
            
            {/* Footer: Legend + Total */}
            <div className="flex items-center justify-between pt-2 mt-1.5 border-t border-border/10 dark:border-white/[0.04] shrink-0">
              <span className="text-[10px] text-muted-foreground font-medium">
                {totalCount} atividades
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-muted-foreground/60">Menos</span>
                <div className="flex gap-[3px]">
                  <div className="w-2.5 h-2.5 rounded-[2px]" style={{ background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)' }} />
                  <div className="w-2.5 h-2.5 rounded-[2px]" style={{ background: 'linear-gradient(135deg, #fed7aa, #fdba74)' }} />
                  <div className="w-2.5 h-2.5 rounded-[2px]" style={{ background: 'linear-gradient(135deg, #fdba74, #fb923c)' }} />
                  <div className="w-2.5 h-2.5 rounded-[2px]" style={{ background: 'linear-gradient(135deg, #fb923c, #f97316)' }} />
                  <div className="w-2.5 h-2.5 rounded-[2px]" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }} />
                </div>
                <span className="text-[9px] text-muted-foreground/60">Mais</span>
              </div>
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
