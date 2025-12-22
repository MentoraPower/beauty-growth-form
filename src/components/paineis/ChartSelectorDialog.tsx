import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PieChart, BarChart3, TrendingUp, AreaChart, Activity, Target, AlignLeft } from "lucide-react";

export interface ChartType {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  preview: React.ReactNode;
}

const chartTypes: ChartType[] = [
  {
    id: 'pie',
    name: 'Gráfico de Pizza',
    description: 'Ideal para mostrar proporções e distribuições',
    icon: PieChart,
    preview: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="20" />
        <circle 
          cx="50" cy="50" r="40" fill="none" 
          stroke="hsl(var(--foreground))" strokeWidth="20"
          strokeDasharray="125.6 251.2" 
          transform="rotate(-90 50 50)"
        />
        <circle 
          cx="50" cy="50" r="40" fill="none" 
          stroke="hsl(var(--muted-foreground))" strokeWidth="20"
          strokeDasharray="62.8 251.2" 
          strokeDashoffset="-125.6"
          transform="rotate(-90 50 50)"
        />
      </svg>
    ),
  },
  {
    id: 'bar',
    name: 'Gráfico de Barras',
    description: 'Compare valores entre diferentes categorias',
    icon: BarChart3,
    preview: (
      <svg viewBox="0 0 100 80" className="w-full h-full">
        <rect x="10" y="50" width="15" height="25" rx="2" fill="hsl(var(--muted))" />
        <rect x="30" y="30" width="15" height="45" rx="2" fill="hsl(var(--muted-foreground))" />
        <rect x="50" y="15" width="15" height="60" rx="2" fill="hsl(var(--foreground))" />
        <rect x="70" y="35" width="15" height="40" rx="2" fill="hsl(var(--muted-foreground))" />
      </svg>
    ),
  },
  {
    id: 'bar_horizontal',
    name: 'Barras Horizontais',
    description: 'Ideal para comparar respostas e categorias',
    icon: AlignLeft,
    preview: (
      <svg viewBox="0 0 100 80" className="w-full h-full">
        <rect x="5" y="10" width="80" height="12" rx="2" fill="hsl(var(--foreground))" />
        <rect x="5" y="27" width="55" height="12" rx="2" fill="hsl(var(--muted-foreground))" />
        <rect x="5" y="44" width="70" height="12" rx="2" fill="hsl(var(--muted))" />
        <rect x="5" y="61" width="40" height="12" rx="2" fill="hsl(var(--muted-foreground))" />
      </svg>
    ),
  },
  {
    id: 'line',
    name: 'Gráfico de Linha',
    description: 'Acompanhe tendências ao longo do tempo',
    icon: TrendingUp,
    preview: (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <polyline 
          points="5,50 25,35 45,40 65,20 95,10" 
          fill="none" 
          stroke="hsl(var(--foreground))" 
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="5" cy="50" r="4" fill="hsl(var(--foreground))" />
        <circle cx="25" cy="35" r="4" fill="hsl(var(--foreground))" />
        <circle cx="45" cy="40" r="4" fill="hsl(var(--foreground))" />
        <circle cx="65" cy="20" r="4" fill="hsl(var(--foreground))" />
        <circle cx="95" cy="10" r="4" fill="hsl(var(--foreground))" />
      </svg>
    ),
  },
  {
    id: 'area',
    name: 'Gráfico de Área',
    description: 'Visualize volumes e tendências acumuladas',
    icon: AreaChart,
    preview: (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path 
          d="M5,55 L5,45 Q25,30 45,35 T95,15 L95,55 Z" 
          fill="url(#areaGradient)"
        />
        <path 
          d="M5,45 Q25,30 45,35 T95,15" 
          fill="none" 
          stroke="hsl(var(--foreground))" 
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    id: 'gauge',
    name: 'Medidor (Gauge)',
    description: 'Mostre progresso ou status de metas',
    icon: Target,
    preview: (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <path 
          d="M10,55 A40,40 0 0,1 90,55" 
          fill="none" 
          stroke="hsl(var(--muted))" 
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path 
          d="M10,55 A40,40 0 0,1 65,20" 
          fill="none" 
          stroke="hsl(var(--foreground))" 
          strokeWidth="8"
          strokeLinecap="round"
        />
        <text x="50" y="50" textAnchor="middle" fontSize="14" fontWeight="bold" fill="hsl(var(--foreground))">75%</text>
      </svg>
    ),
  },
  {
    id: 'kpi',
    name: 'Indicador KPI',
    description: 'Destaque métricas importantes com variação',
    icon: Activity,
    preview: (
      <div className="flex flex-col items-center justify-center h-full">
        <span className="text-2xl font-bold text-foreground">2.847</span>
        <span className="text-xs text-green-500 font-medium">+12.5%</span>
      </div>
    ),
  },
];

interface ChartSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectChart: (chart: ChartType) => void;
}

export function ChartSelectorDialog({ open, onOpenChange, onSelectChart }: ChartSelectorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl border-0 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-center">
            Escolha um tipo de gráfico
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-center">
            Selecione o tipo de visualização para seu dashboard
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-6">
          {chartTypes.map((chart) => (
            <button
              key={chart.id}
              onClick={() => onSelectChart(chart)}
              className="group flex flex-col bg-white border border-border rounded-xl p-4 text-left transition-all duration-200 hover:shadow-lg hover:border-foreground/20 focus:outline-none"
            >
              {/* Chart Preview */}
              <div className="w-full h-28 mb-4 p-3 bg-muted/30 rounded-lg flex items-center justify-center">
                {chart.preview}
              </div>

              {/* Chart Info */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <chart.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-foreground mb-0.5 truncate">
                    {chart.name}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {chart.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
