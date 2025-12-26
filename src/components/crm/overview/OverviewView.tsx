import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Lead, Pipeline } from "@/types/crm";
import { OverviewCard, CardTemplate, CardSize, DataSource, MIN_CARD_WIDTH_PX, MIN_CARD_WIDTH_PERCENT } from "./types";
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
function GhostPlaceholder({ card }: { card: OverviewCard }) {
  return (
    <div
      className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 w-full"
      style={{
        height: card.size.height,
      }}
    />
  );
}

// Calculate cards in the same visual line based on percentage sum
function getCardsInSameLine(allCards: OverviewCard[], targetCardId: string): OverviewCard[] {
  const sortedCards = [...allCards].sort((a, b) => a.order - b.order);
  
  let currentPercentSum = 0;
  let currentLine: OverviewCard[] = [];
  
  for (const card of sortedCards) {
    if (currentPercentSum + card.size.widthPercent > 100.5 && currentLine.length > 0) {
      if (currentLine.some(c => c.id === targetCardId)) {
        return currentLine;
      }
      currentLine = [card];
      currentPercentSum = card.size.widthPercent;
    } else {
      currentLine.push(card);
      currentPercentSum += card.size.widthPercent;
    }
  }
  
  if (currentLine.some(c => c.id === targetCardId)) {
    return currentLine;
  }
  
  return [];
}

// Sortable wrapper for cards - controls width via percentage with gap offset
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
  allCards,
}: {
  card: OverviewCard;
  leads: Lead[];
  pipelines: Pipeline[];
  leadTags: Array<{ lead_id: string; name: string; color: string }>;
  onDelete: (id: string) => void;
  onResize: (id: string, size: CardSize, resizeDirection?: string) => void;
  onConnectDataSource?: (card: OverviewCard) => void;
  isBeingDragged: boolean;
  containerWidth: number;
  allCards: OverviewCard[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useSortable({ id: card.id });

  const GAP_PX = 16; // gap-4 = 16px

  // Find how many cards are in the same line
  const cardsInLine = getCardsInSameLine(allCards, card.id);
  const numberOfGaps = Math.max(0, cardsInLine.length - 1);
  
  // Calculate gap offset: each card subtracts its proportional share of the total gaps
  // gapOffset = (totalGaps / numCards) = (numberOfGaps * GAP_PX) / numCardsInLine
  const gapOffset = cardsInLine.length > 0 
    ? (numberOfGaps * GAP_PX) / cardsInLine.length 
    : 0;

  // Wrapper style: percentage-based width minus proportional gap offset
  // flexShrink: 0 prevents browser from auto-shrinking cards
  const wrapperStyle: React.CSSProperties = {
    width: `calc(${card.size.widthPercent}% - ${gapOffset}px)`,
    flexBasis: `calc(${card.size.widthPercent}% - ${gapOffset}px)`,
    flexShrink: 0,
    flexGrow: 0,
    maxWidth: '100%',
    minWidth: `${MIN_CARD_WIDTH_PX}px`,
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition: undefined,
  };

  // When this card is being dragged, show a ghost placeholder
  if (isBeingDragged) {
    return (
      <div ref={setNodeRef} style={wrapperStyle}>
        <GhostPlaceholder card={card} />
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={wrapperStyle}>
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

  // Find cards that are visually on the same line
  // Uses percentage sum (should sum to ~100% for a full line)
  const findCardsInSameLine = useCallback((cards: OverviewCard[], targetCardId: string): OverviewCard[] => {
    const sortedCards = [...cards].sort((a, b) => a.order - b.order);
    
    let currentPercentSum = 0;
    let currentLine: OverviewCard[] = [];
    
    for (const card of sortedCards) {
      // If adding this card exceeds 100%, start new line
      if (currentPercentSum + card.size.widthPercent > 100.5 && currentLine.length > 0) {
        // Check if target is in this line
        if (currentLine.some(c => c.id === targetCardId)) {
          return currentLine;
        }
        // Start new line
        currentLine = [card];
        currentPercentSum = card.size.widthPercent;
      } else {
        currentLine.push(card);
        currentPercentSum += card.size.widthPercent;
      }
    }
    
    // Check last line
    if (currentLine.some(c => c.id === targetCardId)) {
      return currentLine;
    }
    
    return [];
  }, []);

  // Save multiple cards to DB
  const saveMultipleCardsToDb = useCallback(async (cardsToSave: OverviewCard[]) => {
    if (!subOriginId) return;
    
    try {
      const updates = cardsToSave.map((card) => ({
        sub_origin_id: subOriginId,
        card_id: card.id,
        title: card.title,
        chart_type: card.chartType,
        data_source: card.dataSource,
        width_percent: card.size.widthPercent,
        width: Math.round((card.size.widthPercent / 100) * (containerWidth || 1000)),
        height: Math.round(card.size.height),
        card_order: card.order,
      }));

      await supabase
        .from("overview_cards")
        .upsert(updates, { onConflict: "sub_origin_id,card_id" });
    } catch (error) {
      console.error("Error saving cards:", error);
    }
  }, [subOriginId, containerWidth]);

  const handleResizeCard = useCallback((id: string, size: CardSize, resizeDirection?: string) => {
    setCards((prev) => {
      const currentCard = prev.find(c => c.id === id);
      if (!currentCard) return prev;
      
      // Only apply collaborative resize for horizontal resizing
      const isHorizontalResize = resizeDirection === 'left' || resizeDirection === 'right' || 
        resizeDirection?.includes('left') || resizeDirection?.includes('right');
      
      if (!isHorizontalResize) {
        // Vertical-only resize - just resize this card
        const newCards = prev.map((c) => (c.id === id ? { ...c, size } : c));
        const resizedCard = newCards.find(c => c.id === id);
        if (resizedCard) {
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = setTimeout(() => saveCardToDb(resizedCard), 300);
        }
        return newCards;
      }
      
      // Find cards in the same line
      const cardsInLine = findCardsInSameLine(prev, id);
      const cardIndex = cardsInLine.findIndex(c => c.id === id);
      
      // Determine neighbor based on resize direction
      const isResizingRight = resizeDirection === 'right' || resizeDirection === 'top-right' || resizeDirection === 'bottom-right';
      const neighborCard = isResizingRight 
        ? cardsInLine[cardIndex + 1] 
        : cardsInLine[cardIndex - 1];
      
      if (!neighborCard) {
        // No neighbor in this direction - normal resize (card can grow freely)
        const newCards = prev.map((c) => (c.id === id ? { ...c, size } : c));
        const resizedCard = newCards.find(c => c.id === id);
        if (resizedCard) {
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = setTimeout(() => saveCardToDb(resizedCard), 300);
        }
        return newCards;
      }
      
      // Calculate delta in width percent (positive = growing, negative = shrinking)
      const deltaPercent = size.widthPercent - currentCard.size.widthPercent;
      
      // Calculate effective minimum percent based on container width and MIN_CARD_WIDTH_PX
      // This ensures the minimum percentage aligns with the actual pixel minimum
      const effectiveMinPercent = containerWidth > 0
        ? Math.max(MIN_CARD_WIDTH_PERCENT, (MIN_CARD_WIDTH_PX / containerWidth) * 100)
        : MIN_CARD_WIDTH_PERCENT;
      
      // Calculate current line sum (all cards in this line)
      const lineSum = cardsInLine.reduce((sum, c) => sum + c.size.widthPercent, 0);
      
      // Calculate "slack" - how much space is left before the line is full (100%)
      const slack = Math.max(0, 100 - lineSum);
      
      // If growing (delta > 0):
      // 1. First consume slack (neighbor doesn't shrink yet)
      // 2. Then shrink neighbor
      // 3. If neighbor is at minimum, let current card continue growing (will cause wrap)
      if (deltaPercent > 0) {
        // How much do we need to take from neighbor after consuming slack?
        const shrinkNeeded = Math.max(0, deltaPercent - slack);
        
        // Calculate new neighbor width
        const neighborNewPercent = neighborCard.size.widthPercent - shrinkNeeded;
        
        if (neighborNewPercent >= effectiveMinPercent) {
          // Neighbor can accommodate (either no shrink needed, or it can shrink enough)
          const newCards = prev.map(c => {
            if (c.id === id) return { ...c, size };
            if (c.id === neighborCard.id && shrinkNeeded > 0) {
              return { 
                ...c, 
                size: { ...c.size, widthPercent: neighborNewPercent } 
              };
            }
            return c;
          });
          
          // Debounced save
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = setTimeout(() => {
            const cardsToSave = [newCards.find(c => c.id === id)!];
            if (shrinkNeeded > 0) {
              cardsToSave.push(newCards.find(c => c.id === neighborCard.id)!);
            }
            saveMultipleCardsToDb(cardsToSave.filter(Boolean));
          }, 300);
          
          return newCards;
        } else {
          // Neighbor would go below minimum
          // Let the current card grow anyway - this will cause the neighbor to wrap to next line
          // (flex-wrap will handle it naturally when sum > 100%)
          const neighborAtMin = effectiveMinPercent;
          
          const newCards = prev.map(c => {
            if (c.id === id) return { ...c, size }; // Let it grow!
            if (c.id === neighborCard.id) return { 
              ...c, 
              size: { ...c.size, widthPercent: neighborAtMin } 
            };
            return c;
          });
          
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = setTimeout(() => {
            const cardsToSave = [
              newCards.find(c => c.id === id)!,
              newCards.find(c => c.id === neighborCard.id)!,
            ].filter(Boolean);
            saveMultipleCardsToDb(cardsToSave);
          }, 300);
          
          return newCards;
        }
      } else {
        // Shrinking (delta < 0) - just apply the size change, no collaborative resize needed
        const newCards = prev.map((c) => (c.id === id ? { ...c, size } : c));
        const resizedCard = newCards.find(c => c.id === id);
        if (resizedCard) {
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = setTimeout(() => saveCardToDb(resizedCard), 300);
        }
        return newCards;
      }
    });
  }, [saveCardToDb, saveMultipleCardsToDb, findCardsInSameLine, containerWidth]);

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
            <div ref={containerRef} className="flex flex-wrap gap-4 pb-4 content-start overflow-hidden">
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
                  allCards={sortedCards}
                />
              ))}
            </div>
          </SortableContext>

          {/* Drag overlay - shows floating card on top with shadow */}
          <DragOverlay dropAnimation={null}>
            {activeCard ? (() => {
              // Calculate pixel width with minimum constraint for drag overlay
              const overlayPixelWidth = containerWidth > 0 
                ? Math.max(
                    (activeCard.size.widthPercent / 100) * containerWidth,
                    MIN_CARD_WIDTH_PX
                  )
                : undefined;
              return (
                <div className="shadow-2xl shadow-black/20 rounded-xl" style={{ width: overlayPixelWidth }}>
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
              );
            })() : null}
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
