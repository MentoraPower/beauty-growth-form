import { useState, useEffect, lazy, Suspense } from "react";
import { Mail, Plus, Trash2, Settings, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pipeline } from "@/types/crm";
import { cn } from "@/lib/utils";

const EmailFlowBuilder = lazy(() => 
  import("./EmailFlowBuilder").then(m => ({ default: m.EmailFlowBuilder }))
);

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

interface EmailAutomationsViewProps {
  pipelines: Pipeline[];
  subOriginId: string | null;
}

export function EmailAutomationsView({ pipelines, subOriginId }: EmailAutomationsViewProps) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [emailName, setEmailName] = useState("");
  const [emailTriggerPipeline, setEmailTriggerPipeline] = useState("");
  const [showFlowBuilder, setShowFlowBuilder] = useState(false);
  const [flowBuilderData, setFlowBuilderData] = useState<EmailAutomation | null>(null);

  // Fetch email automations
  const { data: emailAutomations = [], isLoading, refetch } = useQuery({
    queryKey: ["email-automations", subOriginId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("email_automations")
        .select("*")
        .order("created_at", { ascending: false });
      
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
  });

  // Fetch pending emails count
  const { data: pendingCounts = {} } = useQuery({
    queryKey: ["scheduled-emails-counts", subOriginId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_emails")
        .select("automation_id")
        .eq("status", "pending");
      
      if (error) return {};
      
      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        counts[row.automation_id] = (counts[row.automation_id] || 0) + 1;
      });
      return counts;
    },
    refetchInterval: 30000,
  });

  const activeCount = emailAutomations.filter(e => e.is_active).length;

  const getPipelineName = (pipelineId: string) => {
    return pipelines.find(p => p.id === pipelineId)?.nome || "";
  };

  const toggleAutomation = async (id: string, isActive: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("email_automations")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
      refetch();
    } catch (error) {
      console.error("Erro ao atualizar automação:", error);
      toast.error("Erro ao atualizar automação");
    }
  };

  const deleteAutomation = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from("email_automations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      refetch();
      toast.success("Automação removida!");
    } catch (error) {
      console.error("Erro ao remover automação:", error);
      toast.error("Erro ao remover automação");
    }
  };

  const startCreating = () => {
    setIsCreating(true);
    setEditingId(null);
    setEmailName("");
    setEmailTriggerPipeline("");
  };

  const startEditing = (automation: EmailAutomation) => {
    setFlowBuilderData(automation);
    setShowFlowBuilder(true);
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setEmailName("");
    setEmailTriggerPipeline("");
  };

  const handleContinueToBuilder = () => {
    if (!emailName.trim()) {
      toast.error("Digite um nome para a automação");
      return;
    }
    if (!emailTriggerPipeline) {
      toast.error("Selecione uma pipeline de gatilho");
      return;
    }

    setFlowBuilderData({
      id: "",
      name: emailName,
      trigger_pipeline_id: emailTriggerPipeline,
      sub_origin_id: subOriginId,
      subject: "",
      body_html: "",
      is_active: true,
      created_at: "",
      flow_steps: null,
    });
    setShowFlowBuilder(true);
    setIsCreating(false);
  };

  const handleSaveFlow = async (steps: any[]) => {
    const emailSteps = steps.filter(s => s.type === "email");
    if (emailSteps.length === 0) {
      toast.error("Adicione pelo menos um passo de e-mail");
      return;
    }

    const triggerStep = steps.find(s => s.type === "trigger");
    const triggerPipelineId = triggerStep?.data?.triggerPipelineId || flowBuilderData?.trigger_pipeline_id;

    const firstEmailStep = emailSteps[0];
    const subject = firstEmailStep?.data?.subject || "";
    const bodyHtml = firstEmailStep?.data?.bodyHtml || "";

    try {
      if (flowBuilderData?.id) {
        // Update existing
        const { error } = await (supabase as any)
          .from("email_automations")
          .update({
            name: flowBuilderData.name,
            trigger_pipeline_id: triggerPipelineId,
            subject,
            body_html: bodyHtml,
            flow_steps: steps,
          })
          .eq("id", flowBuilderData.id);

        if (error) throw error;
        toast.success("Automação atualizada!");
      } else {
        // Create new
        const { error } = await (supabase as any)
          .from("email_automations")
          .insert({
            name: flowBuilderData?.name || emailName,
            trigger_pipeline_id: triggerPipelineId,
            sub_origin_id: subOriginId,
            subject,
            body_html: bodyHtml,
            flow_steps: steps,
            is_active: true,
          });

        if (error) throw error;
        toast.success("Automação criada!");
      }

      refetch();
      setShowFlowBuilder(false);
      setFlowBuilderData(null);
    } catch (error) {
      console.error("Erro ao salvar automação:", error);
      toast.error("Erro ao salvar automação");
    }
  };

  const handleCancelFlow = () => {
    setShowFlowBuilder(false);
    setFlowBuilderData(null);
  };

  // Show flow builder full screen
  if (showFlowBuilder && flowBuilderData) {
    return (
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <EmailFlowBuilder
          automationName={flowBuilderData.name}
          triggerPipelineName={getPipelineName(flowBuilderData.trigger_pipeline_id)}
          onSave={handleSaveFlow}
          onCancel={handleCancelFlow}
          initialSteps={flowBuilderData.flow_steps || undefined}
          pipelines={pipelines}
          subOriginId={subOriginId}
          automationId={flowBuilderData.id || undefined}
          pendingEmailsCount={flowBuilderData.id ? (pendingCounts[flowBuilderData.id] || 0) : 0}
        />
      </Suspense>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Automações de Email</h2>
            <p className="text-sm text-muted-foreground">
              {activeCount} automação{activeCount !== 1 ? "ões" : ""} ativa{activeCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button
          onClick={startCreating}
          className="bg-foreground hover:bg-foreground/90 text-background"
          disabled={isCreating}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova automação
        </Button>
      </div>

      {/* Create form */}
      {isCreating && (
        <div className="p-5 rounded-xl bg-muted/50 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Nova Automação de Email</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={cancelCreating}
            >
              Cancelar
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="Nome da automação..."
              value={emailName}
              onChange={(e) => setEmailName(e.target.value)}
            />
            <Select value={emailTriggerPipeline} onValueChange={setEmailTriggerPipeline}>
              <SelectTrigger>
                <SelectValue placeholder="Pipeline de gatilho..." />
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

          <div className="flex justify-end">
            <Button onClick={handleContinueToBuilder}>
              Continuar para o editor
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {emailAutomations.length === 0 && !isCreating && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-foreground font-medium mb-2">Nenhuma automação de email</h3>
          <p className="text-muted-foreground text-sm max-w-md mb-6">
            Configure automações para enviar emails automaticamente quando leads chegarem em determinadas pipelines.
          </p>
          <Button onClick={startCreating}>
            <Plus className="w-4 h-4 mr-2" />
            Criar automação
          </Button>
        </div>
      )}

      {/* Automations list */}
      {emailAutomations.length > 0 && (
        <div className="space-y-3">
          {emailAutomations.map((automation) => (
            <div
              key={automation.id}
              className={cn(
                "p-4 rounded-xl border transition-colors",
                automation.is_active 
                  ? "bg-card border-border" 
                  : "bg-muted/20 border-border opacity-60"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleAutomation(automation.id, automation.is_active)}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-colors",
                      automation.is_active ? "bg-primary" : "bg-muted-foreground/30"
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{automation.name}</span>
                      {pendingCounts[automation.id] > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          {pendingCounts[automation.id]} pendente{pendingCounts[automation.id] !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>Gatilho: {getPipelineName(automation.trigger_pipeline_id)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => startEditing(automation)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
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
  );
}
