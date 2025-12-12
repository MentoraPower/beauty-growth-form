import { cn } from "@/lib/utils";

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
    <div className="space-y-2">
      {data.map((step, index) => {
        const widthPercentage = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
        const dropRate = index > 0 && data[index - 1].count > 0 
          ? ((data[index - 1].count - step.count) / data[index - 1].count * 100).toFixed(1)
          : null;
        
        return (
          <div key={step.label} className="relative">
            <div className="flex items-center gap-3">
              {/* Step number */}
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#F40000] to-[#A10000] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                {index + 1}
              </div>
              
              {/* Bar container */}
              <div className="flex-1 relative">
                {/* Background bar */}
                <div className="h-8 bg-muted/40 rounded-lg overflow-hidden">
                  {/* Filled bar */}
                  <div 
                    className="h-full bg-gradient-to-r from-[#F40000]/80 to-[#A10000]/60 rounded-lg transition-all duration-500 ease-out flex items-center"
                    style={{ width: `${Math.max(widthPercentage, 8)}%` }}
                  >
                    <span className="text-white text-xs font-semibold px-3 whitespace-nowrap">
                      {step.count}
                    </span>
                  </div>
                </div>
                
                {/* Label below */}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {step.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {step.percentage.toFixed(1)}%
                    </span>
                    {dropRate !== null && Number(dropRate) > 0 && (
                      <span className="text-[10px] text-rose-500">
                        -{dropRate}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
