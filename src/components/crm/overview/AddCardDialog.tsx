import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, TrendingUp, BarChart3, PieChart, Gauge, Hash, List, CalendarDays, Target,
  CheckCircle2, Activity, CircleDot, Percent, Table2, BarChartHorizontal, ArrowLeft, ChevronRight,
} from "lucide-react";
import { CARD_TEMPLATES, CardTemplate, DataSource } from "./types";
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

const ICON_MAP: Record<string, React.ElementType> = {
  Hash, TrendingUp, List, BarChart3, PieChart, Gauge, CheckCircle2,
  CalendarDays, Activity, CircleDot, Percent, Table2, BarChartHorizontal,
};

const DATA_SOURCE_OPTIONS: Array<{ id: DataSource; label: string; description: string }> = [
  { id: "total_leads", label: "Total de Leads", description: "Número total de leads no CRM" },
  { id: "leads_over_time", label: "Leads ao Longo do Tempo", description: "Entrada de leads por período" },
  { id: "recent_leads", label: "Leads Recentes", description: "Últimos leads adicionados" },
  { id: "leads_by_tag", label: "Leads por Tag", description: "Distribuição por tags aplicadas" },
  { id: "leads_by_utm", label: "Leads por UTM", description: "Origem de tráfego (UTM)" },
  { id: "leads_by_custom_field", label: "Campo Personalizado", description: "Agrupamento por campo custom" },
  { id: "custom_field_avg", label: "Média de Campo Numérico", description: "Score ou média numérica" },
  { id: "custom_field_fill_rate", label: "Taxa de Preenchimento", description: "Completude de dados" },
];

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
    case "donut":
      return (
        <svg viewBox="0 0 64 64" className="w-14 h-14">
          <circle cx="32" cy="32" r="22" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <circle cx="32" cy="32" r="22" fill="none" stroke="hsl(var(--primary))" strokeWidth="8"
            strokeDasharray="86 138" strokeLinecap="round" transform="rotate(-90 32 32)" />
          <circle cx="32" cy="32" r="22" fill="none" stroke="hsl(var(--chart-2))" strokeWidth="8"
            strokeDasharray="34 138" strokeDashoffset="-86" strokeLinecap="round" transform="rotate(-90 32 32)" />
          <text x="32" y="35" textAnchor="middle" className="text-[11px] font-bold fill-foreground">128</text>
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
    case "line":
      return (
        <svg viewBox="0 0 80 36" className="w-full h-10">
          <path d="M0,28 Q10,24 20,20 T40,12 T60,16 T80,6" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
          <circle cx="20" cy="20" r="2.5" fill="hsl(var(--primary))" />
          <circle cx="40" cy="12" r="2.5" fill="hsl(var(--primary))" />
          <circle cx="60" cy="16" r="2.5" fill="hsl(var(--primary))" />
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
    case "bar_horizontal":
      return (
        <svg viewBox="0 0 72 40" className="w-full h-10">
          <rect x="4" y="4" width="52" height="7" rx="2" fill="hsl(var(--primary))" />
          <rect x="4" y="14" width="38" height="7" rx="2" fill="hsl(var(--primary))" opacity="0.75" />
          <rect x="4" y="24" width="24" height="7" rx="2" fill="hsl(var(--primary))" opacity="0.5" />
        </svg>
      );
    case "number":
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-2xl font-bold text-foreground tracking-tight">247</span>
          <span className="text-[10px] font-medium text-primary">+12%</span>
        </div>
      );
    case "progress":
      return (
        <div className="flex flex-col gap-2 w-full px-2">
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: "72%" }} />
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary/60" style={{ width: "45%" }} />
            </div>
          </div>
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
    case "table":
      return (
        <div className="flex flex-col gap-1 w-full px-1">
          <div className="flex gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-muted-foreground/30" />
            <div className="h-1.5 flex-1 rounded-full bg-muted-foreground/30" />
            <div className="h-1.5 w-8 rounded-full bg-muted-foreground/30" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-muted" />
              <div className="h-1.5 flex-1 rounded-full bg-muted" />
              <div className="h-1.5 w-8 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      );
    default:
      return <div className="w-8 h-8 rounded-lg bg-muted" />;
  }
};

export function AddCardDialog({ open, onClose, onAddCard }: AddCardDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<CardTemplate | null>(null);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(null);

  const filteredTemplates = CARD_TEMPLATES.filter((template) => {
    const matchesSearch =
      template.title.toLowerCase().includes(search.toLowerCase()) ||
      template.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSelectTemplate = (template: CardTemplate) => {
    setSelectedTemplate(template);
    setSelectedDataSource(template.dataSource);
  };

  const handleConfirm = () => {
    if (!selectedTemplate) return;
    const finalTemplate = {
      ...selectedTemplate,
      dataSource: selectedDataSource || selectedTemplate.dataSource,
    };
    onAddCard(finalTemplate);
    handleReset();
  };

  const handleReset = () => {
    setSelectedTemplate(null);
    setSelectedDataSource(null);
    setSearch("");
    onClose();
  };

  const handleBack = () => {
    setSelectedTemplate(null);
    setSelectedDataSource(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleReset}>
      <DialogContent className="w-[95vw] max-w-6xl h-[90vh] max-h-[780px] p-0 gap-0 overflow-hidden bg-background border-border/40 dark:border-white/[0.08]">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-52 shrink-0 border-r border-border/30 dark:border-white/[0.06] flex flex-col">
            <div className="px-4 pt-5 pb-4">
              <h2 className="text-base font-semibold text-foreground">Adicionar cartão</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedTemplate ? "Configurar cartão" : "Escolha uma visualização"}
              </p>
            </div>

            {!selectedTemplate ? (
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
                          ? "bg-foreground/10 text-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{cat.label}</span>
                      <span className={cn(
                        "text-[11px] tabular-nums",
                        selectedCategory === cat.id ? "text-foreground/60" : "text-muted-foreground/50"
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </nav>
            ) : (
              /* Config sidebar when template is selected */
              <div className="flex-1 px-3 space-y-4">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar
                </button>

                {/* Selected template info */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border/20 dark:border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = ICON_MAP[selectedTemplate.icon] || Hash;
                      return <Icon className="h-4 w-4 text-primary" />;
                    })()}
                    <span className="text-sm font-medium text-foreground">{selectedTemplate.title}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{selectedTemplate.description}</p>
                </div>

                {/* Data source config */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fonte de dados</label>
                  <Select
                    value={selectedDataSource || ""}
                    onValueChange={(v) => setSelectedDataSource(v as DataSource)}
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue placeholder="Selecionar fonte" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border/60 dark:border-white/15">
                      {DATA_SOURCE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          <div>
                            <span>{opt.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedDataSource && (
                    <p className="text-[11px] text-muted-foreground">
                      {DATA_SOURCE_OPTIONS.find(o => o.id === selectedDataSource)?.description}
                    </p>
                  )}
                </div>

                {/* Add button */}
                <Button onClick={handleConfirm} className="w-full" size="sm">
                  Adicionar cartão
                </Button>
              </div>
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            {!selectedTemplate ? (
              <>
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

                <div className="h-px bg-border/30 dark:bg-white/[0.04]" />

                {/* Cards Grid */}
                <ScrollArea className="flex-1">
                  <div className="p-4 grid grid-cols-3 gap-3">
                    {filteredTemplates.map((template) => {
                      const Icon = ICON_MAP[template.icon] || Hash;
                      return (
                        <button
                          key={template.id}
                          onClick={() => handleSelectTemplate(template)}
                          className={cn(
                            "group relative flex flex-col rounded-xl border border-border/30 dark:border-white/[0.06]",
                            "bg-card hover:bg-muted/30 hover:border-border/60 dark:hover:border-white/[0.12]",
                            "transition-all duration-200 text-left overflow-hidden hover:shadow-md"
                          )}
                        >
                          <div className="h-28 flex items-center justify-center px-4 bg-muted/20 dark:bg-white/[0.02]">
                            <ChartPreview type={template.chartType} />
                          </div>
                          <div className="p-3 flex items-start gap-2.5 border-t border-border/20 dark:border-white/[0.04]">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                              <Icon className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-[13px] font-medium text-foreground leading-tight line-clamp-1">
                                {template.title}
                              </h4>
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                {template.description}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
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
              </>
            ) : (
              /* Config preview */
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="w-full max-w-md">
                  <div className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-card overflow-hidden">
                    <div className="h-48 flex items-center justify-center bg-muted/20 dark:bg-white/[0.02]">
                      <div className="scale-150">
                        <ChartPreview type={selectedTemplate.chartType} />
                      </div>
                    </div>
                    <div className="p-4 border-t border-border/20 dark:border-white/[0.04] text-center">
                      <h3 className="text-base font-medium text-foreground">{selectedTemplate.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{selectedTemplate.description}</p>
                      {selectedDataSource && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {DATA_SOURCE_OPTIONS.find(o => o.id === selectedDataSource)?.label}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Configure a fonte de dados no menu lateral e clique em "Adicionar cartão"
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
