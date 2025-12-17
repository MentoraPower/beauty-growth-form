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

// Placeholder component - simple, no animations
const DropPlaceholder = memo(function DropPlaceholder() {
  return (
    <div 
      className="h-[100px] rounded-lg border-2 border-dashed border-black/20 bg-black/[0.02]"
    />
  );
});

// Top drop zone component - always present when dragging
const TopDropZone = memo(function TopDropZone({ 
  pipelineId, 
  showPlaceholder 
}: { 
  pipelineId: string; 
  showPlaceholder: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${pipelineId}-top-zone`,
    data: { pipelineId, isTopZone: true },
  });

  const isActive = isOver || showPlaceholder;

  return (
    <div 
      ref={setNodeRef}
      className="transition-all duration-200 ease-out"
      style={{
        height: isActive ? 108 : 8, // 100px + 8px margin
        marginBottom: isActive ? 8 : 0,
      }}
    >
      {isActive && <DropPlaceholder />}
    </div>
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

  // Filter out the active dragging card from display
  const visibleLeads = useMemo(() => {
    if (!activeId) return leads;
    return leads.filter(l => l.id !== activeId);
  }, [leads, activeId]);

  // Check if this column should show a drop indicator at the top (no specific target)
  const showTopPlaceholder = useMemo(() => {
    if (!dropIndicator || !activeId) return false;
    return dropIndicator.pipelineId === pipeline.id && 
           dropIndicator.position === "top" && 
           !dropIndicator.targetLeadId;
  }, [dropIndicator, activeId, pipeline.id]);

  // Check if column is being targeted for drop
  const isTargeted = isOver || (dropIndicator?.pipelineId === pipeline.id);

  return (
    <div className="flex-shrink-0 w-80 flex flex-col min-h-0 relative">
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-0 rounded-xl rounded-b-none border border-b-0 transition-colors duration-150 flex flex-col overflow-hidden ${
          isTargeted
            ? "bg-black/[0.02] border-black/15 border-dashed"
            : "bg-muted/40 border-black/10"
        }`}
      >
        {/* Header inside column */}
        <div className="px-4 pt-4 pb-3 border-b border-black/5">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm">{pipeline.nome}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
              isTargeted 
                ? "bg-black/5 text-foreground" 
                : "text-muted-foreground bg-muted"
            }`}>
              {leads.length}
            </span>
          </div>
        </div>

        {/* Cards container */}
        <div className="p-3 flex-1 overflow-y-auto">
          {/* Top drop zone - only visible when dragging and column has cards */}
          {activeId && (
            <TopDropZone 
              pipelineId={pipeline.id} 
              showPlaceholder={showTopPlaceholder && visibleLeads.length > 0}
            />
          )}
          
          <SortableContext
            items={leads.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 pb-12">
              {/* Top placeholder for empty column */}
              {showTopPlaceholder && visibleLeads.length === 0 && (
                <DropPlaceholder />
              )}

              {visibleLeads.map((lead) => {
                // Check if we should show placeholder above or below this card
                const showPlaceholderAbove = dropIndicator?.pipelineId === pipeline.id && 
                  dropIndicator?.position === "top" && 
                  dropIndicator?.targetLeadId === lead.id;
                
                const showPlaceholderBelow = dropIndicator?.pipelineId === pipeline.id && 
                  dropIndicator?.position === "bottom" && 
                  dropIndicator?.targetLeadId === lead.id;

                return (
                  <div key={lead.id}>
                    {/* Placeholder above card - smooth height transition */}
                    <div 
                      className="transition-all duration-200 ease-out overflow-hidden"
                      style={{
                        height: showPlaceholderAbove ? 108 : 0,
                        marginBottom: showPlaceholderAbove ? 8 : 0,
                        opacity: showPlaceholderAbove ? 1 : 0,
                      }}
                    >
                      <DropPlaceholder />
                    </div>
                    
                    <KanbanCard 
                      lead={lead} 
                      subOriginId={subOriginId}
                    />

                    {/* Placeholder below card - smooth height transition */}
                    <div 
                      className="transition-all duration-200 ease-out overflow-hidden"
                      style={{
                        height: showPlaceholderBelow ? 108 : 0,
                        marginTop: showPlaceholderBelow ? 8 : 0,
                        opacity: showPlaceholderBelow ? 1 : 0,
                      }}
                    >
                      <DropPlaceholder />
                    </div>
                  </div>
                );
              })}

              {/* Empty state */}
              {visibleLeads.length === 0 && !showTopPlaceholder && (
                <div className={`text-center text-sm py-8 rounded-lg border-2 border-dashed transition-colors duration-150 ${
                  isTargeted 
                    ? "border-black/20 text-foreground bg-black/[0.02]" 
                    : "border-transparent text-muted-foreground"
                }`}>
                  {isTargeted ? "Solte aqui" : "Nenhum lead"}
                </div>
              )}

              {/* Bottom drop zone when column is targeted but no specific position */}
              {isTargeted && visibleLeads.length > 0 && !dropIndicator?.targetLeadId && !showTopPlaceholder && (
                <DropPlaceholder />
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