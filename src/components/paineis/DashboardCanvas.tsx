import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Link2, X, Trash2, GripVertical, CalendarIcon } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChartSelectorDialog, ChartType } from "./ChartSelectorDialog";
import { ConnectSourceDialog, WidgetSource } from "./ConnectSourceDialog";
import { ChartRenderer } from "./ChartRenderer";
import { supabase } from "@/integrations/supabase/client";
import widgetDecoration from "@/assets/dashboard-banner.png";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
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
  widthPercent?: number;
  customName?: string;
}

interface DashboardCanvasProps {
  painelName: string;
  dashboardId?: string;
  onBack: () => void;
}

const PIPELINE_COLORS = ["#171717", "#404040", "#737373", "#a3a3a3", "#d4d4d4"];
const MIN_WIDTH = 260;
const DEFAULT_WIDTH = 340;
const GAP = 16;
const REFERENCE_WIDTH = 1200; // Reference container width for percentage calculations
const DEFAULT_PERCENT = 28; // Default percentage (~340px at 1200px container)
const BAR_ITEM_HEIGHT = 32; // Height per bar in horizontal bar chart
const BAR_MIN_HEIGHT = 100; // Minimum height for bar chart
const BAR_HEADER_PADDING = 60; // Padding for header and spacing

// Calculate optimal height for horizontal bar chart based on data items
const calculateOptimalBarHeight = (distributionCount: number): number => {
  if (distributionCount <= 0) return BAR_MIN_HEIGHT;
  const calculatedHeight = (distributionCount * BAR_ITEM_HEIGHT) + BAR_HEADER_PADDING;
  return Math.max(BAR_MIN_HEIGHT, Math.min(calculatedHeight, 500));
};

interface SortableWidgetProps {
  widget: DashboardWidget;
  widgetWidth: number;
  onResize: (id: string, width: number, height: number) => void;
  onDelete: (id: string) => void;
  onConnect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  containerWidth: number;
  isDragging: boolean;
  isMobile: boolean;
}

function SortableWidget({ 
  widget, 
  widgetWidth,
  onResize, 
  onDelete, 
  onConnect, 
  onRename, 
  containerWidth, 
  isDragging: externalIsDragging,
  isMobile 
}: SortableWidgetProps) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [actualWidth, setActualWidth] = useState(widgetWidth);
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

  const widgetHeight = widget.height || 280;
  
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

  // Style: NO transitions, fixed pixel widths
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: 'none', // NEVER use transitions - immediate feedback
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.4 : 1,
    width: isMobile ? '100%' : widgetWidth,
    minWidth: isMobile ? '100%' : MIN_WIDTH,
    maxWidth: containerWidth > 0 ? containerWidth : '100%',
    height: widgetHeight,
    flexShrink: 0,
    flexGrow: 0,
    cursor: isDragging ? 'grabbing' : undefined,
  };

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  return (
    <div 
      ref={(node) => {
        setNodeRef(node);
        if (node) (widgetRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }} 
      style={style}
      className={cn(
        "group/widget relative bg-muted/40 border rounded-3xl overflow-hidden",
        isDragging 
          ? "border-border shadow-2xl ring-2 ring-border/50 scale-[1.02] z-50" 
          : "border-border/50 shadow-sm hover:shadow-md hover:border-border/80"
      )}
    >
      <div className="relative h-full p-3 pt-2 flex flex-col">
        {/* Header Row - Drag handle + Title aligned */}
        <div className="flex items-center gap-0 mb-2 shrink-0">
          {/* Drag Handle */}
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

        {/* Delete Button */}
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
            className="absolute inset-0 flex flex-col items-center justify-center bg-muted/95 rounded-3xl hover:bg-muted focus:outline-none z-10"
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
            height={widgetHeight - 50}
            isLoading={widget.isLoading}
          />
        </div>
      </div>

      {/* Resize Handles - only when not dragging */}
      {!isDragging && !externalIsDragging && (
        <>
          <ResizeHandle 
            direction="e" 
            widgetWidth={widgetWidth} 
            widgetHeight={widgetHeight}
            containerWidth={containerWidth}
            onResize={(w, h) => onResize(widget.id, w, h)}
            onResizeStart={handleResizeStart}
            onResizeEnd={handleResizeEnd}
          />
          <ResizeHandle 
            direction="s" 
            widgetWidth={widgetWidth} 
            widgetHeight={widgetHeight}
            containerWidth={containerWidth}
            onResize={(w, h) => onResize(widget.id, w, h)}
            onResizeStart={handleResizeStart}
            onResizeEnd={handleResizeEnd}
          />
          <ResizeHandle 
            direction="se" 
            widgetWidth={widgetWidth} 
            widgetHeight={widgetHeight}
            containerWidth={containerWidth}
            onResize={(w, h) => onResize(widget.id, w, h)}
            onResizeStart={handleResizeStart}
            onResizeEnd={handleResizeEnd}
          />
        </>
      )}
    </div>
  );
}

interface ResizeHandleProps {
  direction: 'e' | 's' | 'se';
  widgetWidth: number;
  widgetHeight: number;
  containerWidth: number;
  onResize: (width: number, height: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

function ResizeHandle({ direction, widgetWidth, widgetHeight, containerWidth, onResize, onResizeStart, onResizeEnd }: ResizeHandleProps) {
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
        const maxWidth = containerWidth > 0 ? containerWidth : 2000;
        newWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, startSize.current.width + deltaX));
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
        className="absolute top-2 bottom-2 -right-3 w-8 cursor-e-resize group z-30"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute top-1/2 left-3 -translate-y-1/2 w-1.5 h-12 rounded-full bg-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  if (direction === 's') {
    return (
      <div
        className="absolute left-2 right-2 -bottom-2 h-6 cursor-s-resize group z-30"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute top-2 left-1/2 -translate-x-1/2 h-1.5 w-12 rounded-full bg-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  return (
    <div
      className="absolute -bottom-2 -right-2 w-8 h-8 cursor-se-resize group z-40"
      onMouseDown={handleMouseDown}
    >
      <svg 
        className="absolute bottom-2 right-2 w-4 h-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity"
        viewBox="0 0 10 10"
      >
        <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

type DatePreset = 'today' | 'yesterday' | '7days' | '30days' | 'custom';

// Convert percentage to pixels based on container width
function percentToPixels(percent: number, containerWidth: number): number {
  return Math.max(MIN_WIDTH, Math.floor((percent / 100) * containerWidth));
}

// Convert pixels to percentage based on container width
function pixelsToPercent(pixels: number, containerWidth: number): number {
  if (containerWidth <= 0) return DEFAULT_PERCENT;
  return Math.max(1, Math.min(100, (pixels / containerWidth) * 100));
}

// Get widget width in pixels (from percent or fallback to stored width)
function getWidgetPixelWidth(widget: DashboardWidget, containerWidth: number): number {
  if (widget.widthPercent !== undefined && widget.widthPercent > 0) {
    return percentToPixels(widget.widthPercent, containerWidth);
  }
  // Fallback for legacy widgets with pixel width
  if (widget.width !== undefined) {
    return widget.width;
  }
  return DEFAULT_WIDTH;
}

// Helper to compute rows of widgets based on their widths
function computeWidgetRows(widgets: DashboardWidget[], containerWidth: number): number[][] {
  if (containerWidth <= 0) return [widgets.map((_, i) => i)];
  
  const rows: number[][] = [];
  let currentRow: number[] = [];
  let rowWidth = 0;

  widgets.forEach((widget, idx) => {
    const w = getWidgetPixelWidth(widget, containerWidth);
    const neededWidth = currentRow.length > 0 ? w + GAP : w;

    if (currentRow.length > 0 && rowWidth + neededWidth > containerWidth) {
      rows.push(currentRow);
      currentRow = [idx];
      rowWidth = w;
    } else {
      currentRow.push(idx);
      rowWidth += neededWidth;
    }
  });

  if (currentRow.length > 0) rows.push(currentRow);
  return rows;
}

// Calculate the actual widths to display.
// IMPORTANT: respect user-defined widths (do NOT auto-expand last widget to fill remaining space).
function calculateDisplayWidths(widgets: DashboardWidget[], containerWidth: number): number[] {
  if (containerWidth <= 0) return widgets.map(w => getWidgetPixelWidth(w, REFERENCE_WIDTH));

  const rows = computeWidgetRows(widgets, containerWidth);
  const displayWidths = new Array(widgets.length).fill(0);

  rows.forEach((rowIndices) => {
    const totalGaps = (rowIndices.length - 1) * GAP;
    const availableWidth = containerWidth - totalGaps;

    rowIndices.forEach((i) => {
      const desired = getWidgetPixelWidth(widgets[i], containerWidth);
      displayWidths[i] = Math.min(availableWidth, Math.max(MIN_WIDTH, desired));
    });
  });

  return displayWidths;
}

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

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const setContainerNode = useCallback((node: HTMLDivElement | null) => {
    setContainerEl(node);
  }, []);

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
    if (!containerEl) return;

    const updateWidth = () => {
      const availableWidth = containerEl.clientWidth - 8;
      setContainerWidth(availableWidth);
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);

    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerEl);

    return () => {
      window.removeEventListener('resize', updateWidth);
      observer.disconnect();
    };
  }, [containerEl]);

  // Keep ref in sync with state
  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  // Load widgets from database on mount + real-time subscription
  useEffect(() => {
    if (!dashboardId) {
      setIsInitialLoad(false);
      return;
    }

    const loadWidgets = async () => {
      const { data } = await supabase
        .from("dashboards")
        .select("widgets")
        .eq("id", dashboardId)
        .single();

      if (data?.widgets && Array.isArray(data.widgets)) {
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

    const channel = supabase
      .channel(`dashboard-realtime-${dashboardId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'dashboards',
          filter: `id=eq.${dashboardId}`,
        },
        (payload) => {
          const newWidgets = payload.new?.widgets;
          if (newWidgets && Array.isArray(newWidgets)) {
            setWidgets(prev => {
              const prevDataMap = new Map(prev.map(w => [w.id, w.data]));
              return (newWidgets as unknown as DashboardWidget[]).map((w) => ({
                ...w,
                data: prevDataMap.get(w.id) || undefined,
                isLoading: w.isConnected && !prevDataMap.has(w.id),
              }));
            });
          }
        }
      )
      .subscribe();

    // Realtime channel for Facebook Ads insights updates
    const fbInsightsChannel = supabase
      .channel('facebook-ads-insights-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'facebook_ads_insights',
        },
        () => {
          // When Facebook Ads insights change, refetch data for Facebook Ads widgets
          setWidgets(prev => prev.map(w => {
            if (w.source?.type === 'facebook_ads' || w.source?.type === 'cost_per_lead') {
              return { ...w, isLoading: true };
            }
            return w;
          }));
        }
      )
      .subscribe();

    // Realtime channel for leads updates (for CPL calculations)
    const leadsChannel = supabase
      .channel('leads-realtime-for-cpl')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
        },
        () => {
          // When leads change, refetch CPL widgets
          setWidgets(prev => prev.map(w => {
            if (w.source?.type === 'cost_per_lead') {
              return { ...w, isLoading: true };
            }
            return w;
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(fbInsightsChannel);
      supabase.removeChannel(leadsChannel);
    };
  }, [dashboardId]);

  // Fetch data for loaded widgets that are connected
  useEffect(() => {
    if (isInitialLoad) return;
    
    const fetchDataForLoadedWidgets = async () => {
      const connectedWidgets = widgets.filter(w => w.isConnected && w.isLoading);
      
      for (const widget of connectedWidgets) {
        const data = await fetchWidgetData(widget);

        // For horizontal bar charts, adjust height based on number of bars
        let newHeight = widget.height;
        if (widget.chartType.id === 'bar_horizontal' && data?.distribution) {
          newHeight = calculateOptimalBarHeight(data.distribution.length);
        }

        setWidgets(prev => prev.map(w => 
          w.id === widget.id ? { ...w, data: data || undefined, isLoading: false, height: newHeight } : w
        ));
      }
    };

    fetchDataForLoadedWidgets();
  }, [isInitialLoad]);

  // Auto-refresh Facebook Ads and CPL widgets every 30 seconds
  useEffect(() => {
    if (isInitialLoad) return;

    const hasFacebookWidgets = widgets.some(w => 
      w.isConnected && (w.source?.type === 'facebook_ads' || w.source?.type === 'cost_per_lead')
    );

    if (!hasFacebookWidgets) return;

    const refreshFacebookData = async () => {
      const fbWidgets = widgets.filter(w => 
        w.isConnected && !w.isLoading && (w.source?.type === 'facebook_ads' || w.source?.type === 'cost_per_lead')
      );

      for (const widget of fbWidgets) {
        const data = await fetchWidgetData(widget);
        if (data) {
          setWidgets(prev => prev.map(w => 
            w.id === widget.id ? { ...w, data } : w
          ));
        }
      }
    };

    // Refresh every 30 seconds
    const intervalId = setInterval(refreshFacebookData, 30000);

    return () => clearInterval(intervalId);
  }, [isInitialLoad, widgets.length, startDate, endDate]);

  // Auto-save widgets to database (debounced)
  useEffect(() => {
    if (isInitialLoad || !dashboardId) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
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

    const filterStartDate = startDate.toISOString();
    const filterEndDate = endDate.toISOString();

    try {
      // Handle tracking types
      if (widget.source.type === 'tracking_grupo_entrada' || widget.source.type === 'tracking_grupo_saida') {
        const trackingType = widget.source.type === 'tracking_grupo_entrada' ? 'grupo_entrada' : 'grupo_saida';
        const label = widget.source.type === 'tracking_grupo_entrada' ? 'Entradas' : 'Saídas';
        
        if (!widget.source.sourceId) {
          return { total: 0, label };
        }

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

          if (error) break;

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

        const uniqueLeadIds = new Set(allEvents.map(e => e.lead_id));
        const total = uniqueLeadIds.size;

        const trend: ChartDataPoint[] = [];
        const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        
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

        const distribution: ChartDataPoint[] = [{
          name: label,
          value: total,
          color: widget.source.type === 'tracking_grupo_entrada' ? '#10b981' : '#ef4444',
        }];

        return { total, label, distribution, trend };
      }

      // Handle Facebook Ads type
      if (widget.source.type === 'facebook_ads') {
        if (!widget.source.sourceId) {
          return { total: 0, label: 'Facebook Ads', distribution: [], trend: [] };
        }

        // Determine which metric to use
        const metric = widget.source.fbMetric || 'spend';
        const metricLabels: Record<string, string> = {
          spend: 'Valor Gasto',
          cpm: 'CPM',
          cpc: 'CPC'
        };

        // Get connection details to fetch fresh data with date filter
        const { data: connection, error: connError } = await supabase
          .from('facebook_ads_connections')
          .select('access_token, selected_campaigns')
          .eq('id', widget.source.sourceId)
          .single();

        if (connError || !connection) {
          console.error('Error fetching Facebook connection:', connError);
          return { total: 0, label: 'Facebook Ads', distribution: [], trend: [] };
        }

        // Determine which campaigns to fetch
        const campaignsToFetch = widget.source.fbCampaignId 
          ? [{ id: widget.source.fbCampaignId, name: widget.source.fbCampaignName }]
          : (connection.selected_campaigns as { id: string; name: string }[]) || [];

        if (campaignsToFetch.length === 0) {
          return { total: 0, label: 'Facebook Ads', distribution: [], trend: [] };
        }

        // Format dates for Facebook API (YYYY-MM-DD)
        const sinceDate = format(startDate, 'yyyy-MM-dd');
        const untilDate = format(endDate, 'yyyy-MM-dd');

        // Fetch fresh insights with date range
        const { data: insightsData, error: insightsError } = await supabase.functions.invoke('facebook-ads', {
          body: { 
            action: 'get-insights-daterange',
            accessToken: connection.access_token,
            campaignIds: campaignsToFetch.map(c => c.id),
            since: sinceDate,
            until: untilDate
          }
        });

        if (insightsError) {
          console.error('Error fetching Facebook insights:', insightsError);
          // Fallback to cached data
          const { data: cachedInsights } = await supabase
            .from('facebook_ads_insights')
            .select('campaign_id, campaign_name, spend, cpm, cpc')
            .eq('connection_id', widget.source.sourceId);

          const points: ChartDataPoint[] = (cachedInsights || [])
            .filter(i => !widget.source.fbCampaignId || i.campaign_id === widget.source.fbCampaignId)
            .map((i) => ({
              name: i.campaign_name || i.campaign_id,
              value: Number(i[metric] || 0),
            }));

          const total = points.reduce((sum, p) => sum + p.value, 0);
          return {
            total: Math.round(total * 100) / 100,
            label: `${metricLabels[metric]} (cache)`,
            distribution: points,
            trend: points,
          };
        }

        const insights = insightsData?.insights || [];
        const points: ChartDataPoint[] = insights.map((i: any) => ({
          name: i.campaign_name || campaignsToFetch.find(c => c.id === i.campaignId)?.name || i.campaignId,
          value: Number(i[metric] || 0),
        }));

        const total = points.reduce((sum, p) => sum + p.value, 0);
        const campaignName = widget.source.fbCampaignName || 'Todas';
        const label = widget.source.fbCampaignId 
          ? `${metricLabels[metric]} - ${campaignName}` 
          : `${metricLabels[metric]} (Total)`;

        return {
          total: Math.round(total * 100) / 100,
          label,
          distribution: points,
          trend: points,
        };
      }

      // Handle Cost per Lead (CPL) type
      if (widget.source.type === 'cost_per_lead') {
        const { fbConnectionId, fbCampaignId, fbCampaignName, subOriginIdForLeads } = widget.source;
        
        if (!fbConnectionId || !fbCampaignId || !subOriginIdForLeads) {
          return { total: 0, label: 'CPL' };
        }

        // 1. Get Facebook spend for the campaign
        const { data: connection, error: connError } = await supabase
          .from('facebook_ads_connections')
          .select('access_token')
          .eq('id', fbConnectionId)
          .single();

        if (connError || !connection) {
          console.error('Error fetching Facebook connection for CPL:', connError);
          return { total: 0, label: 'CPL' };
        }

        const sinceDate = format(startDate, 'yyyy-MM-dd');
        const untilDate = format(endDate, 'yyyy-MM-dd');

        const { data: insightsData, error: insightsError } = await supabase.functions.invoke('facebook-ads', {
          body: { 
            action: 'get-insights-daterange',
            accessToken: connection.access_token,
            campaignIds: [fbCampaignId],
            since: sinceDate,
            until: untilDate
          }
        });

        let totalSpend = 0;
        if (!insightsError && insightsData?.insights) {
          totalSpend = insightsData.insights.reduce((sum: number, i: any) => sum + Number(i.spend || 0), 0);
        }

        // 2. Count paid leads from the sub-origin using the same logic as "Orgânico vs Pago"
        const { data: allLeads } = await supabase
          .from("leads")
          .select("id, utm_source, utm_medium, created_at")
          .eq("sub_origin_id", subOriginIdForLeads)
          .gte("created_at", filterStartDate)
          .lte("created_at", filterEndDate);

        // Use the same paid traffic indicators as "Orgânico vs Pago" widget
        const paidMediumIndicators = ['cpc', 'ppc', 'paid', 'ads', 'cpm', 'cpv', 'display', 'banner', 'remarketing', 'retargeting', 'paidsocial', 'paid_social', 'paid-social'];
        const paidSourceIndicators = ['facebook_ads', 'fb_ads', 'google_ads', 'googleads', 'meta_ads', 'tiktok_ads', 'instagram_ads', 'ads'];

        // Filter for paid leads using the same logic
        const paidLeadsList = (allLeads || []).filter(lead => {
          const utmMedium = (lead.utm_medium || '').toLowerCase().trim();
          const utmSource = (lead.utm_source || '').toLowerCase().trim();
          
          const isPaidMedium = paidMediumIndicators.some(indicator => utmMedium.includes(indicator));
          const isPaidSource = paidSourceIndicators.some(indicator => utmSource.includes(indicator) || utmSource === indicator);
          
          return isPaidSource || isPaidMedium;
        });

        const paidLeadsCount = paidLeadsList.length;
        const cpl = paidLeadsCount > 0 ? totalSpend / paidLeadsCount : 0;

        // Trend by day
        const trend: ChartDataPoint[] = [];
        const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const daysToShow = Math.min(daysDiff, 7);
        
        for (let i = daysToShow - 1; i >= 0; i--) {
          const date = new Date(endDate);
          date.setDate(date.getDate() - i);
          const dayStart = new Date(date.setHours(0, 0, 0, 0));
          const dayEnd = new Date(date.setHours(23, 59, 59, 999));
          
          const leadsInDay = paidLeadsList.filter(l => {
            const createdAt = new Date(l.created_at);
            return createdAt >= dayStart && createdAt <= dayEnd;
          }).length;

          trend.push({
            name: days[dayStart.getDay()],
            value: leadsInDay,
          });
        }

        const label = `CPL - ${fbCampaignName || 'Campanha'}`;
        
        return {
          total: Math.round(cpl * 100) / 100,
          label,
          distribution: [
            { name: 'Valor Gasto', value: Math.round(totalSpend * 100) / 100, color: '#f97316' },
            { name: 'Leads Pagos', value: paidLeadsCount, color: '#10b981' },
          ],
          trend,
        };
      }

      // Handle UTM types
      if (widget.source.type === 'utm_source' || widget.source.type === 'utm_medium' || widget.source.type === 'utm_campaign' || widget.source.type === 'utm_all') {
        if (!widget.source.sourceId) {
          return { total: 0, label: 'UTMs' };
        }

        const { data: subOriginLeads } = await supabase
          .from("leads")
          .select("id")
          .eq("sub_origin_id", widget.source.sourceId);

        const leadIds = subOriginLeads?.map(l => l.id) || [];
        
        if (leadIds.length === 0) {
          return { total: 0, label: 'UTMs', distribution: [], trend: [] };
        }

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

          if (error) break;

          if (events && events.length > 0) {
            allTrackingEvents = [...allTrackingEvents, ...events];
            from += pageSize;
            hasMore = events.length === pageSize;
          } else {
            hasMore = false;
          }
        }

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
            const utmSource = dados.utm_source || dados.utmSource || dados.UTM_SOURCE;
            const utmMedium = dados.utm_medium || dados.utmMedium || dados.UTM_MEDIUM;
            const utmCampaign = dados.utm_campaign || dados.utmCampaign || dados.UTM_CAMPAIGN;
            const utmTerm = dados.utm_term || dados.utmTerm || dados.UTM_TERM;
            const utmContent = dados.utm_content || dados.utmContent || dados.UTM_CONTENT;
            
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
          
          // Paid traffic indicators in utm_medium or utm_source
          const paidMediumIndicators = ['cpc', 'ppc', 'paid', 'ads', 'cpm', 'cpv', 'display', 'banner', 'remarketing', 'retargeting', 'paidsocial', 'paid_social', 'paid-social'];
          const paidSourceIndicators = ['facebook_ads', 'fb_ads', 'google_ads', 'googleads', 'meta_ads', 'tiktok_ads', 'instagram_ads', 'ads'];
          
          utmEntries.forEach(entry => {
            const medium = (entry.utm_medium || '').toLowerCase().trim();
            const source = (entry.utm_source || '').toLowerCase().trim();
            
            // Check if medium or source indicates paid traffic
            const isPaidMedium = paidMediumIndicators.some(indicator => medium.includes(indicator));
            const isPaidSource = paidSourceIndicators.some(indicator => source.includes(indicator) || source === indicator);
            
            if (isPaidMedium || isPaidSource) {
              paid++;
            } else {
              organic++;
            }
          });
          
          distribution = [
            { name: 'Orgânico', value: organic },
            { name: 'Pago', value: paid },
          ];
        }

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

      // Handle Custom Fields type
      if (widget.source.type === 'custom_field') {
        if (!widget.source.sourceId || !widget.source.customFieldId) {
          return { total: 0, label: widget.source.customFieldLabel || 'Campo Personalizado' };
        }

        const label = widget.source.customFieldLabel || 'Campo Personalizado';

        // Get leads from the sub-origin
        const { data: subOriginLeads } = await supabase
          .from("leads")
          .select("id")
          .eq("sub_origin_id", widget.source.sourceId)
          .gte("created_at", filterStartDate)
          .lte("created_at", filterEndDate);

        const leadIds = subOriginLeads?.map(l => l.id) || [];
        
        if (leadIds.length === 0) {
          return { total: 0, label, distribution: [], trend: [] };
        }

        // Get responses for this custom field
        let allResponses: { id: string; lead_id: string; response_value: string | null; created_at: string }[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data: responses, error } = await supabase
            .from("lead_custom_field_responses")
            .select("id, lead_id, response_value, created_at")
            .eq("field_id", widget.source.customFieldId)
            .in("lead_id", leadIds)
            .range(from, from + pageSize - 1);

          if (error) break;

          if (responses && responses.length > 0) {
            allResponses = [...allResponses, ...responses];
            from += pageSize;
            hasMore = responses.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        // Count responses by value
        const responseMap = new Map<string, number>();
        allResponses.forEach(response => {
          const value = response.response_value?.trim() || 'Sem resposta';
          responseMap.set(value, (responseMap.get(value) || 0) + 1);
        });

        const total = allResponses.length;
        const colors = ['#f97316', '#fb923c', '#fdba74', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
        let colorIndex = 0;
        
        const distribution: ChartDataPoint[] = Array.from(responseMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, value]) => ({
            name,
            value,
            color: colors[colorIndex++ % colors.length],
          }));

        // Trend by day
        const trend: ChartDataPoint[] = [];
        const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const daysToShow = Math.min(daysDiff, 7);
        
        for (let i = daysToShow - 1; i >= 0; i--) {
          const date = new Date(endDate);
          date.setDate(date.getDate() - i);
          const dayStart = new Date(date.setHours(0, 0, 0, 0));
          const dayEnd = new Date(date.setHours(23, 59, 59, 999));
          
          const count = allResponses.filter(r => {
            const createdAt = new Date(r.created_at);
            return createdAt >= dayStart && createdAt <= dayEnd;
          }).length;

          trend.push({
            name: days[dayStart.getDay()],
            value: count,
          });
        }

        return { total, label, distribution, trend };
      }

      // For origin/sub_origin types
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

      const pipelineIds = [...new Set(leads?.filter(l => l.pipeline_id).map(l => l.pipeline_id) || [])];
      
      let pipelinesData: { id: string; nome: string; ordem: number }[] = [];
      if (pipelineIds.length > 0) {
        const { data } = await supabase
          .from("pipelines")
          .select("id, nome, ordem")
          .in("id", pipelineIds)
          .order("ordem");
        pipelinesData = data || [];
      }

      const distribution: ChartDataPoint[] = [];

      if (pipelinesData.length > 0) {
        pipelinesData.forEach((pipeline, index) => {
          const count = leads?.filter(l => l.pipeline_id === pipeline.id).length || 0;
          if (count > 0) {
            distribution.push({
              name: pipeline.nome,
              value: count,
              color: PIPELINE_COLORS[index % PIPELINE_COLORS.length],
            });
          }
        });

        const withoutPipeline = leads?.filter(l => !l.pipeline_id).length || 0;
        if (withoutPipeline > 0) {
          distribution.push({
            name: "Sem etapa",
            value: withoutPipeline,
            color: "#e5e5e5",
          });
        }
      } else {
        distribution.push({
          name: "Leads",
          value: total,
          color: "#171717",
        });
      }

      const trend: ChartDataPoint[] = [];
      const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      
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

  const refreshAllWidgets = useCallback(async () => {
    const currentWidgets = widgetsRef.current;
    const connectedWidgets = currentWidgets.filter(w => w.isConnected && w.source);
    
    for (const widget of connectedWidgets) {
      const data = await fetchWidgetData(widget);
      
      // For horizontal bar charts, adjust height based on number of bars
      let newHeight = widget.height;
      if (widget.chartType.id === 'bar_horizontal' && data?.distribution) {
        newHeight = calculateOptimalBarHeight(data.distribution.length);
      }
      
      setWidgets(prev => prev.map(w => 
        w.id === widget.id ? { ...w, data: data || undefined, height: newHeight } : w
      ));
    }
  }, [fetchWidgetData]);

  // Refresh widgets when date range changes
  useEffect(() => {
    if (isInitialLoad) return;
    refreshAllWidgets();
  }, [startDate, endDate, isInitialLoad]);

  // Real-time subscriptions for automatic data refresh
  useEffect(() => {
    if (isInitialLoad || !dashboardId) return;

    const connectedWidgets = widgetsRef.current.filter(w => w.isConnected && w.source);
    if (connectedWidgets.length === 0) return;

    // Collect unique sub_origin_ids from all widgets
    const subOriginIds = new Set<string>();
    connectedWidgets.forEach(w => {
      if (w.source?.sourceId) {
        subOriginIds.add(w.source.sourceId);
      }
    });

    // Subscribe to leads table changes
    const leadsChannel = supabase
      .channel(`paineis-leads-${dashboardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
        },
        (payload) => {
          console.log('[Paineis] Lead change detected:', payload.eventType);
          // Check if lead belongs to any monitored sub_origin
          const newData = payload.new as { sub_origin_id?: string } | null;
          const oldData = payload.old as { sub_origin_id?: string } | null;
          const subOriginId = newData?.sub_origin_id || oldData?.sub_origin_id;
          
          if (subOriginId && subOriginIds.has(subOriginId)) {
            refreshAllWidgets();
          }
        }
      )
      .subscribe();

    // Subscribe to lead_tracking table changes
    const trackingChannel = supabase
      .channel(`paineis-tracking-${dashboardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_tracking',
        },
        (payload) => {
          console.log('[Paineis] Tracking change detected:', payload.eventType);
          refreshAllWidgets();
        }
      )
      .subscribe();

    // Subscribe to lead_custom_field_responses table changes
    const customFieldsChannel = supabase
      .channel(`paineis-custom-fields-${dashboardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_custom_field_responses',
        },
        (payload) => {
          console.log('[Paineis] Custom field response change detected:', payload.eventType);
          refreshAllWidgets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(trackingChannel);
      supabase.removeChannel(customFieldsChannel);
    };
  }, [isInitialLoad, dashboardId, refreshAllWidgets]);

  // Real-time polling for Facebook Ads widgets (every 30 seconds)
  useEffect(() => {
    if (isInitialLoad || !dashboardId) return;

    const hasFacebookAdsWidgets = widgetsRef.current.some(
      w => w.isConnected && w.source?.type === 'facebook_ads'
    );

    if (!hasFacebookAdsWidgets) return;

    console.log('[Paineis] Starting Facebook Ads real-time polling (30s interval)');

    const intervalId = setInterval(() => {
      const fbWidgets = widgetsRef.current.filter(
        w => w.isConnected && w.source?.type === 'facebook_ads'
      );
      
      if (fbWidgets.length > 0) {
        console.log('[Paineis] Refreshing Facebook Ads widgets...');
        refreshAllWidgets();
      }
    }, 30000); // 30 seconds

    return () => {
      console.log('[Paineis] Stopping Facebook Ads polling');
      clearInterval(intervalId);
    };
  }, [isInitialLoad, dashboardId, refreshAllWidgets, widgets]);

  const handleSelectChart = (chart: ChartType) => {
    setSelectedChart(chart);
    setIsChartSelectorOpen(false);
    
    const effectiveContainer = containerWidth > 0 ? containerWidth : REFERENCE_WIDTH;
    
    // Calculate how much space is in the last row
    const rows = computeWidgetRows(widgets, effectiveContainer);
    let initialPercent = DEFAULT_PERCENT;
    
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      const lastRowPercent = lastRow.reduce((sum, i) => {
        const w = widgets[i];
        return sum + (w.widthPercent ?? pixelsToPercent(w.width ?? DEFAULT_WIDTH, effectiveContainer));
      }, 0);
      const availablePercent = 100 - lastRowPercent - 2; // 2% for gap
      
      if (availablePercent >= pixelsToPercent(MIN_WIDTH, effectiveContainer)) {
        initialPercent = Math.max(pixelsToPercent(MIN_WIDTH, effectiveContainer), Math.min(DEFAULT_PERCENT, availablePercent));
      }
    }
    
    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      chartType: chart,
      source: null,
      isConnected: false,
      widthPercent: initialPercent,
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

      setWidgets(prev => prev.map(widget => 
        widget.id === pendingWidgetId 
          ? { ...widget, source, isConnected: true, isLoading: true }
          : widget
      ));

      const tempWidget: DashboardWidget = { 
        ...widgetToUpdate, 
        source, 
        isConnected: true 
      };
      const data = await fetchWidgetData(tempWidget);
      
      // For horizontal bar charts, calculate height based on number of bars
      // For other charts, keep existing height or use default
      let appropriateHeight = widgetToUpdate.height || 280;
      if (widgetToUpdate.chartType.id === 'bar_horizontal' && data?.distribution) {
        appropriateHeight = calculateOptimalBarHeight(data.distribution.length);
      }
      
      setWidgets(prev => prev.map(widget => 
        widget.id === pendingWidgetId 
          ? { ...widget, source, isConnected: true, data: data || undefined, isLoading: false, height: appropriateHeight }
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

  // Improved resize handler: saves as percentage for responsive scaling
  const handleWidgetResize = useCallback((widgetId: string, nextWidth: number, nextHeight: number) => {
    const cw = containerWidth > 0 ? containerWidth : REFERENCE_WIDTH;

    const clampWidth = (w: number) => Math.min(cw, Math.max(MIN_WIDTH, w));
    const clampHeight = (h: number) => Math.min(1200, Math.max(120, h));

    setWidgets((prev) => {
      const idx = prev.findIndex(w => w.id === widgetId);
      if (idx === -1) return prev;

      const next = prev.map(w => ({ ...w }));
      const clampedWidth = clampWidth(nextWidth);
      const clampedHeight = clampHeight(nextHeight);

      // Find current row
      const rows = computeWidgetRows(next, cw);
      const rowIndices = rows.find(r => r.includes(idx)) ?? [idx];
      const siblings = rowIndices.filter(i => i !== idx);

      // Calculate delta
      const oldWidth = getWidgetPixelWidth(next[idx], cw);
      const delta = clampedWidth - oldWidth;

      // Apply new size as PERCENTAGE for responsive scaling
      next[idx].widthPercent = pixelsToPercent(clampedWidth, cw);
      next[idx].width = clampedWidth; // Keep pixel for backwards compat
      next[idx].height = clampedHeight;

      if (siblings.length === 0 || delta === 0) {
        return next;
      }

      // Calculate available space in row
      const totalGaps = (rowIndices.length - 1) * GAP;
      const availableWidth = cw - totalGaps;
      const currentRowWidth = rowIndices.reduce((sum, i) => sum + getWidgetPixelWidth(next[i], cw), 0);

      // If expanding and exceeding available width, shrink siblings
      if (delta > 0 && currentRowWidth > availableWidth) {
        const overflow = currentRowWidth - availableWidth;
        let remainingOverflow = overflow;

        // First, shrink from the right (feels natural)
        const shrinkOrder = [...siblings].sort((a, b) => b - a);

        for (const i of shrinkOrder) {
          if (remainingOverflow <= 0) break;
          
          const currentSiblingWidth = getWidgetPixelWidth(next[i], cw);
          const shrinkable = currentSiblingWidth - MIN_WIDTH;
          
          if (shrinkable > 0) {
            const shrinkBy = Math.min(shrinkable, remainingOverflow);
            const newSiblingWidth = currentSiblingWidth - shrinkBy;
            next[i].widthPercent = pixelsToPercent(newSiblingWidth, cw);
            next[i].width = newSiblingWidth;
            remainingOverflow -= shrinkBy;
          }
        }

        // If still overflow, it means widgets are at MIN_WIDTH
        // The natural flex-wrap will handle it by wrapping to next line
      }

      // If shrinking, allow siblings to potentially expand (optional - keep simple for now)
      
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

  // Calculate display widths for all widgets (handles row overflow)
  const displayWidths = calculateDisplayWidths(widgets, containerWidth);

  return (
    <div className="h-full flex flex-col overflow-x-hidden">
      {/* Decorative top banner */}
      <div className="w-full h-8 mb-4 overflow-hidden rounded-lg">
        <img 
          src={widgetDecoration} 
          alt="" 
          className="w-full h-full object-cover"
        />
      </div>

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
        {isInitialLoad ? (
          /* Loading Skeleton */
          <div className="flex flex-wrap gap-3 p-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-xl p-3"
                style={{ width: 340, height: 280 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Skeleton className="w-4 h-4" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex items-center justify-center h-[180px]">
                  <Skeleton className="w-32 h-32 rounded-full" />
                </div>
                <div className="flex justify-between mt-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : widgets.length === 0 ? (
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
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
              <div ref={setContainerNode} className={cn(
                "flex gap-4 p-1 min-h-[200px] overflow-x-hidden",
                isMobile 
                  ? "flex-col" 
                  : "flex-wrap content-start items-start"
              )}>
                {widgets.map((widget, index) => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    widgetWidth={displayWidths[index]}
                    onResize={handleWidgetResize}
                    onDelete={handleDeleteWidget}
                    onConnect={handleConnectWidget}
                    onRename={handleRenameWidget}
                    containerWidth={containerWidth}
                    isDragging={activeId !== null}
                    isMobile={isMobile}
                  />
                ))}
              </div>
            </SortableContext>
            
            {/* Drag Overlay - NO animation */}
            <DragOverlay dropAnimation={null}>
              {activeWidget && (() => {
                const activeIndex = widgets.findIndex(w => w.id === activeWidget.id);
                const overlayWidth = activeIndex >= 0 ? displayWidths[activeIndex] : (activeWidget.width || 340);
                
                return (
                  <div 
                    className="bg-white border-2 border-border rounded-xl shadow-2xl"
                    style={{
                      width: Math.max(MIN_WIDTH, Math.min(overlayWidth, containerWidth || 2000)),
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
          if (!open && pendingWidgetId) {
            const idToCheck = pendingWidgetId;
            // Remove widget only if it is STILL not connected (avoid race with async connect)
            setWidgets((prev) => {
              const w = prev.find((x) => x.id === idToCheck);
              if (w && !w.isConnected) return prev.filter((x) => x.id !== idToCheck);
              return prev;
            });
            setPendingWidgetId(null);
          }
        }}
        selectedChart={selectedChart}
        onConnect={handleConnectSource}
      />
    </div>
  );
}
