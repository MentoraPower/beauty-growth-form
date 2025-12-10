import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

export interface LeadActivity {
  id: string;
  lead_id: string;
  pipeline_id: string | null;
  titulo: string;
  tipo: string;
  data: string;
  hora: string;
  concluida: boolean;
  notas: string | null;
  created_at: string;
}

export interface Pipeline {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
}

interface UseLeadActivitiesProps {
  leadId: string;
  currentPipelineId: string | null;
}

export function useLeadActivities({ leadId, currentPipelineId }: UseLeadActivitiesProps) {
  const queryClient = useQueryClient();
  const [viewingPipelineId, setViewingPipelineId] = useState<string | null>(currentPipelineId);
  const [selectedActivity, setSelectedActivity] = useState<LeadActivity | null>(null);

  // Fetch all pipelines
  const { data: pipelines = [] } = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as Pipeline[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Set initial viewing pipeline
  useEffect(() => {
    if (currentPipelineId && !viewingPipelineId) {
      setViewingPipelineId(currentPipelineId);
    } else if (pipelines.length > 0 && !viewingPipelineId) {
      setViewingPipelineId(pipelines[0].id);
    }
  }, [currentPipelineId, pipelines, viewingPipelineId]);

  // Fetch activities for this lead
  const { data: allActivities = [], isLoading: isLoadingActivities, refetch: refetchActivities } = useQuery({
    queryKey: ["lead-activities", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", leadId)
        .order("data", { ascending: true })
        .order("hora", { ascending: true });
      if (error) throw error;
      return (data || []) as LeadActivity[];
    },
    enabled: !!leadId,
    staleTime: 30 * 1000,
  });

  // Filter activities by viewing pipeline
  const activities = useMemo(() => {
    if (!viewingPipelineId) return [];
    return allActivities.filter(a => a.pipeline_id === viewingPipelineId);
  }, [allActivities, viewingPipelineId]);

  // Realtime subscription
  useEffect(() => {
    if (!leadId) return;

    const channel = supabase
      .channel(`lead-activities-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_activities',
          filter: `lead_id=eq.${leadId}`
        },
        () => {
          refetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, refetchActivities]);

  const handlePipelineClick = useCallback((pipelineId: string) => {
    setViewingPipelineId(pipelineId);
    setSelectedActivity(null);
  }, []);

  const handleActivityClick = useCallback((activity: LeadActivity) => {
    setSelectedActivity(activity);
  }, []);

  const handleAddActivity = useCallback(async (activity: { titulo: string; tipo: string; data: Date; hora: string }, editingActivityId?: string) => {
    try {
      if (!leadId) {
        toast.error("ID do lead não encontrado");
        return;
      }

      if (!viewingPipelineId && !editingActivityId) {
        toast.error("Selecione uma etapa primeiro");
        return;
      }

      if (editingActivityId) {
        const { error } = await supabase
          .from("lead_activities")
          .update({
            titulo: activity.titulo,
            tipo: activity.tipo,
            data: format(activity.data, "yyyy-MM-dd"),
            hora: activity.hora,
          })
          .eq("id", editingActivityId);

        if (error) {
          toast.error(`Erro: ${error.message}`);
          return;
        }

        toast.success("Atividade atualizada!");
      } else {
        const { error } = await supabase
          .from("lead_activities")
          .insert({
            lead_id: leadId,
            pipeline_id: viewingPipelineId!,
            titulo: activity.titulo,
            tipo: activity.tipo,
            data: format(activity.data, "yyyy-MM-dd"),
            hora: activity.hora,
          });

        if (error) {
          toast.error(`Erro: ${error.message}`);
          return;
        }

        toast.success("Atividade criada!");
      }
      refetchActivities();
    } catch (error: any) {
      console.error("Error saving activity:", error);
      toast.error(`Erro ao salvar: ${error?.message || 'Erro desconhecido'}`);
    }
  }, [leadId, viewingPipelineId, refetchActivities]);

  const handleDeleteActivity = useCallback(async (activityId: string) => {
    try {
      const { error } = await supabase
        .from("lead_activities")
        .delete()
        .eq("id", activityId);

      if (error) throw error;

      toast.success("Atividade excluída!");

      if (selectedActivity?.id === activityId) {
        setSelectedActivity(null);
      }

      refetchActivities();
    } catch (error) {
      console.error("Error deleting activity:", error);
      toast.error("Erro ao excluir atividade");
    }
  }, [selectedActivity?.id, refetchActivities]);

  const handleToggleConcluida = useCallback(async (activityId: string, concluida: boolean) => {
    // Optimistic update
    queryClient.setQueryData(
      ["lead-activities", leadId],
      (oldData: LeadActivity[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map((activity) =>
          activity.id === activityId ? { ...activity, concluida } : activity
        );
      }
    );

    if (selectedActivity?.id === activityId) {
      setSelectedActivity(prev => prev ? { ...prev, concluida } : null);
    }

    try {
      const { error } = await supabase
        .from("lead_activities")
        .update({ concluida })
        .eq("id", activityId);

      if (error) {
        queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
        throw error;
      }
    } catch (error) {
      console.error("Error updating activity:", error);
      toast.error("Erro ao atualizar atividade");
    }
  }, [leadId, queryClient, selectedActivity?.id]);

  const currentPipelineName = pipelines.find(p => p.id === viewingPipelineId)?.nome || "Etapa";
  const currentPipelineIndex = pipelines.findIndex(p => p.id === currentPipelineId);

  return {
    pipelines,
    viewingPipelineId,
    currentPipelineId,
    currentPipelineIndex,
    activities,
    allActivities,
    selectedActivity,
    isLoadingActivities,
    currentPipelineName,
    handlePipelineClick,
    handleActivityClick,
    handleAddActivity,
    handleDeleteActivity,
    handleToggleConcluida,
    setSelectedActivity,
  };
}
