import { memo, useRef, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Lead, Pipeline, LeadTag } from "@/types/crm";
import { KanbanCard } from "./KanbanCard";
import { InlineAddContact } from "./InlineAddContact";

interface DropIndicator {
  pipelineId: string;
  position: "top" | "bottom";
  targetLeadId?: string;
}

interface VirtualizedKanbanColumnProps {
  pipeline: Pipeline;
  leads: Lead[];
  leadCount?: number;
  isOver?: boolean;
  subOriginId?: string | null;
  activeId?: string | null;
  dropIndicator?: DropIndicator | null;
  activePipelineId?: string | null;
  tagsMap?: Map<string, LeadTag[]>;
  teamMembersMap?: Map<string, { name: string | null; photo_url: string | null }>;
}

const CARD_HEIGHT = 116; // Approximate height of a KanbanCard
const CARD_GAP = 8;

export const VirtualizedKanbanColumn = memo(function VirtualizedKanbanColumn({ 
  pipeline, 
  leads, 
  leadCount,
  isOver, 
  subOriginId,
  activeId,
  dropIndicator,
  activePipelineId,
  tagsMap,
  teamMembersMap,
}: VirtualizedKanbanColumnProps) {
  const displayCount = leadCount !== undefined ? leadCount : leads.length;
  const parentRef = useRef<HTMLDivElement>(null);
  
  const { setNodeRef } = useDroppable({
    id: pipeline.id,
  });

  // Check if column is being targeted for drop
  const isTargeted = isOver || (dropIndicator?.pipelineId === pipeline.id);
  
  // Check if this is a cross-pipeline drag
  const isCrossPipelineDrag = activeId && activePipelineId && activePipelineId !== pipeline.id;
  
  // Only show placeholder in EMPTY columns
  const showTopPlaceholder = isTargeted && isCrossPipelineDrag && leads.length === 0;

  // Virtual list setup
  const virtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => CARD_HEIGHT + CARD_GAP, []),
    overscan: 5, // Render 5 extra items above/below viewport
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Combine refs for droppable and scroll container
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node);
    (parentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [setNodeRef]);

  return (
    <div className="flex-shrink-0 w-80 flex flex-col min-h-0 relative">
      <div
        ref={setRefs}
        className={`flex-1 min-h-0 rounded-xl rounded-b-none border border-b-0 transition-colors duration-100 flex flex-col overflow-hidden ${
          isTargeted
            ? "bg-black/[0.02] border-black/15 border-dashed"
            : "bg-muted/40 border-black/10"
        }`}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2 border-b border-black/5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm">{pipeline.nome}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
              isTargeted 
                ? "bg-black/5 text-foreground" 
                : "text-muted-foreground bg-muted"
            }`}>
              {displayCount.toLocaleString('pt-BR')}
            </span>
          </div>
          <InlineAddContact pipelineId={pipeline.id} subOriginId={subOriginId || null} />
        </div>

        {/* Virtualized Cards container */}
        <div 
          ref={parentRef}
          className="flex-1 overflow-y-auto p-3"
        >
          <SortableContext
            items={leads.map(l => l.id)}
            strategy={verticalListSortingStrategy}
          >
            {/* Top placeholder for cross-pipeline drag (only when column is empty) */}
            {showTopPlaceholder && (
              <div className="mb-2">
                <div className="h-[100px] rounded-lg border-2 border-dashed border-black/20 bg-black/[0.03]" />
              </div>
            )}

            {leads.length > 0 ? (
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualItems.map((virtualItem) => {
                  const lead = leads[virtualItem.index];
                  return (
                    <div
                      key={lead.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                        paddingBottom: `${CARD_GAP}px`,
                      }}
                    >
                      <KanbanCard 
                        lead={lead} 
                        subOriginId={subOriginId}
                        tags={tagsMap?.get(lead.id) || []}
                        assignedMemberInfo={lead.assigned_to ? teamMembersMap?.get(lead.assigned_to) : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            ) : !showTopPlaceholder ? (
              <div className={`text-center text-sm py-8 rounded-lg border-2 border-dashed transition-colors duration-100 ${
                isTargeted 
                  ? "border-black/20 text-foreground bg-black/[0.02]" 
                  : "border-transparent text-muted-foreground"
              }`}>
                {isTargeted ? "Solte aqui" : "Nenhum lead"}
              </div>
            ) : null}
            
            {/* Extra padding at bottom for scroll area */}
            {leads.length > 0 && <div className="h-12" />}
          </SortableContext>
        </div>
      </div>
      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none rounded-b-xl" />
    </div>
  );
});
