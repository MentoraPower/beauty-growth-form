import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Link2, X, Trash2, GripVertical, CalendarIcon } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChartSelectorDialog, ChartType } from "./ChartSelectorDialog";
import { ConnectSourceDialog, WidgetSource } from "./ConnectSourceDialog";
import { ChartRenderer } from "./ChartRenderer";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface WidgetData {
  total: number;
  label: string;
  distribution?: ChartDataPoint[];
  trend?: ChartDataPoint[];
}

export interface DashboardWidget {
  id: string;
  chartType: ChartType;
  source: WidgetSource | null;
  isConnected: boolean;
  data?: WidgetData;
  isLoading?: boolean;
  width?: number;
  height?: number;
  customName?: string;
}

interface DashboardCanvasProps {
  painelName: string;
  dashboardId?: string;
  onBack: () => void;
}

const PIPELINE_COLORS = ["#171717", "#404040", "#737373", "#a3a3a3", "#d4d4d4"];

interface SortableWidgetProps {
  widget: DashboardWidget;
  onResize: (id: string, width: number, height: number) => void;
  onDelete: (id: string) => void;
  onConnect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  containerWidth: number;
}

function SortableWidget({ widget, onResize, onDelete, onConnect, onRename, containerWidth }: SortableWidgetProps) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [actualWidth, setActualWidth] = useState(widget.width || 340);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(widget.customName || widget.source?.sourceName || widget.chartType.name);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const widgetWidth = typeof widget.width === "number" ? widget.width : (containerWidth || 340);
  const widgetHeight = widget.height || 280;
  const minWidth = 260;

  // Observe actual rendered width
  useEffect(() => {
    if (!widgetRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setActualWidth(entry.contentRect.width);
      }
    });

    observer.observe(widgetRef.current);
    return () => observer.disconnect();
  }, []);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.4 : 1,
    flexBasis: widgetWidth,
    flexGrow: 0,
    flexShrink: 0,
    width: widgetWidth,
    minWidth: minWidth,
    height: widgetHeight,
  };

  const handleResize = (deltaX: number, deltaY: number, direction: string) => {
    let newWidth = widgetWidth;
    let newHeight = widgetHeight;

    // Use containerWidth as max, fallback to a large value
    const maxWidth = containerWidth > 0 ? containerWidth : 3000;

    if (direction.includes('e')) {
      newWidth = Math.min(maxWidth, Math.max(minWidth, widgetWidth + deltaX));
    }
    if (direction.includes('w')) {
      newWidth = Math.min(maxWidth, Math.max(minWidth, widgetWidth - deltaX));
    }
    if (direction.includes('s')) {
      newHeight = Math.min(1200, Math.max(220, widgetHeight + deltaY));
    }

    onResize(widget.id, newWidth, newHeight);
  };

  return (
    <div 
      ref={(node) => {
        setNodeRef(node);
        if (node) (widgetRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }} 
      style={style}
      className={`group/widget relative bg-white border border-border rounded-xl shadow-sm ${isDragging ? 'shadow-lg ring-2 ring-primary/20' : 'hover:shadow-md'}`}
    >
      <div className="relative h-full p-3 pt-2 flex flex-col">
        {/* Header Row - Drag handle + Title aligned */}
        <div className="flex items-center gap-0 mb-2 shrink-0">
          {/* Drag Handle - only visible on hover, expands width */}
          <div
            {...attributes}
            {...listeners}
            className="shrink-0 rounded-lg cursor-grab active:cursor-grabbing hover:bg-muted z-20 opacity-0 group-hover/widget:opacity-100 w-0 group-hover/widget:w-7 h-7 flex items-center justify-center overflow-hidden transition-all duration-300 ease-out"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
          
          {/* Title - Inline Editable */}
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => {
                setIsEditing(false);
                if (editName.trim() && editName !== (widget.customName || widget.source?.sourceName || widget.chartType.name)) {
                  onRename(widget.id, editName.trim());
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditing(false);
                  if (editName.trim() && editName !== (widget.customName || widget.source?.sourceName || widget.chartType.name)) {
                    onRename(widget.id, editName.trim());
                  }
                }
                if (e.key === 'Escape') {
                  setEditName(widget.customName || widget.source?.sourceName || widget.chartType.name);
                  setIsEditing(false);
                }
              }}
              className="text-sm font-medium text-foreground bg-transparent border-b border-primary outline-none flex-1 min-w-0"
              autoFocus
            />
          ) : (
            <h3
              onClick={() => {
                setIsEditing(true);
                setTimeout(() => inputRef.current?.select(), 0);
              }}
              className="text-sm font-medium text-foreground truncate flex-1 cursor-text hover:text-primary transition-colors"
              title="Clique para editar"
            >
              {widget.customName || widget.source?.sourceName || widget.chartType.name}
            </h3>
          )}
        </div>

        {/* Delete Button - only visible on hover */}
        <button
          onClick={() => onDelete(widget.id)}
          className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-red-50 z-20 opacity-0 group-hover/widget:opacity-100 transition-opacity"
          title="Remover widget"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
        </button>

        {/* Connect Overlay */}
        {!widget.isConnected && (
          <button
            onClick={() => onConnect(widget.id)}
            className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 rounded-xl hover:bg-white focus:outline-none z-10"
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-muted">
              <Link2 className="h-6 w-6 text-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">
              Conectar fonte de dados
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              Clique para vincular uma origem
            </span>
          </button>
        )}
        
        {/* Chart */}
        <div className={`flex-1 min-h-0 relative ${!widget.isConnected ? "opacity-30" : ""}`}>
          <ChartRenderer
            chartType={widget.chartType.id}
            data={widget.data}
            width={actualWidth - 32}
            height={widgetHeight - 92}
            isLoading={widget.isLoading}
          />
        </div>
      </div>

      {/* Resize Handles */}
      <ResizeHandle 
        direction="w" 
        widgetWidth={widgetWidth} 
        widgetHeight={widgetHeight}
        containerWidth={containerWidth}
        minWidth={minWidth}
        onResize={(w, h) => onResize(widget.id, w, h)}
      />
      <ResizeHandle 
        direction="e" 
        widgetWidth={widgetWidth} 
        widgetHeight={widgetHeight}
        containerWidth={containerWidth}
        minWidth={minWidth}
        onResize={(w, h) => onResize(widget.id, w, h)}
      />
      <ResizeHandle 
        direction="s" 
        widgetWidth={widgetWidth} 
        widgetHeight={widgetHeight}
        containerWidth={containerWidth}
        minWidth={minWidth}
        onResize={(w, h) => onResize(widget.id, w, h)}
      />
      <ResizeHandle 
        direction="se" 
        widgetWidth={widgetWidth} 
        widgetHeight={widgetHeight}
        containerWidth={containerWidth}
        minWidth={minWidth}
        onResize={(w, h) => onResize(widget.id, w, h)}
      />
    </div>
  );
}

interface ResizeHandleProps {
  direction: 'w' | 'e' | 's' | 'se';
  widgetWidth: number;
  widgetHeight: number;
  containerWidth: number;
  minWidth: number;
  onResize: (width: number, height: number) => void;
}

function ResizeHandle({ direction, widgetWidth, widgetHeight, containerWidth, minWidth, onResize }: ResizeHandleProps) {
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { width: widgetWidth, height: widgetHeight };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startPos.current.x;
      const deltaY = moveEvent.clientY - startPos.current.y;

      let newWidth = startSize.current.width;
      let newHeight = startSize.current.height;

      if (direction.includes('e')) {
        const maxWidth = containerWidth > 0 ? containerWidth : 2000;
        newWidth = Math.min(maxWidth, Math.max(minWidth, startSize.current.width + deltaX));
      }
      if (direction.includes('w')) {
        const maxWidth = containerWidth > 0 ? containerWidth : 2000;
        newWidth = Math.min(maxWidth, Math.max(minWidth, startSize.current.width - deltaX));
      }
      if (direction.includes('s')) {
        newHeight = Math.min(1200, Math.max(220, startSize.current.height + deltaY));
      }

      onResize(newWidth, newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (direction === 'w') {
    return (
      <div
        className="absolute top-2 bottom-2 left-0 w-2 cursor-w-resize group z-20"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute top-1/2 left-0.5 -translate-y-1/2 w-1 h-8 rounded-full bg-border opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  if (direction === 'e') {
    return (
      <div
        className="absolute top-2 bottom-2 right-0 w-2 cursor-e-resize group z-20"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute top-1/2 right-0.5 -translate-y-1/2 w-1 h-8 rounded-full bg-border opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  if (direction === 's') {
    return (
      <div
        className="absolute left-2 right-2 bottom-0 h-2 cursor-s-resize group z-20"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full bg-border opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  return (
    <div
      className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group z-30"
      onMouseDown={handleMouseDown}
    >
      <svg 
        className="absolute bottom-1 right-1 w-2.5 h-2.5 text-border opacity-0 group-hover:opacity-100 transition-opacity"
        viewBox="0 0 10 10"
      >
        <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

type DatePreset = 'today' | 'yesterday' | '7days' | '30days' | 'custom';

export function DashboardCanvas({ painelName, dashboardId, onBack }: DashboardCanvasProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [isChartSelectorOpen, setIsChartSelectorOpen] = useState(false);
  const [isConnectSourceOpen, setIsConnectSourceOpen] = useState(false);
  const [selectedChart, setSelectedChart] = useState<ChartType | null>(null);
  const [pendingWidgetId, setPendingWidgetId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('30days');
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const widgetsRef = useRef<DashboardWidget[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const today = new Date();
    switch (preset) {
      case 'today':
        setStartDate(startOfDay(today));
        setEndDate(endOfDay(today));
        break;
      case 'yesterday':
        const yesterday = subDays(today, 1);
        setStartDate(startOfDay(yesterday));
        setEndDate(endOfDay(yesterday));
        break;
      case '7days':
        setStartDate(subDays(today, 7));
        setEndDate(today);
        break;
      case '30days':
        setStartDate(subDays(today, 30));
        setEndDate(today);
        break;
    }
  };

  // Measure container width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        // Subtract padding (p-1 = 4px each side = 8px total)
        const availableWidth = containerRef.current.clientWidth - 8;
        setContainerWidth(availableWidth);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    
    // Also observe container size changes
    const observer = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', updateWidth);
      observer.disconnect();
    };
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  // Load widgets from database on mount
  useEffect(() => {
    const loadWidgets = async () => {
      if (!dashboardId) {
        setIsInitialLoad(false);
        return;
      }

      const { data } = await supabase
        .from("dashboards")
        .select("widgets")
        .eq("id", dashboardId)
        .single();

      if (data?.widgets && Array.isArray(data.widgets)) {
        // Restore widgets without data (will be fetched separately)
        const loadedWidgets = (data.widgets as unknown as DashboardWidget[]).map((w) => ({
          ...w,
          data: undefined,
          isLoading: w.isConnected,
        }));
        setWidgets(loadedWidgets);
      }
      setIsInitialLoad(false);
    };

    loadWidgets();
  }, [dashboardId]);

  // Fetch data for loaded widgets that are connected
  useEffect(() => {
    if (isInitialLoad) return;
    
    const fetchDataForLoadedWidgets = async () => {
      const connectedWidgets = widgets.filter(w => w.isConnected && w.isLoading);
      
      for (const widget of connectedWidgets) {
        const data = await fetchWidgetData(widget);
        setWidgets(prev => prev.map(w => 
          w.id === widget.id ? { ...w, data: data || undefined, isLoading: false } : w
        ));
      }
    };

    fetchDataForLoadedWidgets();
  }, [isInitialLoad]); // Only run once after initial load

  // Auto-save widgets to database (debounced, silent)
  useEffect(() => {
    if (isInitialLoad || !dashboardId) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 500ms
    saveTimeoutRef.current = setTimeout(async () => {
      // Save widgets without runtime data
      const widgetsToSave = widgets.map(({ data, isLoading, ...rest }) => rest) as unknown;
      
      await supabase
        .from("dashboards")
        .update({ widgets: widgetsToSave as Json })
        .eq("id", dashboardId);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [widgets, dashboardId, isInitialLoad]);

  const fetchWidgetData = useCallback(async (widget: DashboardWidget): Promise<WidgetData | null> => {
    if (!widget.source) return null;

    // Use the date range for filtering
    const filterStartDate = startDate.toISOString();
    const filterEndDate = endDate.toISOString();

    try {
      // Handle tracking types - now requires sourceId for sub_origin filtering
      if (widget.source.type === 'tracking_grupo_entrada' || widget.source.type === 'tracking_grupo_saida') {
        const trackingType = widget.source.type === 'tracking_grupo_entrada' ? 'grupo_entrada' : 'grupo_saida';
        const label = widget.source.type === 'tracking_grupo_entrada' ? 'Entradas' : 'Saídas';
        
        if (!widget.source.sourceId) {
          return { total: 0, label };
        }

        // First, get all leads from the selected sub_origin
        let allLeadIds: string[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data: leads, error } = await supabase
            .from("leads")
            .select("id")
            .eq("sub_origin_id", widget.source.sourceId)
            .range(from, from + pageSize - 1);

          if (error) {
            console.error("Error fetching leads:", error);
            break;
          }

          if (leads && leads.length > 0) {
            allLeadIds = [...allLeadIds, ...leads.map(l => l.id)];
            from += pageSize;
            hasMore = leads.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        if (allLeadIds.length === 0) {
          return { total: 0, label, distribution: [], trend: [] };
        }

        // Fetch tracking events for these leads filtered by date
        let allEvents: { id: string; created_at: string; lead_id: string }[] = [];
        from = 0;
        hasMore = true;

        while (hasMore) {
          const { data: events, error } = await supabase
            .from("lead_tracking")
            .select("id, created_at, lead_id")
            .eq("tipo", trackingType)
            .in("lead_id", allLeadIds)
            .gte("created_at", filterStartDate)
            .lte("created_at", filterEndDate)
            .range(from, from + pageSize - 1);

          if (error) {
            console.error("Error fetching tracking events:", error);
            return { total: 0, label };
          }

          if (events && events.length > 0) {
            allEvents = [...allEvents, ...events];
            from += pageSize;
            hasMore = events.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        // Count unique leads (not events)
        const uniqueLeadIds = new Set(allEvents.map(e => e.lead_id));
        const total = uniqueLeadIds.size;

        // Calculate trend by day within selected range
        const trend: ChartDataPoint[] = [];
        const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        
        // Calculate days between start and end
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const daysToShow = Math.min(daysDiff, 7);
        
        for (let i = daysToShow - 1; i >= 0; i--) {
          const date = new Date(endDate);
          date.setDate(date.getDate() - i);
          const dayStart = new Date(date.setHours(0, 0, 0, 0));
          const dayEnd = new Date(date.setHours(23, 59, 59, 999));
          
          const leadsInDay = new Set(
            allEvents
              .filter(e => {
                const createdAt = new Date(e.created_at);
                return createdAt >= dayStart && createdAt <= dayEnd;
              })
              .map(e => e.lead_id)
          );

          trend.push({
            name: days[dayStart.getDay()],
            value: leadsInDay.size,
          });
        }

        // Distribution: show total unique leads
        const distribution: ChartDataPoint[] = [{
          name: label,
          value: total,
          color: widget.source.type === 'tracking_grupo_entrada' ? '#10b981' : '#ef4444',
        }];

        return { total, label, distribution, trend };
      }

      // For origin/sub_origin types, require sourceId
      if (!widget.source.sourceId) return null;

      let subOriginIds: string[] = [];

      if (widget.source.type === 'sub_origin') {
        subOriginIds = [widget.source.sourceId];
      } else if (widget.source.type === 'origin') {
        const { data: subOrigins } = await supabase
          .from("crm_sub_origins")
          .select("id")
          .eq("origin_id", widget.source.sourceId);
        
        if (subOrigins && subOrigins.length > 0) {
          subOriginIds = subOrigins.map(so => so.id);
        } else {
          return { total: 0, label: "Leads" };
        }
      }

      // Fetch leads with pipeline info filtered by date
      let allLeads: { id: string; pipeline_id: string | null; created_at: string }[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: leads, error } = await supabase
          .from("leads")
          .select("id, pipeline_id, created_at")
          .in("sub_origin_id", subOriginIds)
          .gte("created_at", filterStartDate)
          .lte("created_at", filterEndDate)
          .range(from, from + pageSize - 1);

        if (error) {
          console.error("Error fetching leads:", error);
          return { total: 0, label: "Leads" };
        }

        if (leads && leads.length > 0) {
          allLeads = [...allLeads, ...leads];
          from += pageSize;
          hasMore = leads.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const leads = allLeads;

      const total = leads?.length || 0;

      // Fetch pipelines for distribution
      const { data: pipelines } = await supabase
        .from("pipelines")
        .select("id, nome, cor")
        .in("sub_origin_id", subOriginIds)
        .order("ordem");

      // Calculate distribution by pipeline
      const distribution: ChartDataPoint[] = [];
      
      if (pipelines && pipelines.length > 0) {
        pipelines.forEach((pipeline, index) => {
          const count = leads?.filter(l => l.pipeline_id === pipeline.id).length || 0;
          if (count > 0) {
            distribution.push({
              name: pipeline.nome,
              value: count,
              color: PIPELINE_COLORS[index % PIPELINE_COLORS.length],
            });
          }
        });

        // Add "Sem pipeline" if there are leads without pipeline
        const withoutPipeline = leads?.filter(l => !l.pipeline_id).length || 0;
        if (withoutPipeline > 0) {
          distribution.push({
            name: "Sem etapa",
            value: withoutPipeline,
            color: "#e5e5e5",
          });
        }
      } else {
        // If no pipelines, just show total
        distribution.push({
          name: "Leads",
          value: total,
          color: "#171717",
        });
      }

      // Calculate trend by day within selected range
      const trend: ChartDataPoint[] = [];
      const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      
      // Calculate days between start and end
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const daysToShow = Math.min(daysDiff, 7);
      
      for (let i = daysToShow - 1; i >= 0; i--) {
        const date = new Date(endDate);
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date.setHours(0, 0, 0, 0));
        const dayEnd = new Date(date.setHours(23, 59, 59, 999));
        
        const count = leads?.filter(l => {
          const createdAt = new Date(l.created_at);
          return createdAt >= dayStart && createdAt <= dayEnd;
        }).length || 0;

        trend.push({
          name: days[dayStart.getDay()],
          value: count,
        });
      }

      return { total, label: "Leads", distribution, trend };
    } catch (error) {
      console.error("Error fetching widget data:", error);
      return { total: 0, label: "Leads" };
    }
  }, [startDate, endDate]);

  // Refresh all connected widgets
  const refreshAllWidgets = useCallback(async () => {
    const currentWidgets = widgetsRef.current;
    const connectedWidgets = currentWidgets.filter(w => w.isConnected && w.source);
    
    for (const widget of connectedWidgets) {
      const data = await fetchWidgetData(widget);
      setWidgets(prev => prev.map(w => 
        w.id === widget.id ? { ...w, data: data || undefined } : w
      ));
    }
  }, [fetchWidgetData]);

  // Refresh widgets when date range changes
  useEffect(() => {
    if (isInitialLoad) return;
    refreshAllWidgets();
  }, [startDate, endDate, refreshAllWidgets, isInitialLoad]);

  // Real-time subscription for leads changes
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-leads-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads'
        },
        () => {
          // Refresh all widgets when leads change
          refreshAllWidgets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshAllWidgets]);

  const handleSelectChart = (chart: ChartType) => {
    setSelectedChart(chart);
    setIsChartSelectorOpen(false);
    
    const gap = 16;
    const minWidth = 260;
    const defaultWidth = 340;
    const effectiveContainer = containerWidth > 0 ? containerWidth : 800;
    
    // Calculate initial width - try to fit in existing row if possible
    let initialWidth = defaultWidth;
    
    if (widgets.length > 0) {
      // Calculate current last row width
      let lastRowWidth = 0;
      widgets.forEach(w => {
        const wWidth = w.width || defaultWidth;
        const neededWidth = lastRowWidth > 0 ? wWidth + gap : wWidth;
        if (lastRowWidth + neededWidth > effectiveContainer && lastRowWidth > 0) {
          lastRowWidth = wWidth;
        } else {
          lastRowWidth += neededWidth;
        }
      });
      
      // Space available in last row
      const availableInRow = effectiveContainer - lastRowWidth - gap;
      if (availableInRow >= minWidth) {
        initialWidth = Math.max(minWidth, Math.min(defaultWidth, availableInRow));
      }
    }
    
    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      chartType: chart,
      source: null,
      isConnected: false,
      width: initialWidth,
      height: 280,
    };
    setWidgets(prev => [...prev, newWidget]);
    
    setPendingWidgetId(newWidget.id);
    setIsConnectSourceOpen(true);
  };

  const handleConnectSource = async (source: WidgetSource) => {
    if (pendingWidgetId) {
      const widgetToUpdate = widgets.find(w => w.id === pendingWidgetId);
      if (!widgetToUpdate) {
        setPendingWidgetId(null);
        return;
      }

      // First set loading state
      setWidgets(prev => prev.map(widget => 
        widget.id === pendingWidgetId 
          ? { ...widget, source, isConnected: true, isLoading: true }
          : widget
      ));

      // Create temp widget with source to fetch data
      const tempWidget: DashboardWidget = { 
        ...widgetToUpdate, 
        source, 
        isConnected: true 
      };
      const data = await fetchWidgetData(tempWidget);
      
      // Update with fetched data
      setWidgets(prev => prev.map(widget => 
        widget.id === pendingWidgetId 
          ? { ...widget, source, isConnected: true, data: data || undefined, isLoading: false }
          : widget
      ));

      setPendingWidgetId(null);
    }
  };

  const handleConnectWidget = (widgetId: string) => {
    const widget = widgets.find(w => w.id === widgetId);
    if (widget) {
      setSelectedChart(widget.chartType);
      setPendingWidgetId(widgetId);
      setIsConnectSourceOpen(true);
    }
  };

  const handleDeleteWidget = (widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  };

  const handleRenameWidget = (widgetId: string, newName: string) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, customName: newName } : w
    ));
  };

  const handleWidgetResize = useCallback((widgetId: string, nextWidth: number, nextHeight: number) => {
    const gap = 16;
    const MIN_WIDTH = 260;
    const DEFAULT_WIDTH = 340; // "padrão"
    const cw = containerWidth > 0 ? containerWidth : 1200;

    const clampWidth = (w: number) => Math.min(cw, Math.max(MIN_WIDTH, w));
    const clampHeight = (h: number) => Math.min(1200, Math.max(220, h));

    const computeRows = (list: DashboardWidget[]) => {
      const rows: number[][] = [];
      let row: number[] = [];
      let used = 0;

      for (let i = 0; i < list.length; i++) {
        const w = list[i].width ?? DEFAULT_WIDTH;
        const needed = row.length > 0 ? w + gap : w;

        if (row.length > 0 && used + needed > cw) {
          rows.push(row);
          row = [i];
          used = w;
        } else {
          row.push(i);
          used += needed;
        }
      }

      if (row.length) rows.push(row);
      return rows;
    };

    setWidgets((prev) => {
      const idx = prev.findIndex(w => w.id === widgetId);
      if (idx === -1) return prev;

      const next = prev.map(w => ({ ...w }));

      // Determine current row (before applying the new width)
      const rows = computeRows(next);
      const rowIndices = rows.find(r => r.includes(idx)) ?? [idx];
      const siblings = rowIndices.filter(i => i !== idx);

      // Apply requested size
      next[idx].width = clampWidth(nextWidth);
      next[idx].height = clampHeight(nextHeight);

      if (siblings.length === 0) return next;

      const available = cw - gap * (rowIndices.length - 1);
      const rowSum = rowIndices.reduce((sum, i) => sum + (next[i].width ?? DEFAULT_WIDTH), 0);

      if (rowSum <= available) {
        return next;
      }

      // Need to shrink siblings that are wider than DEFAULT_WIDTH first
      let overflow = rowSum - available;

      // Rightmost siblings shrink first (feels more natural visually)
      const shrinkOrder = [...siblings].sort((a, b) => b - a);

      for (const i of shrinkOrder) {
        if (overflow <= 0) break;
        const current = next[i].width ?? DEFAULT_WIDTH;
        const extra = Math.max(0, current - DEFAULT_WIDTH);
        if (extra <= 0) continue;

        const reduceBy = Math.min(extra, overflow);
        next[i].width = current - reduceBy;
        overflow -= reduceBy;
      }

      // If still overflowing, it means siblings are already at DEFAULT_WIDTH;
      // then flex-wrap will naturally move items to the next line.
      return next;
    });
  }, [containerWidth]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setWidgets(prev => {
        const oldIndex = prev.findIndex(w => w.id === active.id);
        const newIndex = prev.findIndex(w => w.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-foreground">
          {painelName}
        </h1>
        <div className="flex items-center gap-2">
          {/* Date Presets */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {[
              { id: 'today' as DatePreset, label: 'Hoje' },
              { id: 'yesterday' as DatePreset, label: 'Ontem' },
              { id: '7days' as DatePreset, label: '7 dias' },
              { id: '30days' as DatePreset, label: '30 dias' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetChange(preset.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  datePreset === preset.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Date Range Pickers */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2 text-xs">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {format(startDate, "dd/MM/yy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    if (date) {
                      setStartDate(date);
                      setDatePreset('custom');
                    }
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2 text-xs">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {format(endDate, "dd/MM/yy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => {
                    if (date) {
                      setEndDate(date);
                      setDatePreset('custom');
                    }
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Add Chart Button */}
          {widgets.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChartSelectorOpen(true)}
              className="h-8 gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          )}

          {/* Close Button */}
          <button
            onClick={onBack}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-auto">
        {widgets.length === 0 ? (
          /* Empty State */
          <div className="flex justify-center pt-16">
            <button
              onClick={() => setIsChartSelectorOpen(true)}
              className="group flex flex-col items-center justify-center w-80 h-48 border-2 border-dashed border-border rounded-2xl hover:border-foreground/30 hover:bg-muted/30 focus:outline-none"
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-muted group-hover:bg-muted/80">
                <Plus className="h-8 w-8 text-muted-foreground group-hover:text-foreground" />
              </div>
              <span className="text-base font-medium text-muted-foreground group-hover:text-foreground">
                Criar dashboard
              </span>
            </button>
          </div>
        ) : (
          /* Dashboard with Draggable Widgets */
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
              <div ref={containerRef} className="flex flex-wrap gap-3 p-1 content-start">
                {widgets.map((widget) => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    onResize={handleWidgetResize}
                    onDelete={handleDeleteWidget}
                    onConnect={handleConnectWidget}
                    onRename={handleRenameWidget}
                    containerWidth={containerWidth}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Dialogs */}
      <ChartSelectorDialog
        open={isChartSelectorOpen}
        onOpenChange={setIsChartSelectorOpen}
        onSelectChart={handleSelectChart}
      />

      <ConnectSourceDialog
        open={isConnectSourceOpen}
        onOpenChange={(open) => {
          setIsConnectSourceOpen(open);
          if (!open) setPendingWidgetId(null);
        }}
        selectedChart={selectedChart}
        onConnect={handleConnectSource}
      />
    </div>
  );
}
