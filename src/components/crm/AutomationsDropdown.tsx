import { useState, useEffect } from "react";
import { Zap, Plus, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pipeline } from "@/types/crm";

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
  target_type: string;
  target_sub_origin_id: string | null;
  target_origin_id: string | null;
  target_pipeline_id: string | null;
  is_active: boolean;
  sub_origin_id: string | null;
}

interface AutomationsDropdownProps {
  pipelines: Pipeline[];
  subOriginId: string | null;
}

export function AutomationsDropdown({ pipelines, subOriginId }: AutomationsDropdownProps) {
  const queryClient = useQueryClient();
  const [selectedSourcePipeline, setSelectedSourcePipeline] = useState<string>("");

  // Fetch origins
  const { data: origins = [] } = useQuery({
    queryKey: ["crm-origins"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_origins").select("*").order("ordem");
      return data as Origin[] || [];
    },
  });

  // Fetch sub-origins
  const { data: subOrigins = [] } = useQuery({
    queryKey: ["crm-sub-origins"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_sub_origins").select("*").order("ordem");
      return data as SubOrigin[] || [];
    },
  });

  // Fetch all pipelines for target selection
  const { data: allPipelines = [] } = useQuery({
    queryKey: ["all-pipelines"],
    queryFn: async () => {
      const { data } = await supabase.from("pipelines").select("*").order("ordem");
      return data as Pipeline[] || [];
    },
  });

  // Fetch automations
  const { data: automations = [], refetch: refetchAutomations } = useQuery({
    queryKey: ["pipeline-automations", subOriginId],
    queryFn: async () => {
      let query = supabase.from("pipeline_automations").select("*");
      if (subOriginId) {
        query = query.eq("sub_origin_id", subOriginId);
      }
      const { data } = await query;
      return data as Automation[] || [];
    },
  });

  const activeAutomationsCount = automations.filter(a => a.is_active).length;

  const getOriginName = (originId: string | null) => {
    if (!originId) return "";
    return origins.find(o => o.id === originId)?.nome || "";
  };

  const getSubOriginName = (subOriginId: string | null) => {
    if (!subOriginId) return "";
    return subOrigins.find(s => s.id === subOriginId)?.nome || "";
  };

  const getPipelineName = (pipelineId: string | null, pipelineList: Pipeline[] = pipelines) => {
    if (!pipelineId) return "";
    return pipelineList.find(p => p.id === pipelineId)?.nome || "";
  };

  const createAutomation = async () => {
    if (!selectedSourcePipeline) {
      toast.error("Selecione uma pipeline de origem");
      return;
    }

    try {
      const { error } = await supabase.from("pipeline_automations").insert({
        pipeline_id: selectedSourcePipeline,
        target_type: 'sub_origin',
        is_active: true,
        sub_origin_id: subOriginId,
      });

      if (error) throw error;

      refetchAutomations();
      queryClient.invalidateQueries({ queryKey: ["pipeline-automations", subOriginId] });
      toast.success("Automação criada!");
      setSelectedSourcePipeline("");
    } catch (error) {
      console.error("Erro ao criar automação:", error);
      toast.error("Erro ao criar automação");
    }
  };

  const updateAutomation = async (automationId: string, updates: Partial<Automation>) => {
    try {
      const { error } = await supabase
        .from("pipeline_automations")
        .update(updates)
        .eq("id", automationId);

      if (error) throw error;

      refetchAutomations();
      queryClient.invalidateQueries({ queryKey: ["pipeline-automations", subOriginId] });
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
      queryClient.invalidateQueries({ queryKey: ["pipeline-automations", subOriginId] });
      toast.success("Automação removida!");
    } catch (error) {
      console.error("Erro ao remover automação:", error);
      toast.error("Erro ao remover automação");
    }
  };

  // Get pipelines for selected target sub-origin
  const getTargetPipelines = (targetSubOriginId: string | null) => {
    if (!targetSubOriginId) return [];
    return allPipelines.filter(p => p.sub_origin_id === targetSubOriginId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative">
          <Zap className="w-4 h-4 text-amber-500" />
          {activeAutomationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-medium flex items-center justify-center bg-amber-500 text-white rounded-full">
              {activeAutomationsCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[500px] bg-popover z-[9999] p-4">
        <DropdownMenuLabel className="flex items-center gap-2 text-base font-semibold pb-2">
          <Zap className="w-4 h-4 text-amber-500" />
          Automações de Pipeline
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Create new automation */}
        <div className="py-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Mova leads automaticamente quando chegarem em uma pipeline
          </p>
          <div className="flex items-center gap-2">
            <Select value={selectedSourcePipeline} onValueChange={setSelectedSourcePipeline}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Selecione pipeline de origem..." />
              </SelectTrigger>
              <SelectContent className="z-[10000]">
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 bg-gradient-to-r from-[#F40000] to-[#A10000] text-white"
              onClick={createAutomation}
              disabled={!selectedSourcePipeline}
            >
              <Plus className="w-4 h-4 mr-1" />
              Criar
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Existing automations */}
        <div className="py-2 space-y-2 max-h-[300px] overflow-y-auto">
          {automations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma automação configurada
            </p>
          ) : (
            automations.map((automation) => (
              <div
                key={automation.id}
                className="p-3 bg-muted/30 rounded-lg border space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={automation.is_active}
                      onCheckedChange={(checked) =>
                        updateAutomation(automation.id, { is_active: checked })
                      }
                      className="scale-75"
                    />
                    <span className="text-xs font-medium">
                      {getPipelineName(automation.pipeline_id)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => deleteAutomation(automation.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Mover para:</span>
                  
                  {/* Select Origin */}
                  <Select
                    value={automation.target_origin_id || ""}
                    onValueChange={(value) => {
                      updateAutomation(automation.id, {
                        target_origin_id: value,
                        target_sub_origin_id: null,
                        target_pipeline_id: null,
                      });
                    }}
                  >
                    <SelectTrigger className="w-28 h-7 text-xs">
                      <SelectValue placeholder="Origem..." />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      {origins.map((origin) => (
                        <SelectItem key={origin.id} value={origin.id}>
                          {origin.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <ArrowRight className="h-3 w-3 text-muted-foreground" />

                  {/* Select Sub-Origin */}
                  <Select
                    value={automation.target_sub_origin_id || ""}
                    onValueChange={(value) => {
                      updateAutomation(automation.id, {
                        target_sub_origin_id: value,
                        target_pipeline_id: null,
                      });
                    }}
                    disabled={!automation.target_origin_id}
                  >
                    <SelectTrigger className="w-28 h-7 text-xs">
                      <SelectValue placeholder="Sub-origem..." />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      {subOrigins
                        .filter(s => s.origin_id === automation.target_origin_id)
                        .map((subOrigin) => (
                          <SelectItem key={subOrigin.id} value={subOrigin.id}>
                            {subOrigin.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <ArrowRight className="h-3 w-3 text-muted-foreground" />

                  {/* Select Target Pipeline */}
                  <Select
                    value={automation.target_pipeline_id || ""}
                    onValueChange={(value) => {
                      updateAutomation(automation.id, { target_pipeline_id: value });
                    }}
                    disabled={!automation.target_sub_origin_id}
                  >
                    <SelectTrigger className="w-28 h-7 text-xs">
                      <SelectValue placeholder="Pipeline..." />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      {getTargetPipelines(automation.target_sub_origin_id).map((pipeline) => (
                        <SelectItem key={pipeline.id} value={pipeline.id}>
                          {pipeline.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
