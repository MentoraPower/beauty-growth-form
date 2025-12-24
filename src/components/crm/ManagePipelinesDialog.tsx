import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Pipeline } from "@/types/crm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, GripVertical, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface ManagePipelinesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: Pipeline[];
  subOriginId: string | null;
}

interface SortablePipelineItemProps {
  pipeline: Pipeline;
  editingId: string | null;
  editingName: string;
  setEditingId: (id: string | null) => void;
  setEditingName: (name: string) => void;
  updatePipeline: (id: string) => void;
  deletePipeline: (id: string) => void;
  isDragging?: boolean;
  isOverlay?: boolean;
}

function SortablePipelineItem({
  pipeline,
  editingId,
  editingName,
  setEditingId,
  setEditingName,
  updatePipeline,
  deletePipeline,
  isDragging = false,
  isOverlay = false,
  isFirst = false,
  isLast = false,
}: SortablePipelineItemProps & { isFirst?: boolean; isLast?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: pipeline.id, disabled: isOverlay });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: undefined,
  };

  const dragging = isDragging || isSortableDragging;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      className="relative"
    >
      {/* Connector line from top */}
      {!isFirst && !isOverlay && (
        <div className="absolute left-6 -top-3 w-0.5 h-3 bg-gradient-to-b from-muted-foreground/20 to-muted-foreground/40" />
      )}
      
      {/* Pipeline node */}
      <div
        className={cn(
          "group relative flex items-center gap-3 rounded-xl border-2 p-3 pl-4 transition-all",
          dragging && !isOverlay
            ? "opacity-30 border-dashed border-muted-foreground/30 bg-muted/10"
            : "bg-gradient-to-r from-background via-background to-muted/20 border-border/60 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
          isOverlay && "shadow-2xl border-primary/50 bg-background"
        )}
      >
        {/* Pipeline indicator dot */}
        <div 
          className={cn(
            "absolute -left-[7px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-background transition-all",
            dragging && !isOverlay ? "bg-muted-foreground/30" : "bg-primary shadow-md shadow-primary/30"
          )}
        />

        {/* Drag Handle */}
        <div
          {...(isOverlay ? {} : attributes)}
          {...(isOverlay ? {} : listeners)}
          className={cn(
            "p-1.5 -m-1 rounded-lg transition-all cursor-grab active:cursor-grabbing touch-none",
            isOverlay ? "opacity-100 bg-muted" : "opacity-40 group-hover:opacity-100 hover:bg-muted"
          )}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {editingId === pipeline.id && !isOverlay ? (
            <div className="flex items-center gap-2">
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") updatePipeline(pipeline.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="h-8 flex-1 text-sm"
              />
              <Button
                size="sm"
                className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => updatePipeline(pipeline.id)}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setEditingId(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <span className="font-medium text-sm truncate block">
              {pipeline.nome}
            </span>
          )}
        </div>

        {/* Actions */}
        {editingId !== pipeline.id && !isOverlay && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-muted"
              onClick={() => {
                setEditingId(pipeline.id);
                setEditingName(pipeline.nome);
              }}
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => deletePipeline(pipeline.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Connector line to bottom */}
      {!isLast && !isOverlay && (
        <div className="absolute left-6 -bottom-3 w-0.5 h-3 bg-gradient-to-b from-muted-foreground/40 to-muted-foreground/20" />
      )}
    </div>
  );
}

export function ManagePipelinesDialog({
  open,
  onOpenChange,
  pipelines,
  subOriginId,
}: ManagePipelinesDialogProps) {
  const queryClient = useQueryClient();
  const [newPipelineName, setNewPipelineName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localPipelines, setLocalPipelines] = useState<Pipeline[]>([]);

  // Sync local state with props
  useEffect(() => {
    const sorted = [...pipelines].sort((a, b) => a.ordem - b.ordem);
    setLocalPipelines(sorted);
  }, [pipelines]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activePipeline = activeId ? localPipelines.find(p => p.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = localPipelines.findIndex((p) => p.id === active.id);
    const newIndex = localPipelines.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic update - immediately update local state
    const reorderedPipelines = arrayMove(localPipelines, oldIndex, newIndex);
    setLocalPipelines(reorderedPipelines);

    // Background database update
    try {
      const updates = reorderedPipelines.map((pipeline, index) => ({
        id: pipeline.id,
        ordem: index,
      }));

      // Use Promise.all for parallel updates
      await Promise.all(
        updates.map((update) =>
          supabase
            .from("pipelines")
            .update({ ordem: update.ordem })
            .eq("id", update.id)
        )
      );

      queryClient.invalidateQueries({ queryKey: ["pipelines", subOriginId] });
    } catch (error) {
      // Revert on error
      setLocalPipelines([...pipelines].sort((a, b) => a.ordem - b.ordem));
      console.error("Erro ao reordenar pipelines:", error);
      toast.error("Erro ao reordenar pipelines");
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const addPipeline = async () => {
    if (!newPipelineName.trim()) return;

    try {
      const maxOrdem = Math.max(...pipelines.map((p) => p.ordem), -1);
      const { error } = await supabase.from("pipelines").insert({
        nome: newPipelineName,
        ordem: maxOrdem + 1,
        cor: "#6366f1",
        sub_origin_id: subOriginId,
      });

      if (error) throw error;

      setNewPipelineName("");
      queryClient.invalidateQueries({ queryKey: ["pipelines", subOriginId] });
      toast.success("Pipeline adicionada!");
    } catch (error) {
      console.error("Erro ao adicionar pipeline:", error);
      toast.error("Erro ao adicionar pipeline");
    }
  };

  const deletePipeline = async (id: string) => {
    try {
      const { error } = await supabase.from("pipelines").delete().eq("id", id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["pipelines", subOriginId] });
      toast.success("Pipeline removida!");
    } catch (error) {
      console.error("Erro ao remover pipeline:", error);
      toast.error("Erro ao remover pipeline");
    }
  };

  const updatePipeline = async (id: string) => {
    if (!editingName.trim()) return;

    try {
      const { error } = await supabase
        .from("pipelines")
        .update({ nome: editingName })
        .eq("id", id);

      if (error) throw error;

      setEditingId(null);
      setEditingName("");
      queryClient.invalidateQueries({ queryKey: ["pipelines", subOriginId] });
      toast.success("Pipeline atualizada!");
    } catch (error) {
      console.error("Erro ao atualizar pipeline:", error);
      toast.error("Erro ao atualizar pipeline");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-muted/30">
          <DialogTitle className="text-lg font-semibold">Gerenciar Pipelines</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-6 space-y-6">
          {/* Add New Pipeline */}
          <div className="flex gap-3">
            <Input
              placeholder="Nome da nova pipeline..."
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addPipeline();
              }}
              className="flex-1 h-11"
            />
            <Button 
              onClick={addPipeline} 
              className="h-11 px-6 bg-gradient-to-r from-orange-600 to-amber-500 text-white shrink-0"
            >
              <Plus className="w-5 h-5 mr-2" />
              Adicionar
            </Button>
          </div>

          {/* Vertical Pipeline Flow */}
          <div className="relative pl-4 space-y-6 max-h-[400px] overflow-y-auto pr-2 py-2">
            {/* Main pipeline track line */}
            {localPipelines.length > 1 && (
              <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gradient-to-b from-primary/20 via-muted-foreground/20 to-primary/20 rounded-full" />
            )}
            
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext
                items={localPipelines.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {localPipelines.map((pipeline, index) => (
                  <SortablePipelineItem
                    key={pipeline.id}
                    pipeline={pipeline}
                    editingId={editingId}
                    editingName={editingName}
                    setEditingId={setEditingId}
                    setEditingName={setEditingName}
                    updatePipeline={updatePipeline}
                    deletePipeline={deletePipeline}
                    isDragging={activeId === pipeline.id}
                    isFirst={index === 0}
                    isLast={index === localPipelines.length - 1}
                  />
                ))}
              </SortableContext>

              {typeof document !== "undefined"
                ? createPortal(
                    <DragOverlay
                      zIndex={99999}
                      dropAnimation={null}
                    >
                      {activePipeline ? (
                        <SortablePipelineItem
                          pipeline={activePipeline}
                          editingId={null}
                          editingName=""
                          setEditingId={() => {}}
                          setEditingName={() => {}}
                          updatePipeline={() => {}}
                          deletePipeline={() => {}}
                          isOverlay
                        />
                      ) : null}
                    </DragOverlay>,
                    document.body
                  )
                : null}
            </DndContext>
          </div>

          {pipelines.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Nenhuma pipeline criada ainda.</p>
              <p className="text-xs mt-1">Adicione uma pipeline usando o campo acima.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
