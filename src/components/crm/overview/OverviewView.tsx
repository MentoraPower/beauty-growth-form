import { useState, useEffect, useCallback, useRef } from "react";
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

interface OverviewViewProps {
  leads: Lead[];
  pipelines: Pipeline[];
  leadTags: Array<{ lead_id: string; name: string; color: string }>;
  subOriginId: string | null;
}

export function OverviewView({ leads, pipelines, leadTags, subOriginId }: OverviewViewProps) {
  const [cards, setCards] = useState<OverviewCard[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [configPanelCard, setConfigPanelCard] = useState<OverviewCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Debounced save for resize operations
  const saveCards = useCallback((cardsToSave: OverviewCard[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      cardsToSave.forEach(saveCardToDb);
    }, 300);
  }, [saveCardToDb]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleAddCard = useCallback((template: CardTemplate) => {
    const newCard: OverviewCard = {
      id: `card-${Date.now()}`,
      title: template.title,
      chartType: template.chartType,
      dataSource: null, // Start with no data source
      size: template.defaultSize,
      order: cards.length,
    };
    const newCards = [...cards, newCard];
    setCards(newCards);
    saveCards(newCards);
    // Automatically open config panel for the new card
    setConfigPanelCard(newCard);
  }, [cards, saveCards]);

  const handleConnectDataSource = useCallback((card: OverviewCard) => {
    setConfigPanelCard(card);
  }, []);

  const handleUpdateCard = useCallback((cardId: string, updates: Partial<OverviewCard>) => {
    setCards((prev) => {
      const newCards = prev.map((c) => (c.id === cardId ? { ...c, ...updates } : c));
      saveCards(newCards);
      // Update the config panel card reference if it's the one being edited
      const updatedCard = newCards.find(c => c.id === cardId);
      if (configPanelCard && configPanelCard.id === cardId && updatedCard) {
        setConfigPanelCard(updatedCard);
      }
      return newCards;
    });
  }, [saveCards, configPanelCard]);

  const handleDeleteCard = useCallback((id: string) => {
    const newCards = cards.filter((c) => c.id !== id);
    setCards(newCards);
    saveCards(newCards);
  }, [cards, saveCards]);

  const handleResizeCard = useCallback((id: string, size: CardSize) => {
    setCards((prev) => {
      const newCards = prev.map((c) => (c.id === id ? { ...c, size } : c));
      saveCards(newCards);
      return newCards;
    });
  }, [saveCards]);

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

      {/* Cards - Flex wrap layout for free positioning */}
      <ScrollArea className="flex-1">
        <div className="flex flex-wrap gap-4 pb-4 pr-4 content-start">
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
                onConnectDataSource={handleConnectDataSource}
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

      {/* Card Config Panel */}
      {configPanelCard && (
        <CardConfigPanel
          card={configPanelCard}
          leads={leads}
          pipelines={pipelines}
          leadTags={leadTags}
          onClose={() => setConfigPanelCard(null)}
          onUpdateCard={handleUpdateCard}
        />
      )}
    </div>
  );
}
