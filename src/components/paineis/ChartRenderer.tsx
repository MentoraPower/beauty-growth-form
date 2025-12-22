import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { ChartDataPoint, WidgetData } from "./DashboardCanvas";

interface ChartRendererProps {
  chartType: string;
  data?: WidgetData;
  width: number;
  height: number;
  isLoading?: boolean;
}

// Orange gradient palette
const PRIMARY_ORANGE = "#f97316";
const PRIMARY_ORANGE_LIGHT = "#fb923c";
const PRIMARY_ORANGE_DARK = "#c2410c";

const GRADIENT_PAIRS = [
  { start: "#f97316", end: "#fb923c" },
  { start: "#ea580c", end: "#f97316" },
  { start: "#c2410c", end: "#ea580c" },
  { start: "#9a3412", end: "#c2410c" },
  { start: "#7c2d12", end: "#9a3412" },
];

export function ChartRenderer({ chartType, data, width, height, isLoading }: ChartRendererProps) {
  const chartHeight = height;
  const total = data?.total || 0;
  const distribution = data?.distribution || [];
  const trend = data?.trend || [];

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-orange-400/20 rounded-full blur-xl animate-pulse" />
          <RefreshCw className="h-8 w-8 text-orange-500 animate-spin relative z-10" />
        </div>
      </div>
    );
  }

  switch (chartType) {
    case 'pie':
      if (distribution.length === 0) {
        return (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Sem dados</p>
          </div>
        );
      }

      const isWide = width > height * 1.3;
      const isVerySmall = height < 200 || width < 280;
      
      const availablePieHeight = isWide ? height - 20 : height * 0.55;
      const availablePieWidth = isWide ? width * 0.45 : width - 40;
      const pieSize = Math.min(availablePieHeight, availablePieWidth);
      
      const totalFontSize = pieSize > 120 ? 'text-3xl' : pieSize > 80 ? 'text-2xl' : 'text-xl';
      const labelFontSize = pieSize > 100 ? 'text-[11px]' : 'text-[9px]';
      
      const maxLegendItems = isVerySmall ? 3 : height > 350 ? 7 : 5;
      
      return (
        <div className={`w-full h-full flex ${isWide ? 'flex-row items-center' : 'flex-col items-center justify-center'} gap-3 p-2`}>
          {/* Donut Chart with glow effect */}
          <div 
            className="relative shrink-0 flex items-center justify-center"
            style={{ 
              width: pieSize, 
              height: pieSize,
            }}
          >
            {/* Subtle glow behind chart */}
            <div 
              className="absolute inset-4 rounded-full blur-2xl opacity-20"
              style={{ background: `radial-gradient(circle, ${PRIMARY_ORANGE}40, transparent 70%)` }}
            />
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {distribution.map((_, index) => (
                    <linearGradient key={`pieGrad-${index}`} id={`pieGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={GRADIENT_PAIRS[index % GRADIENT_PAIRS.length].start} />
                      <stop offset="100%" stopColor={GRADIENT_PAIRS[index % GRADIENT_PAIRS.length].end} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="90%"
                  paddingAngle={distribution.length > 1 ? 4 : 0}
                  dataKey="value"
                  stroke="none"
                  animationDuration={600}
                  animationEasing="ease-out"
                >
                  {distribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color || `url(#pieGradient-${index})`}
                      style={{
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(8px)",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                    padding: "10px 14px",
                    fontSize: "12px",
                  }}
                  formatter={(val: number, name: string) => [`${val} leads`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center total with subtle bg */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center bg-white/60 backdrop-blur-sm rounded-full p-3">
                <p className={`${totalFontSize} font-bold text-foreground leading-none`}>
                  {total}
                </p>
                <p className={`${labelFontSize} text-muted-foreground mt-0.5 font-medium`}>total</p>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className={`flex flex-col gap-2 ${isWide ? 'flex-1 min-w-0' : 'w-full max-w-[200px]'}`}>
            {distribution.slice(0, maxLegendItems).map((entry, index) => {
              const percentage = total > 0 ? Math.round((entry.value / total) * 100) : 0;
              const gradientColor = GRADIENT_PAIRS[index % GRADIENT_PAIRS.length].start;
              return (
                <div key={entry.name} className="flex items-center gap-2.5 min-w-0">
                  <div 
                    className="w-3 h-3 rounded-full shrink-0" 
                    style={{ 
                      background: entry.color || `linear-gradient(135deg, ${GRADIENT_PAIRS[index % GRADIENT_PAIRS.length].start}, ${GRADIENT_PAIRS[index % GRADIENT_PAIRS.length].end})`,
                    }}
                  />
                  <span className="text-xs text-foreground/70 truncate flex-1 min-w-0 font-medium">
                    {entry.name}
                  </span>
                  <span className="text-xs font-semibold text-foreground shrink-0 tabular-nums">
                    {entry.value}
                  </span>
                  <span className="text-[10px] font-medium shrink-0 w-10 text-right tabular-nums text-muted-foreground">
                    {percentage}%
                  </span>
                </div>
              );
            })}
            {distribution.length > maxLegendItems && (
              <p className="text-[10px] text-muted-foreground pl-5 font-medium">
                +{distribution.length - maxLegendItems} mais
              </p>
            )}
          </div>
        </div>
      );

    case 'bar':
      if (trend.length === 0) {
        return (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Sem dados</p>
          </div>
        );
      }

      return (
        <div className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                  <stop offset="100%" stopColor="#fb923c" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(8px)",
                  border: "none",
                  borderRadius: "12px",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                  padding: "10px 14px",
                  fontSize: "12px",
                }}
                formatter={(val: number) => [`${val} leads`, "Quantidade"]}
                cursor={{ fill: "rgba(249, 115, 22, 0.06)" }}
              />
              <Bar 
                dataKey="value" 
                fill="url(#barGradient)" 
                radius={[6, 6, 0, 0]}
                maxBarSize={50}
                animationDuration={600}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );

    case 'bar_horizontal':
      if (distribution.length === 0) {
        return (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Sem dados</p>
          </div>
        );
      }

      // Calculate how many bars fit in the available height
      const itemHeight = 24; // height per bar item including gap
      const availableHeight = height - 8; // minimal padding
      const maxItemsToShow = Math.max(1, Math.floor(availableHeight / itemHeight));
      const sortedData = [...distribution].sort((a, b) => b.value - a.value).slice(0, maxItemsToShow);
      const maxValue = Math.max(...sortedData.map(d => d.value), 1);
      const totalResponses = distribution.reduce((sum, d) => sum + d.value, 0);
      const hiddenCount = distribution.length - maxItemsToShow;

      return (
        <div className="w-full h-full flex flex-col px-3 py-1 overflow-hidden">
          <div className="flex flex-col justify-start gap-1 flex-1 overflow-hidden">
            {sortedData.map((item, index) => {
              const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
              const responsePercent = totalResponses > 0 ? Math.round((item.value / totalResponses) * 100) : 0;
              const gradient = GRADIENT_PAIRS[index % GRADIENT_PAIRS.length];
              
              return (
                <div key={`${item.name}-${index}`} className="flex items-center gap-2 min-w-0">
                  <div className="w-9 shrink-0 flex items-center justify-start">
                    <span className={`text-xs font-bold tabular-nums ${item.value === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {item.value}
                    </span>
                  </div>
                  
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    {item.value > 0 && (
                      <div 
                        className="h-full rounded-full relative overflow-hidden"
                        style={{ 
                          width: `${Math.max(percentage, 4)}%`, 
                          background: item.color || `linear-gradient(90deg, ${gradient.start}, ${gradient.end})`,
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12" />
                      </div>
                    )}
                  </div>
                  
                  <div className="w-[65px] shrink-0 flex items-center justify-between gap-1">
                    <span 
                      className={`text-[10px] truncate leading-tight font-medium ${item.value === 0 ? 'text-muted-foreground' : 'text-foreground/70'}`}
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    <span className="text-[9px] font-medium text-muted-foreground">
                      {item.value === 0 ? '-' : `${responsePercent}%`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {hiddenCount > 0 && (
            <div className="pt-1 shrink-0">
              <p className="text-[10px] text-muted-foreground text-center font-medium">
                +{hiddenCount} mais
              </p>
            </div>
          )}
        </div>
      );

    case 'line':
      if (trend.length === 0) {
        return (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Sem dados</p>
          </div>
        );
      }

      return (
        <div className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#fb923c" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(8px)",
                  border: "none",
                  borderRadius: "12px",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                  padding: "10px 14px",
                  fontSize: "12px",
                }}
                formatter={(val: number) => [`${val} leads`, "Quantidade"]}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="url(#lineGradient)" 
                strokeWidth={3}
                dot={{ 
                  fill: "#f97316", 
                  strokeWidth: 2, 
                  stroke: "#fff",
                  r: 5,
                }}
                activeDot={{ 
                  r: 7, 
                  fill: "#f97316",
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
                animationDuration={700}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );

    case 'area':
      if (trend.length === 0) {
        return (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Sem dados</p>
          </div>
        );
      }

      return (
        <div className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#fb923c" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="areaStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#fb923c" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 11, fill: "#6b7280", fontWeight: 500 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(8px)",
                  border: "none",
                  borderRadius: "12px",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                  padding: "10px 14px",
                  fontSize: "12px",
                }}
                formatter={(val: number) => [`${val} leads`, "Quantidade"]}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="url(#areaStrokeGradient)" 
                strokeWidth={2.5}
                fill="url(#areaGradient)"
                animationDuration={700}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );

    case 'gauge':
      const gaugeMaxValue = Math.max(total * 1.3, 100);
      const gaugePercentage = Math.min(Math.round((total / gaugeMaxValue) * 100), 100);
      const gaugeWidth = Math.min(chartHeight * 1.2, width - 40);
      const gaugeHeight = gaugeWidth * 0.6;
      
      // Create gradient arc segments
      const arcLength = 251.2; // Approximate arc length for the path
      const filledLength = (gaugePercentage / 100) * arcLength;
      
      return (
        <div className="w-full h-full flex flex-col items-center justify-center relative">
          <svg 
            width={gaugeWidth} 
            height={gaugeHeight} 
            viewBox="0 0 200 110"
            className="relative z-10"
          >
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#fb923c" />
              </linearGradient>
            </defs>
            {/* Background arc */}
            <path
              d="M20,100 A80,80 0 0,1 180,100"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="14"
              strokeLinecap="round"
            />
            {/* Progress arc with gradient */}
            <path
              d="M20,100 A80,80 0 0,1 180,100"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${filledLength} ${arcLength}`}
              style={{ 
                transition: "stroke-dasharray 0.8s ease-out",
              }}
            />
          </svg>
          <div className="text-center -mt-6 relative z-10">
            <p className="text-4xl font-bold text-foreground">
              {total.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground font-medium mt-1">{data?.label || "Leads"}</p>
          </div>
        </div>
      );

    case 'kpi':
      let changePercent = 0;
      if (trend.length >= 2) {
        const recent = trend.slice(-3).reduce((sum, t) => sum + t.value, 0);
        const earlier = trend.slice(0, 3).reduce((sum, t) => sum + t.value, 0);
        if (earlier > 0) {
          changePercent = Math.round(((recent - earlier) / earlier) * 100);
        }
      }
      const isPositive = changePercent >= 0;
      
      return (
        <div className="w-full h-full flex flex-col items-center justify-center relative">
          <p className="text-5xl font-bold text-foreground tracking-tight relative z-10">
            {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2 mt-4 relative z-10">
            <span className={`text-sm font-semibold ${
              isPositive ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {isPositive ? '+' : ''}{changePercent}%
            </span>
            <span className="text-xs text-muted-foreground font-medium">vs. período anterior</span>
          </div>
        </div>
      );

    default:
      return (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Gráfico não disponível</p>
        </div>
      );
  }
}
