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
}: SortablePipelineItemProps) {
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
    transition: undefined, // Sem transição para evitar pulo
  };

  const dragging = isDragging || isSortableDragging;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      className={cn(
        "group rounded-xl border p-4",
        dragging && !isOverlay
          ? "opacity-30 border-dashed border-muted-foreground/30 bg-muted/10"
          : "bg-gradient-to-br from-background to-muted/30 border-border/60 hover:border-border hover:shadow-md",
        isOverlay && "shadow-2xl border-border bg-background"
      )}
    >
      <div className="flex items-center gap-4">
        {/* Drag Handle */}
        <div
          {...(isOverlay ? {} : attributes)}
          {...(isOverlay ? {} : listeners)}
          className={cn(
            "p-1 -m-1 rounded transition-all cursor-grab active:cursor-grabbing touch-none",
            isOverlay ? "opacity-100" : "opacity-50 group-hover:opacity-100 hover:bg-muted"
          )}
        >
          <GripVertical className="w-5 h-5 text-muted-foreground pointer-events-none" />
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
                className="h-9 flex-1"
              />
              <Button
                size="sm"
                className="h-9 px-3 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => updatePipeline(pipeline.id)}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 px-3"
                onClick={() => setEditingId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <h3 className="font-medium text-sm truncate">
              {pipeline.nome}
            </h3>
          )}
        </div>

        {/* Actions */}
        {editingId !== pipeline.id && !isOverlay && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-xs gap-1.5 hover:bg-muted"
              onClick={() => {
                setEditingId(pipeline.id);
                setEditingName(pipeline.nome);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => deletePipeline(pipeline.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
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
              className="h-11 px-6 bg-gradient-to-r from-[#F40000] to-[#A10000] text-white shrink-0"
            >
              <Plus className="w-5 h-5 mr-2" />
              Adicionar
            </Button>
          </div>

          {/* Vertical Scroll Container with DnD */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
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
                {localPipelines.map((pipeline) => (
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
