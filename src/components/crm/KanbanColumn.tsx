import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Lead, Pipeline } from "@/types/crm";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  pipeline: Pipeline;
  leads: Lead[];
  isOver?: boolean;
}

export function KanbanColumn({ pipeline, leads, isOver }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
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
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`p-3 min-h-[500px] rounded-xl border transition-all duration-150 ${
          isOver
            ? "bg-primary/5 border-primary/30 shadow-lg"
            : "bg-muted/20 border-black/5"
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
              <div className={`text-center text-sm py-8 rounded-lg border-2 border-dashed transition-colors ${
                isOver ? "border-primary/30 text-primary" : "border-transparent text-muted-foreground"
              }`}>
                {isOver ? "Solte aqui" : "Nenhum lead"}
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
