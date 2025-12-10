import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Lead, Pipeline } from "@/types/crm";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { ManagePipelinesDialog } from "./ManagePipelinesDialog";
import { toast } from "sonner";

export function KanbanBoard() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isPipelinesDialogOpen, setIsPipelinesDialogOpen] = useState(false);
  const [localLeads, setLocalLeads] = useState<Lead[]>([]);
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    })
  );

  const { data: pipelines = [] } = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data as Pipeline[];
    },
    staleTime: 30000,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["crm-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Lead[];
    },
    staleTime: 5000,
  });

  // Sync local state with fetched data
  useEffect(() => {
    if (leads.length > 0) {
      setLocalLeads(leads);
    }
  }, [leads]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("crm-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newLead = payload.new as Lead;
            setLocalLeads((prev) => {
              if (prev.some((l) => l.id === newLead.id)) return prev;
              return [newLead, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedLead = payload.new as Lead;
            setLocalLeads((prev) =>
              prev.map((l) => (l.id === updatedLead.id ? updatedLead : l))
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setLocalLeads((prev) => prev.filter((l) => l.id !== deletedId));
          }
          queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pipelines" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pipelines"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);
      setOverId(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeLead = localLeads.find((l) => l.id === activeId);
      if (!activeLead) return;

      // Determine target pipeline
      let newPipelineId: string | null = null;

      const overPipeline = pipelines.find((p) => p.id === overId);
      if (overPipeline) {
        newPipelineId = overPipeline.id;
      } else {
        const overLead = localLeads.find((l) => l.id === overId);
        if (overLead) {
          newPipelineId = overLead.pipeline_id;
        }
      }

      if (!newPipelineId || newPipelineId === activeLead.pipeline_id) return;

      // Optimistic update - update local state immediately
      setLocalLeads((prev) =>
        prev.map((l) =>
          l.id === activeId ? { ...l, pipeline_id: newPipelineId } : l
        )
      );

      // Update database in background
      try {
        const { error } = await supabase
          .from("leads")
          .update({ pipeline_id: newPipelineId })
          .eq("id", activeId);

        if (error) throw error;
      } catch (error) {
        // Revert on error
        setLocalLeads((prev) =>
          prev.map((l) =>
            l.id === activeId
              ? { ...l, pipeline_id: activeLead.pipeline_id }
              : l
          )
        );
        console.error("Erro ao mover lead:", error);
        toast.error("Erro ao mover lead");
      }
    },
    [localLeads, pipelines]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
  }, []);

  const activeLead = useMemo(
    () => (activeId ? localLeads.find((l) => l.id === activeId) : null),
    [activeId, localLeads]
  );

  const displayLeads = localLeads.length > 0 ? localLeads : leads;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">CRM - Gestão de Leads</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsPipelinesDialogOpen(true)}
        >
          <Settings className="w-4 h-4 mr-2" />
          Gerenciar Origens
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {pipelines.map((pipeline) => {
            const pipelineLeads = displayLeads.filter(
              (lead) => lead.pipeline_id === pipeline.id
            );
            return (
              <KanbanColumn
                key={pipeline.id}
                pipeline={pipeline}
                leads={pipelineLeads}
                isOver={overId === pipeline.id}
              />
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            <div className="rotate-3 scale-105">
              <KanbanCard lead={activeLead} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <ManagePipelinesDialog
        open={isPipelinesDialogOpen}
        onOpenChange={setIsPipelinesDialogOpen}
        pipelines={pipelines}
      />
    </div>
  );
}
