import { useState } from "react";
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

interface ManagePipelinesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: Pipeline[];
  subOriginId: string | null;
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

          {/* Vertical Scroll Container */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {pipelines.map((pipeline) => (
              <div
                key={pipeline.id}
                className="group rounded-xl bg-gradient-to-br from-background to-muted/30 border border-border/60 p-4 transition-all duration-200 hover:border-border hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  {/* Drag Handle */}
                  <div className="opacity-40 group-hover:opacity-100 transition-opacity cursor-grab">
                    <GripVertical className="w-5 h-5 text-muted-foreground" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {editingId === pipeline.id ? (
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
                  {editingId !== pipeline.id && (
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
            ))}
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
