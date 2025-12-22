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
import { useIsMobile } from "@/hooks/use-mobile";
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
  rectIntersection,
  MouseSensor,
  TouchSensor,
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
  widthPercent?: number; // 0-100: percentage of container width
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
  isSorting: boolean;
  isMobile: boolean;
}

function SortableWidget({ widget, onResize, onDelete, onConnect, onRename, containerWidth, isSorting, isMobile }: SortableWidgetProps) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [actualWidth, setActualWidth] = useState(widget.width || 340);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(widget.customName || widget.source?.sourceName || widget.chartType.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  // ALWAYS prioritize widthPercent if available and container is measured
  // This ensures widgets scale proportionally with screen size
  const hasValidPercent = widget.widthPercent !== undefined && widget.widthPercent > 0;
  const hasValidContainer = containerWidth > 0;
  
  const calculatedWidth = hasValidPercent && hasValidContainer
    ? (widget.widthPercent! / 100) * containerWidth
    : (typeof widget.width === "number" ? widget.width : 340);
  
  const widgetWidth = Math.max(260, Math.min(calculatedWidth, containerWidth || 2000));
  const widgetHeight = widget.height || 280;
  const minWidth = 260;
  
  // ALL widgets with a saved percentage should grow proportionally
  // This ensures that if widget A is 30%, B is 50%, C is 20% - they maintain ratio on any screen size
  const shouldGrow = hasValidPercent;

  // While sorting/dragging, lock flex sizing so other widgets don't "achatar" (shrink) and redraw constantly
  const lockDuringSort = !isMobile && isSorting;

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

  const responsiveWidth = isMobile ? '100%' : widgetWidth;
  const responsiveMinWidth = isMobile ? '100%' : minWidth;
  // Ensure widget never exceeds container on any screen
  const maxWidthValue = containerWidth > 0 ? containerWidth : '100%';

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    // Disable transition during resize/sort for immediate feedback and to avoid flex reflow glitches
    transition: isDragging || isResizing || lockDuringSort ? 'none' : 'width 0.3s ease-out, flex-basis 0.3s ease-out, height 0.2s ease-out',
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1,
    flexBasis: responsiveWidth,
    // Use flex-grow proportionally based on widthPercent so all widgets scale together
    // Example: 30%, 50%, 20% -> flexGrow: 30, 50, 20 -> they maintain ratio
    flexGrow: isMobile ? 1 : (lockDuringSort ? 0 : (shouldGrow ? widget.widthPercent! : 0)),
    // Prevent siblings from shrinking weirdly while sorting
    flexShrink: isMobile ? 1 : (lockDuringSort ? 0 : 1),
    width: responsiveWidth,
    minWidth: responsiveMinWidth,
    maxWidth: maxWidthValue, // Prevent overflow
    height: widgetHeight,
    cursor: isDragging ? 'grabbing' : undefined,
  };

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
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
      className={cn(
        "group/widget relative bg-white border rounded-xl transition-all duration-200",
        isDragging 
          ? "border-border shadow-2xl ring-2 ring-border/50 scale-[1.02] z-50" 
          : "border-border shadow-sm hover:shadow-md hover:border-border/80"
      )}
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
              className="text-sm font-medium text-foreground bg-transparent border-b border-border focus:border-foreground outline-none flex-1 min-w-0"
              autoFocus
            />
          ) : (
            <h3
              onClick={() => {
                setIsEditing(true);
                setTimeout(() => inputRef.current?.select(), 0);
              }}
              className="text-sm font-medium text-foreground truncate flex-1 cursor-text transition-colors"
              title="Clique para editar"
            >
              {widget.customName || widget.source?.sourceName || widget.chartType.name}
            </h3>
          )}
        </div>

        {/* Delete Button - only visible on hover */}
        <button
          onClick={() => onDelete(widget.id)}
          className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-muted z-20 opacity-0 group-hover/widget:opacity-100 transition-opacity"
          title="Remover widget"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
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
        direction="e" 
        widgetWidth={widgetWidth} 
        widgetHeight={widgetHeight}
        containerWidth={containerWidth}
        minWidth={minWidth}
        onResize={(w, h) => onResize(widget.id, w, h)}
        onResizeStart={handleResizeStart}
        onResizeEnd={handleResizeEnd}
      />
      <ResizeHandle 
        direction="s" 
        widgetWidth={widgetWidth} 
        widgetHeight={widgetHeight}
        containerWidth={containerWidth}
        minWidth={minWidth}
        onResize={(w, h) => onResize(widget.id, w, h)}
        onResizeStart={handleResizeStart}
        onResizeEnd={handleResizeEnd}
      />
      <ResizeHandle 
        direction="se" 
        widgetWidth={widgetWidth} 
        widgetHeight={widgetHeight}
        containerWidth={containerWidth}
        minWidth={minWidth}
        onResize={(w, h) => onResize(widget.id, w, h)}
        onResizeStart={handleResizeStart}
        onResizeEnd={handleResizeEnd}
      />
    </div>
  );
}

interface ResizeHandleProps {
  direction: 'e' | 's' | 'se';
  widgetWidth: number;
  widgetHeight: number;
  containerWidth: number;
  minWidth: number;
  onResize: (width: number, height: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

function ResizeHandle({ direction, widgetWidth, widgetHeight, containerWidth, minWidth, onResize, onResizeStart, onResizeEnd }: ResizeHandleProps) {
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { width: widgetWidth, height: widgetHeight };
    
    onResizeStart?.();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startPos.current.x;
      const deltaY = moveEvent.clientY - startPos.current.y;

      let newWidth = startSize.current.width;
      let newHeight = startSize.current.height;

      if (direction.includes('e')) {
        // Limit to container width minus gap (16px)
        const maxWidth = containerWidth > 0 ? containerWidth - 16 : 2000;
        newWidth = Math.min(maxWidth, Math.max(minWidth, startSize.current.width + deltaX));
      }
      if (direction.includes('s')) {
        newHeight = Math.min(1200, Math.max(220, startSize.current.height + deltaY));
      }

      onResize(newWidth, newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      onResizeEnd?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (direction === 'e') {
    return (
      <div
        className="absolute top-2 bottom-2 right-0 w-3 cursor-e-resize group z-20"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute top-1/2 right-0.5 -translate-y-1/2 w-1 h-10 rounded-full bg-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  if (direction === 's') {
    return (
      <div
        className="absolute left-2 right-2 bottom-0 h-3 cursor-s-resize group z-20"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  return (
    <div
      className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize group z-30"
      onMouseDown={handleMouseDown}
    >
      <svg 
        className="absolute bottom-1 right-1 w-3 h-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity"
        viewBox="0 0 10 10"
      >
        <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

type DatePreset = 'today' | 'yesterday' | '7days' | '30days' | 'custom';

export function DashboardCanvas({ painelName, dashboardId, onBack }: DashboardCanvasProps) {
  const isMobile = useIsMobile();
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

      // Handle UTM types - fetch from lead_tracking history
      if (widget.source.type === 'utm_source' || widget.source.type === 'utm_medium' || widget.source.type === 'utm_campaign' || widget.source.type === 'utm_all') {
        if (!widget.source.sourceId) {
          return { total: 0, label: 'UTMs' };
        }

        // First get lead IDs from the sub_origin
        const { data: subOriginLeads } = await supabase
          .from("leads")
          .select("id")
          .eq("sub_origin_id", widget.source.sourceId);

        const leadIds = subOriginLeads?.map(l => l.id) || [];
        
        if (leadIds.length === 0) {
          return { total: 0, label: 'UTMs', distribution: [], trend: [] };
        }

        // Fetch tracking events with UTM data (webhook, formulario, cadastro types often have UTM data)
        let allTrackingEvents: { lead_id: string; dados: any; created_at: string; tipo: string }[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data: events, error } = await supabase
            .from("lead_tracking")
            .select("lead_id, dados, created_at, tipo")
            .in("lead_id", leadIds)
            .in("tipo", ["webhook", "formulario", "cadastro"])
            .gte("created_at", filterStartDate)
            .lte("created_at", filterEndDate)
            .range(from, from + pageSize - 1);

          if (error) {
            console.error("Error fetching tracking for UTM:", error);
            break;
          }

          if (events && events.length > 0) {
            allTrackingEvents = [...allTrackingEvents, ...events];
            from += pageSize;
            hasMore = events.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        // Extract UTM data from tracking events (dados field)
        interface UtmData {
          lead_id: string;
          utm_source?: string;
          utm_medium?: string;
          utm_campaign?: string;
          utm_term?: string;
          utm_content?: string;
          created_at: string;
        }

        const utmDataByLead = new Map<string, UtmData>();
        
        allTrackingEvents.forEach(event => {
          if (event.dados && typeof event.dados === 'object') {
            const dados = event.dados as Record<string, any>;
            // Check for UTM data in various possible locations
            const utmSource = dados.utm_source || dados.utmSource || dados.UTM_SOURCE;
            const utmMedium = dados.utm_medium || dados.utmMedium || dados.UTM_MEDIUM;
            const utmCampaign = dados.utm_campaign || dados.utmCampaign || dados.UTM_CAMPAIGN;
            const utmTerm = dados.utm_term || dados.utmTerm || dados.UTM_TERM;
            const utmContent = dados.utm_content || dados.utmContent || dados.UTM_CONTENT;
            
            // Only add if has any UTM data, or if no entry exists yet
            if (!utmDataByLead.has(event.lead_id) || utmSource || utmMedium || utmCampaign) {
              utmDataByLead.set(event.lead_id, {
                lead_id: event.lead_id,
                utm_source: utmSource,
                utm_medium: utmMedium,
                utm_campaign: utmCampaign,
                utm_term: utmTerm,
                utm_content: utmContent,
                created_at: event.created_at,
              });
            }
          }
        });

        // If no tracking data found, fallback to leads table
        if (utmDataByLead.size === 0) {
          const { data: leadsWithUtm } = await supabase
            .from("leads")
            .select("id, utm_source, utm_medium, utm_campaign, created_at")
            .eq("sub_origin_id", widget.source.sourceId)
            .gte("created_at", filterStartDate)
            .lte("created_at", filterEndDate);

          leadsWithUtm?.forEach(lead => {
            utmDataByLead.set(lead.id, {
              lead_id: lead.id,
              utm_source: lead.utm_source || undefined,
              utm_medium: lead.utm_medium || undefined,
              utm_campaign: lead.utm_campaign || undefined,
              created_at: lead.created_at,
            });
          });
        }

        const utmEntries = Array.from(utmDataByLead.values());
        const total = utmEntries.length;
        let distribution: ChartDataPoint[] = [];
        let label = 'UTMs';

        if (widget.source.type === 'utm_source') {
          label = 'Por Fonte';
          const sourceMap = new Map<string, number>();
          utmEntries.forEach(entry => {
            const source = entry.utm_source || 'Orgânico';
            sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
          });
          
          const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'];
          let colorIndex = 0;
          Array.from(sourceMap.entries())
            .sort((a, b) => b[1] - a[1])
            .forEach(([name, value]) => {
              distribution.push({ name, value, color: colors[colorIndex % colors.length] });
              colorIndex++;
            });
        } else if (widget.source.type === 'utm_medium') {
          label = 'Por Mídia';
          const mediumMap = new Map<string, number>();
          utmEntries.forEach(entry => {
            const medium = entry.utm_medium || 'Direto';
            mediumMap.set(medium, (mediumMap.get(medium) || 0) + 1);
          });
          
          const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'];
          let colorIndex = 0;
          Array.from(mediumMap.entries())
            .sort((a, b) => b[1] - a[1])
            .forEach(([name, value]) => {
              distribution.push({ name, value, color: colors[colorIndex % colors.length] });
              colorIndex++;
            });
        } else if (widget.source.type === 'utm_campaign') {
          label = 'Por Campanha';
          const campaignMap = new Map<string, number>();
          utmEntries.forEach(entry => {
            const campaign = entry.utm_campaign || 'Sem campanha';
            campaignMap.set(campaign, (campaignMap.get(campaign) || 0) + 1);
          });
          
          const colors = ['#f59e0b', '#8b5cf6', '#3b82f6', '#10b981', '#ef4444', '#6366f1', '#ec4899'];
          let colorIndex = 0;
          Array.from(campaignMap.entries())
            .sort((a, b) => b[1] - a[1])
            .forEach(([name, value]) => {
              distribution.push({ name, value, color: colors[colorIndex % colors.length] });
              colorIndex++;
            });
        } else if (widget.source.type === 'utm_all') {
          label = 'Orgânico vs Pago';
          let organic = 0;
          let paid = 0;
          
          utmEntries.forEach(entry => {
            // If has utm_source or utm_medium that indicates paid traffic
            const isPaid = entry.utm_source || entry.utm_medium || entry.utm_campaign;
            if (isPaid) {
              paid++;
            } else {
              organic++;
            }
          });
          
          distribution = [
            { name: 'Orgânico', value: organic, color: '#10b981' },
            { name: 'Pago', value: paid, color: '#8b5cf6' },
          ];
        }

        // Calculate trend by day
        const trend: ChartDataPoint[] = [];
        const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const daysToShow = Math.min(daysDiff, 7);
        
        for (let i = daysToShow - 1; i >= 0; i--) {
          const date = new Date(endDate);
          date.setDate(date.getDate() - i);
          const dayStart = new Date(date.setHours(0, 0, 0, 0));
          const dayEnd = new Date(date.setHours(23, 59, 59, 999));
          
          const count = utmEntries.filter(entry => {
            const createdAt = new Date(entry.created_at);
            return createdAt >= dayStart && createdAt <= dayEnd;
          }).length;

          trend.push({
            name: days[dayStart.getDay()],
            value: count,
          });
        }

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
    
    // Calculate initial percentage
    const initialWidthPercent = (initialWidth / effectiveContainer) * 100;
    
    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      chartType: chart,
      source: null,
      isConnected: false,
      width: initialWidth,
      widthPercent: initialWidthPercent,
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

    // Helper to get effective width from widget (using percent if available)
    const getEffectiveWidth = (widget: DashboardWidget) => {
      if (widget.widthPercent !== undefined) {
        return (widget.widthPercent / 100) * cw;
      }
      return widget.width ?? DEFAULT_WIDTH;
    };

    const computeRows = (list: DashboardWidget[]) => {
      const rows: number[][] = [];
      let row: number[] = [];
      let used = 0;

      for (let i = 0; i < list.length; i++) {
        const w = getEffectiveWidth(list[i]);
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
      const clampedWidth = clampWidth(nextWidth);
      next[idx].width = clampedWidth;
      next[idx].height = clampHeight(nextHeight);
      
      // Calculate and save the percentage
      const widthPercent = (clampedWidth / cw) * 100;
      // Snap to 100% if very close (>= 98%)
      next[idx].widthPercent = widthPercent >= 98 ? 100 : widthPercent;

      if (siblings.length === 0) {
        // Also update siblings percentages for consistency
        return next;
      }

      const available = cw - gap * (rowIndices.length - 1);
      const rowSum = rowIndices.reduce((sum, i) => sum + (next[i].width ?? DEFAULT_WIDTH), 0);

      if (rowSum <= available) {
        // Update all widgets in row with their percentages
        rowIndices.forEach(i => {
          const w = next[i].width ?? DEFAULT_WIDTH;
          const pct = (w / cw) * 100;
          next[i].widthPercent = pct >= 98 ? 100 : pct;
        });
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

      // Update all widgets in row with their percentages
      rowIndices.forEach(i => {
        const w = next[i].width ?? DEFAULT_WIDTH;
        const pct = (w / cw) * 100;
        next[i].widthPercent = pct >= 98 ? 100 : pct;
      });

      // If still overflowing, it means siblings are already at DEFAULT_WIDTH;
      // then flex-wrap will naturally move items to the next line.
      return next;
    });
  }, [containerWidth]);

  const [activeId, setActiveId] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (over && active.id !== over.id) {
      setWidgets(prev => {
        const oldIndex = prev.findIndex(w => w.id === active.id);
        const newIndex = prev.findIndex(w => w.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const activeWidget = activeId ? widgets.find(w => w.id === activeId) : null;

  return (
    <div className="h-full flex flex-col overflow-x-hidden">
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
              <div ref={containerRef} className={cn(
                "flex gap-3 p-1 min-h-[200px] overflow-x-hidden",
                isMobile 
                  ? "flex-col" 
                  : "flex-wrap content-start"
              )}>
                {widgets.map((widget) => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    onResize={handleWidgetResize}
                    onDelete={handleDeleteWidget}
                    onConnect={handleConnectWidget}
                    onRename={handleRenameWidget}
                    containerWidth={containerWidth}
                    isSorting={activeId !== null}
                    isMobile={isMobile}
                  />
                ))}
              </div>
            </SortableContext>
            
            {/* Drag Overlay - shows a preview of the dragged widget */}
            <DragOverlay adjustScale={false} dropAnimation={{
              duration: 200,
              easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
            }}>
              {activeWidget && (() => {
                // Calculate overlay width using the same logic as SortableWidget
                const hasValidPercent = activeWidget.widthPercent !== undefined && activeWidget.widthPercent > 0;
                const overlayWidth = hasValidPercent && containerWidth > 0
                  ? (activeWidget.widthPercent! / 100) * containerWidth
                  : (activeWidget.width || 340);
                
                return (
                  <div 
                    className="bg-white border-2 border-border rounded-xl shadow-2xl opacity-90"
                    style={{
                      width: Math.max(260, Math.min(overlayWidth, containerWidth || 2000)),
                      height: activeWidget.height || 280,
                    }}
                  >
                  <div className="p-3 pt-2 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium text-foreground truncate">
                        {activeWidget.customName || activeWidget.source?.sourceName || activeWidget.chartType.name}
                      </h3>
                    </div>
                    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                      Solte para reposicionar
                    </div>
                  </div>
                  </div>
                );
              })()}
            </DragOverlay>
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
