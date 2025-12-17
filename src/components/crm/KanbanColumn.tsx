import { memo, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Lead, Pipeline } from "@/types/crm";
import { KanbanCard } from "./KanbanCard";

interface DropIndicator {
  pipelineId: string;
  position: "top" | "bottom";
  targetLeadId?: string;
}

interface KanbanColumnProps {
  pipeline: Pipeline;
  leads: Lead[];
  leadCount?: number; // Exact count from database (bypasses 1000 limit)
  isOver?: boolean;
  subOriginId?: string | null;
  activeId?: string | null;
  dropIndicator?: DropIndicator | null;
  activePipelineId?: string | null; // Pipeline do card sendo arrastado
}

export const KanbanColumn = memo(function KanbanColumn({ 
  pipeline, 
  leads, 
  leadCount,
  isOver, 
  subOriginId,
  activeId,
  dropIndicator,
  activePipelineId,
}: KanbanColumnProps) {
  // Use exact count if provided, fallback to leads array length
  const displayCount = leadCount !== undefined ? leadCount : leads.length;
  const { setNodeRef } = useDroppable({
    id: pipeline.id,
  });

  // Check if column is being targeted for drop
  const isTargeted = isOver || (dropIndicator?.pipelineId === pipeline.id);
  
  // Check if this is a cross-pipeline drag (card coming from different pipeline)
  const isCrossPipelineDrag = activeId && activePipelineId && activePipelineId !== pipeline.id;
  
  // Only show placeholder in EMPTY columns to avoid layout "bounce" when dropping
  const showTopPlaceholder = isTargeted && isCrossPipelineDrag && leads.length === 0;

  // IDs for SortableContext - must include all items
  const leadIds = useMemo(() => leads.map(l => l.id), [leads]);

  return (
    <div className="flex-shrink-0 w-80 flex flex-col min-h-0 relative">
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-0 rounded-xl rounded-b-none border border-b-0 transition-colors duration-100 flex flex-col overflow-hidden ${
          isTargeted
            ? "bg-black/[0.02] border-black/15 border-dashed"
            : "bg-muted/40 border-black/10"
        }`}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-black/5">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm">{pipeline.nome}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
              isTargeted 
                ? "bg-black/5 text-foreground" 
                : "text-muted-foreground bg-muted"
            }`}>
              {displayCount.toLocaleString('pt-BR')}
            </span>
          </div>
        </div>

        {/* Cards container */}
        <div className="p-3 flex-1 overflow-y-auto">
          <SortableContext
            items={leadIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 pb-12">
              {/* Top placeholder for cross-pipeline drag (only when column is empty) */}
              {showTopPlaceholder && (
                <div className="mb-2">
                  <div className="h-[100px] rounded-lg border-2 border-dashed border-black/20 bg-black/[0.03]" />
                </div>
              )}

              {leads.map((lead) => (
                <KanbanCard 
                  key={lead.id}
                  lead={lead} 
                  subOriginId={subOriginId}
                />
              ))}

              {/* Empty state */}
              {leads.length === 0 && !showTopPlaceholder && (
                <div className={`text-center text-sm py-8 rounded-lg border-2 border-dashed transition-colors duration-100 ${
                  isTargeted 
                    ? "border-black/20 text-foreground bg-black/[0.02]" 
                    : "border-transparent text-muted-foreground"
                }`}>
                  {isTargeted ? "Solte aqui" : "Nenhum lead"}
                </div>
              )}
            </div>
          </SortableContext>
        </div>
      </div>
      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none rounded-b-xl" />
    </div>
  );
});