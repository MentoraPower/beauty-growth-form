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
  isOver?: boolean;
  subOriginId?: string | null;
  activeId?: string | null;
  dropIndicator?: DropIndicator | null;
}

// Placeholder component for drop zones
const DropPlaceholder = memo(function DropPlaceholder({ isActive }: { isActive?: boolean }) {
  return (
    <div 
      className={`
        h-[120px] rounded-lg border-2 border-dashed transition-all duration-200
        ${isActive 
          ? "border-primary/60 bg-primary/5" 
          : "border-muted-foreground/20 bg-muted/20"
        }
      `}
    />
  );
});

export const KanbanColumn = memo(function KanbanColumn({ 
  pipeline, 
  leads, 
  isOver, 
  subOriginId,
  activeId,
  dropIndicator,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: pipeline.id,
  });

  // Check if this column should show a drop indicator at the top
  const showTopPlaceholder = useMemo(() => {
    if (!dropIndicator || !activeId) return false;
    return dropIndicator.pipelineId === pipeline.id && 
           dropIndicator.position === "top" && 
           !dropIndicator.targetLeadId;
  }, [dropIndicator, activeId, pipeline.id]);

  // Filter out the active dragging card from display
  const visibleLeads = useMemo(() => {
    if (!activeId) return leads;
    return leads.filter(l => l.id !== activeId);
  }, [leads, activeId]);

  // Check if column is being targeted for drop
  const isTargeted = isOver || (dropIndicator?.pipelineId === pipeline.id);

  return (
    <div className="flex-shrink-0 w-80 flex flex-col min-h-0 relative">
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-0 rounded-xl rounded-b-none border border-b-0 transition-all duration-200 flex flex-col overflow-hidden ${
          isTargeted
            ? "bg-muted/50 border-primary/30 border-dashed shadow-sm"
            : "bg-muted/40 border-black/10"
        }`}
      >
        {/* Header inside column */}
        <div className="px-4 pt-4 pb-3 border-b border-black/5">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm">{pipeline.nome}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
              isTargeted 
                ? "bg-primary/10 text-primary" 
                : "text-muted-foreground bg-muted"
            }`}>
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
            <div className="space-y-2 pb-12">
              {/* Top placeholder - shows when hovering at top of column */}
              {showTopPlaceholder && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-150">
                  <DropPlaceholder isActive />
                </div>
              )}

              {visibleLeads.map((lead, index) => {
                // Check if we should show placeholder above or below this card
                const showPlaceholderAbove = dropIndicator?.pipelineId === pipeline.id && 
                  dropIndicator?.position === "top" && 
                  dropIndicator?.targetLeadId === lead.id;
                
                const showPlaceholderBelow = dropIndicator?.pipelineId === pipeline.id && 
                  dropIndicator?.position === "bottom" && 
                  dropIndicator?.targetLeadId === lead.id;

                return (
                  <div key={lead.id}>
                    {/* Placeholder above card */}
                    {showPlaceholderAbove && (
                      <div className="mb-2 animate-in fade-in slide-in-from-top-2 duration-150">
                        <DropPlaceholder isActive />
                      </div>
                    )}
                    
                    <div 
                      className="animate-in fade-in slide-in-from-bottom-2 duration-200"
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      <KanbanCard 
                        lead={lead} 
                        subOriginId={subOriginId}
                      />
                    </div>

                    {/* Placeholder below card */}
                    {showPlaceholderBelow && (
                      <div className="mt-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <DropPlaceholder isActive />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Empty state */}
              {visibleLeads.length === 0 && !showTopPlaceholder && (
                <div className={`text-center text-sm py-8 rounded-lg border-2 border-dashed transition-all duration-200 ${
                  isTargeted 
                    ? "border-primary/40 text-primary bg-primary/5" 
                    : "border-transparent text-muted-foreground"
                }`}>
                  {isTargeted ? "Solte aqui" : "Nenhum lead"}
                </div>
              )}

              {/* Bottom drop zone when column is targeted but no specific position */}
              {isTargeted && visibleLeads.length > 0 && !dropIndicator?.targetLeadId && !showTopPlaceholder && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <DropPlaceholder isActive />
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
