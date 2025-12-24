import { useState, useEffect, lazy, Suspense, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const [automationId, setAutomationId] = useState<string | null>(null);
  const [localAutomation, setLocalAutomation] = useState<EmailAutomation | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStepsRef = useRef<string>("");
  const didHydrateRef = useRef(false);
  const ignoreNextAutosaveRef = useRef(true);
  const lastKnownTriggerPipelineIdRef = useRef<string | null>(null);
  const currentSubOriginRef = useRef<string | null>(null);

  // Reset local state when switching sub-origin
  useEffect(() => {
    // Only reset if subOriginId actually changed
    if (currentSubOriginRef.current === subOriginId) return;
    
    console.log("Switching sub-origin from", currentSubOriginRef.current, "to", subOriginId);
    currentSubOriginRef.current = subOriginId;
    
    // Reset all refs
    didHydrateRef.current = false;
    ignoreNextAutosaveRef.current = true;
    lastSavedStepsRef.current = "";
    lastKnownTriggerPipelineIdRef.current = null;
    
    // Reset state
    setAutomationId(null);
    setLocalAutomation(null);

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    // Invalidate the query cache for the previous origin
    queryClient.invalidateQueries({ queryKey: ["email-automation-single"] });
  }, [subOriginId, queryClient]);

  // Fetch existing automation for this sub_origin
  const { data: existingAutomation, isLoading, refetch } = useQuery({
    queryKey: ["email-automation-single", subOriginId],
    enabled: !!subOriginId,
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache (previously cacheTime)
    refetchOnMount: "always",
    queryFn: async () => {
      if (!subOriginId) return null;

      console.log("Fetching automation for sub_origin:", subOriginId);
      
      const { data, error } = await supabase
        .from("email_automations")
        .select("*")
        .eq("sub_origin_id", subOriginId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching email automation:", error);
        return null;
      }

      console.log("Fetched automation:", data?.id, "for sub_origin:", subOriginId);
      return data as EmailAutomation | null;
    },
  });

  // Real-time subscription for automation changes
  useEffect(() => {
    if (!subOriginId) return;

    console.log("Setting up realtime subscription for sub_origin:", subOriginId);
    
    const channel = supabase
      .channel(`email-automations-${subOriginId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_automations',
          filter: `sub_origin_id=eq.${subOriginId}`,
        },
        (payload) => {
          console.log("Realtime update received:", payload.eventType, payload.new);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newData = payload.new as EmailAutomation;
            // Only update if it's for our current sub_origin
            if (newData.sub_origin_id === subOriginId) {
              setLocalAutomation(newData);
              if (newData.id && !automationId) {
                setAutomationId(newData.id);
              }
            }
          } else if (payload.eventType === 'DELETE') {
            setLocalAutomation(null);
            setAutomationId(null);
          }
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up realtime subscription for sub_origin:", subOriginId);
      supabase.removeChannel(channel);
    };
  }, [subOriginId, automationId]);

  // Sync local state with fetched data
  useEffect(() => {
    if (existingAutomation && existingAutomation.sub_origin_id === subOriginId) {
      setLocalAutomation(existingAutomation);
    }
  }, [existingAutomation, subOriginId]);

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
    if (!localAutomation) return;
    
    // Ensure this automation is for the current sub_origin
    if (localAutomation.sub_origin_id !== subOriginId) {
      console.log("Skipping hydration: automation sub_origin mismatch", localAutomation.sub_origin_id, "vs", subOriginId);
      return;
    }

    const flowSteps = localAutomation.flow_steps || [];
    
    // Create a clean version for comparison (without functions)
    const cleanSteps = flowSteps.map((s: any) => ({
      id: s.id,
      type: s.type,
      position: s.position,
      data: s.data ? Object.fromEntries(
        Object.entries(s.data).filter(([_, v]) => typeof v !== 'function')
      ) : {},
    }));
    
    lastSavedStepsRef.current = JSON.stringify(cleanSteps);
    lastKnownTriggerPipelineIdRef.current = localAutomation.trigger_pipeline_id || null;
    ignoreNextAutosaveRef.current = true;

    if (localAutomation.id) {
      setAutomationId(localAutomation.id);
    }

    didHydrateRef.current = true;
    console.log("Hydrated automation:", localAutomation.id, "for sub_origin:", subOriginId);
  }, [localAutomation, subOriginId]);

  const getPipelineName = useCallback(
    (pipelineId: string) => {
      return pipelines.find((p) => p.id === pipelineId)?.nome || "";
    },
    [pipelines]
  );

  // Auto-save function
  const autoSave = useCallback(async (steps: any[]) => {
    if (!didHydrateRef.current) {
      console.log("Auto-save skipped: not hydrated yet");
      return;
    }
    
    // Verify we're saving for the correct sub_origin
    if (currentSubOriginRef.current !== subOriginId) {
      console.log("Auto-save skipped: sub_origin changed during save");
      return;
    }

    // Create a clean version of steps without functions for comparison
    const cleanSteps = steps.map(s => ({
      id: s.id,
      type: s.type,
      position: s.position,
      data: s.data ? Object.fromEntries(
        Object.entries(s.data).filter(([_, v]) => typeof v !== 'function')
      ) : {},
    }));
    
    const stepsJson = JSON.stringify(cleanSteps);

    // Ignore the first onChange emission after mount/hydration (prevents overwriting)
    if (ignoreNextAutosaveRef.current) {
      lastSavedStepsRef.current = stepsJson;
      ignoreNextAutosaveRef.current = false;
      console.log("Auto-save: first call ignored (hydration)");
      return;
    }

    // Skip if nothing changed
    if (stepsJson === lastSavedStepsRef.current) {
      return;
    }
    
    console.log("Auto-save: changes detected, saving for sub_origin:", subOriginId);

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
        const { error } = await supabase
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
        const { data, error } = await supabase
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
      console.log("Automação salva automaticamente", { automationId, triggerPipelineId, subOriginId });
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

  // Use a key to force remount when switching origins
  const flowBuilderKey = `flow-builder-${subOriginId || 'none'}`;
  
  // Get the automation data to display (prefer localAutomation which has realtime updates)
  const displayAutomation = localAutomation?.sub_origin_id === subOriginId ? localAutomation : null;

  // Always show flow builder directly
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <EmailFlowBuilder
        key={flowBuilderKey}
        automationName={displayAutomation?.name || "Automação de Email"}
        triggerPipelineName={displayAutomation ? getPipelineName(displayAutomation.trigger_pipeline_id) : (pipelines[0]?.nome || "")}
        onSave={handleManualSave}
        onCancel={() => {}} // No cancel needed since it's always open
        onChange={handleSaveFlow}
        initialSteps={displayAutomation?.flow_steps || undefined}
        pipelines={pipelines}
        subOriginId={subOriginId}
        automationId={automationId || undefined}
        pendingEmailsCount={pendingCount}
        hideHeader={true}
      />
    </Suspense>
  );
}
