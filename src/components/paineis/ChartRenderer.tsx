import { useMemo } from "react";
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

interface ChartRendererProps {
  chartType: string;
  value: number;
  label: string;
  width: number;
  height: number;
  isLoading?: boolean;
}

const COLORS = {
  primary: "hsl(0, 0%, 9%)",
  secondary: "hsl(0, 0%, 45%)",
  muted: "hsl(0, 0%, 90%)",
  accent: "hsl(0, 0%, 20%)",
};

const PIE_COLORS = ["#171717", "#404040", "#737373", "#a3a3a3", "#d4d4d4"];

export function ChartRenderer({ chartType, value, label, width, height, isLoading }: ChartRendererProps) {
  const chartHeight = height - 60;

  // Generate mock trend data based on value
  const trendData = useMemo(() => {
    const baseValue = value || 100;
    return [
      { name: "Seg", value: Math.round(baseValue * 0.7) },
      { name: "Ter", value: Math.round(baseValue * 0.85) },
      { name: "Qua", value: Math.round(baseValue * 0.6) },
      { name: "Qui", value: Math.round(baseValue * 0.95) },
      { name: "Sex", value: Math.round(baseValue * 1.1) },
      { name: "Sáb", value: Math.round(baseValue * 0.8) },
      { name: "Dom", value: Math.round(baseValue * 1) },
    ];
  }, [value]);

  const pieData = useMemo(() => {
    const total = value || 100;
    return [
      { name: "Ativos", value: Math.round(total * 0.45) },
      { name: "Qualificados", value: Math.round(total * 0.25) },
      { name: "Pendentes", value: Math.round(total * 0.15) },
      { name: "Convertidos", value: Math.round(total * 0.1) },
      { name: "Outros", value: Math.round(total * 0.05) },
    ];
  }, [value]);

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: chartHeight }}>
        <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  switch (chartType) {
    case 'pie':
      return (
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={chartHeight * 0.25}
                outerRadius={chartHeight * 0.4}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                formatter={(val: number) => [`${val} leads`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </div>
      );

    case 'bar':
      return (
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                formatter={(val: number) => [`${val} leads`, ""]}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
              />
              <Bar 
                dataKey="value" 
                fill="#171717" 
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );

    case 'line':
      return (
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                formatter={(val: number) => [`${val} leads`, ""]}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#171717" 
                strokeWidth={2.5}
                dot={{ fill: "#171717", strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: "#171717" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );

    case 'area':
      return (
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#171717" stopOpacity={0.3} />
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
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                formatter={(val: number) => [`${val} leads`, ""]}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#171717" 
                strokeWidth={2}
                fill="url(#areaGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );

    case 'gauge':
      const percentage = Math.min(Math.round((value / Math.max(value * 1.5, 100)) * 100), 100);
      const gaugeSize = Math.min(chartHeight * 0.9, width - 40);
      const strokeWidth = gaugeSize * 0.12;
      const radius = (gaugeSize - strokeWidth) / 2;
      const circumference = Math.PI * radius;
      const progress = (percentage / 100) * circumference;
      
      return (
        <div className="w-full flex flex-col items-center justify-center" style={{ height: chartHeight }}>
          <svg 
            width={gaugeSize} 
            height={gaugeSize * 0.6} 
            viewBox={`0 0 ${gaugeSize} ${gaugeSize * 0.6}`}
          >
            {/* Background arc */}
            <path
              d={`M ${strokeWidth / 2} ${gaugeSize * 0.55} A ${radius} ${radius} 0 0 1 ${gaugeSize - strokeWidth / 2} ${gaugeSize * 0.55}`}
              fill="none"
              stroke="#f0f0f0"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Progress arc */}
            <path
              d={`M ${strokeWidth / 2} ${gaugeSize * 0.55} A ${radius} ${radius} 0 0 1 ${gaugeSize - strokeWidth / 2} ${gaugeSize * 0.55}`}
              fill="none"
              stroke="#171717"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${progress} ${circumference}`}
              style={{ transition: "stroke-dasharray 0.5s ease" }}
            />
          </svg>
          <div className="text-center -mt-2">
            <p className="text-3xl font-bold text-foreground">{value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      );

    case 'kpi':
      const change = Math.round((Math.random() - 0.3) * 30);
      const isPositive = change >= 0;
      return (
        <div className="w-full flex flex-col items-center justify-center" style={{ height: chartHeight }}>
          <p className="text-4xl font-bold text-foreground tracking-tight">
            {value.toLocaleString()}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}{change}%
            </span>
            <span className="text-xs text-muted-foreground">vs. semana anterior</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </div>
      );

    default:
      return (
        <div className="w-full flex items-center justify-center" style={{ height: chartHeight }}>
          <p className="text-muted-foreground">Gráfico não disponível</p>
        </div>
      );
  }
}
