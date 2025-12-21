import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { 
  Folder, 
  FolderOpen, 
  Users, 
  CalendarDays, 
  Megaphone,
  DollarSign, 
  MousePointer, 
  BarChart3, 
  TrendingUp 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SubOrigin {
  id: string;
  nome: string;
  origin_id: string;
}

interface Origin {
  id: string;
  nome: string;
}

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  isConnected: boolean;
  category: 'sub_origins' | 'origins' | 'campaigns';
  sourceId?: string;
  sourceName?: string;
}

interface AddWidgetDropdownProps {
  children: React.ReactNode;
  onAddWidget: (widget: DashboardWidget) => void;
}

const campaignMetrics = [
  { id: 'meta_spend', title: 'Valor Gasto', description: 'Gasto total em campanhas', icon: DollarSign },
  { id: 'meta_cpc', title: 'CPC', description: 'Custo por clique', icon: MousePointer },
  { id: 'meta_cpm', title: 'CPM', description: 'Custo por mil impressões', icon: BarChart3 },
  { id: 'meta_results', title: 'Resultados', description: 'Conversões em tempo real', icon: TrendingUp },
];

const originMetrics = [
  { id: 'leads', title: 'Leads', description: 'Total de leads', icon: Users },
  { id: 'appointments', title: 'Agendamentos', description: 'Agendamentos marcados', icon: CalendarDays },
];

export function AddWidgetDropdown({ children, onAddWidget }: AddWidgetDropdownProps) {
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [subOrigins, setSubOrigins] = useState<SubOrigin[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      const [originsRes, subOriginsRes] = await Promise.all([
        supabase.from("crm_origins").select("*").order("ordem"),
        supabase.from("crm_sub_origins").select("*").order("ordem"),
      ]);

      if (originsRes.data) setOrigins(originsRes.data);
      if (subOriginsRes.data) setSubOrigins(subOriginsRes.data);
    };

    fetchData();
  }, [isOpen]);

  const getSubOriginsForOrigin = (originId: string) => {
    return subOrigins.filter((so) => so.origin_id === originId);
  };

  const handleAddWidget = (
    type: string,
    title: string,
    category: 'sub_origins' | 'origins' | 'campaigns',
    sourceId?: string,
    sourceName?: string
  ) => {
    const widget: DashboardWidget = {
      id: `${type}-${Date.now()}`,
      type,
      title: sourceName ? `${title} - ${sourceName}` : title,
      isConnected: false,
      category,
      sourceId,
      sourceName,
    };
    onAddWidget(widget);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 bg-popover p-2">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 pb-2">
          Escolha uma fonte de dados
        </DropdownMenuLabel>

        {/* Sub-origens */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer py-3 px-3 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Sub-origens</span>
                <span className="text-xs text-muted-foreground">Dados por sub-origem do CRM</span>
              </div>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 bg-popover p-1">
            {origins.length === 0 ? (
              <DropdownMenuItem disabled className="text-muted-foreground text-sm">
                Nenhuma origem encontrada
              </DropdownMenuItem>
            ) : (
              origins.map((origin) => {
                const subOriginsForOrigin = getSubOriginsForOrigin(origin.id);
                
                if (subOriginsForOrigin.length === 0) {
                  return (
                    <DropdownMenuItem key={origin.id} disabled className="opacity-50 py-2">
                      <Folder className="h-4 w-4 mr-2" />
                      {origin.nome} (vazio)
                    </DropdownMenuItem>
                  );
                }

                return (
                  <DropdownMenuSub key={origin.id}>
                    <DropdownMenuSubTrigger className="cursor-pointer py-2">
                      <Folder className="h-4 w-4 mr-2 text-muted-foreground" />
                      {origin.nome}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-52 bg-popover p-1">
                      {subOriginsForOrigin.map((subOrigin) => (
                        <DropdownMenuSub key={subOrigin.id}>
                          <DropdownMenuSubTrigger className="cursor-pointer py-2">
                            <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
                            {subOrigin.nome}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-52 bg-popover p-1">
                            {originMetrics.map((metric) => (
                              <DropdownMenuItem
                                key={metric.id}
                                className="cursor-pointer py-2.5 px-3"
                                onClick={() => handleAddWidget(
                                  metric.id,
                                  metric.title,
                                  'sub_origins',
                                  subOrigin.id,
                                  subOrigin.nome
                                )}
                              >
                                <metric.icon className="h-4 w-4 mr-3 text-muted-foreground" />
                                <div className="flex flex-col">
                                  <span className="text-sm">{metric.title}</span>
                                  <span className="text-xs text-muted-foreground">{metric.description}</span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                );
              })
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Puxar Origens */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer py-3 px-3 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Folder className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Puxar origens</span>
                <span className="text-xs text-muted-foreground">Dados agregados por origem</span>
              </div>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 bg-popover p-1">
            {origins.length === 0 ? (
              <DropdownMenuItem disabled className="text-muted-foreground text-sm">
                Nenhuma origem encontrada
              </DropdownMenuItem>
            ) : (
              origins.map((origin) => (
                <DropdownMenuSub key={origin.id}>
                  <DropdownMenuSubTrigger className="cursor-pointer py-2">
                    <Folder className="h-4 w-4 mr-2 text-muted-foreground" />
                    {origin.nome}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52 bg-popover p-1">
                    {originMetrics.map((metric) => (
                      <DropdownMenuItem
                        key={metric.id}
                        className="cursor-pointer py-2.5 px-3"
                        onClick={() => handleAddWidget(
                          metric.id,
                          metric.title,
                          'origins',
                          origin.id,
                          origin.nome
                        )}
                      >
                        <metric.icon className="h-4 w-4 mr-3 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="text-sm">{metric.title}</span>
                          <span className="text-xs text-muted-foreground">{metric.description}</span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="my-2" />

        {/* Conectar Campanhas */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer py-3 px-3 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Megaphone className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Conectar campanhas</span>
                <span className="text-xs text-muted-foreground">Métricas do Meta Ads</span>
              </div>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 bg-popover p-1">
            {campaignMetrics.map((metric) => (
              <DropdownMenuItem
                key={metric.id}
                className="cursor-pointer py-2.5 px-3"
                onClick={() => handleAddWidget(metric.id, metric.title, 'campaigns')}
              >
                <metric.icon className="h-4 w-4 mr-3 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm">{metric.title}</span>
                  <span className="text-xs text-muted-foreground">{metric.description}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
