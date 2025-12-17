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
import { triggerWebhook } from "@/lib/webhooks";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Search, Filter, X, CalendarIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { toast } from "sonner";
import { AutomationsDropdown } from "./AutomationsDropdown";
import { EmailFlowBuilder } from "./EmailFlowBuilder";

// Lazy load heavy dialog
const ManagePipelinesDialog = lazy(() => 
  import("./ManagePipelinesDialog").then(m => ({ default: m.ManagePipelinesDialog }))
);

interface EmailEditingContext {
  emailName: string;
  emailTriggerPipeline: string;
  editingEmailId: string | null;
  isCreating: boolean;
  emailSubject: string;
  emailBodyHtml: string;
}

interface EmailBuilderState {
  show: boolean;
  props?: {
    automationName: string;
    triggerPipelineName: string;
    onSave: (steps: any[]) => Promise<void>;
    onCancel: () => void;
    initialSteps?: any[];
    editingContext?: EmailEditingContext;
    pipelines?: Pipeline[];
    subOriginId?: string | null;
  };
}

export function KanbanBoard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const subOriginId = searchParams.get("origin");
  const urlSearchQuery = searchParams.get("search") || "";
  const isEmailBuilderOpen = searchParams.get("emailBuilder") === "open";
  const emailBuilderEmailId = searchParams.get("emailId");
  const emailBuilderName = searchParams.get("emailName");
  const emailBuilderTriggerPipelineId = searchParams.get("emailTrigger");
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isPipelinesDialogOpen, setIsPipelinesDialogOpen] = useState(false);
  const [localLeads, setLocalLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
  const [filterMQL, setFilterMQL] = useState<"all" | "mql" | "non-mql">("all");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [emailBuilderProps, setEmailBuilderProps] = useState<EmailBuilderState["props"] | null>(null);
  const [emailEditingContext, setEmailEditingContext] = useState<EmailEditingContext | null>(null);
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const queryClient = useQueryClient();
  const searchTimeoutRef = useRef<number | null>(null);

  // Open email builder with URL param (and persist minimum state in URL for refresh/deep-link)
  const openEmailBuilder = useCallback((props: EmailBuilderState["props"]) => {
    setEmailBuilderProps(props);
    setAutomationsOpen(false);

    const ctx = props.editingContext;

    // NOTE: react-router-dom's setSearchParams does NOT support functional updates
    const next = new URLSearchParams(searchParams);
    next.set("emailBuilder", "open");

    if (ctx?.editingEmailId) next.set("emailId", ctx.editingEmailId);
    else next.delete("emailId");

    if (ctx?.emailName) next.set("emailName", ctx.emailName);
    else next.delete("emailName");

    if (ctx?.emailTriggerPipeline) next.set("emailTrigger", ctx.emailTriggerPipeline);
    else next.delete("emailTrigger");

    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Close email builder and return to CRM with automations popup open
  const closeEmailBuilder = useCallback(() => {
    // Clear builder props first so conditional render switches immediately
    setEmailBuilderProps(null);
    
    // NOTE: react-router-dom's setSearchParams does NOT support functional updates
    const next = new URLSearchParams(searchParams);
    next.delete("emailBuilder");
    next.delete("emailId");
    next.delete("emailName");
    next.delete("emailTrigger");
    setSearchParams(next, { replace: true });

    // Reopen automations dropdown immediately
    setAutomationsOpen(true);
  }, [searchParams, setSearchParams]);

  // Sync search from URL when navigating (e.g., coming back from lead detail)
  useEffect(() => {
    setSearchQuery(urlSearchQuery);
  }, [urlSearchQuery]);

  // Update URL with debounce to avoid triggering loading bar on every keystroke
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    // Debounce URL update to avoid loading bar flicker
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      const newParams = new URLSearchParams(searchParams);
      if (value) {
        newParams.set("search", value);
      } else {
        newParams.delete("search");
      }
      setSearchParams(newParams, { replace: true });
      searchTimeoutRef.current = null;
    }, 500);
  };
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

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

  const { data: pipelines = [], isLoading: isLoadingPipelines } = useQuery({
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
  const { data: currentSubOrigin, isLoading: isLoadingSubOrigin } = useQuery({
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

  const { data: leads = [], dataUpdatedAt, isLoading: isLoadingLeads } = useQuery({
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

  // Fetch all tags for filtering (after leads is declared)
  const { data: allTags = [] } = useQuery({
    queryKey: ["all-tags", subOriginId, leads.length],
    queryFn: async () => {
      const leadIds = leads.map(l => l.id);
      if (leadIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("lead_tags")
        .select("name, color")
        .in("lead_id", leadIds);

      if (error) return [];
      
      // Get unique tags
      const uniqueTags = new Map<string, { name: string; color: string }>();
      data.forEach(tag => {
        if (!uniqueTags.has(tag.name)) {
          uniqueTags.set(tag.name, tag);
        }
      });
      return Array.from(uniqueTags.values());
    },
    enabled: leads.length > 0,
  });

  // Fetch tags for leads (for filtering)
  const { data: leadTags = [] } = useQuery({
    queryKey: ["lead-tags-map", subOriginId, leads.length],
    queryFn: async () => {
      const leadIds = leads.map(l => l.id);
      if (leadIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("lead_tags")
        .select("lead_id, name")
        .in("lead_id", leadIds);

      if (error) return [];
      return data;
    },
    enabled: leads.length > 0,
  });

  // Consider loading if queries haven't resolved yet OR if subOriginId just changed
  const isLoading = isLoadingPipelines || isLoadingLeads || isLoadingSubOrigin || (subOriginId && !currentSubOrigin && pipelines.length === 0);

  // Track previous values to prevent unnecessary updates
  const prevDataUpdatedAtRef = useRef(dataUpdatedAt);
  const prevSubOriginIdRef = useRef(subOriginId);
  const invalidateLeadsTimeoutRef = useRef<number | null>(null);

  // Sync local state with fetched data - only when data actually changes
  useEffect(() => {
    // Reset when subOriginId changes
    if (prevSubOriginIdRef.current !== subOriginId) {
      prevSubOriginIdRef.current = subOriginId;
      prevDataUpdatedAtRef.current = 0;
      setLocalLeads([]);
      return;
    }
    
    // Update when data changes
    if (dataUpdatedAt && dataUpdatedAt !== prevDataUpdatedAtRef.current) {
      prevDataUpdatedAtRef.current = dataUpdatedAt;
      setLocalLeads(leads);
    }
  }, [dataUpdatedAt, subOriginId, leads]);

  // Real-time subscription
  useEffect(() => {
    const scheduleLeadsInvalidate = () => {
      if (invalidateLeadsTimeoutRef.current) {
        window.clearTimeout(invalidateLeadsTimeoutRef.current);
      }
      invalidateLeadsTimeoutRef.current = window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["crm-leads", subOriginId] });
        invalidateLeadsTimeoutRef.current = null;
      }, 250);
    };

    const channel = supabase
      .channel(`crm-realtime-${subOriginId || "all"}`)
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
            const deletedId = (payload.old as any).id;
            setLocalLeads((prev) => prev.filter((l) => l.id !== deletedId));
          }

          // Debounce invalidation to avoid UI freezes during batch updates/moves
          scheduleLeadsInvalidate();
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
      if (invalidateLeadsTimeoutRef.current) {
        window.clearTimeout(invalidateLeadsTimeoutRef.current);
        invalidateLeadsTimeoutRef.current = null;
      }
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

          // Trigger webhook for lead moved (fire and forget)
          const movedLead = { ...activeLead, pipeline_id: newPipelineId };
          triggerWebhook({
            trigger: "lead_moved",
            lead: movedLead as Lead,
            pipeline_id: newPipelineId,
            previous_pipeline_id: activeLead.pipeline_id,
            sub_origin_id: subOriginId,
          }).catch(console.error);
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
    let baseLeads = localLeads.length > 0 ? localLeads : leads;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      baseLeads = baseLeads.filter(lead => 
        lead.name.toLowerCase().includes(query) ||
        lead.email.toLowerCase().includes(query) ||
        lead.clinic_name?.toLowerCase().includes(query)
      );
    }
    
    // Filter by MQL status
    if (filterMQL === "mql") {
      baseLeads = baseLeads.filter(lead => lead.is_mql === true);
    } else if (filterMQL === "non-mql") {
      baseLeads = baseLeads.filter(lead => lead.is_mql === false);
    }
    
    // Filter by tags
    if (filterTags.length > 0) {
      const leadIdsWithTags = new Set(
        leadTags
          .filter(lt => filterTags.includes(lt.name))
          .map(lt => lt.lead_id)
      );
      baseLeads = baseLeads.filter(lead => leadIdsWithTags.has(lead.id));
    }
    
    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      baseLeads = baseLeads.filter(lead => new Date(lead.created_at) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      baseLeads = baseLeads.filter(lead => new Date(lead.created_at) <= end);
    }
    
    return baseLeads;
  }, [localLeads, leads, searchQuery, filterMQL, filterTags, leadTags, startDate, endDate]);

  const hasActiveFilters = filterMQL !== "all" || filterTags.length > 0 || startDate !== undefined || endDate !== undefined;

  const clearFilters = () => {
    setFilterMQL("all");
    setFilterTags([]);
    setStartDate(undefined);
    setEndDate(undefined);
  };

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
    // Sort each pipeline's leads - by created_at (newest first), respecting manual ordem when set
    map.forEach((pipelineLeads) => {
      pipelineLeads.sort((a, b) => {
        // If both have ordem set (manual reorder), use ordem
        if (a.ordem !== null && a.ordem !== undefined && a.ordem !== 0 && 
            b.ordem !== null && b.ordem !== undefined && b.ordem !== 0) {
          return (a.ordem ?? 0) - (b.ordem ?? 0);
        }
        // Otherwise, sort by created_at (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });
    return map;
  }, [displayLeads, pipelines]);

  // Build title based on current sub-origin
  const pageTitle = currentSubOrigin 
    ? currentSubOrigin.nome
    : "Selecione uma sub-origem";

  // If email builder is open, show only EmailFlowBuilder
  if (isEmailBuilderOpen && emailBuilderProps) {
    return (
      <div className="relative flex flex-col h-full w-full overflow-hidden">
        <EmailFlowBuilder
          automationName={emailBuilderProps.automationName}
          triggerPipelineName={emailBuilderProps.triggerPipelineName}
          onSave={async (steps) => {
            await emailBuilderProps.onSave(steps);
            setEmailEditingContext(null); // Clear context after successful save
            closeEmailBuilder();
          }}
          onCancel={() => {
            emailBuilderProps.onCancel();
            closeEmailBuilder();
          }}
          initialSteps={emailBuilderProps.initialSteps}
          pipelines={emailBuilderProps.pipelines || pipelines}
          subOriginId={emailBuilderProps.subOriginId || subOriginId}
        />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-[calc(100vh-2rem)] overflow-hidden">
      {/* Header - all on same line */}
      <div className="flex items-center gap-4 mb-4">
        {/* Title - left */}
        <h1 className="text-xl font-light flex-shrink-0">{pageTitle}</h1>

        {/* Search centered with filters */}
        <div className="flex-1 flex items-center justify-center gap-2">
          {subOriginId && (
            <AutomationsDropdown 
              pipelines={pipelines} 
              subOriginId={subOriginId}
              externalOpen={automationsOpen}
              onOpenChange={setAutomationsOpen}
              emailEditingContext={emailEditingContext}
              onEmailContextChange={(ctx) => setEmailEditingContext(ctx)}
              onShowEmailBuilder={(show, props) => {
                if (show && props) {
                  // Save the editing context for when we come back
                  if (props.editingContext) {
                    setEmailEditingContext(props.editingContext);
                  }
                  openEmailBuilder(props);
                } else {
                  closeEmailBuilder();
                }
              }}
            />
          )}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Pesquisar leads..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Filters - Modern Style */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant={hasActiveFilters ? "default" : "outline"} 
                size="sm" 
                className={hasActiveFilters 
                  ? "h-9 gap-2 bg-gradient-to-r from-[#F40000] to-[#A10000] text-white border-0" 
                  : "h-9 gap-2"
                }
              >
                <Filter className="w-4 h-4" />
                Filtros
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-white/20 rounded-full">
                    {(filterMQL !== "all" ? 1 : 0) + filterTags.length + (startDate ? 1 : 0) + (endDate ? 1 : 0)}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-72 bg-popover z-[9999] p-0 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Filtros</span>
                  {hasActiveFilters && (
                    <button 
                      onClick={clearFilters}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Limpar tudo
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3 space-y-4">
                {/* MQL Status Section */}
                <div className="space-y-2">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Qualificação
                  </span>
                  
                  <div className="space-y-2">
                    {/* MQL Toggle */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-medium">MQL</span>
                      </div>
                      <button
                        onClick={() => setFilterMQL(filterMQL === "mql" ? "all" : "mql")}
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          filterMQL === "mql" ? "bg-emerald-500" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                            filterMQL === "mql" ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                    
                    {/* Non-MQL Toggle */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="text-xs font-medium">Não MQL</span>
                      </div>
                      <button
                        onClick={() => setFilterMQL(filterMQL === "non-mql" ? "all" : "non-mql")}
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          filterMQL === "non-mql" ? "bg-orange-500" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                            filterMQL === "non-mql" ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Date Filter Section */}
                <div className="space-y-2">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Data de Cadastro
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {/* Start Date */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-left",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="w-3.5 h-3.5" />
                          {startDate ? format(startDate, "dd/MM/yy", { locale: ptBR }) : "Início"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[99999]" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>

                    {/* End Date */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-left",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="w-3.5 h-3.5" />
                          {endDate ? format(endDate, "dd/MM/yy", { locale: ptBR }) : "Fim"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[99999]" align="end">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Clear dates */}
                  {(startDate || endDate) && (
                    <button
                      onClick={() => { setStartDate(undefined); setEndDate(undefined); }}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Limpar datas
                    </button>
                  )}
                </div>
                
                {/* Tags Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Tags
                    </span>
                    {filterTags.length > 0 && (
                      <button 
                        onClick={() => setFilterTags([])}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  
                  {/* Selected Tags */}
                  {filterTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-muted/20 rounded-lg border border-border/50">
                      {filterTags.map((tagName) => {
                        const tag = allTags.find(t => t.name === tagName);
                        return (
                          <span
                            key={tagName}
                            className="inline-flex items-center gap-1 py-0.5 px-2 rounded text-[11px] text-white"
                            style={{ backgroundColor: tag?.color || "#6366f1" }}
                          >
                            {tagName}
                            <button
                              onClick={() => setFilterTags(filterTags.filter(t => t !== tagName))}
                              className="hover:bg-white/20 rounded-sm"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Available Tags */}
                  {allTags.length > 0 ? (
                    <div className="max-h-28 overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/30">
                      {allTags.filter(tag => !filterTags.includes(tag.name)).map((tag) => (
                        <button
                          key={tag.name}
                          onClick={() => setFilterTags([...filterTags, tag.name])}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left"
                        >
                          <span 
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white/50" 
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="truncate text-foreground">{tag.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/50">
                      Nenhuma tag disponível
                    </div>
                  )}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right side - settings */}
        <div className="flex items-center gap-2 flex-shrink-0">
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

      {!subOriginId && (
        <p className="text-sm text-muted-foreground mb-4">
          Clique em uma sub-origem no menu lateral para ver os leads
        </p>
      )}

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
        {isLoading ? (
          // Loading skeletons
          <div className="flex gap-4 overflow-x-auto flex-1 pb-0 min-h-0 animate-in fade-in duration-300">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 w-72 bg-muted/40 rounded-xl p-3 min-h-0">
                <Skeleton className="h-6 w-24 mb-4" />
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto flex-1 pb-0 min-h-0 animate-in fade-in duration-300">
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
            <div className="rotate-3 scale-105">
              <KanbanCard lead={activeLead} isDragging />
            </div>
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
