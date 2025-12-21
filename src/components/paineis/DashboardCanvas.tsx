import { useState, useEffect, useCallback } from "react";
import { Plus, Link2, X, RefreshCw } from "lucide-react";
import { ChartSelectorDialog, ChartType } from "./ChartSelectorDialog";
import { ConnectSourceDialog, WidgetSource } from "./ConnectSourceDialog";
import { ResizableWidget } from "./ResizableWidget";
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
      width: 280,
      height: 200,
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

  const handleWidgetResize = (widgetId: string, width: number, height: number) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, width, height } : w
    ));
  };

  const renderChartWithData = (widget: DashboardWidget) => {
    const value = widget.data?.value || 0;
    const chartHeight = (widget.height || 200) - 80; // Account for header and footer
    
    if (widget.isLoading) {
      return (
        <div className="w-full flex items-center justify-center" style={{ height: chartHeight }}>
          <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
      );
    }

    switch (widget.chartType.id) {
      case 'kpi':
        return (
          <div className="flex flex-col items-center justify-center" style={{ height: chartHeight }}>
            <span className="text-4xl font-bold text-foreground">{value.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground mt-1">{widget.data?.label || "Leads"}</span>
          </div>
        );

      case 'pie':
        const pieSize = Math.min(chartHeight - 10, (widget.width || 280) - 60);
        return (
          <div className="w-full flex items-center justify-center" style={{ height: chartHeight }}>
            <svg viewBox="0 0 100 100" style={{ width: pieSize, height: pieSize }}>
              <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="16" />
              <circle 
                cx="50" cy="50" r="40" fill="none" 
                stroke="hsl(var(--foreground))" strokeWidth="16"
                strokeDasharray={`${Math.min(value * 2.51, 251.2)} 251.2`}
                transform="rotate(-90 50 50)"
              />
              <text x="50" y="55" textAnchor="middle" fontSize="18" fontWeight="bold" fill="hsl(var(--foreground))">
                {value}
              </text>
            </svg>
          </div>
        );

      case 'bar':
        const maxBar = Math.max(value, 100);
        const barHeight = Math.round((value / maxBar) * (chartHeight - 20));
        return (
          <div className="w-full flex items-end justify-center gap-3 px-4" style={{ height: chartHeight }}>
            <div className="flex flex-col items-center">
              <div 
                className="w-16 bg-foreground rounded-t-md transition-all duration-500" 
                style={{ height: `${barHeight}px` }}
              />
              <span className="text-sm text-muted-foreground mt-2 font-medium">{value}</span>
            </div>
          </div>
        );

      case 'line':
        return (
          <div className="w-full flex items-center justify-center" style={{ height: chartHeight }}>
            <div className="text-center">
              <span className="text-3xl font-bold text-foreground">{value.toLocaleString()}</span>
              <p className="text-sm text-muted-foreground mt-1">leads</p>
            </div>
          </div>
        );

      case 'area':
        return (
          <div className="w-full flex items-center justify-center" style={{ height: chartHeight }}>
            <div className="text-center">
              <span className="text-3xl font-bold text-foreground">{value.toLocaleString()}</span>
              <p className="text-sm text-muted-foreground mt-1">leads</p>
            </div>
          </div>
        );

      case 'gauge':
        const percentage = Math.min(Math.round((value / Math.max(value, 100)) * 100), 100);
        const gaugeSize = Math.min(chartHeight, (widget.width || 280) - 40);
        return (
          <div className="w-full flex items-center justify-center" style={{ height: chartHeight }}>
            <svg viewBox="0 0 100 60" style={{ width: gaugeSize * 1.2, height: gaugeSize * 0.7 }}>
              <path 
                d="M10,55 A40,40 0 0,1 90,55" 
                fill="none" 
                stroke="hsl(var(--muted))" 
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path 
                d="M10,55 A40,40 0 0,1 90,55" 
                fill="none" 
                stroke="hsl(var(--foreground))" 
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${percentage * 1.26} 126`}
              />
              <text x="50" y="48" textAnchor="middle" fontSize="14" fontWeight="bold" fill="hsl(var(--foreground))">
                {value}
              </text>
            </svg>
          </div>
        );

      default:
        return (
          <div className="w-full flex items-center justify-center" style={{ height: chartHeight }}>
            {widget.chartType.preview}
          </div>
        );
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
                initialWidth={widget.width || 280}
                initialHeight={widget.height || 200}
                minWidth={200}
                minHeight={160}
                maxWidth={600}
                maxHeight={500}
                onResize={(w, h) => handleWidgetResize(widget.id, w, h)}
                className="bg-white border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="relative h-full p-4">
                  {/* Connect Overlay */}
                  {!widget.isConnected && (
                    <button
                      onClick={() => handleConnectWidget(widget.id)}
                      className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 rounded-xl transition-all hover:bg-white/95 focus:outline-none z-10"
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2 bg-muted">
                        <Link2 className="h-5 w-5 text-foreground" />
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        Conectar fonte
                      </span>
                    </button>
                  )}

                  {/* Widget Content */}
                  <div className={`h-full flex flex-col ${!widget.isConnected ? "opacity-40" : ""}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <widget.chartType.icon className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium text-foreground truncate">
                          {widget.chartType.name}
                        </h3>
                      </div>
                      {widget.isConnected && (
                        <button
                          onClick={() => refreshWidgetData(widget.id)}
                          className="p-1 rounded hover:bg-muted transition-colors"
                          title="Atualizar dados"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${widget.isLoading ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                    
                    {/* Chart */}
                    <div className="flex-1 min-h-0">
                      {widget.isConnected ? renderChartWithData(widget) : (
                        <div className="w-full h-full flex items-center justify-center p-2">
                          {widget.chartType.preview}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    {widget.source && (
                      <p className="text-xs text-muted-foreground text-center truncate shrink-0 pt-1">
                        {widget.source.sourceName}
                      </p>
                    )}
                  </div>
                </div>
              </ResizableWidget>
            ))}

            {/* Add More Button */}
            <button
              onClick={() => setIsChartSelectorOpen(true)}
              className="flex flex-col items-center justify-center w-[200px] h-[160px] border-2 border-dashed border-border rounded-xl transition-all duration-200 hover:border-foreground/30 hover:bg-muted/30 focus:outline-none"
            >
              <Plus className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">
                Adicionar
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
