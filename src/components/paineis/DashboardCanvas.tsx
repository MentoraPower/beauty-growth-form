import { useState, useCallback } from "react";
import { Plus, Link2, X, RefreshCw, Trash2 } from "lucide-react";
import { ChartSelectorDialog, ChartType } from "./ChartSelectorDialog";
import { ConnectSourceDialog, WidgetSource } from "./ConnectSourceDialog";
import { ResizableWidget } from "./ResizableWidget";
import { ChartRenderer } from "./ChartRenderer";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardWidget {
  id: string;
  chartType: ChartType;
  source: WidgetSource | null;
  isConnected: boolean;
  data?: {
    value: number;
    label: string;
  };
  isLoading?: boolean;
  width?: number;
  height?: number;
}

interface DashboardCanvasProps {
  painelName: string;
  onBack: () => void;
}

export function DashboardCanvas({ painelName, onBack }: DashboardCanvasProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [isChartSelectorOpen, setIsChartSelectorOpen] = useState(false);
  const [isConnectSourceOpen, setIsConnectSourceOpen] = useState(false);
  const [selectedChart, setSelectedChart] = useState<ChartType | null>(null);
  const [pendingWidgetId, setPendingWidgetId] = useState<string | null>(null);

  const fetchWidgetData = useCallback(async (widget: DashboardWidget) => {
    if (!widget.source || !widget.source.sourceId) return null;

    try {
      let query = supabase.from("leads").select("id", { count: "exact", head: true });

      if (widget.source.type === 'sub_origin') {
        query = query.eq("sub_origin_id", widget.source.sourceId);
      } else if (widget.source.type === 'origin') {
        const { data: subOrigins } = await supabase
          .from("crm_sub_origins")
          .select("id")
          .eq("origin_id", widget.source.sourceId);
        
        if (subOrigins && subOrigins.length > 0) {
          const subOriginIds = subOrigins.map(so => so.id);
          query = query.in("sub_origin_id", subOriginIds);
        } else {
          return { value: 0, label: "Leads" };
        }
      }

      const { count, error } = await query;

      if (error) {
        console.error("Error fetching leads:", error);
        return { value: 0, label: "Leads" };
      }

      return { value: count || 0, label: "Leads" };
    } catch (error) {
      console.error("Error fetching widget data:", error);
      return { value: 0, label: "Leads" };
    }
  }, []);

  const refreshWidgetData = useCallback(async (widgetId: string) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, isLoading: true } : w
    ));

    const widget = widgets.find(w => w.id === widgetId);
    if (widget) {
      const data = await fetchWidgetData(widget);
      setWidgets(prev => prev.map(w => 
        w.id === widgetId ? { ...w, data: data || undefined, isLoading: false } : w
      ));
    }
  }, [widgets, fetchWidgetData]);

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
      setWidgets(prev => prev.map(widget => 
        widget.id === pendingWidgetId 
          ? { ...widget, source, isConnected: true, isLoading: true }
          : widget
      ));

      const widgetToUpdate = widgets.find(w => w.id === pendingWidgetId);
      if (widgetToUpdate) {
        const tempWidget = { ...widgetToUpdate, source, isConnected: true };
        const data = await fetchWidgetData(tempWidget);
        
        setWidgets(prev => prev.map(widget => 
          widget.id === pendingWidgetId 
            ? { ...widget, source, isConnected: true, data: data || undefined, isLoading: false }
            : widget
        ));
      }

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
              className="group flex flex-col items-center justify-center w-80 h-48 border-2 border-dashed border-border rounded-2xl transition-all duration-200 hover:border-foreground/30 hover:bg-muted/30 focus:outline-none"
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-muted group-hover:bg-muted/80 transition-colors">
                <Plus className="h-8 w-8 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <span className="text-base font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Criar dashboard
              </span>
            </button>
          </div>
        ) : (
          /* Dashboard with Resizable Widgets */
          <div className="flex flex-wrap gap-4 p-1">
            {widgets.map((widget) => (
              <ResizableWidget
                key={widget.id}
                initialWidth={widget.width || 340}
                initialHeight={widget.height || 280}
                minWidth={260}
                minHeight={220}
                maxWidth={700}
                maxHeight={550}
                onResize={(w, h) => handleWidgetResize(widget.id, w, h)}
                className="bg-white border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="relative h-full p-4 flex flex-col">
                  {/* Connect Overlay */}
                  {!widget.isConnected && (
                    <button
                      onClick={() => handleConnectWidget(widget.id)}
                      className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 rounded-xl transition-all hover:bg-white focus:outline-none z-10"
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
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <widget.chartType.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <h3 className="text-sm font-medium text-foreground truncate">
                        {widget.source?.sourceName || widget.chartType.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {widget.isConnected && (
                        <button
                          onClick={() => refreshWidgetData(widget.id)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                          title="Atualizar dados"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${widget.isLoading ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteWidget(widget.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors group"
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
                      value={widget.data?.value || 0}
                      label={widget.data?.label || "Leads"}
                      width={widget.width || 340}
                      height={(widget.height || 280) - 60}
                      isLoading={widget.isLoading}
                    />
                  </div>
                </div>
              </ResizableWidget>
            ))}

            {/* Add More Button */}
            <button
              onClick={() => setIsChartSelectorOpen(true)}
              className="flex flex-col items-center justify-center w-[260px] h-[220px] border-2 border-dashed border-border rounded-xl transition-all duration-200 hover:border-foreground/30 hover:bg-muted/30 focus:outline-none"
            >
              <Plus className="h-6 w-6 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">
                Adicionar gráfico
              </span>
            </button>
          </div>
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
