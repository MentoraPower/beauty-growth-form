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

          {/* Horizontal Scroll Container */}
          <div className="relative">
            <div className="overflow-x-auto pb-4 -mx-2 px-2">
              <div className="flex gap-4 min-w-max">
                {pipelines.map((pipeline, index) => (
                  <div
                    key={pipeline.id}
                    className="group relative w-56 flex-shrink-0"
                  >
                    {/* Modern Card */}
                    <div className="h-40 rounded-2xl bg-gradient-to-br from-background to-muted/50 border border-border/60 p-4 flex flex-col transition-all duration-200 hover:border-border hover:shadow-lg hover:shadow-black/5">
                      {/* Card Number Badge */}
                      <div className="absolute -top-2 -left-2 w-7 h-7 rounded-lg bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center shadow-md">
                        <span className="text-[11px] font-bold text-white">{index + 1}</span>
                      </div>

                      {/* Drag Handle */}
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-2">
                        {editingId === pipeline.id ? (
                          <div className="space-y-2">
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
                              className="h-9 text-sm"
                            />
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                className="flex-1 h-8 bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => updatePipeline(pipeline.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <h3 className="font-semibold text-base leading-tight line-clamp-2">
                            {pipeline.nome}
                          </h3>
                        )}
                      </div>

                      {/* Actions */}
                      {editingId !== pipeline.id && (
                        <div className="flex items-center gap-2 pt-3 border-t border-border/40">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1 h-8 text-xs gap-1.5 hover:bg-muted"
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

                {/* Add New Card Placeholder */}
                <button
                  onClick={() => document.querySelector<HTMLInputElement>('input[placeholder="Nome da nova pipeline..."]')?.focus()}
                  className="w-56 h-40 flex-shrink-0 rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/40 bg-muted/20 hover:bg-muted/40 transition-all duration-200 flex flex-col items-center justify-center gap-2 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-muted/50 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                    <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    Nova pipeline
                  </span>
                </button>
              </div>
            </div>

            {/* Scroll Indicators */}
            {pipelines.length > 3 && (
              <>
                <div className="absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
              </>
            )}
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
