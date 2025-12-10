import { useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
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
  const [isPipelinesDialogOpen, setIsPipelinesDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
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
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["crm-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data as Lead[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("crm-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pipelines",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pipelines"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeLead = leads.find((l) => l.id === activeId);
    if (!activeLead) {
      setActiveId(null);
      return;
    }

    const overPipeline = pipelines.find((p) => p.id === overId);
    const overLead = leads.find((l) => l.id === overId);

    let newPipelineId = activeLead.pipeline_id;

    if (overPipeline) {
      newPipelineId = overPipeline.id;
    } else if (overLead) {
      newPipelineId = overLead.pipeline_id;
    }

    if (newPipelineId !== activeLead.pipeline_id) {
      try {
        const { error } = await supabase
          .from("leads")
          .update({ pipeline_id: newPipelineId })
          .eq("id", activeId);

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
        toast.success("Lead movido com sucesso!");
      } catch (error) {
        console.error("Erro ao mover lead:", error);
        toast.error("Erro ao mover lead");
      }
    }

    setActiveId(null);
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

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
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {pipelines.map((pipeline) => {
            const pipelineLeads = leads.filter(
              (lead) => lead.pipeline_id === pipeline.id
            );
            return (
              <KanbanColumn
                key={pipeline.id}
                pipeline={pipeline}
                leads={pipelineLeads}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeLead ? <KanbanCard lead={activeLead} /> : null}
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
