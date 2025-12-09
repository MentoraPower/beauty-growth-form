interface MiniGaugeChartProps {
  value: number;
  maxValue: number;
  label: string;
}

const MiniGaugeChart = ({ value, maxValue, label }: MiniGaugeChartProps) => {
  const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  const angle = (percentage / 100) * 180;
  const uniqueId = `miniGauge-${label.replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-background rounded-xl">
      <div className="relative w-16 h-8">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 50"
          preserveAspectRatio="xMidYMax meet"
        >
          {/* Background track */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={`url(#${uniqueId})`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 125.66} 125.66`}
          />
          <defs>
            <linearGradient id={uniqueId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--primary-dark))" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex items-end justify-center pb-0">
          <span className="text-lg font-bold text-foreground">{value}</span>
        </div>
      </div>
      
      <p className="text-[10px] text-muted-foreground mt-1.5 text-center leading-tight line-clamp-2 max-w-[80px]">
        {label}
      </p>
    </div>
  );
};

export default MiniGaugeChart;
