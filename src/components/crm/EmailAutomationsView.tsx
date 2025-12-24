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
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStepsRef = useRef<string>("");

  // Fetch existing automation for this sub_origin
  const { data: existingAutomation, isLoading, refetch } = useQuery({
    queryKey: ["email-automation-single", subOriginId],
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

  // Set automation ID when data loads
  useEffect(() => {
    if (existingAutomation?.id) {
      setAutomationId(existingAutomation.id);
    }
  }, [existingAutomation]);

  const getPipelineName = useCallback((pipelineId: string) => {
    return pipelines.find(p => p.id === pipelineId)?.nome || "";
  }, [pipelines]);

  // Auto-save function
  const autoSave = useCallback(async (steps: any[]) => {
    const stepsJson = JSON.stringify(steps);
    
    // Skip if nothing changed
    if (stepsJson === lastSavedStepsRef.current) {
      return;
    }

    const emailSteps = steps.filter(s => s.type === "email");
    const triggerStep = steps.find(s => s.type === "trigger");
    const triggerPipelineId = triggerStep?.data?.triggerPipelineId || pipelines[0]?.id;

    if (!triggerPipelineId) {
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
      console.log("Automação salva automaticamente");
    } catch (error) {
      console.error("Erro ao salvar automação:", error);
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
