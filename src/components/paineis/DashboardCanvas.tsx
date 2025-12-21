import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, Link2, X, Trash2, GripVertical } from "lucide-react";
import { ChartSelectorDialog, ChartType } from "./ChartSelectorDialog";
import { ConnectSourceDialog, WidgetSource } from "./ConnectSourceDialog";
import { ResizableWidget } from "./ResizableWidget";
import { ChartRenderer } from "./ChartRenderer";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface WidgetData {
  total: number;
  label: string;
  distribution?: ChartDataPoint[];
  trend?: ChartDataPoint[];
}

export interface DashboardWidget {
  id: string;
  chartType: ChartType;
  source: WidgetSource | null;
  isConnected: boolean;
  data?: WidgetData;
  isLoading?: boolean;
  width?: number;
  height?: number;
}

interface DashboardCanvasProps {
  painelName: string;
  onBack: () => void;
}

const PIPELINE_COLORS = ["#171717", "#404040", "#737373", "#a3a3a3", "#d4d4d4"];

interface SortableWidgetProps {
  widget: DashboardWidget;
  onResize: (id: string, width: number, height: number) => void;
  onDelete: (id: string) => void;
  onConnect: (id: string) => void;
}

function SortableWidget({ widget, onResize, onDelete, onConnect }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ResizableWidget
        initialWidth={widget.width || 340}
        initialHeight={widget.height || 280}
        minWidth={260}
        minHeight={220}
        maxWidth={3000}
        maxHeight={1200}
        onResize={(w, h) => onResize(widget.id, w, h)}
        className={`bg-white border border-border rounded-xl shadow-sm ${isDragging ? 'shadow-lg ring-2 ring-primary/20' : 'hover:shadow-md'}`}
      >
        <div className="relative h-full p-4 flex flex-col">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 p-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-muted z-20"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Connect Overlay */}
          {!widget.isConnected && (
            <button
              onClick={() => onConnect(widget.id)}
              className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 rounded-xl hover:bg-white focus:outline-none z-10"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-muted">
                <Link2 className="h-6 w-6 text-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground">
                Conectar fonte de dados
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                Clique para vincular uma origem
              </span>
            </button>
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-3 shrink-0 pl-8">
            <h3 className="text-sm font-medium text-foreground truncate">
              {widget.source?.sourceName || widget.chartType.name}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onDelete(widget.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 group"
                title="Remover widget"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-red-500" />
              </button>
            </div>
          </div>
          
          {/* Chart */}
          <div className={`flex-1 min-h-0 relative ${!widget.isConnected ? "opacity-30" : ""}`}>
            <ChartRenderer
              chartType={widget.chartType.id}
              data={widget.data}
              width={widget.width || 340}
              height={(widget.height || 280) - 60}
              isLoading={widget.isLoading}
            />
          </div>
        </div>
      </ResizableWidget>
    </div>
  );
}

export function DashboardCanvas({ painelName, onBack }: DashboardCanvasProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [isChartSelectorOpen, setIsChartSelectorOpen] = useState(false);
  const [isConnectSourceOpen, setIsConnectSourceOpen] = useState(false);
  const [selectedChart, setSelectedChart] = useState<ChartType | null>(null);
  const [pendingWidgetId, setPendingWidgetId] = useState<string | null>(null);
  const widgetsRef = useRef<DashboardWidget[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  const fetchWidgetData = useCallback(async (widget: DashboardWidget): Promise<WidgetData | null> => {
    if (!widget.source || !widget.source.sourceId) return null;

    try {
      let subOriginIds: string[] = [];

      if (widget.source.type === 'sub_origin') {
        subOriginIds = [widget.source.sourceId];
      } else if (widget.source.type === 'origin') {
        const { data: subOrigins } = await supabase
          .from("crm_sub_origins")
          .select("id")
          .eq("origin_id", widget.source.sourceId);
        
        if (subOrigins && subOrigins.length > 0) {
          subOriginIds = subOrigins.map(so => so.id);
        } else {
          return { total: 0, label: "Leads" };
        }
      }

      // Fetch leads with pipeline info - remove default 1000 limit
      let allLeads: { id: string; pipeline_id: string | null; created_at: string }[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: leads, error } = await supabase
          .from("leads")
          .select("id, pipeline_id, created_at")
          .in("sub_origin_id", subOriginIds)
          .range(from, from + pageSize - 1);

        if (error) {
          console.error("Error fetching leads:", error);
          return { total: 0, label: "Leads" };
        }

        if (leads && leads.length > 0) {
          allLeads = [...allLeads, ...leads];
          from += pageSize;
          hasMore = leads.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const leads = allLeads;

      const total = leads?.length || 0;

      // Fetch pipelines for distribution
      const { data: pipelines } = await supabase
        .from("pipelines")
        .select("id, nome, cor")
        .in("sub_origin_id", subOriginIds)
        .order("ordem");

      // Calculate distribution by pipeline
      const distribution: ChartDataPoint[] = [];
      
      if (pipelines && pipelines.length > 0) {
        pipelines.forEach((pipeline, index) => {
          const count = leads?.filter(l => l.pipeline_id === pipeline.id).length || 0;
          if (count > 0) {
            distribution.push({
              name: pipeline.nome,
              value: count,
              color: PIPELINE_COLORS[index % PIPELINE_COLORS.length],
            });
          }
        });

        // Add "Sem pipeline" if there are leads without pipeline
        const withoutPipeline = leads?.filter(l => !l.pipeline_id).length || 0;
        if (withoutPipeline > 0) {
          distribution.push({
            name: "Sem etapa",
            value: withoutPipeline,
            color: "#e5e5e5",
          });
        }
      } else {
        // If no pipelines, just show total
        distribution.push({
          name: "Leads",
          value: total,
          color: "#171717",
        });
      }

      // Calculate trend by day (last 7 days)
      const trend: ChartDataPoint[] = [];
      const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const today = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date.setHours(0, 0, 0, 0));
        const dayEnd = new Date(date.setHours(23, 59, 59, 999));
        
        const count = leads?.filter(l => {
          const createdAt = new Date(l.created_at);
          return createdAt >= dayStart && createdAt <= dayEnd;
        }).length || 0;

        trend.push({
          name: days[dayStart.getDay()],
          value: count,
        });
      }

      return { total, label: "Leads", distribution, trend };
    } catch (error) {
      console.error("Error fetching widget data:", error);
      return { total: 0, label: "Leads" };
    }
  }, []);

  // Refresh all connected widgets
  const refreshAllWidgets = useCallback(async () => {
    const currentWidgets = widgetsRef.current;
    const connectedWidgets = currentWidgets.filter(w => w.isConnected && w.source);
    
    for (const widget of connectedWidgets) {
      const data = await fetchWidgetData(widget);
      setWidgets(prev => prev.map(w => 
        w.id === widget.id ? { ...w, data: data || undefined } : w
      ));
    }
  }, [fetchWidgetData]);

  // Real-time subscription for leads changes
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-leads-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads'
        },
        () => {
          // Refresh all widgets when leads change
          refreshAllWidgets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshAllWidgets]);

  const handleSelectChart = (chart: ChartType) => {
    setSelectedChart(chart);
    setIsChartSelectorOpen(false);
    
    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      chartType: chart,
      source: null,
      isConnected: false,
      width: 340,
      height: 280,
    };
    setWidgets(prev => [...prev, newWidget]);
    
    setPendingWidgetId(newWidget.id);
    setIsConnectSourceOpen(true);
  };

  const handleConnectSource = async (source: WidgetSource) => {
    if (pendingWidgetId) {
      const widgetToUpdate = widgets.find(w => w.id === pendingWidgetId);
      if (!widgetToUpdate) {
        setPendingWidgetId(null);
        return;
      }

      // First set loading state
      setWidgets(prev => prev.map(widget => 
        widget.id === pendingWidgetId 
          ? { ...widget, source, isConnected: true, isLoading: true }
          : widget
      ));

      // Create temp widget with source to fetch data
      const tempWidget: DashboardWidget = { 
        ...widgetToUpdate, 
        source, 
        isConnected: true 
      };
      const data = await fetchWidgetData(tempWidget);
      
      // Update with fetched data
      setWidgets(prev => prev.map(widget => 
        widget.id === pendingWidgetId 
          ? { ...widget, source, isConnected: true, data: data || undefined, isLoading: false }
          : widget
      ));

      setPendingWidgetId(null);
    }
  };

  const handleConnectWidget = (widgetId: string) => {
    const widget = widgets.find(w => w.id === widgetId);
    if (widget) {
      setSelectedChart(widget.chartType);
      setPendingWidgetId(widgetId);
      setIsConnectSourceOpen(true);
    }
  };

  const handleDeleteWidget = (widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  };

  const handleWidgetResize = (widgetId: string, width: number, height: number) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, width, height } : w
    ));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setWidgets(prev => {
        const oldIndex = prev.findIndex(w => w.id === active.id);
        const newIndex = prev.findIndex(w => w.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-foreground">
          {painelName}
        </h1>
        <button
          onClick={onBack}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-auto">
        {widgets.length === 0 ? (
          /* Empty State */
          <div className="flex justify-center pt-16">
            <button
              onClick={() => setIsChartSelectorOpen(true)}
              className="group flex flex-col items-center justify-center w-80 h-48 border-2 border-dashed border-border rounded-2xl hover:border-foreground/30 hover:bg-muted/30 focus:outline-none"
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-muted group-hover:bg-muted/80">
                <Plus className="h-8 w-8 text-muted-foreground group-hover:text-foreground" />
              </div>
              <span className="text-base font-medium text-muted-foreground group-hover:text-foreground">
                Criar dashboard
              </span>
            </button>
          </div>
        ) : (
          /* Dashboard with Draggable Widgets */
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
              <div className="flex flex-wrap gap-4 p-1">
                {widgets.map((widget) => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    onResize={handleWidgetResize}
                    onDelete={handleDeleteWidget}
                    onConnect={handleConnectWidget}
                  />
                ))}

                {/* Add More Button */}
                <button
                  onClick={() => setIsChartSelectorOpen(true)}
                  className="flex flex-col items-center justify-center w-[260px] h-[220px] border-2 border-dashed border-border rounded-xl hover:border-foreground/30 hover:bg-muted/30 focus:outline-none"
                >
                  <Plus className="h-6 w-6 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Adicionar gráfico
                  </span>
                </button>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Dialogs */}
      <ChartSelectorDialog
        open={isChartSelectorOpen}
        onOpenChange={setIsChartSelectorOpen}
        onSelectChart={handleSelectChart}
      />

      <ConnectSourceDialog
        open={isConnectSourceOpen}
        onOpenChange={(open) => {
          setIsConnectSourceOpen(open);
          if (!open) setPendingWidgetId(null);
        }}
        selectedChart={selectedChart}
        onConnect={handleConnectSource}
      />
    </div>
  );
}
