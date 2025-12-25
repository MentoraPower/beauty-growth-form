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
  pointerWithin,
  rectIntersection,
  CollisionDetection,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Lead, Pipeline } from "@/types/crm";
import { triggerWebhook } from "@/lib/webhooks";
import { trackPipelineMove, trackPositionChange } from "@/lib/leadTracking";
import { KanbanColumn } from "./KanbanColumn";
import { ListView } from "./ListView";
import { KanbanCard } from "./KanbanCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Search, Filter, X, CalendarIcon, Zap, Webhook, GitBranch } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { toast } from "sonner";
import { AutomationsDropdown } from "./AutomationsDropdown";
import { EmailFlowBuilder } from "./EmailFlowBuilder";


// Lazy load heavy components
const ManagePipelinesDialog = lazy(() => 
  import("./ManagePipelinesDialog").then(m => ({ default: m.ManagePipelinesDialog }))
);

const CalendarPageLazy = lazy(() => import("@/pages/CalendarPage"));

const EmailAutomationsView = lazy(() => 
  import("./EmailAutomationsView").then(m => ({ default: m.EmailAutomationsView }))
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
    automationId?: string;
    pendingEmailsCount?: number;
  };
}

type CRMView = "overview" | "quadro" | "lista" | "calendario" | "email";

export function KanbanBoard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const subOriginId = searchParams.get("origin");
  const urlSearchQuery = searchParams.get("search") || "";
  const urlView = searchParams.get("view") as CRMView | null;
  const isEmailBuilderOpen = searchParams.get("emailBuilder") === "open";
  const emailBuilderEmailId = searchParams.get("emailId");
  const emailBuilderName = searchParams.get("emailName");
  const emailBuilderTriggerPipelineId = searchParams.get("emailTrigger");
  
  const [activeView, setActiveView] = useState<CRMView>(urlView || "quadro");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    pipelineId: string;
    position: "top" | "bottom";
    targetLeadId?: string;
  } | null>(null);
  const [isPipelinesDialogOpen, setIsPipelinesDialogOpen] = useState(false);
  const [localLeads, setLocalLeads] = useState<Lead[]>([]);
  const isReorderingRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
  const [filterMQL, setFilterMQL] = useState<"all" | "mql" | "non-mql">("all");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [emailBuilderProps, setEmailBuilderProps] = useState<EmailBuilderState["props"] | null>(null);
  const [emailEditingContext, setEmailEditingContext] = useState<EmailEditingContext | null>(null);
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"automations" | "webhooks" | "pipelines">("automations");
  const queryClient = useQueryClient();
  const searchTimeoutRef = useRef<number | null>(null);

  // Handle view change and update URL
  const handleViewChange = useCallback((view: CRMView) => {
    setActiveView(view);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("view", view);
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

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
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 50,
        tolerance: 8,
      },
    })
  );

  // Custom collision detection - more responsive and anticipatory
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // First check pointer within (most precise for cards)
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    // Fallback to rect intersection (catches columns better)
    return rectIntersection(args);
  }, []);

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

  // Fetch exact lead counts per pipeline (bypasses 1000 row limit)
  const { data: pipelineCounts = {} } = useQuery({
    queryKey: ["pipeline-counts", subOriginId, pipelines.map(p => p.id).join(",")],
    queryFn: async () => {
      if (pipelines.length === 0) return {};
      
      const countPromises = pipelines.map(async (pipeline) => {
        const { count, error } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("pipeline_id", pipeline.id);
        
        return {
          pipelineId: pipeline.id,
          count: error ? 0 : (count || 0),
        };
      });
      
      const counts = await Promise.all(countPromises);
      return counts.reduce((acc, { pipelineId, count }) => {
        acc[pipelineId] = count;
        return acc;
      }, {} as Record<string, number>);
    },
    staleTime: 5000,
    enabled: pipelines.length > 0,
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

  // Fetch email automations for this sub-origin
  const { data: emailAutomations = [] } = useQuery({
    queryKey: ["email-automations-triggers", subOriginId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_automations")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;
      
      // Filter by sub_origin_id if available, or by trigger_pipeline belonging to current sub-origin
      if (subOriginId && data) {
        return data.filter(ea => ea.sub_origin_id === subOriginId);
      }
      return data || [];
    },
    staleTime: 5000,
    enabled: !!subOriginId,
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
        .maybeSingle();

      if (error) {
        console.error("Error fetching sub-origin:", error);
        return null;
      }
      return data;
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
        .order("created_at", { ascending: false });

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

  // Fetch tags for leads (for filtering and display on cards)
  const { data: leadTagsRaw = [] } = useQuery({
    queryKey: ["lead-tags-full", subOriginId, leads.length],
    queryFn: async () => {
      const leadIds = leads.map(l => l.id);
      if (leadIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("lead_tags")
        .select("id, lead_id, name, color")
        .in("lead_id", leadIds);

      if (error) return [];
      return data;
    },
    enabled: leads.length > 0,
  });

  // Convert leadTags to filtering format (backwards compatibility)
  const leadTags = useMemo(() => 
    leadTagsRaw.map(t => ({ lead_id: t.lead_id, name: t.name })),
    [leadTagsRaw]
  );

  // Map of lead_id -> LeadTag[] for card display
  const tagsMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }[]>();
    leadTagsRaw.forEach(tag => {
      const existing = map.get(tag.lead_id) || [];
      existing.push({ id: tag.id, name: tag.name, color: tag.color });
      map.set(tag.lead_id, existing);
    });
    return map;
  }, [leadTagsRaw]);

  // Consider loading only while queries are still in progress
  const isLoading = isLoadingPipelines || isLoadingLeads || isLoadingSubOrigin;

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
    
    // Don't overwrite local state during reordering operations
    if (isReorderingRef.current) return;
    
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
        // Also invalidate pipeline counts to keep them in sync
        queryClient.invalidateQueries({ queryKey: ["pipeline-counts", subOriginId] });
        invalidateLeadsTimeoutRef.current = null;
      }, 250);
    };

    const channel = supabase
      .channel(`crm-realtime-${subOriginId || "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          // Ignore real-time updates during reordering to prevent conflicts
          if (isReorderingRef.current) return;

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

  // Auto-navigate to first sub-origin if none selected
  useEffect(() => {
    const autoSelectFirstSubOrigin = async () => {
      if (subOriginId) return; // Already have a sub-origin selected
      
      // Get first origin ordered by 'ordem'
      const { data: origins } = await supabase
        .from('crm_origins')
        .select('id')
        .order('ordem')
        .limit(1);
      
      if (origins && origins.length > 0) {
        // Get first sub-origin of that origin
        const { data: subOrigins } = await supabase
          .from('crm_sub_origins')
          .select('id')
          .eq('origin_id', origins[0].id)
          .order('ordem')
          .limit(1);
        
        if (subOrigins && subOrigins.length > 0) {
          const newParams = new URLSearchParams(searchParams);
          newParams.set('origin', subOrigins[0].id);
          setSearchParams(newParams, { replace: true });
        }
      }
    };

    autoSelectFirstSubOrigin();
  }, [subOriginId, searchParams, setSearchParams]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setDropIndicator(null);
    isReorderingRef.current = true;
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over, active } = event;
    setOverId(over?.id as string | null);

    if (!over || !active) {
      setDropIndicator(null);
      return;
    }

    const overId = over.id as string;

    // Check if hovering over a top drop zone
    if (overId.endsWith("-top-zone")) {
      const pipelineId = overId.replace("-top-zone", "");
      setDropIndicator({
        pipelineId,
        position: "top",
      });
      return;
    }

    // Check if hovering over a pipeline column (empty area)
    const overPipeline = pipelines.find((p) => p.id === overId);
    if (overPipeline) {
      // Decide top/bottom based on pointer position inside the column
      const overRect = over.rect;
      const activeRect = active.rect.current.translated;

      let position: "top" | "bottom" = "top";
      if (overRect && activeRect) {
        const overCenter = overRect.top + overRect.height / 2;
        const activeCenter = activeRect.top + activeRect.height / 2;
        position = activeCenter > overCenter ? "bottom" : "top";
      }

      setDropIndicator({
        pipelineId: overPipeline.id,
        position,
      });
      return;
    }

    // Check if hovering over a lead card
    const overLead = localLeads.find((l) => l.id === overId);
    if (overLead && overLead.pipeline_id) {
      // Calculate position based on mouse/drag position relative to the card
      const overRect = over.rect;
      const activeRect = active.rect.current.translated;
      
      if (overRect && activeRect) {
        const overCenter = overRect.top + overRect.height / 2;
        const activeCenter = activeRect.top + activeRect.height / 2;
        const position = activeCenter < overCenter ? "top" : "bottom";
        
        setDropIndicator({
          pipelineId: overLead.pipeline_id,
          position,
          targetLeadId: overId,
        });
      } else {
        // Fallback to top if no rects available
        setDropIndicator({
          pipelineId: overLead.pipeline_id,
          position: "top",
          targetLeadId: overId,
        });
      }
    }
  }, [pipelines, localLeads]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      
      // Capture drop indicator before clearing state
      const currentDropIndicator = dropIndicator;

      setActiveId(null);
      setOverId(null);
      setDropIndicator(null);

      if (!over) {
        isReorderingRef.current = false;
        return;
      }

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeLead = localLeads.find((l) => l.id === activeId);
      if (!activeLead) {
        isReorderingRef.current = false;
        return;
      }

      // Check if dropping on a top-zone
      const isTopZone = overId.endsWith("-top-zone");
      const topZonePipelineId = isTopZone ? overId.replace("-top-zone", "") : null;

      // Check if dropping on a pipeline column or another lead
      const overPipeline = pipelines.find((p) => p.id === overId || p.id === topZonePipelineId);
      const overLead = localLeads.find((l) => l.id === overId);

      // Determine target pipeline
      let newPipelineId: string | null = topZonePipelineId
        ? topZonePipelineId
        : overPipeline
          ? overPipeline.id
          : overLead?.pipeline_id ?? null;

      if (!newPipelineId) {
        isReorderingRef.current = false;
        return;
      }

      // Same pipeline - handle reordering
      if (newPipelineId === activeLead.pipeline_id && overLead) {
        const pipelineLeads = localLeads
          .filter((l) => l.pipeline_id === newPipelineId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const oldIndex = pipelineLeads.findIndex((l) => l.id === activeId);
        const targetIndex = pipelineLeads.findIndex((l) => l.id === overId);
        
        if (oldIndex === -1 || targetIndex === -1 || oldIndex === targetIndex) {
          isReorderingRef.current = false;
          return;
        }

        // Simple swap using arrayMove - let dnd-kit handle the logic
        const reorderedLeads = arrayMove(pipelineLeads, oldIndex, targetIndex);

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
          
          // Also update react-query cache to prevent refetch from overwriting
          queryClient.setQueryData<Lead[]>(["crm-leads", subOriginId], (oldData) => {
            if (!oldData) return oldData;
            return oldData.map((l) => {
              const update = updates.find((u) => u.id === l.id);
              return update ? { ...l, ordem: update.ordem } : l;
            });
          });
        } catch (error) {
          console.error("Erro ao reordenar leads:", error);
          toast.error("Erro ao reordenar leads");
          queryClient.invalidateQueries({ queryKey: ["crm-leads", subOriginId] });
        } finally {
          // Clear reordering flag after a short delay to let DB sync
          setTimeout(() => { isReorderingRef.current = false; }, 500);
        }
        return;
      }

      // Same pipeline - dropped on the column (not directly on a card)
      if (newPipelineId === activeLead.pipeline_id && !overLead) {
        const pipelineLeads = localLeads
          .filter((l) => l.pipeline_id === newPipelineId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const oldIndex = pipelineLeads.findIndex((l) => l.id === activeId);
        if (oldIndex === -1) {
          isReorderingRef.current = false;
          return;
        }

        const wantsBottom =
          currentDropIndicator?.pipelineId === newPipelineId &&
          currentDropIndicator?.position === "bottom";

        const targetIndex = wantsBottom ? Math.max(pipelineLeads.length - 1, 0) : 0;
        if (oldIndex === targetIndex) {
          isReorderingRef.current = false;
          return;
        }

        const reorderedLeads = arrayMove(pipelineLeads, oldIndex, targetIndex);

        const updates = reorderedLeads.map((lead, index) => ({
          id: lead.id,
          ordem: index,
        }));

        setLocalLeads((prev) =>
          prev.map((l) => {
            const update = updates.find((u) => u.id === l.id);
            return update ? { ...l, ordem: update.ordem } : l;
          })
        );

        try {
          for (const update of updates) {
            await supabase
              .from("leads")
              .update({ ordem: update.ordem })
              .eq("id", update.id);
          }

          queryClient.setQueryData<Lead[]>(["crm-leads", subOriginId], (oldData) => {
            if (!oldData) return oldData;
            return oldData.map((l) => {
              const update = updates.find((u) => u.id === l.id);
              return update ? { ...l, ordem: update.ordem } : l;
            });
          });
        } catch (error) {
          console.error("Erro ao reordenar leads:", error);
          toast.error("Erro ao reordenar leads");
          queryClient.invalidateQueries({ queryKey: ["crm-leads", subOriginId] });
        } finally {
          setTimeout(() => { isReorderingRef.current = false; }, 500);
        }

        return;
      }
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
          } finally {
            setTimeout(() => { isReorderingRef.current = false; }, 500);
          }
          return;
        }

        // No automation - normal pipeline move
        const targetPipelineLeads = localLeads
          .filter((l) => l.pipeline_id === newPipelineId && l.id !== activeId)
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

        // Determine insertion index using drop indicator for precise placement
        let insertIndex = 0;
        
        // Check if we have a specific target lead from the drop indicator
        const targetLeadId = currentDropIndicator?.targetLeadId;
        if (targetLeadId) {
          const targetIndex = targetPipelineLeads.findIndex((l) => l.id === targetLeadId);
          if (targetIndex >= 0) {
            // Insert above or below based on position
            insertIndex = currentDropIndicator?.position === "bottom" 
              ? targetIndex + 1 
              : targetIndex;
          } else {
            insertIndex = 0;
          }
        } else if (overLead && overLead.id !== activeId) {
          // Fallback: use overId if no targetLeadId
          const overIndex = targetPipelineLeads.findIndex((l) => l.id === overId);
          if (overIndex >= 0) {
            insertIndex = currentDropIndicator?.position === "bottom" 
              ? overIndex + 1 
              : overIndex;
          } else {
            insertIndex = 0;
          }
        } else {
          // Dropped on empty column or no specific position - insert at top
          insertIndex = 0;
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

          // Force update the query cache to prevent stale data from overwriting local state
          queryClient.setQueryData<Lead[]>(["crm-leads", subOriginId], (oldData) => {
            if (!oldData) return oldData;
            return oldData.map((l) => {
              if (l.id === activeId) {
                return { ...l, pipeline_id: newPipelineId, ordem: insertIndex };
              }
              const upd = updatesForTarget.find((u) => u.id === l.id);
              return upd ? { ...l, ordem: upd.ordem } : l;
            });
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

          // Track pipeline move
          const fromPipeline = pipelines.find(p => p.id === activeLead.pipeline_id);
          const toPipeline = pipelines.find(p => p.id === newPipelineId);
          trackPipelineMove({
            leadId: activeId,
            fromPipelineName: fromPipeline?.nome || "Sem pipeline",
            toPipelineName: toPipeline?.nome || "Desconhecido",
            fromPipelineId: activeLead.pipeline_id,
            toPipelineId: newPipelineId,
          }).catch(console.error);

          // Email automations are handled server-side by the trigger-webhook edge function.

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
        } finally {
          setTimeout(() => { isReorderingRef.current = false; }, 500);
        }
      }

      // No-op drop (ex: soltou no fundo da mesma coluna): libera o lock do realtime
      isReorderingRef.current = false;
    },
    [localLeads, pipelines, automations, queryClient, subOriginId, dropIndicator]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    setDropIndicator(null);
    isReorderingRef.current = false;
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
    // Sort each pipeline's leads
    map.forEach((pipelineLeads) => {
      const hasManualOrder = pipelineLeads.some((l) => (l.ordem ?? 0) !== 0);

      pipelineLeads.sort((a, b) => {
        // If manual order exists in this pipeline, always respect ordem (including 0)
        if (hasManualOrder) {
          return (a.ordem ?? 0) - (b.ordem ?? 0);
        }
        // Otherwise, sort by created_at (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });
    return map;
  }, [displayLeads, pipelines]);

  // Check if sub-origin doesn't exist (after loading completes)
  if (subOriginId && !isLoadingSubOrigin && !currentSubOrigin) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-2rem)] gap-4">
        <p className="text-muted-foreground">Sub-origem não encontrada</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          Voltar
        </Button>
      </div>
    );
  }

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
          automationId={emailBuilderProps.automationId}
          pendingEmailsCount={emailBuilderProps.pendingEmailsCount || 0}
        />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Header - all on same line */}
      <div className="flex items-center gap-4 mb-2">
        {/* Title - left */}
        <h1 className="text-xl font-light flex-shrink-0">{pageTitle}</h1>

        {/* Hidden AutomationsDropdown - controlled externally */}
        {subOriginId && (
          <div className="hidden">
            <AutomationsDropdown 
              pipelines={pipelines} 
              subOriginId={subOriginId}
              externalOpen={automationsOpen}
              onOpenChange={setAutomationsOpen}
              emailEditingContext={emailEditingContext}
              onEmailContextChange={(ctx) => setEmailEditingContext(ctx)}
              onShowEmailBuilder={(show, props) => {
                if (show && props) {
                  if (props.editingContext) {
                    setEmailEditingContext(props.editingContext);
                  }
                  openEmailBuilder(props);
                } else {
                  closeEmailBuilder();
                }
              }}
            />
          </div>
        )}

        {/* Center space */}
        <div className="flex-1" />

        {/* Right side - Search and Filters */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative w-64">
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
      </div>

      {/* View Tabs - OverView | Quadro | Calendário */}
      {subOriginId && (
        <div className="w-full mb-4">
          <div className="w-full flex items-center justify-between bg-gray-200 rounded-lg px-4 py-2.5">
            <div className="relative inline-flex items-center gap-6">
              {/* Animated gradient indicator */}
              <div 
                className="absolute -bottom-1.5 h-0.5 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-300 ease-out"
                style={{
                  left: activeView === "overview" ? "0px" : 
                        activeView === "quadro" ? "calc(55px + 24px)" : 
                        activeView === "lista" ? "calc(55px + 24px + 48px + 24px)" :
                        activeView === "calendario" ? "calc(55px + 24px + 48px + 24px + 28px + 24px)" :
                        "calc(55px + 24px + 48px + 24px + 28px + 24px + 72px + 24px + 16px + 24px)",
                  width: activeView === "overview" ? "55px" : 
                         activeView === "quadro" ? "48px" : 
                         activeView === "lista" ? "28px" :
                         activeView === "calendario" ? "72px" :
                         "82px"
                }}
              />
              <button
                onClick={() => handleViewChange("overview")}
                className={cn(
                  "relative text-[13px] font-semibold tracking-wide transition-all antialiased",
                  activeView === "overview" 
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                OverView
              </button>
              <button
                onClick={() => handleViewChange("quadro")}
                className={cn(
                  "relative text-[13px] font-semibold tracking-wide transition-all antialiased",
                  activeView === "quadro" 
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                Quadro
              </button>
              <button
                onClick={() => handleViewChange("lista")}
                className={cn(
                  "relative text-[13px] font-semibold tracking-wide transition-all antialiased",
                  activeView === "lista" 
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                List
              </button>
              <button
                onClick={() => handleViewChange("calendario")}
                className={cn(
                  "relative text-[13px] font-semibold tracking-wide transition-all antialiased",
                  activeView === "calendario" 
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                Calendário
              </button>
              
              {/* Separator */}
              <div className="w-px h-4 bg-gray-400" />
              
              <button
                onClick={() => handleViewChange("email")}
                className={cn(
                  "relative text-[13px] font-semibold tracking-wide transition-all antialiased",
                  activeView === "email" 
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                Automations
              </button>
            </div>

            {/* Settings Icon - Right side */}
            <button 
              onClick={() => setSettingsDialogOpen(true)}
              className="p-1.5 rounded-lg hover:bg-gray-300 transition-colors text-gray-600 hover:text-gray-900"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
            </button>

            {/* Settings Dialog */}
            <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
              <DialogContent className="max-w-5xl h-[500px] p-0 flex flex-col gap-0" aria-describedby={undefined}>
                <DialogTitle className="sr-only">Configurações</DialogTitle>
                
                {/* Header with tabs */}
                <div className="border-b border-border">
                  <div className="px-6 py-3">
                    <h2 className="text-lg font-semibold">Configurações</h2>
                  </div>
                  
                  <div className="flex items-center gap-1 px-6">
                    <button
                      onClick={() => setSettingsTab("automations")}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                        settingsTab === "automations"
                          ? "border-orange-500 text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Zap className="w-4 h-4" />
                      Automação
                    </button>
                    <button
                      onClick={() => setSettingsTab("webhooks")}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                        settingsTab === "webhooks"
                          ? "border-orange-500 text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Webhook className="w-4 h-4" />
                      WebHook
                    </button>
                    <button
                      onClick={() => setSettingsTab("pipelines")}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                        settingsTab === "pipelines"
                          ? "border-orange-500 text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <GitBranch className="w-4 h-4" />
                      Pipelines
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto min-h-0 pt-4">
                  {settingsTab === "automations" && (
                    <div className="h-full">
                      <AutomationsDropdown 
                        pipelines={pipelines} 
                        subOriginId={subOriginId}
                        externalOpen={true}
                        onOpenChange={() => {}}
                        emailEditingContext={emailEditingContext}
                        onEmailContextChange={(ctx) => setEmailEditingContext(ctx)}
                        onShowEmailBuilder={(show, props) => {
                          if (show && props) {
                            if (props.editingContext) {
                              setEmailEditingContext(props.editingContext);
                            }
                            setSettingsDialogOpen(false);
                            openEmailBuilder(props);
                          } else {
                            closeEmailBuilder();
                          }
                        }}
                        embedded={true}
                        embeddedTab="automations"
                      />
                    </div>
                  )}
                  
                  {settingsTab === "webhooks" && (
                    <div className="h-full">
                      <AutomationsDropdown 
                        pipelines={pipelines} 
                        subOriginId={subOriginId}
                        externalOpen={true}
                        onOpenChange={() => {}}
                        emailEditingContext={emailEditingContext}
                        onEmailContextChange={(ctx) => setEmailEditingContext(ctx)}
                        onShowEmailBuilder={(show, props) => {
                          if (show && props) {
                            if (props.editingContext) {
                              setEmailEditingContext(props.editingContext);
                            }
                            setSettingsDialogOpen(false);
                            openEmailBuilder(props);
                          } else {
                            closeEmailBuilder();
                          }
                        }}
                        embedded={true}
                        embeddedTab="webhooks"
                      />
                    </div>
                  )}
                  
                  {settingsTab === "pipelines" && (
                    <Suspense fallback={<div className="p-6"><Skeleton className="h-64 w-full" /></div>}>
                      <ManagePipelinesDialog
                        open={true}
                        onOpenChange={() => {}}
                        pipelines={pipelines}
                        subOriginId={subOriginId}
                        embedded={true}
                      />
                    </Suspense>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

      {!subOriginId && (
        <p className="text-sm text-muted-foreground mb-4">
          Clique em uma sub-origem no menu lateral para ver os leads
        </p>
      )}

      {/* OverView */}
      {activeView === "overview" && subOriginId && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p>OverView - Em breve</p>
        </div>
      )}

      {/* Calendário */}
      {activeView === "calendario" && subOriginId && (
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <Skeleton className="h-96 w-full max-w-4xl rounded-xl" />
          </div>
        }>
          <CalendarPageLazy />
        </Suspense>
      )}

      {/* Email */}
      {activeView === "email" && subOriginId && (
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <Skeleton className="h-96 w-full max-w-4xl rounded-xl" />
          </div>
        }>
          <EmailAutomationsView 
            pipelines={pipelines} 
            subOriginId={subOriginId}
          />
        </Suspense>
      )}

      {/* Lista */}
      {activeView === "lista" && subOriginId && (
        <ListView
          pipelines={pipelines}
          leadsByPipeline={leadsByPipeline}
          subOriginId={subOriginId}
        />
      )}

      {/* Quadro (Kanban) */}
      {activeView === "quadro" && (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
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
                    leadCount={hasActiveFilters || searchQuery ? undefined : pipelineCounts[pipeline.id]}
                    isOver={overId === pipeline.id}
                    subOriginId={subOriginId}
                    activeId={activeId}
                    dropIndicator={dropIndicator}
                    activePipelineId={activeLead?.pipeline_id}
                    tagsMap={tagsMap}
                  />
                ))}
              </div>
            )}

            <DragOverlay 
              dropAnimation={null}
            >
              {activeLead ? (
                <div className="rotate-2 scale-[1.02] opacity-95 cursor-grabbing pointer-events-none">
                  <KanbanCard lead={activeLead} isDragging tags={tagsMap.get(activeLead.id) || []} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

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
