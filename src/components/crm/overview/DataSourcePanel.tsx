import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Fonte de dados
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Selecione uma fonte de dados para o cartão "{card.title}"
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="p-6 grid grid-cols-2 gap-3">
            {DATA_SOURCES.map((source) => {
              const Icon = source.icon;
              const isSelected = card.dataSource === source.id;
              
              return (
                <button
                  key={source.id}
                  onClick={() => handleSelect(source.id)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border transition-all text-left group",
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
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {source.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
