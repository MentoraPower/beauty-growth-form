import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  PieChart, 
  Users, 
  TrendingUp, 
  Target, 
  List, 
  Tag, 
  Filter,
  Database,
  ChevronRight
} from "lucide-react";
import { DataSource, OverviewCard } from "./types";
import { cn } from "@/lib/utils";

interface DataSourcePanelProps {
  open: boolean;
  onClose: () => void;
  card: OverviewCard | null;
  onSelectDataSource: (cardId: string, dataSource: DataSource) => void;
}

const DATA_SOURCES: Array<{
  id: DataSource;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}> = [
  {
    id: "total_leads",
    title: "Total de Leads",
    description: "Número total de leads no CRM",
    icon: Users,
    category: "Métricas",
  },
  {
    id: "leads_by_pipeline",
    title: "Leads por Pipeline",
    description: "Distribuição de leads por pipeline",
    icon: PieChart,
    category: "Distribuição",
  },
  {
    id: "leads_over_time",
    title: "Leads ao Longo do Tempo",
    description: "Evolução de leads por período",
    icon: TrendingUp,
    category: "Tendências",
  },
  {
    id: "leads_by_mql",
    title: "MQL vs Não-MQL",
    description: "Proporção de leads qualificados",
    icon: Target,
    category: "Qualificação",
  },
  {
    id: "recent_leads",
    title: "Leads Recentes",
    description: "Lista dos últimos leads adicionados",
    icon: List,
    category: "Listas",
  },
  {
    id: "leads_by_tag",
    title: "Leads por Tag",
    description: "Distribuição de leads por tags",
    icon: Tag,
    category: "Distribuição",
  },
  {
    id: "conversion_rate",
    title: "Funil de Conversão",
    description: "Progressão dos leads pelos pipelines",
    icon: Filter,
    category: "Conversão",
  },
];

export function DataSourcePanel({ open, onClose, card, onSelectDataSource }: DataSourcePanelProps) {
  if (!card) return null;

  const handleSelect = (dataSource: DataSource) => {
    onSelectDataSource(card.id, dataSource);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Fonte de dados
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Selecione uma fonte de dados para o cartão "{card.title}"
          </p>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="p-6 space-y-2">
            {DATA_SOURCES.map((source) => {
              const Icon = source.icon;
              const isSelected = card.dataSource === source.id;
              
              return (
                <button
                  key={source.id}
                  onClick={() => handleSelect(source.id)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left group",
                    isSelected 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    isSelected ? "bg-primary/10" : "bg-muted group-hover:bg-primary/10"
                  )}>
                    <Icon className={cn(
                      "h-5 w-5 transition-colors",
                      isSelected ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                    )} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-medium text-sm",
                        isSelected ? "text-primary" : "text-foreground"
                      )}>
                        {source.title}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {source.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {source.description}
                    </p>
                  </div>

                  <ChevronRight className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isSelected ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                  )} />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
