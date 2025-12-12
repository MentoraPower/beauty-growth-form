import { useState } from "react";
import { Zap, Plus, Trash2, ArrowRight, Webhook, FolderSync, Copy, Check, Send, Download } from "lucide-react";
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

interface WebhookConfig {
  id: string;
  type: "receive" | "send";
  url: string;
  scope: "all" | "origin" | "sub_origin";
  origin_id?: string;
  sub_origin_id?: string;
  trigger?: string;
  trigger_pipeline_id?: string;
  is_active: boolean;
}

export function AutomationsDropdown({ pipelines, subOriginId }: AutomationsDropdownProps) {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<ActiveView>("menu");
  const [webhookTab, setWebhookTab] = useState<WebhookTab>("receive");
  const [selectedSourcePipeline, setSelectedSourcePipeline] = useState<string>("");
  
  // Receive webhook states
  const [receiveScope, setReceiveScope] = useState<"all" | "origin" | "sub_origin">("all");
  const [receiveOriginId, setReceiveOriginId] = useState<string>("");
  const [receiveSubOriginId, setReceiveSubOriginId] = useState<string>("");
  
  // Send webhook states
  const [sendWebhookUrl, setSendWebhookUrl] = useState("");
  const [sendTrigger, setSendTrigger] = useState<string>("");
  const [sendTriggerPipelineId, setSendTriggerPipelineId] = useState<string>("");
  const [sendScope, setSendScope] = useState<"all" | "origin" | "sub_origin">("all");
  const [sendOriginId, setSendOriginId] = useState<string>("");
  const [sendSubOriginId, setSendSubOriginId] = useState<string>("");
  const [sentWebhooks, setSentWebhooks] = useState<WebhookConfig[]>([]);
  
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

  // Get pipelines for send trigger based on scope
  const getSendTriggerPipelines = () => {
    if (sendScope === "sub_origin" && sendSubOriginId) {
      return allPipelines.filter(p => p.sub_origin_id === sendSubOriginId);
    } else if (sendScope === "origin" && sendOriginId) {
      const subOriginsInOrigin = subOrigins.filter(s => s.origin_id === sendOriginId);
      return allPipelines.filter(p => subOriginsInOrigin.some(s => s.id === p.sub_origin_id));
    }
    return allPipelines;
  };

  // Generate webhook URL based on scope - using Vercel API route
  const getGeneratedWebhookUrl = () => {
    const baseUrl = `https://scalebeauty.com.br/api/webhook`;
    if (receiveScope === "all") {
      return baseUrl;
    } else if (receiveScope === "origin" && receiveOriginId) {
      return `${baseUrl}?origin_id=${receiveOriginId}`;
    } else if (receiveScope === "sub_origin" && receiveSubOriginId) {
      return `${baseUrl}?sub_origin_id=${receiveSubOriginId}`;
    }
    return baseUrl;
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(getGeneratedWebhookUrl());
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const addSendWebhook = () => {
    if (!sendWebhookUrl.trim()) {
      toast.error("Digite uma URL válida");
      return;
    }
    if (!sendTrigger) {
      toast.error("Selecione um gatilho");
      return;
    }
    if (sendTrigger === "lead_moved" && !sendTriggerPipelineId) {
      toast.error("Selecione a pipeline de destino");
      return;
    }
    
    const newWebhook: WebhookConfig = {
      id: Date.now().toString(),
      type: "send",
      url: sendWebhookUrl,
      scope: sendScope,
      origin_id: sendOriginId || undefined,
      sub_origin_id: sendSubOriginId || undefined,
      trigger: sendTrigger,
      trigger_pipeline_id: sendTrigger === "lead_moved" ? sendTriggerPipelineId : undefined,
      is_active: true,
    };
    setSentWebhooks([...sentWebhooks, newWebhook]);
    setSendWebhookUrl("");
    setSendTrigger("");
    setSendTriggerPipelineId("");
    toast.success("Webhook de envio cadastrado!");
  };

  const removeWebhook = (id: string) => {
    setSentWebhooks(sentWebhooks.filter(w => w.id !== id));
    toast.success("Webhook removido!");
  };

  const toggleWebhook = (id: string) => {
    setSentWebhooks(sentWebhooks.map(w => 
      w.id === id ? { ...w, is_active: !w.is_active } : w
    ));
  };

  const getTriggerLabel = (trigger: string, pipelineId?: string) => {
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
      <DropdownMenuContent align="start" className="w-[520px] bg-popover z-[9999] p-0 overflow-hidden">
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
          <div className="p-4 space-y-3">
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
          <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
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
              
              <div className="space-y-2">
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
          <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
              <button
                onClick={() => setWebhookTab("receive")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-medium transition-colors ${
                  webhookTab === "receive"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                Receber
              </button>
              <button
                onClick={() => setWebhookTab("send")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-medium transition-colors ${
                  webhookTab === "send"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                Enviar
              </button>
            </div>

            {webhookTab === "receive" && (
              <div className="space-y-4">
                {/* Scope selection */}
                <div className="space-y-3">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Escopo do webhook
                  </span>
                  
                  <Select value={receiveScope} onValueChange={(v: "all" | "origin" | "sub_origin") => {
                    setReceiveScope(v);
                    setReceiveOriginId("");
                    setReceiveSubOriginId("");
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

                  {receiveScope === "origin" && (
                    <Select value={receiveOriginId} onValueChange={setReceiveOriginId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecione a origem..." />
                      </SelectTrigger>
                      <SelectContent className="z-[10000]">
                        {origins.map((origin) => (
                          <SelectItem key={origin.id} value={origin.id}>
                            {origin.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {receiveScope === "sub_origin" && (
                    <Select value={receiveSubOriginId} onValueChange={setReceiveSubOriginId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecione a sub-origem..." />
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
                  )}
                </div>

                {/* Generated URL */}
                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <span className="text-[11px] font-medium text-blue-600 uppercase tracking-wider block mb-3">
                    Sua URL de recebimento
                  </span>
                  <div className="flex gap-2">
                    <Input
                      value={getGeneratedWebhookUrl()}
                      readOnly
                      className="flex-1 h-9 text-[11px] bg-background font-mono"
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
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Use esta URL para receber leads de sistemas externos
                  </p>
                </div>
              </div>
            )}

            {webhookTab === "send" && (
              <div className="space-y-4">
                {/* Add new send webhook */}
                <div className="space-y-3">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Cadastrar webhook de envio
                  </span>
                  
                  <div className="space-y-2">
                    <Input
                      placeholder="URL de destino..."
                      value={sendWebhookUrl}
                      onChange={(e) => setSendWebhookUrl(e.target.value)}
                      className="h-9 text-xs"
                    />
                    
                    <Select value={sendTrigger} onValueChange={(v) => {
                      setSendTrigger(v);
                      setSendTriggerPipelineId("");
                    }}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecione o gatilho..." />
                      </SelectTrigger>
                      <SelectContent className="z-[10000]">
                        <SelectItem value="lead_created">Lead criado</SelectItem>
                        <SelectItem value="lead_moved">Lead movido para pipeline</SelectItem>
                        <SelectItem value="lead_updated">Lead atualizado</SelectItem>
                        <SelectItem value="lead_deleted">Lead excluído</SelectItem>
                      </SelectContent>
                    </Select>

                    {sendTrigger === "lead_moved" && (
                      <Select value={sendTriggerPipelineId} onValueChange={setSendTriggerPipelineId}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Selecione a pipeline de destino..." />
                        </SelectTrigger>
                        <SelectContent className="z-[10000]">
                          {getSendTriggerPipelines().map((pipeline) => (
                            <SelectItem key={pipeline.id} value={pipeline.id}>
                              {pipeline.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Select value={sendScope} onValueChange={(v: "all" | "origin" | "sub_origin") => {
                      setSendScope(v);
                      setSendOriginId("");
                      setSendSubOriginId("");
                      setSendTriggerPipelineId("");
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

                    {sendScope === "origin" && (
                      <Select value={sendOriginId} onValueChange={setSendOriginId}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Selecione a origem..." />
                        </SelectTrigger>
                        <SelectContent className="z-[10000]">
                          {origins.map((origin) => (
                            <SelectItem key={origin.id} value={origin.id}>
                              {origin.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {sendScope === "sub_origin" && (
                      <Select value={sendSubOriginId} onValueChange={setSendSubOriginId}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Selecione a sub-origem..." />
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
                    )}

                    <Button
                      size="sm"
                      className="w-full h-9 bg-gradient-to-r from-[#F40000] to-[#A10000] text-white"
                      onClick={addSendWebhook}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Cadastrar Webhook
                    </Button>
                  </div>
                </div>

                {/* Registered send webhooks */}
                {sentWebhooks.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Webhooks cadastrados ({sentWebhooks.length})
                    </span>
                    {sentWebhooks.map((webhook) => (
                      <div
                        key={webhook.id}
                        className={`p-3 rounded-lg border ${
                          webhook.is_active 
                            ? "bg-green-500/5 border-green-500/20" 
                            : "bg-muted/20 border-border/50 opacity-60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <button
                              onClick={() => toggleWebhook(webhook.id)}
                              className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                                webhook.is_active ? "bg-green-500" : "bg-muted"
                              }`}
                            >
                              <span
                                className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                                  webhook.is_active ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                            <span className="text-xs font-mono truncate">{webhook.url}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 hover:bg-destructive/10 flex-shrink-0"
                            onClick={() => removeWebhook(webhook.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                        <div className="text-[10px] text-muted-foreground pl-11">
                          Gatilho: <span className="text-foreground font-medium">{getTriggerLabel(webhook.trigger || "", webhook.trigger_pipeline_id)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {sentWebhooks.length === 0 && (
                  <div className="text-center py-4 text-xs text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/50">
                    Nenhum webhook de envio cadastrado
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
