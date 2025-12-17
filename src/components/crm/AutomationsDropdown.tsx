import { useState, useEffect, useRef, useMemo } from "react";
import { Zap, Plus, Trash2, ArrowRight, Webhook, FolderSync, Copy, Check, Send, X, Settings, Mail, Loader2, Workflow } from "lucide-react";
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
import { EmailFlowBuilder } from "./EmailFlowBuilder";

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
  flow_steps: any[] | null;
}

interface EmailEditingContext {
  emailName: string;
  emailTriggerPipeline: string;
  editingEmailId: string | null;
  isCreating: boolean;
  emailSubject: string;
  emailBodyHtml: string;
}

interface AutomationsDropdownProps {
  pipelines: Pipeline[];
  subOriginId: string | null;
  onShowEmailBuilder?: (show: boolean, props?: EmailBuilderProps) => void;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  emailEditingContext?: EmailEditingContext | null;
  onEmailContextChange?: (context: EmailEditingContext | null) => void;
}

interface EmailBuilderProps {
  automationName: string;
  triggerPipelineName: string;
  onSave: (steps: any[]) => Promise<void>;
  onCancel: () => void;
  initialSteps?: any[];
  editingContext?: EmailEditingContext;
  pipelines?: Pipeline[];
  subOriginId?: string | null;
}

type ActiveTab = "automations" | "webhooks";

export function AutomationsDropdown({ 
  pipelines, 
  subOriginId, 
  onShowEmailBuilder, 
  externalOpen, 
  onOpenChange,
  emailEditingContext,
  onEmailContextChange 
}: AutomationsDropdownProps) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
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
  const [showEmailFlowBuilder, setShowEmailFlowBuilder] = useState(false);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [emailName, setEmailName] = useState("");
  const [emailTriggerPipeline, setEmailTriggerPipeline] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBodyHtml, setEmailBodyHtml] = useState("");
  const [emailFlowSteps, setEmailFlowSteps] = useState<any[] | null>(null);

  // Restore email editing context when dropdown opens with context
  useEffect(() => {
    if (open && emailEditingContext) {
      setEmailName(emailEditingContext.emailName);
      setEmailTriggerPipeline(emailEditingContext.emailTriggerPipeline);
      setEditingEmailId(emailEditingContext.editingEmailId);
      setIsCreatingEmail(emailEditingContext.isCreating);
      setEmailSubject(emailEditingContext.emailSubject || "");
      setEmailBodyHtml(emailEditingContext.emailBodyHtml || "");
      setActiveTab("automations");
    }
  }, [open, emailEditingContext]);
  
  const [copied, setCopied] = useState(false);
  const [triggerDropdownOpen, setTriggerDropdownOpen] = useState(false);
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false);
  
  // Bulk send states
  const [bulkSendUrl, setBulkSendUrl] = useState("");
  const [bulkSendPipelineId, setBulkSendPipelineId] = useState<string>("");
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkSendProgress, setBulkSendProgress] = useState({ sent: 0, total: 0 });

  // Fetch origins - only when dropdown is open
  const { data: origins = [] } = useQuery({
    queryKey: ["crm-origins"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_origins").select("*").order("ordem");
      return data as Origin[] || [];
    },
    enabled: open,
  });

  // Fetch sub-origins - only when dropdown is open
  const { data: subOrigins = [] } = useQuery({
    queryKey: ["crm-sub-origins"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_sub_origins").select("*").order("ordem");
      return data as SubOrigin[] || [];
    },
    enabled: open,
  });

  // Fetch all pipelines for target selection - only when dropdown is open
  const { data: allPipelines = [] } = useQuery({
    queryKey: ["all-pipelines"],
    queryFn: async () => {
      const { data } = await supabase.from("pipelines").select("*").order("ordem");
      return data as Pipeline[] || [];
    },
    enabled: open,
  });

  // Fetch automations - only when dropdown is open
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
    enabled: open,
  });

  // Fetch webhooks - only when dropdown is open, filtered by sub_origin
  const { data: webhooks = [], refetch: refetchWebhooks } = useQuery({
    queryKey: ["crm-webhooks", subOriginId],
    queryFn: async () => {
      let query = supabase
        .from("crm_webhooks")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (subOriginId) {
        query = query.eq("sub_origin_id", subOriginId);
      }
      
      const { data } = await query;
      return (data || []) as CrmWebhook[];
    },
    enabled: open,
  });

  // Fetch email automations - only when dropdown is open
  const { data: emailAutomations = [], refetch: refetchEmailAutomations } = useQuery({
    queryKey: ["email-automations", subOriginId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("email_automations").select("*").order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching email automations:", error);
        return [];
      }
      let filtered = data || [];
      if (subOriginId) {
        filtered = filtered.filter((e: any) => e.sub_origin_id === subOriginId);
      }
      return filtered as EmailAutomation[];
    },
    enabled: open,
  });

  const activeEmailAutomationsCount = emailAutomations.filter(e => e.is_active).length;

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
        sub_origin_id: subOriginId, // Always use current sub_origin
        trigger: webhookType === "send" ? webhookTrigger : null,
        trigger_pipeline_id: webhookType === "send" && webhookTrigger === "lead_moved" ? webhookTriggerPipelineId : null,
        is_active: true,
      });

      if (error) throw error;

      refetchWebhooks();
      queryClient.invalidateQueries({ queryKey: ["crm-webhooks", subOriginId] });
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
      queryClient.invalidateQueries({ queryKey: ["crm-webhooks", subOriginId] });
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
      queryClient.invalidateQueries({ queryKey: ["crm-webhooks", subOriginId] });
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

  // Bulk send function
  const executeBulkSend = async () => {
    if (!bulkSendUrl.trim()) {
      toast.error("Digite a URL de destino");
      return;
    }
    if (!bulkSendPipelineId) {
      toast.error("Selecione a pipeline");
      return;
    }

    setIsBulkSending(true);
    setBulkSendProgress({ sent: 0, total: 0 });

    try {
      // Fetch all leads from selected pipeline
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("*")
        .eq("pipeline_id", bulkSendPipelineId);

      if (leadsError) throw leadsError;

      if (!leads || leads.length === 0) {
        toast.error("Nenhum lead encontrado nesta pipeline");
        setIsBulkSending(false);
        return;
      }

      setBulkSendProgress({ sent: 0, total: leads.length });

      let successCount = 0;
      let errorCount = 0;

      // Send each lead one by one
      for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        try {
          const payload = {
            evento: "bulk_send",
            data_envio: new Date().toISOString(),
            dados: {
              id: lead.id,
              nome: lead.name,
              email: lead.email,
              whatsapp: lead.whatsapp,
              country_code: lead.country_code,
              instagram: lead.instagram,
              service_area: lead.service_area,
              monthly_billing: lead.monthly_billing,
              weekly_attendance: lead.weekly_attendance,
              workspace_type: lead.workspace_type,
              years_experience: lead.years_experience,
              clinic_name: lead.clinic_name,
              average_ticket: lead.average_ticket,
              estimated_revenue: lead.estimated_revenue,
              is_mql: lead.is_mql,
              created_at: lead.created_at,
            },
            pipeline: {
              atual: bulkSendPipelineId,
            },
            origem: {
              sub_origin_id: lead.sub_origin_id,
            },
          };

          const response = await fetch(bulkSendUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
            console.error(`Error sending lead ${lead.id}:`, response.status);
          }
        } catch (err) {
          errorCount++;
          console.error(`Error sending lead ${lead.id}:`, err);
        }

        setBulkSendProgress({ sent: i + 1, total: leads.length });
      }

      if (errorCount === 0) {
        toast.success(`${successCount} leads enviados com sucesso!`);
      } else {
        toast.warning(`${successCount} enviados, ${errorCount} erros`);
      }

      // Reset form
      setBulkSendUrl("");
      setBulkSendPipelineId("");
    } catch (error) {
      console.error("Erro ao disparar em massa:", error);
      toast.error("Erro ao disparar em massa");
    } finally {
      setIsBulkSending(false);
      setBulkSendProgress({ sent: 0, total: 0 });
    }
  };

  // Email automation functions
  const createEmailAutomation = async () => {
    if (!emailName.trim()) {
      toast.error("Digite um nome para a automação");
      return;
    }
    if (!emailTriggerPipeline) {
      toast.error("Selecione a pipeline de gatilho");
      return;
    }
    if (!emailSubject.trim()) {
      toast.error("Digite o assunto do e-mail");
      return;
    }
    if (!emailBodyHtml.trim()) {
      toast.error("Digite o conteúdo HTML do e-mail");
      return;
    }

    try {
      const { error } = await (supabase as any).from("email_automations").insert({
        name: emailName,
        trigger_pipeline_id: emailTriggerPipeline,
        sub_origin_id: subOriginId,
        subject: emailSubject,
        body_html: emailBodyHtml,
        is_active: true,
      });

      if (error) throw error;

      refetchEmailAutomations();
      resetEmailForm();
      toast.success("Automação de e-mail criada!");
    } catch (error) {
      console.error("Erro ao criar automação de e-mail:", error);
      toast.error("Erro ao criar automação de e-mail");
    }
  };

  const updateEmailAutomation = async () => {
    if (!editingEmailId) return;

    try {
      const { error } = await (supabase as any)
        .from("email_automations")
        .update({
          name: emailName,
          trigger_pipeline_id: emailTriggerPipeline,
          subject: emailSubject,
          body_html: emailBodyHtml,
        })
        .eq("id", editingEmailId);

      if (error) throw error;

      refetchEmailAutomations();
      resetEmailForm();
      toast.success("Automação atualizada!");
    } catch (error) {
      console.error("Erro ao atualizar automação:", error);
      toast.error("Erro ao atualizar automação");
    }
  };

  const toggleEmailAutomation = async (id: string, isActive: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("email_automations")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
      refetchEmailAutomations();
    } catch (error) {
      console.error("Erro ao atualizar automação:", error);
      toast.error("Erro ao atualizar automação");
    }
  };

  const deleteEmailAutomation = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("email_automations").delete().eq("id", id);
      if (error) throw error;
      refetchEmailAutomations();
      toast.success("Automação removida!");
    } catch (error) {
      console.error("Erro ao remover automação:", error);
      toast.error("Erro ao remover automação");
    }
  };

  const startEditingEmail = (email: EmailAutomation) => {
    setEditingEmailId(email.id);
    setIsCreatingEmail(true);
    setEmailName(email.name);
    setEmailTriggerPipeline(email.trigger_pipeline_id);
    setEmailSubject(email.subject);
    setEmailBodyHtml(email.body_html);
    setEmailFlowSteps(email.flow_steps || null);
  };

  const resetEmailForm = () => {
    setIsCreatingEmail(false);
    setEditingEmailId(null);
    setEmailName("");
    setEmailTriggerPipeline("");
    setEmailSubject("");
    setEmailBodyHtml("");
    setEmailFlowSteps(null);
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

  const openingEmailBuilderRef = useRef(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen && !openingEmailBuilderRef.current) {
      resetAutomationForm();
      resetWebhookForm();
      resetEmailForm();
      setShowEmailFlowBuilder(false);
    }
    if (!isOpen) {
      openingEmailBuilderRef.current = false;
    }
  };

  const handleOpenEmailFlowBuilder = () => {
    if (!emailName.trim()) {
      toast.error("Digite um nome para a automação");
      return;
    }
    if (!emailTriggerPipeline) {
      toast.error("Selecione a pipeline de gatilho");
      return;
    }
    
    const triggerPipelineName = pipelines.find(p => p.id === emailTriggerPipeline)?.nome || "";
    
    // Use saved flow_steps if available, otherwise create default structure when editing
    const getInitialSteps = () => {
      if (emailFlowSteps && emailFlowSteps.length > 0) {
        return emailFlowSteps;
      }
      if (editingEmailId) {
        return [
          { id: "trigger-1", type: "trigger", position: { x: 100, y: 200 }, data: { label: "Gatilho", triggerType: "lead_entered_pipeline", triggerPipelineId: emailTriggerPipeline } },
          { id: "email-1", type: "email", position: { x: 380, y: 200 }, data: { label: "Enviar e-mail", subject: emailSubject, bodyHtml: emailBodyHtml } },
          { id: "end-1", type: "end", position: { x: 660, y: 200 }, data: { label: "Fluxo finalizado" } },
        ];
      }
      return undefined;
    };
    
    if (onShowEmailBuilder) {
      openingEmailBuilderRef.current = true;
      setOpen(false); // Close the dropdown
      onShowEmailBuilder(true, {
        automationName: emailName,
        triggerPipelineName,
        onSave: handleSaveEmailFlow,
        onCancel: () => {
          onShowEmailBuilder(false);
        },
        initialSteps: getInitialSteps(),
        editingContext: {
          emailName,
          emailTriggerPipeline,
          editingEmailId,
          isCreating: isCreatingEmail,
          emailSubject,
          emailBodyHtml,
        },
        pipelines: allPipelines,
        subOriginId,
      });
    } else {
      setShowEmailFlowBuilder(true);
    }
  };

  const handleSaveEmailFlow = async (steps: any[]) => {
    // Extract email steps to build HTML
    const emailSteps = steps.filter(s => s.type === "email");
    if (emailSteps.length === 0) {
      toast.error("Adicione pelo menos um passo de e-mail");
      return;
    }

    // For now, use the first email step's data
    const firstEmail = emailSteps[0];
    const subject = firstEmail.data.subject || emailSubject;
    const bodyHtml = firstEmail.data.bodyHtml || emailBodyHtml;

    if (!subject.trim()) {
      toast.error("Digite o assunto do e-mail");
      return;
    }
    if (!bodyHtml.trim()) {
      toast.error("Digite o conteúdo HTML do e-mail");
      return;
    }

    try {
      if (editingEmailId) {
        const { error } = await (supabase as any)
          .from("email_automations")
          .update({
            name: emailName,
            trigger_pipeline_id: emailTriggerPipeline,
            subject,
            body_html: bodyHtml,
            flow_steps: steps, // Save node positions
          })
          .eq("id", editingEmailId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("email_automations").insert({
          name: emailName,
          trigger_pipeline_id: emailTriggerPipeline,
          sub_origin_id: subOriginId,
          subject,
          body_html: bodyHtml,
          is_active: true,
          flow_steps: steps, // Save node positions
        });
        if (error) throw error;
      }

      refetchEmailAutomations();
      resetEmailForm();
      setShowEmailFlowBuilder(false);
      toast.success(editingEmailId ? "Automação atualizada!" : "Automação de e-mail criada!");
    } catch (error) {
      console.error("Erro ao salvar automação de e-mail:", error);
      toast.error("Erro ao salvar automação de e-mail");
    }
  };

  const receiveWebhooks = webhooks.filter(w => w.type === "receive");
  const sendWebhooks = webhooks.filter(w => w.type === "send");

  const triggerOptions = [
    { id: "lead_moved", label: "Lead movido para pipeline", icon: ArrowRight },
    { id: "lead_created", label: "Lead criado", icon: Plus },
    { id: "lead_updated", label: "Lead atualizado", icon: Settings },
  ];

  // If using local state for email flow builder (fallback when no callback provided)
  if (showEmailFlowBuilder && !onShowEmailBuilder) {
    const triggerPipelineName = pipelines.find(p => p.id === emailTriggerPipeline)?.nome || "";
    
    // Use saved flow_steps if available, otherwise create default structure when editing
    const getFallbackInitialSteps = () => {
      if (emailFlowSteps && emailFlowSteps.length > 0) {
        return emailFlowSteps;
      }
      if (editingEmailId) {
        return [
          { id: "trigger-1", type: "trigger", position: { x: 100, y: 200 }, data: { label: "Gatilho", triggerType: "lead_entered_pipeline", triggerPipelineId: emailTriggerPipeline } },
          { id: "email-1", type: "email", position: { x: 380, y: 200 }, data: { label: "Enviar e-mail", subject: emailSubject, bodyHtml: emailBodyHtml } },
          { id: "end-1", type: "end", position: { x: 660, y: 200 }, data: { label: "Fluxo finalizado" } },
        ];
      }
      return undefined;
    };
    
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <div className="relative inline-flex overflow-visible">
            <Button variant="outline" size="icon" className="h-9 w-9 border-border">
              <Zap className="w-4 h-4 text-foreground" />
            </Button>
            {(activeAutomationsCount + activeWebhooksCount + activeEmailAutomationsCount) > 0 && (
              <span className="absolute top-[2px] right-[2px] z-10 h-4 min-w-4 px-1 text-[10px] font-medium flex items-center justify-center bg-yellow-400 text-black rounded-full pointer-events-none">
                {activeAutomationsCount + activeWebhooksCount + activeEmailAutomationsCount}
              </span>
            )}
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-6xl h-[85vh] overflow-hidden p-0 bg-background border-border" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Editor de Fluxo de E-mail</DialogTitle>
          <EmailFlowBuilder
            automationName={emailName}
            triggerPipelineName={triggerPipelineName}
            onSave={handleSaveEmailFlow}
            onCancel={() => setShowEmailFlowBuilder(false)}
            initialSteps={getFallbackInitialSteps()}
            pipelines={allPipelines}
            subOriginId={subOriginId}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <div className="relative inline-flex overflow-visible">
          <Button variant="outline" size="icon" className="h-9 w-9 border-border">
            <Zap className="w-4 h-4 text-foreground" />
          </Button>
          {(activeAutomationsCount + activeWebhooksCount + activeEmailAutomationsCount) > 0 && (
            <span className="absolute top-[2px] right-[2px] z-10 h-4 min-w-4 px-1 text-[10px] font-medium flex items-center justify-center bg-yellow-400 text-black rounded-full pointer-events-none">
              {activeAutomationsCount + activeWebhooksCount + activeEmailAutomationsCount}
            </span>
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[700px] overflow-hidden p-0 bg-background border-border" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Automações</DialogTitle>
        {/* Header with tabs */}
        <div className="border-b border-border">
          <div className="flex items-center gap-3 px-6 py-4">
            <span className="text-base font-semibold text-foreground">Automações</span>
          </div>
          
          {/* Tabs - Remove email tab, keep automations and webhooks */}
          <div className="flex items-center gap-6 px-6">
            <button
              onClick={() => setActiveTab("automations")}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === "automations"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Automações
              {activeAutomationsCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">
                  {activeAutomationsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("webhooks")}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === "webhooks"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Webhooks
              {activeWebhooksCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">
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
                <button className="px-3 py-1.5 text-sm rounded-lg bg-foreground/10 text-foreground font-medium">
                  Ativo {activeAutomationsCount}
                </button>
                <button className="px-3 py-1.5 text-sm rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                  Inativo {automations.length - activeAutomationsCount}
                </button>
                <div className="flex-1" />
                <Button
                  onClick={() => setIsCreatingAutomation(true)}
                  className="bg-foreground hover:bg-foreground/90 text-background"
                  disabled={isCreatingAutomation}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar automação
                </Button>
                <Button
                  onClick={() => {
                    setIsCreatingEmail(true);
                    setEmailName("Nova automação de e-mail");
                    handleOpenEmailFlowBuilder();
                  }}
                  variant="outline"
                  className="border-border"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  E-mail
                  {activeEmailAutomationsCount > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">
                      {activeEmailAutomationsCount}
                    </span>
                  )}
                </Button>
              </div>

              {/* Create automation flow */}
              {isCreatingAutomation && (
                <div className="mb-6 p-5 rounded-xl bg-muted/50 border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-foreground">
                      {editingAutomationId ? "Editar automação" : "Nova automação"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={resetAutomationForm}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Two-column layout: Trigger -> Action */}
                  <div className="flex items-stretch gap-3">
                    {/* Trigger Column */}
                    <div className="flex-1">
                      <div className="rounded-lg bg-background border border-border h-full">
                        <div className="flex items-center gap-2 p-3 border-b border-border">
                          <span className="text-foreground text-sm font-medium">Quando</span>
                        </div>
                        
                        <div className="p-3">
                          <Select value={selectedTriggerPipeline} onValueChange={setSelectedTriggerPipeline}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Lead movido para..." />
                            </SelectTrigger>
                            <SelectContent>
                              {pipelines.map((pipeline) => (
                                <SelectItem key={pipeline.id} value={pipeline.id}>
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
                      <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Action Column */}
                    <div className="flex-1">
                      <div className="rounded-lg bg-background border border-border h-full">
                        <div className="flex items-center gap-2 p-3 border-b border-border">
                          <span className="text-foreground text-sm font-medium">Então</span>
                        </div>
                        
                        <div className="p-3 space-y-2">
                          <Select value={selectedActionOrigin} onValueChange={(v) => {
                            setSelectedActionOrigin(v);
                            setSelectedActionSubOrigin("");
                            setSelectedActionPipeline("");
                          }}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Origem..." />
                            </SelectTrigger>
                            <SelectContent>
                              {origins.map((origin) => (
                                <SelectItem key={origin.id} value={origin.id}>
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
                            <SelectTrigger className="h-9 text-sm disabled:opacity-50">
                              <SelectValue placeholder="Sub-origem..." />
                            </SelectTrigger>
                            <SelectContent>
                              {subOrigins
                                .filter(s => s.origin_id === selectedActionOrigin)
                                .map((subOrigin) => (
                                  <SelectItem key={subOrigin.id} value={subOrigin.id}>
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
                            <SelectTrigger className="h-9 text-sm disabled:opacity-50">
                              <SelectValue placeholder="Pipeline..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getTargetPipelines(selectedActionSubOrigin).map((pipeline) => (
                                <SelectItem key={pipeline.id} value={pipeline.id}>
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
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>Quando</span>
                      <span className="px-1.5 py-0.5 bg-muted rounded text-foreground text-xs">
                        {selectedTriggerPipeline 
                          ? getPipelineName(selectedTriggerPipeline)
                          : "..."}
                      </span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="px-1.5 py-0.5 bg-muted rounded text-foreground text-xs">
                        {selectedActionPipeline
                          ? `${getOriginName(selectedActionOrigin)} / ${getSubOriginName(selectedActionSubOrigin)} / ${getPipelineName(selectedActionPipeline, allPipelines)}`
                          : "..."}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={editingAutomationId ? saveAutomationEdit : createAutomation}
                      className="h-8 bg-foreground hover:bg-foreground/90 text-background text-xs"
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
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <FolderSync className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-foreground font-medium mb-2">Nenhuma automação configurada</h3>
                  <p className="text-muted-foreground text-sm max-w-md mb-6">
                    Configure automações para mover leads automaticamente entre pipelines e origens.
                  </p>
                  <Button
                    onClick={() => setIsCreatingAutomation(true)}
                    className="bg-foreground hover:bg-foreground/90 text-background"
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
                          ? "bg-muted/50 border-border" 
                          : "bg-muted/20 border-border opacity-60"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => updateAutomation(automation.id, { is_active: !automation.is_active })}
                            className={cn(
                              "relative w-11 h-6 rounded-full transition-colors",
                              automation.is_active ? "bg-foreground" : "bg-muted-foreground/30"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-background shadow-sm transition-transform",
                                automation.is_active ? "translate-x-5" : "translate-x-0"
                              )}
                            />
                          </button>
                          <div>
                            <div className="flex items-center gap-2 text-sm text-foreground">
                              <span className="font-medium">{getPipelineName(automation.pipeline_id)}</span>
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {getOriginName(automation.target_origin_id)} / {getSubOriginName(automation.target_sub_origin_id)} / {getPipelineName(automation.target_pipeline_id, allPipelines)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => startEditingAutomation(automation)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
                <button className="px-3 py-1.5 text-sm rounded-lg bg-foreground/10 text-foreground font-medium">
                  Ativo {activeWebhooksCount}
                </button>
                <button className="px-3 py-1.5 text-sm rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                  Inativo {webhooks.length - activeWebhooksCount}
                </button>
                <div className="flex-1" />
                <Button
                  onClick={() => setIsCreatingWebhook(true)}
                  className="bg-foreground hover:bg-foreground/90 text-background"
                  disabled={isCreatingWebhook}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar webhook
                </Button>
              </div>

              {/* Create webhook form */}
              {isCreatingWebhook && (
                <div className="mb-6 p-5 rounded-xl bg-muted/50 border border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Novo Webhook</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
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
                        <SelectItem value="receive">Receber</SelectItem>
                        <SelectItem value="send">Enviar</SelectItem>
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
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                        URL gerada
                      </span>
                      <div className="flex gap-2">
                        <Input
                          value={getGeneratedWebhookUrl()}
                          readOnly
                          className="flex-1 h-9 text-xs font-mono"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 px-3"
                          onClick={() => copyWebhookUrl(getGeneratedWebhookUrl())}
                        >
                          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full h-10 bg-foreground hover:bg-foreground/90 text-background"
                    onClick={createWebhook}
                  >
                    Salvar Webhook
                  </Button>
                </div>
              )}

              {/* Webhooks list */}
              {webhooks.length === 0 && !isCreatingWebhook ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Webhook className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-foreground font-medium mb-2">Vamos configurar seu primeiro webhook.</h3>
                  <p className="text-muted-foreground text-sm max-w-md mb-6">
                    Conecte seus aplicativos facilmente com webhooks para enviar atualizações em tempo real, automatizar processos e turbinar suas integrações.
                  </p>
                  <Button
                    onClick={() => setIsCreatingWebhook(true)}
                    className="bg-foreground hover:bg-foreground/90 text-background"
                  >
                    Criar webhook
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Receive Webhooks */}
                  {receiveWebhooks.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Webhooks de Recebimento ({receiveWebhooks.length})
                      </span>
                      {receiveWebhooks.map((webhook) => (
                        <div
                          key={webhook.id}
                          className={cn(
                            "p-4 rounded-xl border transition-colors",
                            webhook.is_active 
                              ? "bg-muted/50 border-border" 
                              : "bg-muted/20 border-border opacity-60"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleWebhook(webhook.id, webhook.is_active)}
                                className={cn(
                                  "relative w-10 h-5 rounded-full transition-colors",
                                  webhook.is_active ? "bg-foreground" : "bg-muted-foreground/30"
                                )}
                              >
                                <span
                                  className={cn(
                                    "absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-background shadow-sm transition-transform",
                                    webhook.is_active ? "translate-x-5" : "translate-x-0"
                                  )}
                                />
                              </button>
                              <span className="text-sm font-medium text-foreground">{webhook.name}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteWebhook(webhook.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              value={webhook.url || ""}
                              readOnly
                              className="flex-1 h-8 text-xs font-mono"
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
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Webhooks de Envio ({sendWebhooks.length})
                      </span>
                      {sendWebhooks.map((webhook) => (
                        <div
                          key={webhook.id}
                          className={cn(
                            "p-4 rounded-xl border transition-colors",
                            webhook.is_active 
                              ? "bg-muted/50 border-border" 
                              : "bg-muted/20 border-border opacity-60"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleWebhook(webhook.id, webhook.is_active)}
                                className={cn(
                                  "relative w-10 h-5 rounded-full transition-colors",
                                  webhook.is_active ? "bg-foreground" : "bg-muted-foreground/30"
                                )}
                              >
                                <span
                                  className={cn(
                                    "absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-background shadow-sm transition-transform",
                                    webhook.is_active ? "translate-x-5" : "translate-x-0"
                                  )}
                                />
                              </button>
                              <div>
                                <span className="text-sm font-medium text-foreground block">{webhook.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {getTriggerLabel(webhook.trigger, webhook.trigger_pipeline_id)}
                                </span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteWebhook(webhook.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground font-mono truncate">
                            {webhook.url}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Bulk Send Section - Hidden for now */}
              {/* 
              <div className="mt-6 pt-6 border-t border-neutral-800">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded bg-orange-500/20 flex items-center justify-center">
                    <ListOrdered className="w-3.5 h-3.5 text-orange-500" />
                  </div>
                  <span className="text-sm font-medium text-white">Disparo em Massa</span>
                </div>
                <p className="text-xs text-neutral-400 mb-4">
                  Envie todos os leads de uma pipeline para uma URL via webhook, um por um.
                </p>
                <div className="space-y-3">
                  <Select value={bulkSendPipelineId} onValueChange={setBulkSendPipelineId}>
                    <SelectTrigger className="h-10 bg-neutral-700 border-neutral-600 text-white">
                      <SelectValue placeholder="Selecione a pipeline..." />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700">
                      {allPipelines.map((pipeline) => {
                        const pipelineSubOrigin = subOrigins.find(s => s.id === pipeline.sub_origin_id);
                        const pipelineOrigin = pipelineSubOrigin 
                          ? origins.find(o => o.id === pipelineSubOrigin.origin_id) 
                          : null;
                        return (
                          <SelectItem key={pipeline.id} value={pipeline.id} className="text-white">
                            {pipelineOrigin?.nome} / {pipelineSubOrigin?.nome} / {pipeline.nome}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="URL de destino (POST)..."
                    value={bulkSendUrl}
                    onChange={(e) => setBulkSendUrl(e.target.value)}
                    className="h-10 bg-neutral-700 border-neutral-600 text-white placeholder:text-neutral-500"
                    disabled={isBulkSending}
                  />
                  {isBulkSending && bulkSendProgress.total > 0 && (
                    <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-orange-400">Enviando...</span>
                        <span className="text-xs text-white">
                          {bulkSendProgress.sent} / {bulkSendProgress.total}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-neutral-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-orange-500 transition-all duration-300"
                          style={{ width: `${(bulkSendProgress.sent / bulkSendProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <Button
                    className="w-full h-10 bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={executeBulkSend}
                    disabled={isBulkSending || !bulkSendUrl.trim() || !bulkSendPipelineId}
                  >
                    {isBulkSending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Disparando...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Disparar Leads
                      </>
                    )}
                  </Button>
                </div>
              </div>
              */}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
