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
  { id: 'meta_spend', title: 'Valor Gasto', icon: DollarSign },
  { id: 'meta_cpc', title: 'CPC', icon: MousePointer },
  { id: 'meta_cpm', title: 'CPM', icon: BarChart3 },
  { id: 'meta_results', title: 'Resultados', icon: TrendingUp },
];

const originMetrics = [
  { id: 'leads', title: 'Leads', icon: Users },
  { id: 'appointments', title: 'Agendamentos', icon: CalendarDays },
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
      <DropdownMenuContent align="start" className="w-56 bg-popover">
        {/* Sub-origens */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
            Sub-origens
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48 bg-popover">
            {origins.map((origin) => {
              const subOriginsForOrigin = getSubOriginsForOrigin(origin.id);
              
              if (subOriginsForOrigin.length === 0) {
                return (
                  <DropdownMenuItem key={origin.id} disabled className="opacity-50">
                    <Folder className="h-4 w-4 mr-2" />
                    {origin.nome} (vazio)
                  </DropdownMenuItem>
                );
              }

              return (
                <DropdownMenuSub key={origin.id}>
                  <DropdownMenuSubTrigger className="cursor-pointer">
                    <Folder className="h-4 w-4 mr-2 text-muted-foreground" />
                    {origin.nome}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-44 bg-popover">
                    {subOriginsForOrigin.map((subOrigin) => (
                      <DropdownMenuSub key={subOrigin.id}>
                        <DropdownMenuSubTrigger className="cursor-pointer">
                          <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
                          {subOrigin.nome}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-40 bg-popover">
                          {originMetrics.map((metric) => (
                            <DropdownMenuItem
                              key={metric.id}
                              className="cursor-pointer"
                              onClick={() => handleAddWidget(
                                metric.id,
                                metric.title,
                                'sub_origins',
                                subOrigin.id,
                                subOrigin.nome
                              )}
                            >
                              <metric.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                              {metric.title}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Puxar Origens */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <Folder className="h-4 w-4 mr-2 text-muted-foreground" />
            Puxar origens
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48 bg-popover">
            {origins.map((origin) => (
              <DropdownMenuSub key={origin.id}>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <Folder className="h-4 w-4 mr-2 text-muted-foreground" />
                  {origin.nome}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-40 bg-popover">
                  {originMetrics.map((metric) => (
                    <DropdownMenuItem
                      key={metric.id}
                      className="cursor-pointer"
                      onClick={() => handleAddWidget(
                        metric.id,
                        metric.title,
                        'origins',
                        origin.id,
                        origin.nome
                      )}
                    >
                      <metric.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                      {metric.title}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Conectar Campanhas */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <Megaphone className="h-4 w-4 mr-2 text-muted-foreground" />
            Conectar campanhas
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44 bg-popover">
            {campaignMetrics.map((metric) => (
              <DropdownMenuItem
                key={metric.id}
                className="cursor-pointer"
                onClick={() => handleAddWidget(metric.id, metric.title, 'campaigns')}
              >
                <metric.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                {metric.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
