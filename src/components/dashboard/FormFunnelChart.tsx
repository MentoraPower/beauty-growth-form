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

  return (
    <div className="space-y-1.5">
      {data.map((step, index) => {
        const widthPercent = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
        const taperAmount = index * 3;
        
        return (
          <div key={step.label} className="relative flex items-center gap-3">
            {/* Step label */}
            <div className="w-28 text-right pr-2">
              <span className="text-[11px] text-muted-foreground leading-tight">
                {step.label}
              </span>
            </div>

            {/* Funnel bar container */}
            <div className="flex-1 relative h-6">
              {/* Background track */}
              <div 
                className="absolute inset-0 bg-muted/20 rounded-sm"
                style={{
                  clipPath: `polygon(0 ${taperAmount}%, 100% 0, 100% 100%, 0 ${100 - taperAmount}%)`
                }}
              />
              
              {/* Filled bar */}
              <div 
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#F40000] to-[#A10000]/80 rounded-sm flex items-center transition-all duration-500"
                style={{ 
                  width: `${Math.max(widthPercent, 12)}%`,
                  clipPath: `polygon(0 ${taperAmount}%, 100% 0, 100% 100%, 0 ${100 - taperAmount}%)`
                }}
              >
                <span className="text-[11px] font-semibold text-white pl-2 drop-shadow-sm">
                  {step.count}
                </span>
              </div>
            </div>

            {/* Percentage with trace line */}
            <div className="w-14 flex items-center gap-1.5">
              <div className="w-3 h-px bg-muted-foreground/30" />
              <span className="text-[11px] font-medium text-foreground tabular-nums">
                {step.percentage.toFixed(0)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}