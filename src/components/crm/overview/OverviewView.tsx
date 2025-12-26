import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Lead, Pipeline } from "@/types/crm";
import { OverviewCard, CardTemplate, CardSize, DataSource } from "./types";
import { OverviewCardComponent } from "./OverviewCardComponent";
import { AddCardDialog } from "./AddCardDialog";
import { CardConfigPanel } from "./CardConfigPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

interface OverviewViewProps {
  leads: Lead[];
  pipelines: Pipeline[];
  leadTags: Array<{ lead_id: string; name: string; color: string }>;
  subOriginId: string | null;
}

// Ghost placeholder shown during drag - appears where the card will land
function GhostPlaceholder({ card }: { card: OverviewCard }) {
  return (
    <div
      className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30"
      style={{
        width: card.size.width,
        height: card.size.height,
        maxWidth: '100%',
        flexShrink: 0,
      }}
    />
  );
}

// Sortable wrapper for cards
function SortableCard({
  card,
  leads,
  pipelines,
  leadTags,
  onDelete,
  onResize,
  onConnectDataSource,
  isBeingDragged,
}: {
  card: OverviewCard;
  leads: Lead[];
  pipelines: Pipeline[];
  leadTags: Array<{ lead_id: string; name: string; color: string }>;
  onDelete: (id: string) => void;
  onResize: (id: string, size: CardSize) => void;
  onConnectDataSource?: (card: OverviewCard) => void;
  isBeingDragged: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isSortableDragging,
  } = useSortable({ id: card.id });

  // When this card is being dragged, show a ghost placeholder instead
  if (isBeingDragged) {
    return (
      <div ref={setNodeRef}>
        <GhostPlaceholder card={card} />
      </div>
    );
  }

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    // No transition for instant response
    transition: undefined,
    zIndex: isSortableDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <OverviewCardComponent
        card={card}
        leads={leads}
        pipelines={pipelines}
        leadTags={leadTags}
        onDelete={onDelete}
        onResize={onResize}
        onConnectDataSource={onConnectDataSource}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export function OverviewView({ leads, pipelines, leadTags, subOriginId }: OverviewViewProps) {
  const [cards, setCards] = useState<OverviewCard[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [configPanelCard, setConfigPanelCard] = useState<OverviewCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Configure sensors - require some movement before starting drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Load cards from Supabase
  useEffect(() => {
    if (!subOriginId) {
      setCards([]);
      setIsLoading(false);
      return;
    }

    const loadCards = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("overview_cards")
          .select("*")
          .eq("sub_origin_id", subOriginId)
          .order("card_order", { ascending: true });

        if (error) throw error;

        const loadedCards: OverviewCard[] = (data || []).map((row) => ({
          id: row.card_id,
          title: row.title,
          chartType: row.chart_type as OverviewCard["chartType"],
          dataSource: row.data_source as DataSource | null,
          size: { width: row.width, height: row.height },
          order: row.card_order,
        }));

        setCards(loadedCards);
      } catch (error) {
        console.error("Error loading cards:", error);
        toast.error("Erro ao carregar cartões");
      } finally {
        setIsLoading(false);
      }
    };

    loadCards();
  }, [subOriginId]);

  // Save card to Supabase
  const saveCardToDb = useCallback(async (card: OverviewCard) => {
    if (!subOriginId) return;
    
    try {
      const { error } = await supabase
        .from("overview_cards")
        .upsert({
          sub_origin_id: subOriginId,
          card_id: card.id,
          title: card.title,
          chart_type: card.chartType,
          data_source: card.dataSource,
          width: card.size.width,
          height: card.size.height,
          card_order: card.order,
        }, { onConflict: "sub_origin_id,card_id" });

      if (error) throw error;
    } catch (error) {
      console.error("Error saving card:", error);
    }
  }, [subOriginId]);

  // Save multiple cards order to DB
  const saveCardsOrder = useCallback(async (cardsToSave: OverviewCard[]) => {
    if (!subOriginId) return;
    
    try {
      const updates = cardsToSave.map(card => ({
        sub_origin_id: subOriginId,
        card_id: card.id,
        title: card.title,
        chart_type: card.chartType,
        data_source: card.dataSource,
        width: card.size.width,
        height: card.size.height,
        card_order: card.order,
      }));

      const { error } = await supabase
        .from("overview_cards")
        .upsert(updates, { onConflict: "sub_origin_id,card_id" });

      if (error) throw error;
    } catch (error) {
      console.error("Error saving cards order:", error);
    }
  }, [subOriginId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleAddCard = useCallback(async (template: CardTemplate) => {
    if (!subOriginId) return;

    const newCard: OverviewCard = {
      id: `card-${Date.now()}`,
      title: template.title,
      chartType: template.chartType,
      dataSource: null,
      size: template.defaultSize,
      order: cards.length,
    };

    // Save to database immediately
    try {
      const { error } = await supabase
        .from("overview_cards")
        .insert({
          sub_origin_id: subOriginId,
          card_id: newCard.id,
          title: newCard.title,
          chart_type: newCard.chartType,
          data_source: newCard.dataSource,
          width: newCard.size.width,
          height: newCard.size.height,
          card_order: newCard.order,
        });

      if (error) throw error;

      setCards((prev) => [...prev, newCard]);
      setConfigPanelCard(newCard);
    } catch (error) {
      console.error("Error adding card:", error);
      toast.error("Erro ao adicionar cartão");
    }
  }, [cards.length, subOriginId]);

  const handleConnectDataSource = useCallback((card: OverviewCard) => {
    setConfigPanelCard(card);
  }, []);

  const handleUpdateCard = useCallback((cardId: string, updates: Partial<OverviewCard>) => {
    setCards((prev) => {
      const newCards = prev.map((c) => (c.id === cardId ? { ...c, ...updates } : c));
      // Save updated card to database
      const updatedCard = newCards.find(c => c.id === cardId);
      if (updatedCard) {
        saveCardToDb(updatedCard);
      }
      if (configPanelCard && configPanelCard.id === cardId && updatedCard) {
        setConfigPanelCard(updatedCard);
      }
      return newCards;
    });
  }, [saveCardToDb, configPanelCard]);

  const handleDeleteCard = useCallback(async (id: string) => {
    if (!subOriginId) return;

    try {
      const { error } = await supabase
        .from("overview_cards")
        .delete()
        .eq("sub_origin_id", subOriginId)
        .eq("card_id", id);

      if (error) throw error;

      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Error deleting card:", error);
      toast.error("Erro ao deletar cartão");
    }
  }, [subOriginId]);

  const handleResizeCard = useCallback((id: string, size: CardSize) => {
    setCards((prev) => {
      const newCards = prev.map((c) => (c.id === id ? { ...c, size } : c));
      // Save resized card to database with debounce
      const resizedCard = newCards.find(c => c.id === id);
      if (resizedCard) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          saveCardToDb(resizedCard);
        }, 300);
      }
      return newCards;
    });
  }, [saveCardToDb]);

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setCards((prev) => {
        const oldIndex = prev.findIndex((c) => c.id === active.id);
        const newIndex = prev.findIndex((c) => c.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return prev;

        // Reorder array
        const reordered = [...prev];
        const [removed] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, removed);

        // Update order property
        const withNewOrder = reordered.map((card, index) => ({
          ...card,
          order: index,
        }));

        // Save to DB
        saveCardsOrder(withNewOrder);

        return withNewOrder;
      });
    }
  }, [saveCardsOrder]);

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null;
  const sortedCards = [...cards].sort((a, b) => a.order - b.order);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 shrink-0">
        <h2 className="text-lg font-semibold text-foreground">Visão Geral</h2>
        <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar cartão
        </Button>
      </div>

      {/* Cards - Flex wrap layout with drag and drop */}
      <ScrollArea className="flex-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortedCards.map((c) => c.id)} strategy={rectSortingStrategy}>
            <div className="flex flex-wrap gap-4 pb-4 content-start overflow-hidden">
              {sortedCards.map((card) => (
                <SortableCard
                  key={card.id}
                  card={card}
                  leads={leads}
                  pipelines={pipelines}
                  leadTags={leadTags}
                  onDelete={handleDeleteCard}
                  onResize={handleResizeCard}
                  onConnectDataSource={handleConnectDataSource}
                  isBeingDragged={activeId === card.id}
                />
              ))}
            </div>
          </SortableContext>

          {/* Drag overlay - shows floating card while dragging (no transparency) */}
          <DragOverlay dropAnimation={null}>
            {activeCard ? (
              <OverviewCardComponent
                card={activeCard}
                leads={leads}
                pipelines={pipelines}
                leadTags={leadTags}
                onDelete={() => {}}
                onResize={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>

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

      {/* Card Config Panel - rendered in portal to be above everything */}
      {configPanelCard && createPortal(
        <CardConfigPanel
          card={configPanelCard}
          leads={leads}
          pipelines={pipelines}
          leadTags={leadTags}
          onClose={() => setConfigPanelCard(null)}
          onUpdateCard={handleUpdateCard}
        />,
        document.body
      )}
    </div>
  );
}
