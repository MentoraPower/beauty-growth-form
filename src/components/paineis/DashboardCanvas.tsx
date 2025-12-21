import { useState } from "react";
import { Plus, Link2, X } from "lucide-react";
import { ChartSelectorDialog, ChartType } from "./ChartSelectorDialog";
import { ConnectSourceDialog, WidgetSource } from "./ConnectSourceDialog";

export interface DashboardWidget {
  id: string;
  chartType: ChartType;
  source: WidgetSource | null;
  isConnected: boolean;
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

  const handleSelectChart = (chart: ChartType) => {
    setSelectedChart(chart);
    setIsChartSelectorOpen(false);
    
    // Create widget without source
    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      chartType: chart,
      source: null,
      isConnected: false,
    };
    setWidgets(prev => [...prev, newWidget]);
    
    // Open source connection dialog
    setPendingWidgetId(newWidget.id);
    setIsConnectSourceOpen(true);
  };

  const handleConnectSource = (source: WidgetSource) => {
    if (pendingWidgetId) {
      setWidgets(prev => prev.map(widget => 
        widget.id === pendingWidgetId 
          ? { ...widget, source, isConnected: true }
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
      <div className="flex-1">
        {widgets.length === 0 ? (
          /* Empty State - Add Widget Button */
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
          /* Dashboard Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {widgets.map((widget) => (
              <div
                key={widget.id}
                className="relative bg-white border border-border rounded-xl p-5 min-h-[180px]"
              >
                {/* Connect Overlay for unconnected widgets */}
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
                <div className={!widget.isConnected ? "opacity-40" : ""}>
                  <div className="flex items-center gap-2 mb-3">
                    <widget.chartType.icon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-foreground">
                      {widget.chartType.name}
                    </h3>
                  </div>
                  
                  {/* Chart Preview */}
                  <div className="w-full h-24 flex items-center justify-center">
                    {widget.chartType.preview}
                  </div>

                  {widget.source && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      {widget.source.sourceName}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Add More Button */}
            <button
              onClick={() => setIsChartSelectorOpen(true)}
              className="flex flex-col items-center justify-center min-h-[180px] border-2 border-dashed border-border rounded-xl transition-all duration-200 hover:border-foreground/30 hover:bg-muted/30 focus:outline-none"
            >
              <Plus className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">
                Adicionar
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Chart Selector Dialog */}
      <ChartSelectorDialog
        open={isChartSelectorOpen}
        onOpenChange={setIsChartSelectorOpen}
        onSelectChart={handleSelectChart}
      />

      {/* Connect Source Dialog */}
      <ConnectSourceDialog
        open={isConnectSourceOpen}
        onOpenChange={(open) => {
          setIsConnectSourceOpen(open);
          if (!open) {
            setPendingWidgetId(null);
          }
        }}
        selectedChart={selectedChart}
        onConnect={handleConnectSource}
      />
    </div>
  );
}
