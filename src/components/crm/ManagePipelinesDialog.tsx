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
import { Plus, Trash2, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle>Gerenciar Pipelines</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-6 space-y-6 overflow-y-auto max-h-[calc(85vh-100px)]">
          {/* Add New Pipeline */}
          <div className="flex gap-2">
            <Input
              placeholder="Nome da nova pipeline"
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addPipeline();
              }}
              className="flex-1"
            />
            <Button onClick={addPipeline} className="bg-gradient-to-r from-[#F40000] to-[#A10000] text-white shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {/* Pipeline Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {pipelines.map((pipeline, index) => (
              <div
                key={pipeline.id}
                className={cn(
                  "p-4 rounded-xl border bg-card shadow-sm transition-all hover:shadow-md",
                  "min-h-[120px] flex flex-col justify-between"
                )}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Pipeline {index + 1}
                    </span>
                    {editingId === pipeline.id ? (
                      <div className="flex items-center gap-1 mt-1">
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
                          className="h-8 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 shrink-0"
                          onClick={() => updatePipeline(pipeline.id)}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      </div>
                    ) : (
                      <h3 className="font-semibold text-base mt-1 line-clamp-2">
                        {pipeline.nome}
                      </h3>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border/50">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-3 text-xs gap-1.5"
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
                    className="h-8 px-3 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deletePipeline(pipeline.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
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