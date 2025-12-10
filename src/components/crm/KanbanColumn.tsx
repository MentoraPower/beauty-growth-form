import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Lead, Pipeline } from "@/types/crm";
import { KanbanCard } from "./KanbanCard";
import { Card } from "@/components/ui/card";

interface KanbanColumnProps {
  pipeline: Pipeline;
  leads: Lead[];
}

export function KanbanColumn({ pipeline, leads }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: pipeline.id,
  });

  return (
    <div className="flex-shrink-0 w-80">
      <div className="mb-3 flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: pipeline.cor }}
        />
        <h2 className="font-semibold text-sm">{pipeline.nome}</h2>
        <span className="text-xs text-muted-foreground">({leads.length})</span>
      </div>

      <Card
        ref={setNodeRef}
        className={`p-3 min-h-[500px] bg-muted/20 border-black/5 transition-colors ${
          isOver ? "bg-muted/40" : ""
        }`}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {leads.map((lead) => (
              <KanbanCard key={lead.id} lead={lead} />
            ))}
            {leads.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                Nenhum lead nesta etapa
              </div>
            )}
          </div>
        </SortableContext>
      </Card>
    </div>
  );
}
