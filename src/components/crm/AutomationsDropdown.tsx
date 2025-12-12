import { useState } from "react";
import { Zap, Plus, Trash2, ArrowRight, Webhook, FolderSync, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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

type ActiveView = "menu" | "origin" | "webhook";
type WebhookTab = "receive" | "send";

export function AutomationsDropdown({ pipelines, subOriginId }: AutomationsDropdownProps) {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<ActiveView>("menu");
  const [webhookTab, setWebhookTab] = useState<WebhookTab>("receive");
  const [selectedSourcePipeline, setSelectedSourcePipeline] = useState<string>("");
  const [webhookScope, setWebhookScope] = useState<"all" | "origin" | "sub_origin">("all");
  const [webhookOriginId, setWebhookOriginId] = useState<string>("");
  const [webhookSubOriginId, setWebhookSubOriginId] = useState<string>("");
  const [copied, setCopied] = useState(false);

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

  const getTargetPipelines = (targetSubOriginId: string | null) => {
    if (!targetSubOriginId) return [];
    return allPipelines.filter(p => p.sub_origin_id === targetSubOriginId);
  };

  // Generate webhook URL based on scope
  const getWebhookUrl = () => {
    const baseUrl = `https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/crm-webhook`;
    if (webhookScope === "all") {
      return baseUrl;
    } else if (webhookScope === "origin" && webhookOriginId) {
      return `${baseUrl}?origin_id=${webhookOriginId}`;
    } else if (webhookScope === "sub_origin" && webhookSubOriginId) {
      return `${baseUrl}?sub_origin_id=${webhookSubOriginId}`;
    }
    return baseUrl;
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(getWebhookUrl());
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBack = () => {
    setActiveView("menu");
  };

  return (
    <DropdownMenu onOpenChange={(open) => { if (!open) setActiveView("menu"); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 relative border-border">
          <Zap className="w-4 h-4 text-amber-500" />
          {activeAutomationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-medium flex items-center justify-center bg-amber-500 text-white rounded-full">
              {activeAutomationsCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[420px] bg-popover z-[9999] p-0 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            {activeView !== "menu" && (
              <button
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>
            )}
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold">
              {activeView === "menu" && "Automações"}
              {activeView === "origin" && "Criar na Origem"}
              {activeView === "webhook" && "Webhook"}
            </span>
          </div>
        </div>

        {/* Menu View */}
        {activeView === "menu" && (
          <div className="p-3 space-y-2">
            <button
              onClick={() => setActiveView("origin")}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <FolderSync className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium block">Criar na Origem</span>
                <span className="text-xs text-muted-foreground">Mover leads entre pipelines</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </button>

            <button
              onClick={() => setActiveView("webhook")}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Webhook className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium block">Webhook</span>
                <span className="text-xs text-muted-foreground">Integrar com sistemas externos</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Origin Automation View */}
        {activeView === "origin" && (
          <div className="p-4 space-y-4">
            {/* Create new automation */}
            <div className="space-y-3">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Nova automação
              </span>
              <div className="flex items-center gap-2">
                <Select value={selectedSourcePipeline} onValueChange={setSelectedSourcePipeline}>
                  <SelectTrigger className="flex-1 h-9 text-xs">
                    <SelectValue placeholder="Quando lead chegar em..." />
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
                  className="h-9 px-4 bg-gradient-to-r from-[#F40000] to-[#A10000] text-white"
                  onClick={createAutomation}
                  disabled={!selectedSourcePipeline}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Existing automations */}
            <div className="space-y-3">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Automações ativas ({automations.length})
              </span>
              
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {automations.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/50">
                    Nenhuma automação configurada
                  </div>
                ) : (
                  automations.map((automation) => (
                    <div
                      key={automation.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        automation.is_active 
                          ? "bg-amber-500/5 border-amber-500/20" 
                          : "bg-muted/20 border-border/50 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateAutomation(automation.id, { is_active: !automation.is_active })}
                            className={`relative w-9 h-5 rounded-full transition-colors ${
                              automation.is_active ? "bg-amber-500" : "bg-muted"
                            }`}
                          >
                            <span
                              className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                                automation.is_active ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                          <span className="text-xs font-medium">
                            {getPipelineName(automation.pipeline_id)}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-destructive/10"
                          onClick={() => deleteAutomation(automation.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-16 flex-shrink-0">Origem:</span>
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
                            <SelectTrigger className="flex-1 h-7 text-xs">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent className="z-[10000]">
                              {origins.map((origin) => (
                                <SelectItem key={origin.id} value={origin.id}>
                                  {origin.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-16 flex-shrink-0">Sub-origem:</span>
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
                            <SelectTrigger className="flex-1 h-7 text-xs">
                              <SelectValue placeholder="Selecione..." />
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
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-16 flex-shrink-0">Pipeline:</span>
                          <Select
                            value={automation.target_pipeline_id || ""}
                            onValueChange={(value) => {
                              updateAutomation(automation.id, { target_pipeline_id: value });
                            }}
                            disabled={!automation.target_sub_origin_id}
                          >
                            <SelectTrigger className="flex-1 h-7 text-xs">
                              <SelectValue placeholder="Selecione..." />
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
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Webhook View */}
        {activeView === "webhook" && (
          <div className="p-4 space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
              <button
                onClick={() => setWebhookTab("receive")}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors ${
                  webhookTab === "receive"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Receber
              </button>
              <button
                onClick={() => setWebhookTab("send")}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors ${
                  webhookTab === "send"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Enviar
              </button>
            </div>

            {webhookTab === "receive" && (
              <div className="space-y-4">
                {/* Scope Selection */}
                <div className="space-y-2">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Escopo do webhook
                  </span>
                  <Select value={webhookScope} onValueChange={(v: "all" | "origin" | "sub_origin") => {
                    setWebhookScope(v);
                    setWebhookOriginId("");
                    setWebhookSubOriginId("");
                  }}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="all">Todas as origens</SelectItem>
                      <SelectItem value="origin">Origem específica</SelectItem>
                      <SelectItem value="sub_origin">Sub-origem específica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Origin Selection */}
                {webhookScope === "origin" && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Selecione a origem
                    </span>
                    <Select value={webhookOriginId} onValueChange={setWebhookOriginId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="z-[10000]">
                        {origins.map((origin) => (
                          <SelectItem key={origin.id} value={origin.id}>
                            {origin.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Sub-origin Selection */}
                {webhookScope === "sub_origin" && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Selecione a sub-origem
                    </span>
                    <Select value={webhookSubOriginId} onValueChange={setWebhookSubOriginId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="z-[10000]">
                        {subOrigins.map((subOrigin) => {
                          const origin = origins.find(o => o.id === subOrigin.origin_id);
                          return (
                            <SelectItem key={subOrigin.id} value={subOrigin.id}>
                              {origin?.nome} / {subOrigin.nome}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Webhook URL */}
                <div className="space-y-2">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    URL do Webhook
                  </span>
                  <div className="flex gap-2">
                    <Input
                      value={getWebhookUrl()}
                      readOnly
                      className="flex-1 h-9 text-xs bg-muted/30 font-mono"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3"
                      onClick={copyWebhookUrl}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Envie um POST para esta URL para criar leads automaticamente.
                  </p>
                </div>
              </div>
            )}

            {webhookTab === "send" && (
              <div className="text-center py-8 text-muted-foreground">
                <Webhook className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Em breve</p>
                <p className="text-[10px] mt-1">Envie dados para sistemas externos</p>
              </div>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
