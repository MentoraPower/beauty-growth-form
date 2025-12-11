import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Lead, Pipeline } from "@/types/crm";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  pipeline: Pipeline;
  leads: Lead[];
  isOver?: boolean;
  activeId?: string | null;
}

export function KanbanColumn({ pipeline, leads, isOver, activeId }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: pipeline.id,
  });

  // Filter out the card being dragged so it disappears from original position
  const visibleLeads = activeId ? leads.filter((l) => l.id !== activeId) : leads;

  return (
    <div className="flex-shrink-0 w-80 flex flex-col h-full">
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl border transition-all duration-150 flex flex-col ${
          isOver
            ? "bg-muted/30 border-muted-foreground/20 border-dashed"
            : "bg-muted/20 border-black/5"
        }`}
      >
        {/* Header inside column */}
        <div className="px-4 pt-4 pb-3 border-b border-black/5">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm">{pipeline.nome}</h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {leads.length}
            </span>
          </div>
        </div>

        {/* Cards container */}
        <div className="p-3 flex-1 overflow-y-auto">
          <SortableContext
            items={leads.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {visibleLeads.map((lead) => (
                <KanbanCard key={lead.id} lead={lead} />
              ))}
              {visibleLeads.length === 0 && (
                <div className={`text-center text-sm py-8 rounded-lg border-2 border-dashed transition-colors ${
                  isOver ? "border-muted-foreground/30 text-muted-foreground" : "border-transparent text-muted-foreground"
                }`}>
                  {isOver ? "Solte aqui" : "Nenhum lead"}
                </div>
              )}
            </div>
          </SortableContext>
        </div>
      </div>
    </div>
  );
}
