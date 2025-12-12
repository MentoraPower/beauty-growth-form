import { useState, useEffect, useCallback, useMemo, lazy, Suspense, useRef } from "react";
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
import { arrayMove } from "@dnd-kit/sortable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Lead, Pipeline } from "@/types/crm";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, LayoutGrid, List, Search } from "lucide-react";
import { LeadsList } from "./LeadsList";
import { toast } from "sonner";

// Lazy load heavy dialog
const ManagePipelinesDialog = lazy(() => 
  import("./ManagePipelinesDialog").then(m => ({ default: m.ManagePipelinesDialog }))
);

export function KanbanBoard() {
  const [searchParams] = useSearchParams();
  const subOriginId = searchParams.get("origin");
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isPipelinesDialogOpen, setIsPipelinesDialogOpen] = useState(false);
  const [localLeads, setLocalLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">(() => {
    const saved = localStorage.getItem('crm_view_mode');
    return (saved === 'list' || saved === 'kanban') ? saved : 'kanban';
  });
  const queryClient = useQueryClient();

  // Persist viewMode to localStorage
  useEffect(() => {
    localStorage.setItem('crm_view_mode', viewMode);
  }, [viewMode]);

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
    queryKey: ["pipelines", subOriginId],
    queryFn: async () => {
      let query = supabase
        .from("pipelines")
        .select("*")
        .order("ordem", { ascending: true });
      
      // Filter by sub_origin_id if selected
      if (subOriginId) {
        query = query.eq("sub_origin_id", subOriginId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Pipeline[];
    },
    staleTime: 5000,
  });

  // Fetch automations for pipeline transfers (filtered by sub_origin_id)
  const { data: automations = [] } = useQuery({
    queryKey: ["pipeline-automations", subOriginId],
    queryFn: async () => {
      let query = supabase
        .from("pipeline_automations")
        .select("*")
        .eq("is_active", true);
      
      if (subOriginId) {
        query = query.eq("sub_origin_id", subOriginId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    staleTime: 5000,
  });

  // Fetch current sub-origin name for display
  const { data: currentSubOrigin } = useQuery({
    queryKey: ["sub-origin", subOriginId],
    queryFn: async () => {
      if (!subOriginId) return null;
      const { data, error } = await supabase
        .from("crm_sub_origins")
        .select("*, crm_origins(nome)")
        .eq("id", subOriginId)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!subOriginId,
  });

  const { data: leads = [], dataUpdatedAt } = useQuery({
    queryKey: ["crm-leads", subOriginId],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("*")
        .order("ordem", { ascending: true, nullsFirst: false });

      // Filter by sub_origin_id if one is selected
      if (subOriginId) {
        query = query.eq("sub_origin_id", subOriginId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Lead[];
    },
    staleTime: 5000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Track previous dataUpdatedAt to prevent unnecessary updates
  const prevDataUpdatedAtRef = useRef(dataUpdatedAt);

  // Sync local state with fetched data - only when data actually changes
  useEffect(() => {
    if (dataUpdatedAt !== prevDataUpdatedAtRef.current || leads !== localLeads) {
      prevDataUpdatedAtRef.current = dataUpdatedAt;
      setLocalLeads(leads);
    }
  }, [dataUpdatedAt]);
  
  // Reset local leads when subOriginId changes
  useEffect(() => {
    setLocalLeads([]);
    prevDataUpdatedAtRef.current = 0;
  }, [subOriginId]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`crm-realtime-${subOriginId || 'all'}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newLead = payload.new as Lead;
            // Only add if matches current sub_origin filter
            if (subOriginId && newLead.sub_origin_id !== subOriginId) return;
            setLocalLeads((prev) => {
              if (prev.some((l) => l.id === newLead.id)) return prev;
              return [newLead, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedLead = payload.new as Lead;
            // If sub_origin changed and doesn't match current filter, remove it
            if (subOriginId && updatedLead.sub_origin_id !== subOriginId) {
              setLocalLeads((prev) => prev.filter((l) => l.id !== updatedLead.id));
            } else {
              setLocalLeads((prev) =>
                prev.map((l) => (l.id === updatedLead.id ? updatedLead : l))
              );
            }
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setLocalLeads((prev) => prev.filter((l) => l.id !== deletedId));
          }
          queryClient.invalidateQueries({ queryKey: ["crm-leads", subOriginId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pipelines" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pipelines", subOriginId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, subOriginId]);

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

      // Check if dropping on a pipeline column or another lead
      const overPipeline = pipelines.find((p) => p.id === overId);
      const overLead = localLeads.find((l) => l.id === overId);

      // Determine target pipeline
      let newPipelineId: string | null = overPipeline
        ? overPipeline.id
        : overLead?.pipeline_id ?? null;

      if (!newPipelineId) return;

      // Same pipeline - handle reordering
      if (newPipelineId === activeLead.pipeline_id && overLead) {
        const pipelineLeads = localLeads
          .filter((l) => l.pipeline_id === newPipelineId)
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

        const oldIndex = pipelineLeads.findIndex((l) => l.id === activeId);
        const newIndex = pipelineLeads.findIndex((l) => l.id === overId);

        if (oldIndex === newIndex) return;

        const reorderedLeads = arrayMove(pipelineLeads, oldIndex, newIndex);

        // Update ordem for all reordered leads
        const updates = reorderedLeads.map((lead, index) => ({
          id: lead.id,
          ordem: index,
        }));

        // Optimistic update
        setLocalLeads((prev) =>
          prev.map((l) => {
            const update = updates.find((u) => u.id === l.id);
            return update ? { ...l, ordem: update.ordem } : l;
          })
        );

        // Update database
        try {
          for (const update of updates) {
            await supabase
              .from("leads")
              .update({ ordem: update.ordem })
              .eq("id", update.id);
          }
        } catch (error) {
          console.error("Erro ao reordenar leads:", error);
          toast.error("Erro ao reordenar leads");
          queryClient.invalidateQueries({ queryKey: ["crm-leads", subOriginId] });
        }
        return;
      }

      // Different pipeline - move lead and position it
      if (newPipelineId !== activeLead.pipeline_id) {
        // Check for automation on this pipeline
        const automation = automations.find(
          (a) => a.pipeline_id === newPipelineId && a.is_active
        );

        // If automation exists and has target sub_origin, transfer the lead
        if (automation && automation.target_sub_origin_id && automation.target_pipeline_id) {
          // Remove lead from local state immediately (optimistic)
          setLocalLeads((prev) => prev.filter((l) => l.id !== activeId));

          try {
            // Transfer lead to target sub-origin and pipeline
            const { error } = await supabase
              .from("leads")
              .update({
                sub_origin_id: automation.target_sub_origin_id,
                pipeline_id: automation.target_pipeline_id,
                ordem: 0,
              })
              .eq("id", activeId);

            if (error) throw error;

            // Invalidate queries for both origins to refresh data
            queryClient.invalidateQueries({ queryKey: ["crm-leads", subOriginId] });
            queryClient.invalidateQueries({ queryKey: ["crm-leads", automation.target_sub_origin_id] });

            toast.success("Lead transferido automaticamente!");
          } catch (error) {
            // Revert optimistic update
            setLocalLeads((prev) => [...prev, activeLead]);
            console.error("Erro ao transferir lead:", error);
            toast.error("Erro ao transferir lead");
          }
          return;
        }

        // No automation - normal pipeline move
        const targetPipelineLeads = localLeads
          .filter((l) => l.pipeline_id === newPipelineId)
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

        // Determine insertion index
        let insertIndex = 0;
        if (overLead) {
          const overIndex = targetPipelineLeads.findIndex((l) => l.id === overId);
          insertIndex = overIndex >= 0 ? overIndex : targetPipelineLeads.length;
        } else {
          insertIndex = targetPipelineLeads.length;
        }

        // Calculate new ordem values
        const updatesForTarget = targetPipelineLeads.map((lead, index) => ({
          id: lead.id,
          ordem: index >= insertIndex ? index + 1 : index,
        }));

        // Optimistic update
        setLocalLeads((prev) =>
          prev.map((l) => {
            if (l.id === activeId) {
              return { ...l, pipeline_id: newPipelineId, ordem: insertIndex };
            }
            const update = updatesForTarget.find((u) => u.id === l.id);
            return update ? { ...l, ordem: update.ordem } : l;
          })
        );

        try {
          // Update the moved lead
          await supabase
            .from("leads")
            .update({ pipeline_id: newPipelineId, ordem: insertIndex })
            .eq("id", activeId);

          // Update ordem for displaced leads
          for (const update of updatesForTarget.filter((u) => u.ordem > insertIndex - 1)) {
            await supabase
              .from("leads")
              .update({ ordem: update.ordem })
              .eq("id", update.id);
          }

          // Force update the query cache to prevent stale data on navigation
          queryClient.setQueryData<Lead[]>(["crm-leads", subOriginId], (oldData) => {
            if (!oldData) return oldData;
            return oldData.map((l) => 
              l.id === activeId 
                ? { ...l, pipeline_id: newPipelineId, ordem: insertIndex }
                : l
            );
          });
        } catch (error) {
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
      }
    },
    [localLeads, pipelines, automations, queryClient, subOriginId]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
  }, []);

  const activeLead = useMemo(
    () => (activeId ? localLeads.find((l) => l.id === activeId) : null),
    [activeId, localLeads]
  );

  const displayLeads = useMemo(() => {
    const baseLeads = localLeads.length > 0 ? localLeads : leads;
    if (!searchQuery.trim()) return baseLeads;
    const query = searchQuery.toLowerCase().trim();
    return baseLeads.filter(lead => 
      lead.name.toLowerCase().includes(query) ||
      lead.email.toLowerCase().includes(query) ||
      lead.clinic_name?.toLowerCase().includes(query)
    );
  }, [localLeads, leads, searchQuery]);

  // Memoize leads grouped by pipeline for Kanban view
  const leadsByPipeline = useMemo(() => {
    const map = new Map<string, Lead[]>();
    pipelines.forEach(p => map.set(p.id, []));
    displayLeads.forEach(lead => {
      if (lead.pipeline_id) {
        const arr = map.get(lead.pipeline_id);
        if (arr) arr.push(lead);
      }
    });
    // Sort each pipeline's leads
    map.forEach((pipelineLeads) => {
      pipelineLeads.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    });
    return map;
  }, [displayLeads, pipelines]);

  // Build title based on current sub-origin
  const pageTitle = currentSubOrigin 
    ? `${currentSubOrigin.crm_origins?.nome} / ${currentSubOrigin.nome}`
    : "Selecione uma sub-origem";

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="transition-all duration-150 flex-shrink-0">
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
          {!subOriginId && (
            <p className="text-sm text-muted-foreground mt-1">
              Clique em uma sub-origem no menu lateral para ver os leads
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Pesquisar leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none transition-colors duration-100"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none transition-colors duration-100"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPipelinesDialogOpen(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Gerenciar Origens
          </Button>
        </div>
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
        {viewMode === "list" ? (
          <div className="fade-in">
            <LeadsList leads={displayLeads} pipelines={pipelines} activeDragId={activeId} subOriginId={subOriginId} />
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto flex-1 pb-0 h-full fade-in">
            {pipelines.map((pipeline) => (
              <KanbanColumn
                key={pipeline.id}
                pipeline={pipeline}
                leads={leadsByPipeline.get(pipeline.id) || []}
                isOver={overId === pipeline.id}
                subOriginId={subOriginId}
              />
            ))}
          </div>
        )}

        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            viewMode === "list" ? (
              <div className="bg-white border border-primary/30 rounded-lg px-4 py-2 shadow-lg opacity-90">
                <span className="font-medium text-sm">{activeLead.name}</span>
                <span className="text-muted-foreground text-sm ml-4">{activeLead.email}</span>
              </div>
            ) : (
              <div className="rotate-3 scale-105">
                <KanbanCard lead={activeLead} isDragging />
              </div>
            )
          ) : null}
        </DragOverlay>
      </DndContext>

      <Suspense fallback={null}>
        <ManagePipelinesDialog
          open={isPipelinesDialogOpen}
          onOpenChange={setIsPipelinesDialogOpen}
          pipelines={pipelines}
          subOriginId={subOriginId}
        />
      </Suspense>
    </div>
  );
}
