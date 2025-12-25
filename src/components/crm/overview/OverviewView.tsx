import { useState, useEffect, useCallback, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Lead, Pipeline } from "@/types/crm";
import { OverviewCard, CardTemplate, CardSize } from "./types";
import { OverviewCardComponent } from "./OverviewCardComponent";
import { AddCardDialog } from "./AddCardDialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OverviewViewProps {
  leads: Lead[];
  pipelines: Pipeline[];
  leadTags: Array<{ lead_id: string; name: string; color: string }>;
  subOriginId: string | null;
}

const STORAGE_KEY = "crm-overview-cards";
const GRID_GAP = 16;
const GRID_COLUMNS = 3;
const ROW_HEIGHT = 180;

export function OverviewView({ leads, pipelines, leadTags, subOriginId }: OverviewViewProps) {
  const [cards, setCards] = useState<OverviewCard[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [gridCellWidth, setGridCellWidth] = useState(300);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate grid cell width based on container
  useEffect(() => {
    const updateGridWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth - 16; // account for scrollbar
        const cellWidth = (containerWidth - (GRID_GAP * (GRID_COLUMNS - 1))) / GRID_COLUMNS;
        setGridCellWidth(cellWidth);
      }
    };

    updateGridWidth();
    window.addEventListener("resize", updateGridWidth);
    return () => window.removeEventListener("resize", updateGridWidth);
  }, []);

  // Load cards from localStorage
  useEffect(() => {
    const storageKey = subOriginId ? `${STORAGE_KEY}-${subOriginId}` : STORAGE_KEY;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setCards(JSON.parse(saved));
      } catch {
        setCards([]);
      }
    } else {
      // Default cards for new overview
      setCards([
        {
          id: "default-1",
          title: "Total de Leads",
          chartType: "number",
          dataSource: "total_leads",
          size: { width: 1, height: 1 },
          order: 0,
        },
        {
          id: "default-2",
          title: "Leads por Pipeline",
          chartType: "pie",
          dataSource: "leads_by_pipeline",
          size: { width: 1, height: 2 },
          order: 1,
        },
        {
          id: "default-3",
          title: "Leads ao Longo do Tempo",
          chartType: "area",
          dataSource: "leads_over_time",
          size: { width: 2, height: 2 },
          order: 2,
        },
      ]);
    }
  }, [subOriginId]);

  // Save cards to localStorage
  useEffect(() => {
    if (cards.length > 0) {
      const storageKey = subOriginId ? `${STORAGE_KEY}-${subOriginId}` : STORAGE_KEY;
      localStorage.setItem(storageKey, JSON.stringify(cards));
    }
  }, [cards, subOriginId]);

  const handleAddCard = useCallback((template: CardTemplate) => {
    const newCard: OverviewCard = {
      id: `card-${Date.now()}`,
      title: template.title,
      chartType: template.chartType,
      dataSource: template.dataSource,
      size: template.defaultSize,
      order: cards.length,
    };
    setCards((prev) => [...prev, newCard]);
  }, [cards.length]);

  const handleDeleteCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleResizeCard = useCallback((id: string, size: CardSize) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, size } : c))
    );
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 shrink-0">
        <h2 className="text-lg font-semibold text-foreground">Visão Geral</h2>
        <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar cartão
        </Button>
      </div>

      {/* Cards Grid */}
      <ScrollArea className="flex-1" ref={containerRef}>
        <div 
          className="grid gap-4 pb-4 pr-4"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
            gridAutoRows: `${ROW_HEIGHT}px`,
          }}
        >
          {cards
            .sort((a, b) => a.order - b.order)
            .map((card) => (
              <OverviewCardComponent
                key={card.id}
                card={card}
                leads={leads}
                pipelines={pipelines}
                leadTags={leadTags}
                onDelete={handleDeleteCard}
                onResize={handleResizeCard}
                gridCellWidth={gridCellWidth}
                gridCellHeight={ROW_HEIGHT}
              />
            ))}
        </div>

        {/* Empty State */}
        {cards.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-2">Nenhum cartão adicionado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Adicione cartões para visualizar métricas do seu CRM
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar cartão
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* Add Card Dialog */}
      <AddCardDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAddCard={handleAddCard}
      />
    </div>
  );
}
