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
  PointerSensorOptions,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

// Custom pointer sensor that ignores elements with data-no-dnd attribute
class NoResizePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: (
        { nativeEvent: event }: { nativeEvent: PointerEvent },
        { onActivation }: PointerSensorOptions
      ) => {
        let element = event.target as Element | null;
        while (element) {
          if (element.getAttribute?.("data-no-dnd") === "true") {
            return false;
          }
          element = element.parentElement;
        }

        // Keep default PointerSensor behavior (important for activation constraints)
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

interface OverviewViewProps {
  leads: Lead[];
  pipelines: Pipeline[];
  leadTags: Array<{ lead_id: string; name: string; color: string }>;
  subOriginId: string | null;
}

// Ghost placeholder shown during drag - appears where the card will land
function GhostPlaceholder({ card, containerWidth }: { card: OverviewCard; containerWidth: number }) {
  const pixelWidth = containerWidth > 0 
    ? (card.size.widthPercent / 100) * containerWidth 
    : 280;
  
  return (
    <div
      className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30"
      style={{
        width: pixelWidth,
        height: card.size.height,
        maxWidth: '100%',
        flexShrink: 0,
        transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
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
  containerWidth,
}: {
  card: OverviewCard;
  leads: Lead[];
  pipelines: Pipeline[];
  leadTags: Array<{ lead_id: string; name: string; color: string }>;
  onDelete: (id: string) => void;
  onResize: (id: string, size: CardSize) => void;
  onConnectDataSource?: (card: OverviewCard) => void;
  isBeingDragged: boolean;
  containerWidth: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useSortable({ id: card.id });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    // No transition for instant response
    transition: undefined,
  };

  // When this card is being dragged, show a ghost placeholder that moves with the transform
  if (isBeingDragged) {
    return (
      <div ref={setNodeRef} style={style}>
        <GhostPlaceholder card={card} containerWidth={containerWidth} />
      </div>
    );
  }

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
  const [containerWidth, setContainerWidth] = useState(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Monitor container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      setContainerWidth(container.getBoundingClientRect().width);
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    window.addEventListener('resize', updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Configure sensors - use custom sensor that ignores resize handles
  const sensors = useSensors(
    useSensor(NoResizePointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Helper to convert DB row to OverviewCard
  const rowToCard = useCallback((row: {
    card_id: string;
    title: string;
    chart_type: string;
    data_source: string | null;
    width_percent: number | null;
    height: number;
    card_order: number;
  }): OverviewCard => ({
    id: row.card_id,
    title: row.title,
    chartType: row.chart_type as OverviewCard["chartType"],
    dataSource: row.data_source as DataSource | null,
    size: { 
      widthPercent: row.width_percent ?? 25, // fallback to 25% if not set
      height: row.height 
    },
    order: row.card_order,
  }), []);

  // Load cards from Supabase and subscribe to realtime updates
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

        const loadedCards: OverviewCard[] = (data || []).map(rowToCard);
        setCards(loadedCards);
      } catch (error) {
        console.error("Error loading cards:", error);
        toast.error("Erro ao carregar cartões");
      } finally {
        setIsLoading(false);
      }
    };

    loadCards();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`overview-cards-${subOriginId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'overview_cards',
          filter: `sub_origin_id=eq.${subOriginId}`
        },
        (payload) => {
          console.log('[Realtime] overview_cards change:', payload.eventType);
          
          if (payload.eventType === 'INSERT') {
            const newCard = rowToCard(payload.new as any);
            setCards(prev => {
              // Avoid duplicates
              if (prev.some(c => c.id === newCard.id)) return prev;
              return [...prev, newCard].sort((a, b) => a.order - b.order);
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedCard = rowToCard(payload.new as any);
            setCards(prev => prev.map(c => c.id === updatedCard.id ? updatedCard : c));
          } else if (payload.eventType === 'DELETE') {
            const deletedCardId = (payload.old as any).card_id;
            setCards(prev => prev.filter(c => c.id !== deletedCardId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [subOriginId, rowToCard]);

  // Save card to Supabase
  const saveCardToDb = useCallback(async (card: OverviewCard) => {
    if (!subOriginId) return;
    
    try {
      const { error } = await supabase
        .from("overview_cards")
        .upsert(
          {
            sub_origin_id: subOriginId,
            card_id: card.id,
            title: card.title,
            chart_type: card.chartType,
            data_source: card.dataSource,
            width_percent: card.size.widthPercent,
            width: Math.round((card.size.widthPercent / 100) * (containerWidth || 1000)), // legacy column
            height: Math.round(card.size.height),
            card_order: card.order,
          },
          { onConflict: "sub_origin_id,card_id" }
        );

      if (error) throw error;
    } catch (error) {
      console.error("Error saving card:", error);
    }
  }, [subOriginId, containerWidth]);

  // Save multiple cards order to DB
  const saveCardsOrder = useCallback(async (cardsToSave: OverviewCard[]) => {
    if (!subOriginId) return;
    
    try {
      const updates = cardsToSave.map((card) => ({
        sub_origin_id: subOriginId,
        card_id: card.id,
        title: card.title,
        chart_type: card.chartType,
        data_source: card.dataSource,
        width_percent: card.size.widthPercent,
        width: Math.round((card.size.widthPercent / 100) * (containerWidth || 1000)), // legacy column
        height: Math.round(card.size.height),
        card_order: card.order,
      }));

      const { error } = await supabase
        .from("overview_cards")
        .upsert(updates, { onConflict: "sub_origin_id,card_id" });

      if (error) throw error;
    } catch (error) {
      console.error("Error saving cards order:", error);
    }
  }, [subOriginId, containerWidth]);

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
          width_percent: newCard.size.widthPercent,
          width: Math.round((newCard.size.widthPercent / 100) * (containerWidth || 1000)), // legacy column
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
  }, [cards.length, subOriginId, containerWidth]);

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
    <div className="relative flex flex-col h-full overflow-x-clip overflow-y-hidden">
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
            <div ref={containerRef} className="flex flex-wrap gap-4 pb-4 content-start overflow-x-clip overflow-y-visible">
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
                  containerWidth={containerWidth}
                />
              ))}
            </div>
          </SortableContext>

          {/* Drag overlay - shows floating card on top with shadow */}
          <DragOverlay dropAnimation={null}>
            {activeCard ? (
              <div className="shadow-2xl shadow-black/20 rounded-xl">
                <OverviewCardComponent
                  card={activeCard}
                  leads={leads}
                  pipelines={pipelines}
                  leadTags={leadTags}
                  onDelete={() => {}}
                  onResize={() => {}}
                  containerWidth={containerWidth}
                  isDragging
                />
              </div>
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
