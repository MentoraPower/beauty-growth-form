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
import { RefreshCw } from "lucide-react";
import { ChartDataPoint, WidgetData } from "./DashboardCanvas";

interface ChartRendererProps {
  chartType: string;
  data?: WidgetData;
  width: number;
  height: number;
  isLoading?: boolean;
}

const DEFAULT_COLORS = ["#171717", "#404040", "#737373", "#a3a3a3", "#d4d4d4"];

export function ChartRenderer({ chartType, data, width, height, isLoading }: ChartRendererProps) {
  const chartHeight = height;
  const total = data?.total || 0;
  const distribution = data?.distribution || [];
  const trend = data?.trend || [];

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
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

      const pieSize = Math.min(chartHeight * 0.85, width * 0.45);
      
      return (
        <div className="w-full h-full flex items-center gap-4 px-2">
          {/* Donut Chart */}
          <div className="relative" style={{ width: pieSize, height: pieSize, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="90%"
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  animationDuration={500}
                >
                  {distribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e5e5",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgb(0 0 0 / 0.1)",
                    padding: "8px 12px",
                    fontSize: "12px",
                  }}
                  formatter={(val: number, name: string) => [`${val} leads`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center total */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{total}</p>
                <p className="text-[10px] text-muted-foreground">total</p>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 min-w-0 flex flex-col gap-2 overflow-hidden">
            {distribution.slice(0, 5).map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-sm shrink-0" 
                  style={{ backgroundColor: entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length] }}
                />
                <span className="text-xs text-muted-foreground truncate flex-1">{entry.name}</span>
                <span className="text-xs font-medium text-foreground shrink-0">{entry.value}</span>
              </div>
            ))}
            {distribution.length > 5 && (
              <p className="text-[10px] text-muted-foreground">+{distribution.length - 5} mais</p>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: "#737373" }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: "#737373" }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgb(0 0 0 / 0.1)",
                  fontSize: "12px",
                }}
                formatter={(val: number) => [`${val} leads`, "Quantidade"]}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
              />
              <Bar 
                dataKey="value" 
                fill="#171717" 
                radius={[4, 4, 0, 0]}
                maxBarSize={45}
                animationDuration={500}
              />
            </BarChart>
          </ResponsiveContainer>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 11, fill: "#737373" }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 11, fill: "#737373" }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgb(0 0 0 / 0.1)",
                  fontSize: "12px",
                }}
                formatter={(val: number) => [`${val} leads`, "Quantidade"]}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#171717" 
                strokeWidth={2.5}
                dot={{ fill: "#171717", strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: "#171717" }}
                animationDuration={500}
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
                  <stop offset="0%" stopColor="#171717" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#171717" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 11, fill: "#737373" }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 11, fill: "#737373" }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgb(0 0 0 / 0.1)",
                  fontSize: "12px",
                }}
                formatter={(val: number) => [`${val} leads`, "Quantidade"]}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#171717" 
                strokeWidth={2}
                fill="url(#areaGradient)"
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );

    case 'gauge':
      const maxValue = Math.max(total * 1.3, 100);
      const percentage = Math.round((total / maxValue) * 100);
      const gaugeWidth = Math.min(chartHeight * 1.2, width - 40);
      const gaugeHeight = gaugeWidth * 0.55;
      
      return (
        <div className="w-full h-full flex flex-col items-center justify-center">
          <svg 
            width={gaugeWidth} 
            height={gaugeHeight} 
            viewBox="0 0 200 110"
          >
            {/* Background arc */}
            <path
              d="M20,100 A80,80 0 0,1 180,100"
              fill="none"
              stroke="#f0f0f0"
              strokeWidth="16"
              strokeLinecap="round"
            />
            {/* Progress arc */}
            <path
              d="M20,100 A80,80 0 0,1 180,100"
              fill="none"
              stroke="#171717"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${(percentage / 100) * 251.2} 251.2`}
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          </svg>
          <div className="text-center -mt-8">
            <p className="text-3xl font-bold text-foreground">{total.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{data?.label || "Leads"}</p>
          </div>
        </div>
      );

    case 'kpi':
      // Calculate a mock change percentage based on trend
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
        <div className="w-full h-full flex flex-col items-center justify-center">
          <p className="text-5xl font-bold text-foreground tracking-tight">
            {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
              isPositive ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'
            }`}>
              {isPositive ? '+' : ''}{changePercent}%
            </span>
            <span className="text-xs text-muted-foreground">vs. período anterior</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">{data?.label || "Leads"}</p>
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
