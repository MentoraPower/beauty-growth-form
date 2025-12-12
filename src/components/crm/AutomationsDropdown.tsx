import { useState } from "react";
import { Zap, Plus, Trash2, ArrowRight, Webhook, FolderSync, Copy, Check, Send, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

interface CrmWebhook {
  id: string;
  name: string;
  type: "receive" | "send";
  url: string | null;
  scope: "all" | "origin" | "sub_origin";
  origin_id: string | null;
  sub_origin_id: string | null;
  trigger: string | null;
  trigger_pipeline_id: string | null;
  is_active: boolean;
}

interface AutomationsDropdownProps {
  pipelines: Pipeline[];
  subOriginId: string | null;
}

type ActiveView = "menu" | "origin" | "webhook";

export function AutomationsDropdown({ pipelines, subOriginId }: AutomationsDropdownProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("menu");
  const [selectedSourcePipeline, setSelectedSourcePipeline] = useState<string>("");
  
  // Create webhook states
  const [isCreating, setIsCreating] = useState(false);
  const [webhookName, setWebhookName] = useState("");
  const [webhookType, setWebhookType] = useState<"receive" | "send">("receive");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookScope, setWebhookScope] = useState<"all" | "origin" | "sub_origin">("all");
  const [webhookOriginId, setWebhookOriginId] = useState<string>("");
  const [webhookSubOriginId, setWebhookSubOriginId] = useState<string>("");
  const [webhookTrigger, setWebhookTrigger] = useState<string>("");
  const [webhookTriggerPipelineId, setWebhookTriggerPipelineId] = useState<string>("");
  
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

  // Fetch webhooks
  const { data: webhooks = [], refetch: refetchWebhooks } = useQuery({
    queryKey: ["crm-webhooks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_webhooks")
        .select("*")
        .order("created_at", { ascending: false });
      return (data || []) as CrmWebhook[];
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

  const getSendTriggerPipelines = () => {
    if (webhookScope === "sub_origin" && webhookSubOriginId) {
      return allPipelines.filter(p => p.sub_origin_id === webhookSubOriginId);
    } else if (webhookScope === "origin" && webhookOriginId) {
      const subOriginsInOrigin = subOrigins.filter(s => s.origin_id === webhookOriginId);
      return allPipelines.filter(p => subOriginsInOrigin.some(s => s.id === p.sub_origin_id));
    }
    return allPipelines;
  };

  const getGeneratedWebhookUrl = () => {
    const baseUrl = `https://scalebeauty.com.br/api/webhook`;
    if (webhookScope === "all") {
      return baseUrl;
    } else if (webhookScope === "origin" && webhookOriginId) {
      return `${baseUrl}?origin_id=${webhookOriginId}`;
    } else if (webhookScope === "sub_origin" && webhookSubOriginId) {
      return `${baseUrl}?sub_origin_id=${webhookSubOriginId}`;
    }
    return baseUrl;
  };

  const copyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const createWebhook = async () => {
    if (!webhookName.trim()) {
      toast.error("Digite um nome para o webhook");
      return;
    }
    if (webhookType === "send" && !webhookUrl.trim()) {
      toast.error("Digite a URL de destino");
      return;
    }
    if (webhookType === "send" && !webhookTrigger) {
      toast.error("Selecione um gatilho");
      return;
    }
    if (webhookType === "send" && webhookTrigger === "lead_moved" && !webhookTriggerPipelineId) {
      toast.error("Selecione a pipeline de destino");
      return;
    }

    try {
      const { error } = await supabase.from("crm_webhooks").insert({
        name: webhookName,
        type: webhookType,
        url: webhookType === "send" ? webhookUrl : getGeneratedWebhookUrl(),
        scope: webhookScope,
        origin_id: webhookOriginId || null,
        sub_origin_id: webhookSubOriginId || null,
        trigger: webhookType === "send" ? webhookTrigger : null,
        trigger_pipeline_id: webhookType === "send" && webhookTrigger === "lead_moved" ? webhookTriggerPipelineId : null,
        is_active: true,
      });

      if (error) throw error;

      refetchWebhooks();
      resetWebhookForm();
      toast.success("Webhook criado!");
    } catch (error) {
      console.error("Erro ao criar webhook:", error);
      toast.error("Erro ao criar webhook");
    }
  };

  const toggleWebhook = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("crm_webhooks")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
      refetchWebhooks();
    } catch (error) {
      console.error("Erro ao atualizar webhook:", error);
      toast.error("Erro ao atualizar webhook");
    }
  };

  const deleteWebhook = async (id: string) => {
    try {
      const { error } = await supabase.from("crm_webhooks").delete().eq("id", id);
      if (error) throw error;
      refetchWebhooks();
      toast.success("Webhook removido!");
    } catch (error) {
      console.error("Erro ao remover webhook:", error);
      toast.error("Erro ao remover webhook");
    }
  };

  const resetWebhookForm = () => {
    setIsCreating(false);
    setWebhookName("");
    setWebhookType("receive");
    setWebhookUrl("");
    setWebhookScope("all");
    setWebhookOriginId("");
    setWebhookSubOriginId("");
    setWebhookTrigger("");
    setWebhookTriggerPipelineId("");
  };

  const getTriggerLabel = (trigger: string | null, pipelineId?: string | null) => {
    if (!trigger) return "";
    const triggers: Record<string, string> = {
      "lead_created": "Lead criado",
      "lead_moved": "Lead movido para pipeline",
      "lead_updated": "Lead atualizado",
      "lead_deleted": "Lead excluído",
    };
    let label = triggers[trigger] || trigger;
    if (trigger === "lead_moved" && pipelineId) {
      const pipeline = allPipelines.find(p => p.id === pipelineId);
      if (pipeline) {
        label += `: ${pipeline.nome}`;
      }
    }
    return label;
  };

  const handleBack = () => {
    setActiveView("menu");
    resetWebhookForm();
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setActiveView("menu");
      resetWebhookForm();
    }
  };

  const receiveWebhooks = webhooks.filter(w => w.type === "receive");
  const sendWebhooks = webhooks.filter(w => w.type === "send");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 relative border-border">
          <Zap className="w-4 h-4 text-amber-500" />
          {activeAutomationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-medium flex items-center justify-center bg-amber-500 text-white rounded-full">
              {activeAutomationsCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            {activeView !== "menu" && (
              <button
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowRight className="w-5 h-5 rotate-180" />
              </button>
            )}
            <Zap className="w-5 h-5 text-amber-500" />
            <DialogTitle className="text-lg font-semibold">
              {activeView === "menu" && "Automações"}
              {activeView === "origin" && "Criar na Origem"}
              {activeView === "webhook" && "Webhooks"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(85vh-80px)]">
          {/* Menu View */}
          {activeView === "menu" && (
            <div className="p-6 space-y-4">
              <button
                onClick={() => setActiveView("origin")}
                className="w-full flex items-center gap-4 p-5 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <FolderSync className="w-6 h-6 text-amber-500" />
                </div>
                <div className="flex-1">
                  <span className="text-base font-medium block">Criar na Origem</span>
                  <span className="text-sm text-muted-foreground">Mover leads automaticamente entre pipelines e origens</span>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </button>

              <button
                onClick={() => setActiveView("webhook")}
                className="w-full flex items-center gap-4 p-5 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Webhook className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <span className="text-base font-medium block">Webhooks</span>
                  <span className="text-sm text-muted-foreground">Integrar com sistemas externos via HTTP</span>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Origin Automation View */}
          {activeView === "origin" && (
            <div className="p-6 space-y-6">
              {/* Create new automation */}
              <div className="space-y-4">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Nova automação
                </span>
                <div className="flex items-center gap-3">
                  <Select value={selectedSourcePipeline} onValueChange={setSelectedSourcePipeline}>
                    <SelectTrigger className="flex-1 h-11">
                      <SelectValue placeholder="Quando lead chegar em..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map((pipeline) => (
                        <SelectItem key={pipeline.id} value={pipeline.id}>
                          {pipeline.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="lg"
                    className="h-11 px-6 bg-gradient-to-r from-[#F40000] to-[#A10000] text-white"
                    onClick={createAutomation}
                    disabled={!selectedSourcePipeline}
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Existing automations */}
              <div className="space-y-4">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Automações ativas ({automations.length})
                </span>
                
                <div className="space-y-3">
                  {automations.length === 0 ? (
                    <div className="text-center py-10 text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/50">
                      Nenhuma automação configurada
                    </div>
                  ) : (
                    automations.map((automation) => (
                      <div
                        key={automation.id}
                        className={`p-4 rounded-xl border transition-colors ${
                          automation.is_active 
                            ? "bg-amber-500/5 border-amber-500/20" 
                            : "bg-muted/20 border-border/50 opacity-60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => updateAutomation(automation.id, { is_active: !automation.is_active })}
                              className={`relative w-11 h-6 rounded-full transition-colors ${
                                automation.is_active ? "bg-amber-500" : "bg-muted"
                              }`}
                            >
                              <span
                                className={`absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                                  automation.is_active ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                            <span className="text-sm font-medium">
                              {getPipelineName(automation.pipeline_id)}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-destructive/10"
                            onClick={() => deleteAutomation(automation.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Origem</span>
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
                              <SelectTrigger className="h-9">
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
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Sub-origem</span>
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
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
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

                          <div className="space-y-1.5">
                            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Pipeline</span>
                            <Select
                              value={automation.target_pipeline_id || ""}
                              onValueChange={(value) => {
                                updateAutomation(automation.id, { target_pipeline_id: value });
                              }}
                              disabled={!automation.target_sub_origin_id}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
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
            <div className="p-6 space-y-6">
              {/* Create New Webhook */}
              {!isCreating ? (
                <Button
                  onClick={() => setIsCreating(true)}
                  className="w-full h-12 bg-gradient-to-r from-[#F40000] to-[#A10000] text-white"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Criar Novo Webhook
                </Button>
              ) : (
                <div className="p-5 rounded-xl border border-border bg-muted/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Novo Webhook</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={resetWebhookForm}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Nome do webhook..."
                      value={webhookName}
                      onChange={(e) => setWebhookName(e.target.value)}
                      className="h-10"
                    />
                    <Select value={webhookType} onValueChange={(v: "receive" | "send") => setWebhookType(v)}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receive">
                          <div className="flex items-center gap-2">
                            <Download className="w-4 h-4" />
                            Receber
                          </div>
                        </SelectItem>
                        <SelectItem value="send">
                          <div className="flex items-center gap-2">
                            <Send className="w-4 h-4" />
                            Enviar
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {webhookType === "send" && (
                    <>
                      <Input
                        placeholder="URL de destino..."
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="h-10"
                      />
                      <Select value={webhookTrigger} onValueChange={(v) => {
                        setWebhookTrigger(v);
                        setWebhookTriggerPipelineId("");
                      }}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Selecione o gatilho..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead_created">Lead criado</SelectItem>
                          <SelectItem value="lead_moved">Lead movido para pipeline</SelectItem>
                          <SelectItem value="lead_updated">Lead atualizado</SelectItem>
                          <SelectItem value="lead_deleted">Lead excluído</SelectItem>
                        </SelectContent>
                      </Select>

                      {webhookTrigger === "lead_moved" && (
                        <Select value={webhookTriggerPipelineId} onValueChange={setWebhookTriggerPipelineId}>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Selecione a pipeline..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getSendTriggerPipelines().map((pipeline) => (
                              <SelectItem key={pipeline.id} value={pipeline.id}>
                                {pipeline.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </>
                  )}

                  <Select value={webhookScope} onValueChange={(v: "all" | "origin" | "sub_origin") => {
                    setWebhookScope(v);
                    setWebhookOriginId("");
                    setWebhookSubOriginId("");
                  }}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as origens</SelectItem>
                      <SelectItem value="origin">Origem específica</SelectItem>
                      <SelectItem value="sub_origin">Sub-origem específica</SelectItem>
                    </SelectContent>
                  </Select>

                  {webhookScope === "origin" && (
                    <Select value={webhookOriginId} onValueChange={setWebhookOriginId}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione a origem..." />
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

                  {webhookScope === "sub_origin" && (
                    <Select value={webhookSubOriginId} onValueChange={setWebhookSubOriginId}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione a sub-origem..." />
                      </SelectTrigger>
                      <SelectContent>
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
                  )}

                  {webhookType === "receive" && (
                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <span className="text-[10px] font-medium text-blue-600 uppercase tracking-wider block mb-2">
                        URL gerada
                      </span>
                      <div className="flex gap-2">
                        <Input
                          value={getGeneratedWebhookUrl()}
                          readOnly
                          className="flex-1 h-9 text-xs bg-background font-mono"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 px-3"
                          onClick={() => copyWebhookUrl(getGeneratedWebhookUrl())}
                        >
                          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full h-10 bg-gradient-to-r from-[#F40000] to-[#A10000] text-white"
                    onClick={createWebhook}
                  >
                    Salvar Webhook
                  </Button>
                </div>
              )}

              {/* Receive Webhooks */}
              {receiveWebhooks.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Webhooks de Recebimento ({receiveWebhooks.length})
                  </span>
                  {receiveWebhooks.map((webhook) => (
                    <div
                      key={webhook.id}
                      className={`p-4 rounded-xl border transition-colors ${
                        webhook.is_active 
                          ? "bg-blue-500/5 border-blue-500/20" 
                          : "bg-muted/20 border-border/50 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleWebhook(webhook.id, webhook.is_active)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${
                              webhook.is_active ? "bg-blue-500" : "bg-muted"
                            }`}
                          >
                            <span
                              className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                                webhook.is_active ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                          <span className="text-sm font-medium">{webhook.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-destructive/10"
                          onClick={() => deleteWebhook(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 pl-13">
                        <Input
                          value={webhook.url || ""}
                          readOnly
                          className="flex-1 h-8 text-xs bg-background font-mono"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => copyWebhookUrl(webhook.url || "")}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Send Webhooks */}
              {sendWebhooks.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Webhooks de Envio ({sendWebhooks.length})
                  </span>
                  {sendWebhooks.map((webhook) => (
                    <div
                      key={webhook.id}
                      className={`p-4 rounded-xl border transition-colors ${
                        webhook.is_active 
                          ? "bg-green-500/5 border-green-500/20" 
                          : "bg-muted/20 border-border/50 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleWebhook(webhook.id, webhook.is_active)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${
                              webhook.is_active ? "bg-green-500" : "bg-muted"
                            }`}
                          >
                            <span
                              className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                                webhook.is_active ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                          <span className="text-sm font-medium">{webhook.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-destructive/10"
                          onClick={() => deleteWebhook(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground pl-13 space-y-1">
                        <div className="font-mono truncate">{webhook.url}</div>
                        <div>Gatilho: <span className="text-foreground font-medium">{getTriggerLabel(webhook.trigger, webhook.trigger_pipeline_id)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {webhooks.length === 0 && !isCreating && (
                <div className="text-center py-10 text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/50">
                  Nenhum webhook cadastrado
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
