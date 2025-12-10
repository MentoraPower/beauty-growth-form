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
import { Plus, Trash2, GripVertical } from "lucide-react";

interface ManagePipelinesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: Pipeline[];
}

export function ManagePipelinesDialog({
  open,
  onOpenChange,
  pipelines,
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
        cor: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
      });

      if (error) throw error;

      setNewPipelineName("");
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      toast.success("Origem adicionada!");
    } catch (error) {
      console.error("Erro ao adicionar pipeline:", error);
      toast.error("Erro ao adicionar origem");
    }
  };

  const deletePipeline = async (id: string) => {
    try {
      const { error } = await supabase.from("pipelines").delete().eq("id", id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      toast.success("Origem removida!");
    } catch (error) {
      console.error("Erro ao remover pipeline:", error);
      toast.error("Erro ao remover origem");
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
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      toast.success("Origem atualizada!");
    } catch (error) {
      console.error("Erro ao atualizar pipeline:", error);
      toast.error("Erro ao atualizar origem");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Origens</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nome da nova origem"
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addPipeline();
              }}
            />
            <Button onClick={addPipeline}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>

          <div className="space-y-2">
            {pipelines.map((pipeline) => (
              <div
                key={pipeline.id}
                className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg border border-black/5"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: pipeline.cor }}
                />

                {editingId === pipeline.id ? (
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") updatePipeline(pipeline.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => updatePipeline(pipeline.id)}
                    autoFocus
                    className="flex-1"
                  />
                ) : (
                  <span
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      setEditingId(pipeline.id);
                      setEditingName(pipeline.nome);
                    }}
                  >
                    {pipeline.nome}
                  </span>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deletePipeline(pipeline.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
