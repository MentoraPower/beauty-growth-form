import { useState, useEffect, lazy, Suspense, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pipeline } from "@/types/crm";

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
  const [automationId, setAutomationId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStepsRef = useRef<string>("");
  const didHydrateRef = useRef(false);
  const ignoreNextAutosaveRef = useRef(true);
  const lastKnownTriggerPipelineIdRef = useRef<string | null>(null);

  // Reset local state when switching sub-origin
  useEffect(() => {
    didHydrateRef.current = false;
    ignoreNextAutosaveRef.current = true;
    lastSavedStepsRef.current = "";
    lastKnownTriggerPipelineIdRef.current = null;
    setAutomationId(null);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, [subOriginId]);

  // Fetch existing automation for this sub_origin
  const { data: existingAutomation, isLoading, refetch } = useQuery({
    queryKey: ["email-automation-single", subOriginId],
    enabled: !!subOriginId,
    queryFn: async () => {
      if (!subOriginId) return null;

      const { data, error } = await (supabase as any)
        .from("email_automations")
        .select("*")
        .eq("sub_origin_id", subOriginId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching email automation:", error);
        return null;
      }

      return data as EmailAutomation | null;
    },
  });

  // Fetch pending emails count
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["scheduled-emails-count", automationId],
    queryFn: async () => {
      if (!automationId) return 0;

      const { count, error } = await supabase
        .from("scheduled_emails")
        .select("*", { count: "exact", head: true })
        .eq("automation_id", automationId)
        .eq("status", "pending");

      if (error) return 0;
      return count || 0;
    },
    enabled: !!automationId,
    refetchInterval: 30000,
  });

  // Hydrate refs when data loads (prevents overwriting on mount)
  useEffect(() => {
    if (didHydrateRef.current) return;

    const flowSteps = existingAutomation?.flow_steps || [];
    lastSavedStepsRef.current = JSON.stringify(flowSteps);
    lastKnownTriggerPipelineIdRef.current = existingAutomation?.trigger_pipeline_id || null;
    ignoreNextAutosaveRef.current = true;

    if (existingAutomation?.id) {
      setAutomationId(existingAutomation.id);
    }

    didHydrateRef.current = true;
  }, [existingAutomation]);

  const getPipelineName = useCallback(
    (pipelineId: string) => {
      return pipelines.find((p) => p.id === pipelineId)?.nome || "";
    },
    [pipelines]
  );

  // Auto-save function
  const autoSave = useCallback(async (steps: any[]) => {
    if (!didHydrateRef.current) return;

    const stepsJson = JSON.stringify(steps);

    // Ignore the first onChange emission after mount/hydration (prevents overwriting)
    if (ignoreNextAutosaveRef.current) {
      lastSavedStepsRef.current = stepsJson;
      ignoreNextAutosaveRef.current = false;
      return;
    }

    // Skip if nothing changed
    if (stepsJson === lastSavedStepsRef.current) {
      return;
    }

    // Filter out _edges step for processing
    const nodeSteps = steps.filter((s) => s.type !== "_edges");

    const emailSteps = nodeSteps.filter((s) => s.type === "email");
    const triggerStep = nodeSteps.find((s) => s.type === "trigger");

    // Get trigger pipeline from triggers array or legacy field
    let triggerPipelineId = triggerStep?.data?.triggerPipelineId;
    if (!triggerPipelineId && triggerStep?.data?.triggers?.length > 0) {
      const firstPipelineTrigger = triggerStep.data.triggers.find((t: any) => t.pipelineId);
      triggerPipelineId = firstPipelineTrigger?.pipelineId;
    }

    // Keep last known pipeline as fallback (prevents switching when trigger list is temporarily empty)
    if (!triggerPipelineId) {
      triggerPipelineId = lastKnownTriggerPipelineIdRef.current || undefined;
    }

    // Use first pipeline as last resort
    if (!triggerPipelineId && pipelines.length > 0) {
      triggerPipelineId = pipelines[0].id;
    }

    if (!triggerPipelineId) {
      console.log("Auto-save skipped: no trigger pipeline");
      return;
    }

    const firstEmailStep = emailSteps[0];
    const subject = firstEmailStep?.data?.subject || "";
    const bodyHtml = firstEmailStep?.data?.bodyHtml || "";

    try {
      if (automationId) {
        // Update existing
        const { error } = await (supabase as any)
          .from("email_automations")
          .update({
            trigger_pipeline_id: triggerPipelineId,
            subject,
            body_html: bodyHtml,
            flow_steps: steps,
          })
          .eq("id", automationId);

        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await (supabase as any)
          .from("email_automations")
          .insert({
            name: "Automação de Email",
            trigger_pipeline_id: triggerPipelineId,
            sub_origin_id: subOriginId,
            subject,
            body_html: bodyHtml,
            flow_steps: steps,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setAutomationId(data.id);
        }
      }

      lastSavedStepsRef.current = stepsJson;
      lastKnownTriggerPipelineIdRef.current = triggerPipelineId;
      console.log("Automação salva automaticamente", { automationId, triggerPipelineId });
    } catch (error) {
      console.error("Erro ao salvar automação:", error);
      toast.error("Erro ao salvar automação");
    }
  }, [automationId, subOriginId, pipelines]);

  // Debounced save handler
  const handleSaveFlow = useCallback((steps: any[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      autoSave(steps);
    }, 1000); // Auto-save after 1 second of inactivity
  }, [autoSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Manual save (for explicit save button if needed)
  const handleManualSave = async (steps: any[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await autoSave(steps);
    toast.success("Automação salva!");
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Always show flow builder directly
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <EmailFlowBuilder
        automationName={existingAutomation?.name || "Automação de Email"}
        triggerPipelineName={existingAutomation ? getPipelineName(existingAutomation.trigger_pipeline_id) : (pipelines[0]?.nome || "")}
        onSave={handleManualSave}
        onCancel={() => {}} // No cancel needed since it's always open
        onChange={handleSaveFlow}
        initialSteps={existingAutomation?.flow_steps || undefined}
        pipelines={pipelines}
        subOriginId={subOriginId}
        automationId={automationId || undefined}
        pendingEmailsCount={pendingCount}
        hideHeader={true}
      />
    </Suspense>
  );
}
