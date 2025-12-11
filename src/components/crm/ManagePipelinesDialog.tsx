import { useState, useEffect } from "react";
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
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Check, Zap, ChevronRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ManagePipelinesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: Pipeline[];
}

interface Origin {
  id: string;
  nome: string;
}

interface SubOrigin {
  id: string;
  origin_id: string;
  nome: string;
}

interface Automation {
  id: string;
  pipeline_id: string;
  target_type: 'sub_origin' | 'origin';
  target_sub_origin_id: string | null;
  target_origin_id: string | null;
  target_pipeline_id: string | null;
  is_active: boolean;
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
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);

  // Fetch origins and sub-origins
  const { data: origins = [] } = useQuery({
    queryKey: ["crm-origins"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_origins").select("*").order("ordem");
      return data as Origin[] || [];
    },
  });

  const { data: subOrigins = [] } = useQuery({
    queryKey: ["crm-sub-origins"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_sub_origins").select("*").order("ordem");
      return data as SubOrigin[] || [];
    },
  });

  // Fetch automations
  const { data: automations = [], refetch: refetchAutomations } = useQuery({
    queryKey: ["pipeline-automations"],
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_automations").select("*");
      return data as Automation[] || [];
    },
  });

  const addPipeline = async () => {
    if (!newPipelineName.trim()) return;

    try {
      const maxOrdem = Math.max(...pipelines.map((p) => p.ordem), -1);
      const { error } = await supabase.from("pipelines").insert({
        nome: newPipelineName,
        ordem: maxOrdem + 1,
        cor: "#6366f1",
      });

      if (error) throw error;

      setNewPipelineName("");
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
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

      if (selectedPipeline === id) {
        setSelectedPipeline(null);
      }
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
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
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      toast.success("Pipeline atualizada!");
    } catch (error) {
      console.error("Erro ao atualizar pipeline:", error);
      toast.error("Erro ao atualizar pipeline");
    }
  };

  const createAutomation = async (pipelineId: string) => {
    try {
      const { error } = await supabase.from("pipeline_automations").insert({
        pipeline_id: pipelineId,
        target_type: 'sub_origin',
        is_active: true,
      });

      if (error) throw error;

      refetchAutomations();
      toast.success("Automação criada!");
    } catch (error) {
      console.error("Erro ao criar automação:", error);
      toast.error("Erro ao criar automação");
    }
  };

  const updateAutomation = async (
    automationId: string, 
    updates: Partial<Automation>
  ) => {
    try {
      const { error } = await supabase
        .from("pipeline_automations")
        .update(updates)
        .eq("id", automationId);

      if (error) throw error;

      refetchAutomations();
    } catch (error) {
      console.error("Erro ao atualizar automação:", error);
      toast.error("Erro ao atualizar automação");
    }
  };

  const deleteAutomation = async (automationId: string) => {
    try {
      const { error } = await supabase
        .from("pipeline_automations")
        .delete()
        .eq("id", automationId);

      if (error) throw error;

      refetchAutomations();
      toast.success("Automação removida!");
    } catch (error) {
      console.error("Erro ao remover automação:", error);
      toast.error("Erro ao remover automação");
    }
  };

  const selectedPipelineAutomations = automations.filter(
    a => a.pipeline_id === selectedPipeline
  );

  const getOriginName = (originId: string | null) => {
    if (!originId) return "";
    return origins.find(o => o.id === originId)?.nome || "";
  };

  const getSubOriginName = (subOriginId: string | null) => {
    if (!subOriginId) return "";
    return subOrigins.find(s => s.id === subOriginId)?.nome || "";
  };

  const getPipelineName = (pipelineId: string | null) => {
    if (!pipelineId) return "";
    return pipelines.find(p => p.id === pipelineId)?.nome || "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Gerenciar Pipelines</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New Pipeline */}
          <div className="flex gap-2">
            <Input
              placeholder="Nome da nova pipeline"
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addPipeline();
              }}
              className="max-w-xs"
            />
            <Button onClick={addPipeline} className="bg-gradient-to-r from-[#F40000] to-[#A10000] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {/* Horizontal Pipeline Cards */}
          <div className="relative">
            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-4">
                {pipelines.map((pipeline) => (
                  <div
                    key={pipeline.id}
                    className={cn(
                      "flex-shrink-0 w-48 p-4 rounded-xl border-2 transition-all cursor-pointer",
                      selectedPipeline === pipeline.id
                        ? "border-[#F40000]/50 bg-[#F40000]/5"
                        : "border-border/50 bg-muted/20 hover:border-border"
                    )}
                    onClick={() => setSelectedPipeline(
                      selectedPipeline === pipeline.id ? null : pipeline.id
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      {editingId === pipeline.id ? (
                        <div className="flex items-center gap-1 flex-1">
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
                            className="h-7 text-sm"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              updatePipeline(pipeline.id);
                            }}
                          >
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(null);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="font-medium text-sm truncate flex-1">
                          {pipeline.nome}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(pipeline.id);
                            setEditingName(pipeline.nome);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePipeline(pipeline.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>

                      {/* Automation indicator */}
                      {automations.some(a => a.pipeline_id === pipeline.id && a.is_active) && (
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          <Zap className="h-3 w-3" />
                          <span>Auto</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          {/* Automation Panel */}
          {selectedPipeline && (
            <div className="border rounded-xl p-4 bg-muted/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  <h3 className="font-semibold">
                    Automações - {getPipelineName(selectedPipeline)}
                  </h3>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => createAutomation(selectedPipeline)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nova Automação
                </Button>
              </div>

              {selectedPipelineAutomations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma automação configurada. Crie uma para mover cards automaticamente.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedPipelineAutomations.map((automation) => (
                    <div
                      key={automation.id}
                      className="flex items-center gap-3 p-3 bg-background rounded-lg border"
                    >
                      <Switch
                        checked={automation.is_active}
                        onCheckedChange={(checked) => 
                          updateAutomation(automation.id, { is_active: checked })
                        }
                      />

                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm text-muted-foreground">
                          Mover para
                        </span>
                        
                        <Select
                          value={automation.target_type}
                          onValueChange={(value: 'sub_origin' | 'origin') => 
                            updateAutomation(automation.id, { 
                              target_type: value,
                              target_sub_origin_id: null,
                              target_origin_id: null,
                              target_pipeline_id: null,
                            })
                          }
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sub_origin">Sub-origem</SelectItem>
                            <SelectItem value="origin">Origem</SelectItem>
                          </SelectContent>
                        </Select>

                        <ArrowRight className="h-4 w-4 text-muted-foreground" />

                        {automation.target_type === 'sub_origin' ? (
                          <Select
                            value={automation.target_sub_origin_id || ""}
                            onValueChange={(value) => {
                              const subOrigin = subOrigins.find(s => s.id === value);
                              updateAutomation(automation.id, { 
                                target_sub_origin_id: value,
                                target_origin_id: subOrigin?.origin_id || null,
                              });
                            }}
                          >
                            <SelectTrigger className="w-40 h-8">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {subOrigins.map((subOrigin) => (
                                <SelectItem key={subOrigin.id} value={subOrigin.id}>
                                  {getOriginName(subOrigin.origin_id)} / {subOrigin.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={automation.target_origin_id || ""}
                            onValueChange={(value) => 
                              updateAutomation(automation.id, { target_origin_id: value })
                            }
                          >
                            <SelectTrigger className="w-40 h-8">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {origins.map((origin) => (
                                <SelectItem key={origin.id} value={origin.id}>
                                  {origin.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {/* Target Pipeline */}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Select
                          value={automation.target_pipeline_id || ""}
                          onValueChange={(value) => 
                            updateAutomation(automation.id, { target_pipeline_id: value })
                          }
                        >
                          <SelectTrigger className="w-36 h-8">
                            <SelectValue placeholder="Pipeline..." />
                          </SelectTrigger>
                          <SelectContent>
                            {pipelines.map((pipeline) => (
                              <SelectItem key={pipeline.id} value={pipeline.id}>
                                {pipeline.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => deleteAutomation(automation.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}