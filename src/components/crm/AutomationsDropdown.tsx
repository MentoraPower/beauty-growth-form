import { useState } from "react";
import { Zap, Plus, Trash2, ArrowRight, Webhook, FolderSync, Copy, Check, Send, Download, X, Play, Settings, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pipeline } from "@/types/crm";
import { cn } from "@/lib/utils";

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

interface EmailAutomation {
  id: string;
  name: string;
  trigger_pipeline_id: string;
  sub_origin_id: string | null;
  subject: string;
  body_html: string;
  is_active: boolean;
  created_at: string;
}

interface AutomationsDropdownProps {
  pipelines: Pipeline[];
  subOriginId: string | null;
}

type ActiveTab = "automations" | "webhooks" | "emails";

export function AutomationsDropdown({ pipelines, subOriginId }: AutomationsDropdownProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("automations");
  
  // Automation creation/edit states
  const [isCreatingAutomation, setIsCreatingAutomation] = useState(false);
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<string>("");
  const [selectedTriggerPipeline, setSelectedTriggerPipeline] = useState<string>("");
  const [selectedActionOrigin, setSelectedActionOrigin] = useState<string>("");
  const [selectedActionSubOrigin, setSelectedActionSubOrigin] = useState<string>("");
  const [selectedActionPipeline, setSelectedActionPipeline] = useState<string>("");
  
  // Webhook states
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);
  const [webhookName, setWebhookName] = useState("");
  const [webhookType, setWebhookType] = useState<"receive" | "send">("receive");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookScope, setWebhookScope] = useState<"all" | "origin" | "sub_origin">("all");
  const [webhookOriginId, setWebhookOriginId] = useState<string>("");
  const [webhookSubOriginId, setWebhookSubOriginId] = useState<string>("");
  const [webhookTrigger, setWebhookTrigger] = useState<string>("");
  const [webhookTriggerPipelineId, setWebhookTriggerPipelineId] = useState<string>("");
  
  // Email automation states
  const [isCreatingEmail, setIsCreatingEmail] = useState(false);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [emailName, setEmailName] = useState("");
  const [emailTriggerPipeline, setEmailTriggerPipeline] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBodyHtml, setEmailBodyHtml] = useState("");
  
  const [copied, setCopied] = useState(false);
  const [triggerDropdownOpen, setTriggerDropdownOpen] = useState(false);
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false);

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
  const activeWebhooksCount = webhooks.filter(w => w.is_active).length;

  const getPipelineName = (pipelineId: string | null, pipelineList: Pipeline[] = pipelines) => {
    if (!pipelineId) return "";
    return pipelineList.find(p => p.id === pipelineId)?.nome || "";
  };

  const getOriginName = (originId: string | null) => {
    if (!originId) return "";
    return origins.find(o => o.id === originId)?.nome || "";
  };

  const getSubOriginName = (subOriginId: string | null) => {
    if (!subOriginId) return "";
    return subOrigins.find(s => s.id === subOriginId)?.nome || "";
  };

  const createAutomation = async () => {
    if (!selectedTrigger || !selectedTriggerPipeline) {
      toast.error("Selecione o gatilho e a pipeline");
      return;
    }

    try {
      const { error } = await supabase.from("pipeline_automations").insert({
        pipeline_id: selectedTriggerPipeline,
        target_type: 'sub_origin',
        target_origin_id: selectedActionOrigin || null,
        target_sub_origin_id: selectedActionSubOrigin || null,
        target_pipeline_id: selectedActionPipeline || null,
        is_active: true,
        sub_origin_id: subOriginId,
      });

      if (error) throw error;

      refetchAutomations();
      queryClient.invalidateQueries({ queryKey: ["pipeline-automations", subOriginId] });
      toast.success("Automação criada!");
      resetAutomationForm();
    } catch (error) {
      console.error("Erro ao criar automação:", error);
      toast.error("Erro ao criar automação");
    }
  };

  const saveAutomationEdit = async () => {
    if (!editingAutomationId) return;
    
    try {
      const { error } = await supabase
        .from("pipeline_automations")
        .update({
          pipeline_id: selectedTriggerPipeline,
          target_origin_id: selectedActionOrigin || null,
          target_sub_origin_id: selectedActionSubOrigin || null,
          target_pipeline_id: selectedActionPipeline || null,
        })
        .eq("id", editingAutomationId);

      if (error) throw error;

      refetchAutomations();
      queryClient.invalidateQueries({ queryKey: ["pipeline-automations", subOriginId] });
      toast.success("Automação atualizada!");
      resetAutomationForm();
    } catch (error) {
      console.error("Erro ao atualizar automação:", error);
      toast.error("Erro ao atualizar automação");
    }
  };

  const startEditingAutomation = (automation: Automation) => {
    setEditingAutomationId(automation.id);
    setIsCreatingAutomation(true);
    setSelectedTrigger("lead_moved");
    setSelectedTriggerPipeline(automation.pipeline_id);
    setSelectedActionOrigin(automation.target_origin_id || "");
    setSelectedActionSubOrigin(automation.target_sub_origin_id || "");
    setSelectedActionPipeline(automation.target_pipeline_id || "");
  };

  const resetAutomationForm = () => {
    setIsCreatingAutomation(false);
    setEditingAutomationId(null);
    setSelectedTrigger("");
    setSelectedTriggerPipeline("");
    setSelectedActionOrigin("");
    setSelectedActionSubOrigin("");
    setSelectedActionPipeline("");
    setTriggerDropdownOpen(false);
    setActionDropdownOpen(false);
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
    setIsCreatingWebhook(false);
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

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetAutomationForm();
      resetWebhookForm();
    }
  };

  const receiveWebhooks = webhooks.filter(w => w.type === "receive");
  const sendWebhooks = webhooks.filter(w => w.type === "send");

  const triggerOptions = [
    { id: "lead_moved", label: "Lead movido para pipeline", icon: ArrowRight },
    { id: "lead_created", label: "Lead criado", icon: Plus },
    { id: "lead_updated", label: "Lead atualizado", icon: Settings },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 relative border-border">
          <Zap className="w-4 h-4 text-amber-500" />
          {(activeAutomationsCount + activeWebhooksCount) > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-medium flex items-center justify-center bg-amber-500 text-white rounded-full">
              {activeAutomationsCount + activeWebhooksCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[700px] overflow-hidden p-0 bg-neutral-900 border-neutral-800" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Automações</DialogTitle>
        {/* Header with icon and tabs */}
        <div className="border-b border-neutral-800">
          <div className="flex items-center gap-3 px-6 py-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-base font-semibold text-white">Automações</span>
          </div>
          
          {/* Tabs */}
          <div className="flex items-center gap-6 px-6">
            <button
              onClick={() => setActiveTab("automations")}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === "automations"
                  ? "border-purple-500 text-white"
                  : "border-transparent text-neutral-400 hover:text-white"
              )}
            >
              Automações
              {activeAutomationsCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-purple-500/20 text-purple-400">
                  {activeAutomationsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("webhooks")}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === "webhooks"
                  ? "border-purple-500 text-white"
                  : "border-transparent text-neutral-400 hover:text-white"
              )}
            >
              Webhooks
              {activeWebhooksCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-blue-500/20 text-blue-400">
                  {activeWebhooksCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="overflow-y-auto h-[calc(700px-110px)]">
          {/* Automations Tab */}
          {activeTab === "automations" && (
            <div className="p-6">
              {/* Active/Inactive filter */}
              <div className="flex items-center gap-2 mb-6">
                <button className="px-3 py-1.5 text-sm rounded-lg bg-purple-500/20 text-purple-400 font-medium">
                  Ativo {activeAutomationsCount}
                </button>
                <button className="px-3 py-1.5 text-sm rounded-lg text-neutral-400 hover:bg-neutral-800 transition-colors">
                  Inativo {automations.length - activeAutomationsCount}
                </button>
                <div className="flex-1" />
                <Button
                  onClick={() => setIsCreatingAutomation(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={isCreatingAutomation}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar automação
                </Button>
              </div>

              {/* Create automation flow */}
              {isCreatingAutomation && (
                <div className="mb-6 p-5 rounded-xl bg-neutral-800/50 border border-neutral-700">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-white">
                      {editingAutomationId ? "Editar automação" : "Nova automação"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-neutral-400 hover:text-white"
                      onClick={resetAutomationForm}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Two-column layout: Trigger -> Action */}
                  <div className="flex items-stretch gap-3">
                    {/* Trigger Column */}
                    <div className="flex-1">
                      <div className="rounded-lg bg-neutral-800 border border-neutral-700 h-full">
                        <div className="flex items-center gap-2 p-3 border-b border-neutral-700">
                          <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <Play className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-white text-sm font-medium">Quando</span>
                        </div>
                        
                        <div className="p-3">
                          <Select value={selectedTriggerPipeline} onValueChange={setSelectedTriggerPipeline}>
                            <SelectTrigger className="h-9 bg-neutral-700/50 border-neutral-600 text-white text-sm">
                              <SelectValue placeholder="Lead movido para..." />
                            </SelectTrigger>
                            <SelectContent className="bg-neutral-800 border-neutral-700">
                              {pipelines.map((pipeline) => (
                                <SelectItem key={pipeline.id} value={pipeline.id} className="text-white">
                                  Lead movido para {pipeline.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                        <ArrowRight className="w-4 h-4 text-neutral-400" />
                      </div>
                    </div>

                    {/* Action Column */}
                    <div className="flex-1">
                      <div className="rounded-lg bg-neutral-800 border border-neutral-700 h-full">
                        <div className="flex items-center gap-2 p-3 border-b border-neutral-700">
                          <div className="w-6 h-6 rounded bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center">
                            <FolderSync className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-white text-sm font-medium">Então</span>
                        </div>
                        
                        <div className="p-3 space-y-2">
                          <Select value={selectedActionOrigin} onValueChange={(v) => {
                            setSelectedActionOrigin(v);
                            setSelectedActionSubOrigin("");
                            setSelectedActionPipeline("");
                          }}>
                            <SelectTrigger className="h-9 bg-neutral-700/50 border-neutral-600 text-white text-sm">
                              <SelectValue placeholder="Origem..." />
                            </SelectTrigger>
                            <SelectContent className="bg-neutral-800 border-neutral-700">
                              {origins.map((origin) => (
                                <SelectItem key={origin.id} value={origin.id} className="text-white">
                                  {origin.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select 
                            value={selectedActionSubOrigin} 
                            onValueChange={(v) => {
                              setSelectedActionSubOrigin(v);
                              setSelectedActionPipeline("");
                            }}
                            disabled={!selectedActionOrigin}
                          >
                            <SelectTrigger className="h-9 bg-neutral-700/50 border-neutral-600 text-white text-sm disabled:opacity-50">
                              <SelectValue placeholder="Sub-origem..." />
                            </SelectTrigger>
                            <SelectContent className="bg-neutral-800 border-neutral-700">
                              {subOrigins
                                .filter(s => s.origin_id === selectedActionOrigin)
                                .map((subOrigin) => (
                                  <SelectItem key={subOrigin.id} value={subOrigin.id} className="text-white">
                                    {subOrigin.nome}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>

                          <Select 
                            value={selectedActionPipeline} 
                            onValueChange={setSelectedActionPipeline}
                            disabled={!selectedActionSubOrigin}
                          >
                            <SelectTrigger className="h-9 bg-neutral-700/50 border-neutral-600 text-white text-sm disabled:opacity-50">
                              <SelectValue placeholder="Pipeline..." />
                            </SelectTrigger>
                            <SelectContent className="bg-neutral-800 border-neutral-700">
                              {getTargetPipelines(selectedActionSubOrigin).map((pipeline) => (
                                <SelectItem key={pipeline.id} value={pipeline.id} className="text-white">
                                  {pipeline.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-700">
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <span>Quando</span>
                      <span className="px-1.5 py-0.5 bg-neutral-700 rounded text-white text-xs">
                        {selectedTriggerPipeline 
                          ? getPipelineName(selectedTriggerPipeline)
                          : "..."}
                      </span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="px-1.5 py-0.5 bg-neutral-700 rounded text-white text-xs">
                        {selectedActionPipeline
                          ? `${getOriginName(selectedActionOrigin)} / ${getSubOriginName(selectedActionSubOrigin)} / ${getPipelineName(selectedActionPipeline, allPipelines)}`
                          : "..."}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={editingAutomationId ? saveAutomationEdit : createAutomation}
                      className="h-8 bg-purple-600 hover:bg-purple-700 text-white text-xs"
                      disabled={!selectedTriggerPipeline}
                    >
                      {editingAutomationId ? "Salvar" : "Criar"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Existing automations list */}
              {automations.length === 0 && !isCreatingAutomation ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
                    <FolderSync className="w-6 h-6 text-neutral-500" />
                  </div>
                  <h3 className="text-white font-medium mb-2">Nenhuma automação configurada</h3>
                  <p className="text-neutral-400 text-sm max-w-md mb-6">
                    Configure automações para mover leads automaticamente entre pipelines e origens.
                  </p>
                  <Button
                    onClick={() => setIsCreatingAutomation(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Criar automação
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {automations.map((automation) => (
                    <div
                      key={automation.id}
                      className={cn(
                        "p-4 rounded-xl border transition-colors",
                        automation.is_active 
                          ? "bg-neutral-800/50 border-neutral-700" 
                          : "bg-neutral-800/20 border-neutral-800 opacity-60"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => updateAutomation(automation.id, { is_active: !automation.is_active })}
                            className={cn(
                              "relative w-11 h-6 rounded-full transition-colors",
                              automation.is_active ? "bg-purple-500" : "bg-neutral-600"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
                                automation.is_active ? "translate-x-5" : "translate-x-0"
                              )}
                            />
                          </button>
                          <div>
                            <div className="flex items-center gap-2 text-sm text-white">
                              <span className="font-medium">{getPipelineName(automation.pipeline_id)}</span>
                              <ArrowRight className="w-4 h-4 text-neutral-500" />
                              <span className="text-neutral-400">
                                {getOriginName(automation.target_origin_id)} / {getSubOriginName(automation.target_sub_origin_id)} / {getPipelineName(automation.target_pipeline_id, allPipelines)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-neutral-400 hover:text-white hover:bg-neutral-700"
                            onClick={() => startEditingAutomation(automation)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-neutral-400 hover:text-red-400 hover:bg-red-500/10"
                            onClick={() => deleteAutomation(automation.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Webhooks Tab */}
          {activeTab === "webhooks" && (
            <div className="p-6">
              {/* Active/Inactive filter */}
              <div className="flex items-center gap-2 mb-6">
                <button className="px-3 py-1.5 text-sm rounded-lg bg-blue-500/20 text-blue-400 font-medium">
                  Ativo {activeWebhooksCount}
                </button>
                <button className="px-3 py-1.5 text-sm rounded-lg text-neutral-400 hover:bg-neutral-800 transition-colors">
                  Inativo {webhooks.length - activeWebhooksCount}
                </button>
                <div className="flex-1" />
                <Button
                  onClick={() => setIsCreatingWebhook(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={isCreatingWebhook}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar webhook
                </Button>
              </div>

              {/* Create webhook form */}
              {isCreatingWebhook && (
                <div className="mb-6 p-5 rounded-xl bg-neutral-800/50 border border-neutral-700 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">Novo Webhook</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-neutral-400 hover:text-white"
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
                      className="h-10 bg-neutral-700 border-neutral-600 text-white placeholder:text-neutral-500"
                    />
                    <Select value={webhookType} onValueChange={(v: "receive" | "send") => setWebhookType(v)}>
                      <SelectTrigger className="h-10 bg-neutral-700 border-neutral-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-800 border-neutral-700">
                        <SelectItem value="receive" className="text-white">
                          <div className="flex items-center gap-2">
                            <Download className="w-4 h-4" />
                            Receber
                          </div>
                        </SelectItem>
                        <SelectItem value="send" className="text-white">
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
                        className="h-10 bg-neutral-700 border-neutral-600 text-white placeholder:text-neutral-500"
                      />
                      <Select value={webhookTrigger} onValueChange={(v) => {
                        setWebhookTrigger(v);
                        setWebhookTriggerPipelineId("");
                      }}>
                        <SelectTrigger className="h-10 bg-neutral-700 border-neutral-600 text-white">
                          <SelectValue placeholder="Selecione o gatilho..." />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-800 border-neutral-700">
                          <SelectItem value="lead_created" className="text-white">Lead criado</SelectItem>
                          <SelectItem value="lead_moved" className="text-white">Lead movido para pipeline</SelectItem>
                          <SelectItem value="lead_updated" className="text-white">Lead atualizado</SelectItem>
                          <SelectItem value="lead_deleted" className="text-white">Lead excluído</SelectItem>
                        </SelectContent>
                      </Select>

                      {webhookTrigger === "lead_moved" && (
                        <Select value={webhookTriggerPipelineId} onValueChange={setWebhookTriggerPipelineId}>
                          <SelectTrigger className="h-10 bg-neutral-700 border-neutral-600 text-white">
                            <SelectValue placeholder="Selecione a pipeline..." />
                          </SelectTrigger>
                          <SelectContent className="bg-neutral-800 border-neutral-700">
                            {getSendTriggerPipelines().map((pipeline) => (
                              <SelectItem key={pipeline.id} value={pipeline.id} className="text-white">
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
                    <SelectTrigger className="h-10 bg-neutral-700 border-neutral-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700">
                      <SelectItem value="all" className="text-white">Todas as origens</SelectItem>
                      <SelectItem value="origin" className="text-white">Origem específica</SelectItem>
                      <SelectItem value="sub_origin" className="text-white">Sub-origem específica</SelectItem>
                    </SelectContent>
                  </Select>

                  {webhookScope === "origin" && (
                    <Select value={webhookOriginId} onValueChange={setWebhookOriginId}>
                      <SelectTrigger className="h-10 bg-neutral-700 border-neutral-600 text-white">
                        <SelectValue placeholder="Selecione a origem..." />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-800 border-neutral-700">
                        {origins.map((origin) => (
                          <SelectItem key={origin.id} value={origin.id} className="text-white">
                            {origin.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {webhookScope === "sub_origin" && (
                    <Select value={webhookSubOriginId} onValueChange={setWebhookSubOriginId}>
                      <SelectTrigger className="h-10 bg-neutral-700 border-neutral-600 text-white">
                        <SelectValue placeholder="Selecione a sub-origem..." />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-800 border-neutral-700">
                        {subOrigins.map((subOrigin) => {
                          const origin = origins.find(o => o.id === subOrigin.origin_id);
                          return (
                            <SelectItem key={subOrigin.id} value={subOrigin.id} className="text-white">
                              {origin?.nome} / {subOrigin.nome}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}

                  {webhookType === "receive" && (
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <span className="text-[10px] font-medium text-blue-400 uppercase tracking-wider block mb-2">
                        URL gerada
                      </span>
                      <div className="flex gap-2">
                        <Input
                          value={getGeneratedWebhookUrl()}
                          readOnly
                          className="flex-1 h-9 text-xs bg-neutral-800 border-neutral-700 text-white font-mono"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 px-3 bg-neutral-700 border-neutral-600 text-white hover:bg-neutral-600"
                          onClick={() => copyWebhookUrl(getGeneratedWebhookUrl())}
                        >
                          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full h-10 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={createWebhook}
                  >
                    Salvar Webhook
                  </Button>
                </div>
              )}

              {/* Webhooks list */}
              {webhooks.length === 0 && !isCreatingWebhook ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
                    <Webhook className="w-6 h-6 text-neutral-500" />
                  </div>
                  <h3 className="text-white font-medium mb-2">Vamos configurar seu primeiro webhook.</h3>
                  <p className="text-neutral-400 text-sm max-w-md mb-6">
                    Conecte seus aplicativos facilmente com webhooks para enviar atualizações em tempo real, automatizar processos e turbinar suas integrações.
                  </p>
                  <Button
                    onClick={() => setIsCreatingWebhook(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Criar webhook
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Receive Webhooks */}
                  {receiveWebhooks.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Webhooks de Recebimento ({receiveWebhooks.length})
                      </span>
                      {receiveWebhooks.map((webhook) => (
                        <div
                          key={webhook.id}
                          className={cn(
                            "p-4 rounded-xl border transition-colors",
                            webhook.is_active 
                              ? "bg-blue-500/5 border-blue-500/20" 
                              : "bg-neutral-800/20 border-neutral-800 opacity-60"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleWebhook(webhook.id, webhook.is_active)}
                                className={cn(
                                  "relative w-10 h-5 rounded-full transition-colors",
                                  webhook.is_active ? "bg-blue-500" : "bg-neutral-600"
                                )}
                              >
                                <span
                                  className={cn(
                                    "absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                                    webhook.is_active ? "translate-x-5" : "translate-x-0"
                                  )}
                                />
                              </button>
                              <span className="text-sm font-medium text-white">{webhook.name}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-neutral-400 hover:text-red-400 hover:bg-red-500/10"
                              onClick={() => deleteWebhook(webhook.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              value={webhook.url || ""}
                              readOnly
                              className="flex-1 h-8 text-xs bg-neutral-800 border-neutral-700 text-neutral-300 font-mono"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 bg-neutral-700 border-neutral-600 hover:bg-neutral-600"
                              onClick={() => copyWebhookUrl(webhook.url || "")}
                            >
                              <Copy className="w-3.5 h-3.5 text-white" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Send Webhooks */}
                  {sendWebhooks.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                        <Send className="w-4 h-4" />
                        Webhooks de Envio ({sendWebhooks.length})
                      </span>
                      {sendWebhooks.map((webhook) => (
                        <div
                          key={webhook.id}
                          className={cn(
                            "p-4 rounded-xl border transition-colors",
                            webhook.is_active 
                              ? "bg-green-500/5 border-green-500/20" 
                              : "bg-neutral-800/20 border-neutral-800 opacity-60"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleWebhook(webhook.id, webhook.is_active)}
                                className={cn(
                                  "relative w-10 h-5 rounded-full transition-colors",
                                  webhook.is_active ? "bg-green-500" : "bg-neutral-600"
                                )}
                              >
                                <span
                                  className={cn(
                                    "absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                                    webhook.is_active ? "translate-x-5" : "translate-x-0"
                                  )}
                                />
                              </button>
                              <div>
                                <span className="text-sm font-medium text-white block">{webhook.name}</span>
                                <span className="text-xs text-neutral-400">
                                  {getTriggerLabel(webhook.trigger, webhook.trigger_pipeline_id)}
                                </span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-neutral-400 hover:text-red-400 hover:bg-red-500/10"
                              onClick={() => deleteWebhook(webhook.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="text-xs text-neutral-500 font-mono truncate">
                            {webhook.url}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
