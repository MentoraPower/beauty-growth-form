import { useState, useEffect, useCallback, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Lead, Pipeline } from "@/types/crm";
import { OverviewCard, CardTemplate, CardSize, DataSource } from "./types";
import { OverviewCardComponent } from "./OverviewCardComponent";
import { AddCardDialog } from "./AddCardDialog";
import { CardConfigPanel } from "./CardConfigPanel";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OverviewViewProps {
  leads: Lead[];
  pipelines: Pipeline[];
  leadTags: Array<{ lead_id: string; name: string; color: string }>;
  subOriginId: string | null;
}

const STORAGE_KEY = "crm-overview-cards";

export function OverviewView({ leads, pipelines, leadTags, subOriginId }: OverviewViewProps) {
  const [cards, setCards] = useState<OverviewCard[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [configPanelCard, setConfigPanelCard] = useState<OverviewCard | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      // Start with empty cards - user will add their own
      setCards([]);
    }
  }, [subOriginId]);

  // Save cards to localStorage with debounce for performance during resize
  const saveCards = useCallback((cardsToSave: OverviewCard[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      const storageKey = subOriginId ? `${STORAGE_KEY}-${subOriginId}` : STORAGE_KEY;
      localStorage.setItem(storageKey, JSON.stringify(cardsToSave));
    }, 100);
  }, [subOriginId]);

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
    <div className="flex flex-col h-full overflow-hidden">
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
