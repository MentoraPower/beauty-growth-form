import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, TrendingUp, BarChart3, PieChart, Gauge, Hash, List, CalendarDays, Target, CheckCircle2, Link2, Settings2 } from "lucide-react";
import { CARD_TEMPLATES, CardTemplate } from "./types";
import { cn } from "@/lib/utils";

interface AddCardDialogProps {
  open: boolean;
  onClose: () => void;
  onAddCard: (template: CardTemplate) => void;
}

const CATEGORIES = [
  { id: "all", label: "Todos", icon: Target },
  { id: "featured", label: "Destaques", icon: TrendingUp },
  { id: "charts", label: "Gráficos", icon: BarChart3 },
  { id: "metrics", label: "Métricas", icon: Hash },
  { id: "lists", label: "Listas", icon: List },
];

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  "total_leads": Hash,
  "leads_over_time": TrendingUp,
  "recent_leads": List,
  "leads_by_tag": BarChart3,
  "leads_by_utm": Link2,
  "leads_by_custom_field": Settings2,
  "custom_field_pie": PieChart,
  "custom_field_avg": Gauge,
  "custom_field_fill_rate": CheckCircle2,
  "leads_heatmap": CalendarDays,
};

const ChartPreview = ({ type }: { type: string }) => {
  switch (type) {
    case "pie":
      return (
        <svg viewBox="0 0 64 64" className="w-14 h-14">
          <circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          <circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--primary))" strokeWidth="10"
            strokeDasharray="102 163" strokeLinecap="round" transform="rotate(-90 32 32)" />
          <circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--chart-2))" strokeWidth="10"
            strokeDasharray="40 163" strokeDashoffset="-102" strokeLinecap="round" transform="rotate(-90 32 32)" />
        </svg>
      );
    case "area":
      return (
        <svg viewBox="0 0 80 36" className="w-full h-10">
          <defs>
            <linearGradient id="addCardAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,30 Q12,26 20,22 T40,14 T60,18 T80,8 L80,36 L0,36 Z" fill="url(#addCardAreaGrad)" />
          <path d="M0,30 Q12,26 20,22 T40,14 T60,18 T80,8" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "bar":
    case "bar_vertical":
      return (
        <svg viewBox="0 0 72 36" className="w-full h-10">
          <rect x="6" y="20" width="10" height="16" rx="2" fill="hsl(var(--primary))" opacity="0.5" />
          <rect x="20" y="8" width="10" height="28" rx="2" fill="hsl(var(--primary))" opacity="0.85" />
          <rect x="34" y="14" width="10" height="22" rx="2" fill="hsl(var(--primary))" />
          <rect x="48" y="22" width="10" height="14" rx="2" fill="hsl(var(--primary))" opacity="0.6" />
        </svg>
      );
    case "number":
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-2xl font-bold text-foreground tracking-tight">247</span>
          <span className="text-[10px] font-medium text-primary">+12%</span>
        </div>
      );
    case "list":
      return (
        <div className="flex flex-col gap-1.5 w-full px-1">
          {[0.85, 0.65, 0.45].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-primary/20 shrink-0" />
              <div className="h-1.5 rounded-full bg-muted" style={{ width: `${w * 100}%` }} />
            </div>
          ))}
        </div>
      );
    case "gauge":
      return (
        <svg viewBox="0 0 64 36" className="w-14 h-8">
          <path d="M8 32 A 24 24 0 0 1 56 32" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" strokeLinecap="round" />
          <path d="M8 32 A 24 24 0 0 1 56 32" fill="none" stroke="hsl(var(--primary))" strokeWidth="6" strokeLinecap="round"
            strokeDasharray="55 75" />
          <text x="32" y="30" textAnchor="middle" className="text-[9px] font-bold fill-foreground">7.2</text>
        </svg>
      );
    case "heatmap":
      return (
        <div className="grid grid-cols-7 gap-[2px]">
          {Array.from({ length: 21 }).map((_, i) => {
            const opacity = [0.1, 0.25, 0.5, 0.75, 1][i % 5];
            return <div key={i} className="w-2 h-2 rounded-[2px] bg-primary" style={{ opacity }} />;
          })}
        </div>
      );
    default:
      return <div className="w-8 h-8 rounded-lg bg-muted" />;
  }
};

export function AddCardDialog({ open, onClose, onAddCard }: AddCardDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredTemplates = CARD_TEMPLATES.filter((template) => {
    const matchesSearch =
      template.title.toLowerCase().includes(search.toLowerCase()) ||
      template.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddCard = (template: CardTemplate) => {
    onAddCard(template);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[92vw] max-w-5xl h-[85vh] max-h-[680px] p-0 gap-0 overflow-hidden bg-background border-border/40 dark:border-white/[0.08]">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-52 shrink-0 border-r border-border/30 dark:border-white/[0.06] flex flex-col">
            <div className="px-4 pt-5 pb-4">
              <h2 className="text-base font-semibold text-foreground">Adicionar cartão</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Escolha um tipo de visualização</p>
            </div>

            <nav className="flex-1 px-2 space-y-0.5">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const count = cat.id === "all"
                  ? CARD_TEMPLATES.length
                  : CARD_TEMPLATES.filter(t => t.category === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all",
                      selectedCategory === cat.id
                        ? "bg-foreground text-background font-medium"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{cat.label}</span>
                    <span className={cn(
                      "text-[11px] tabular-nums",
                      selectedCategory === cat.id ? "text-background/60" : "text-muted-foreground/50"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Search bar */}
            <div className="px-4 pt-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar cartões..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 bg-muted/40 border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-border/30 dark:bg-white/[0.04]" />

            {/* Cards Grid */}
            <ScrollArea className="flex-1">
              <div className="p-4 grid grid-cols-3 gap-3">
                {filteredTemplates.map((template) => {
                  const Icon = TEMPLATE_ICONS[template.id] || Hash;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleAddCard(template)}
                      className={cn(
                        "group relative flex flex-col rounded-xl border border-border/30 dark:border-white/[0.06]",
                        "bg-card hover:bg-muted/30 hover:border-border/60 dark:hover:border-white/[0.12]",
                        "transition-all duration-200 text-left overflow-hidden hover:shadow-md"
                      )}
                    >
                      {/* Preview */}
                      <div className="h-28 flex items-center justify-center px-4 bg-muted/20 dark:bg-white/[0.02]">
                        <ChartPreview type={template.chartType} />
                      </div>

                      {/* Info */}
                      <div className="p-3 flex items-start gap-2.5 border-t border-border/20 dark:border-white/[0.04]">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[13px] font-medium text-foreground leading-tight line-clamp-1">
                            {template.title.replace(/^(Gráfico de |Cartão |Lista - |Pizza - |Gauge - |Numérico - |Heatmap de )/, '')}
                          </h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                            {template.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {filteredTemplates.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum cartão encontrado</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
