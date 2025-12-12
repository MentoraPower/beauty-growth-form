import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FunnelStep {
  label: string;
  count: number;
  percentage: number;
}

interface FormFunnelChartProps {
  data: FunnelStep[];
}

export default function FormFunnelChart({ data }: FormFunnelChartProps) {
  const maxCount = data.length > 0 ? data[0].count : 1;
  const chartHeight = 280;
  const stepWidth = 100 / data.length;

  return (
    <TooltipProvider>
      <div className="relative w-full" style={{ height: chartHeight }}>
        {/* SVG Funnel */}
        <svg 
          viewBox={`0 0 ${data.length * 60} 100`} 
          className="w-full h-full" 
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="funnelGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F40000" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#A10000" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          
          {/* Funnel shape - trapezoid getting smaller */}
          <path
            d={`
              M 0 10
              ${data.map((step, i) => {
                const x = (i + 1) * 60;
                const heightPercent = maxCount > 0 ? (step.count / maxCount) * 40 : 0;
                const topY = 50 - heightPercent;
                return `L ${x} ${topY}`;
              }).join(' ')}
              L ${data.length * 60} ${50 + (maxCount > 0 ? (data[data.length - 1]?.count / maxCount) * 40 : 0)}
              ${[...data].reverse().map((step, i) => {
                const x = (data.length - 1 - i) * 60;
                const heightPercent = maxCount > 0 ? (step.count / maxCount) * 40 : 0;
                const bottomY = 50 + heightPercent;
                return `L ${x} ${bottomY}`;
              }).join(' ')}
              L 0 90
              Z
            `}
            fill="url(#funnelGradient)"
            className="drop-shadow-sm"
          />

          {/* Vertical divider lines */}
          {data.slice(1).map((_, i) => {
            const x = (i + 1) * 60;
            return (
              <line
                key={i}
                x1={x}
                y1={10}
                x2={x}
                y2={90}
                stroke="white"
                strokeOpacity="0.2"
                strokeWidth="0.5"
              />
            );
          })}
        </svg>

        {/* Labels and percentages overlay */}
        <div className="absolute inset-0 flex">
          {data.map((step, index) => (
            <div 
              key={step.label}
              className="flex-1 flex flex-col items-center justify-between py-2"
              style={{ width: `${stepWidth}%` }}
            >
              {/* Percentage at top with trace line */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-foreground">
                  {step.percentage.toFixed(0)}%
                </span>
                <div className="w-px h-3 bg-gradient-to-b from-foreground/60 to-transparent" />
              </div>

              {/* Count in middle - modern badge */}
              <div className="bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-lg border border-white/50">
                <span className="text-sm font-bold bg-gradient-to-r from-[#F40000] to-[#A10000] bg-clip-text text-transparent">
                  {step.count}
                </span>
              </div>

              {/* Label at bottom with trace line and tooltip */}
              <div className="flex flex-col items-center">
                <div className="w-px h-3 bg-gradient-to-t from-muted-foreground/60 to-transparent" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[10px] text-muted-foreground text-center cursor-help">
                      Etapa {index + 1}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {step.label}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}