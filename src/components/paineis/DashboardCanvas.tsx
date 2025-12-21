import { useState } from "react";
import { Plus, Link2 } from "lucide-react";
import { AddWidgetDialog, DashboardWidget } from "./AddWidgetDialog";

interface DashboardCanvasProps {
  painelName: string;
  onBack: () => void;
}

export function DashboardCanvas({ painelName, onBack }: DashboardCanvasProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const handleAddWidget = (widget: DashboardWidget) => {
    setWidgets(prev => [...prev, widget]);
  };

  const handleConnectWidget = (widgetId: string) => {
    // TODO: Open connection flow for the widget
    console.log("Connect widget:", widgetId);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          ← Voltar para painéis
        </button>
        <h1 className="text-xl font-semibold text-foreground">
          {painelName}
        </h1>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1">
        {widgets.length === 0 ? (
          /* Empty State - Add Widget Button */
          <div className="h-full flex items-center justify-center">
            <button
              onClick={() => setIsAddDialogOpen(true)}
              className="group flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl transition-all duration-200 hover:border-primary/50 hover:bg-muted/30 focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-muted group-hover:bg-primary/10 transition-colors">
                <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
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
                className="relative bg-white border border-border rounded-xl p-5 min-h-[140px]"
              >
                {/* Connect Overlay for unconnected widgets */}
                {!widget.isConnected && (
                  <button
                    onClick={() => handleConnectWidget(widget.id)}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 rounded-xl transition-all hover:bg-white/95 focus:outline-none z-10"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2 bg-primary/10">
                      <Link2 className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-primary">
                      Conectar
                    </span>
                  </button>
                )}

                {/* Widget Content */}
                <div className="opacity-50">
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    {widget.title}
                  </h3>
                  <p className="text-2xl font-semibold text-foreground">
                    --
                  </p>
                </div>
              </div>
            ))}

            {/* Add More Button */}
            <button
              onClick={() => setIsAddDialogOpen(true)}
              className="flex flex-col items-center justify-center min-h-[140px] border-2 border-dashed border-border rounded-xl transition-all duration-200 hover:border-primary/50 hover:bg-muted/30 focus:outline-none"
            >
              <Plus className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">
                Adicionar
              </span>
            </button>
          </div>
        )}
      </div>

      <AddWidgetDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddWidget={handleAddWidget}
      />
    </div>
  );
}
