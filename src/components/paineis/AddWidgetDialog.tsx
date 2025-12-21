import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, CalendarDays, TrendingUp, DollarSign, MousePointer, BarChart3 } from "lucide-react";

interface WidgetOption {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: 'origins' | 'campaigns';
}

const widgetOptions: WidgetOption[] = [
  {
    id: 'leads',
    title: 'Leads',
    description: 'Puxar leads das origens do CRM',
    icon: Users,
    category: 'origins',
  },
  {
    id: 'appointments',
    title: 'Agendamentos',
    description: 'Puxar agendamentos das origens',
    icon: CalendarDays,
    category: 'origins',
  },
  {
    id: 'meta_spend',
    title: 'Valor Gasto',
    description: 'Valor gasto em campanhas Meta Ads',
    icon: DollarSign,
    category: 'campaigns',
  },
  {
    id: 'meta_cpc',
    title: 'CPC',
    description: 'Custo por clique do Meta Ads',
    icon: MousePointer,
    category: 'campaigns',
  },
  {
    id: 'meta_cpm',
    title: 'CPM',
    description: 'Custo por mil impressões',
    icon: BarChart3,
    category: 'campaigns',
  },
  {
    id: 'meta_results',
    title: 'Resultados',
    description: 'Resultados das campanhas em tempo real',
    icon: TrendingUp,
    category: 'campaigns',
  },
];

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  isConnected: boolean;
  category: 'origins' | 'campaigns';
}

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddWidget: (widget: DashboardWidget) => void;
}

export function AddWidgetDialog({ open, onOpenChange, onAddWidget }: AddWidgetDialogProps) {
  const [activeTab, setActiveTab] = useState<'origins' | 'campaigns'>('origins');

  const handleSelectWidget = (option: WidgetOption) => {
    const widget: DashboardWidget = {
      id: `${option.id}-${Date.now()}`,
      type: option.id,
      title: option.title,
      isConnected: false,
      category: option.category,
    };
    onAddWidget(widget);
    onOpenChange(false);
  };

  const filteredOptions = widgetOptions.filter(opt => opt.category === activeTab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Adicionar ao Dashboard
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setActiveTab('origins')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
                activeTab === 'origins'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Puxar Origens
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
                activeTab === 'campaigns'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Conectar Campanhas
            </button>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground">
            {activeTab === 'origins'
              ? 'Conecte dados de leads e agendamentos das origens do CRM'
              : 'Conecte métricas em tempo real do Meta Ads'}
          </p>

          {/* Options Grid */}
          <div className="grid grid-cols-2 gap-3">
            {filteredOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelectWidget(option)}
                className="flex flex-col items-start p-4 bg-white border border-border rounded-xl text-left transition-all duration-200 hover:shadow-md hover:border-primary/30 focus:outline-none"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-muted">
                  <option.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <h4 className="text-sm font-medium text-foreground mb-0.5">
                  {option.title}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
