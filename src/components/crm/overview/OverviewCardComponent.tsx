import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { 
  MoreHorizontal, 
  Trash2,
  GripVertical,
  ArrowUpRight,
  ArrowDownRight,
  Folder,
  Settings2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { OverviewCard, CardSize, MIN_CARD_WIDTH_PERCENT, MIN_CARD_WIDTH_PX, MIN_CARD_HEIGHT, MAX_CARD_WIDTH_PERCENT, MAX_CARD_HEIGHT } from "./types";
import { Lead, Pipeline } from "@/types/crm";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Funnel, FunnelChart, LabelList } from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type ResizeDirection = 
  | "left" | "right" | "top" | "bottom" 
  | "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface OverviewCardComponentProps {
  card: OverviewCard;
  leads: Lead[];
  pipelines: Pipeline[];
  leadTags: Array<{ lead_id: string; name: string; color: string }>;
  onDelete: (id: string) => void;
  onResize: (id: string, size: CardSize, resizeDirection?: string) => void;
  onConnectDataSource?: (card: OverviewCard) => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  containerWidth?: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
];

export function OverviewCardComponent({
  card,
  leads,
  pipelines,
  leadTags,
  onDelete,
  onResize,
  onConnectDataSource,
  isDragging,
  dragHandleProps,
  containerWidth: externalContainerWidth,
}: OverviewCardComponentProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection | null>(null);
  const [currentSize, setCurrentSize] = useState<CardSize>(card.size);
  const [measuredContainerWidth, setMeasuredContainerWidth] = useState(0);
  const [atLimit, setAtLimit] = useState<{ left: boolean; right: boolean; top: boolean; bottom: boolean }>({
    left: false,
    right: false,
    top: false,
    bottom: false,
  });

  // Use external width if provided (for DragOverlay), otherwise use measured width
  const containerWidth = externalContainerWidth ?? measuredContainerWidth;

  const cardRef = useRef<HTMLDivElement | null>(null);
  const limitsRef = useRef({ left: false, right: false, top: false, bottom: false });
  const containerWidthRef = useRef(0);

  const startPosRef = useRef({ x: 0, y: 0 });
  const startSizeRef = useRef({ widthPercent: card.size.widthPercent, height: card.size.height });
  const currentSizeRef = useRef<CardSize>(card.size);

  useEffect(() => {
    currentSizeRef.current = currentSize;
  }, [currentSize]);

  // Sync with card.size when it changes externally
  useEffect(() => {
    if (!isResizing) {
      setCurrentSize(card.size);
      currentSizeRef.current = card.size;
    }
  }, [card.size, isResizing]);

  // Monitor parent container width with ResizeObserver + window resize listener
  // Skip if external width is provided
  useEffect(() => {
    if (externalContainerWidth !== undefined) return;
    
    // cardRef -> wrapper (sortable item) -> cards container (flex wrap)
    const parent = cardRef.current?.parentElement?.parentElement;
    if (!parent) return;

    const updateContainerWidth = () => {
      const width = parent.getBoundingClientRect().width;
      setMeasuredContainerWidth(width);
      containerWidthRef.current = width;
    };

    // Initial measurement
    updateContainerWidth();

    // ResizeObserver for container changes
    const observer = new ResizeObserver(() => {
      updateContainerWidth();
    });
    observer.observe(parent);

    // Window resize listener como backup para resposta imediata
    const handleWindowResize = () => {
      updateContainerWidth();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [externalContainerWidth]);

  // Calculate actual pixel width from percentage
  const pixelWidth = useMemo(() => {
    if (containerWidth <= 0) return 280; // fallback
    return (currentSize.widthPercent / 100) * containerWidth;
  }, [currentSize.widthPercent, containerWidth]);

  // Calculate data based on dataSource
  const chartData = useMemo(() => {
    if (!card.dataSource) return null;
    
    switch (card.dataSource) {
      case "leads_by_pipeline": {
        return pipelines.map((pipeline) => ({
          name: pipeline.nome,
          value: leads.filter((l) => l.pipeline_id === pipeline.id).length,
          color: pipeline.cor,
        }));
      }
      case "leads_by_mql": {
        const mql = leads.filter((l) => l.is_mql).length;
        const nonMql = leads.filter((l) => !l.is_mql).length;
        return [
          { name: "MQL", value: mql, color: "hsl(var(--primary))" },
          { name: "Não-MQL", value: nonMql, color: "hsl(var(--muted))" },
        ];
      }
      case "leads_over_time": {
        const last30Days = eachDayOfInterval({
          start: subDays(new Date(), 29),
          end: new Date(),
        });
        return last30Days.map((day) => {
          const dayStart = startOfDay(day);
          const count = leads.filter((l) => {
            const leadDate = startOfDay(new Date(l.created_at));
            return leadDate.getTime() === dayStart.getTime();
          }).length;
          return {
            date: format(day, "dd/MM", { locale: ptBR }),
            count,
          };
        });
      }
      case "total_leads": {
        return { total: leads.length };
      }
      case "recent_leads": {
        return leads
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 8);
      }
      case "leads_by_tag": {
        const tagCounts: Record<string, { name: string; count: number; color: string }> = {};
        leadTags.forEach((tag) => {
          if (!tagCounts[tag.name]) {
            tagCounts[tag.name] = { name: tag.name, count: 0, color: tag.color };
          }
          tagCounts[tag.name].count++;
        });
        return Object.values(tagCounts).sort((a, b) => b.count - a.count).slice(0, 10);
      }
      case "conversion_rate": {
        return pipelines.map((pipeline, index) => ({
          name: pipeline.nome,
          value: leads.filter((l) => l.pipeline_id === pipeline.id).length,
          fill: COLORS[index % COLORS.length],
        }));
      }
      default:
        return [];
    }
  }, [card.dataSource, leads, pipelines, leadTags]);

  // Get previous period for comparison (for number cards)
  const previousPeriodChange = useMemo(() => {
    if (card.dataSource !== "total_leads") return null;
    
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const sixtyDaysAgo = subDays(now, 60);
    
    const currentPeriod = leads.filter(l => new Date(l.created_at) >= thirtyDaysAgo).length;
    const previousPeriod = leads.filter(l => {
      const date = new Date(l.created_at);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    }).length;
    
    if (previousPeriod === 0) return { change: 100, direction: "up" as const };
    const change = ((currentPeriod - previousPeriod) / previousPeriod) * 100;
    return {
      change: Math.abs(Math.round(change)),
      direction: change >= 0 ? "up" as const : "down" as const,
    };
  }, [card.dataSource, leads]);

  // Resize handlers
  const handleResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, direction: ResizeDirection) => {
      e.preventDefault();
      e.stopPropagation();

      // Keep receiving events even if the pointer leaves the handle.
      e.currentTarget.setPointerCapture?.(e.pointerId);

      setIsResizing(true);
      setResizeDirection(direction);
      startPosRef.current = { x: e.clientX, y: e.clientY };
      startSizeRef.current = {
        widthPercent: currentSizeRef.current.widthPercent,
        height: currentSizeRef.current.height,
      };
    },
    []
  );

  useEffect(() => {
    if (!isResizing || !resizeDirection) return;

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPosRef.current.x;
      const deltaY = e.clientY - startPosRef.current.y;

      const startWidthPercent = startSizeRef.current.widthPercent;
      const startH = startSizeRef.current.height;

      // Convert deltaX to percentage change based on container width
      const containerW = containerWidthRef.current || 1;
      const deltaPercent = (deltaX / containerW) * 100;

      // Calculate effective minimum percent based on pixel minimum
      // This ensures cards never get smaller than MIN_CARD_WIDTH_PX regardless of container size
      const minPercentFromPixels = containerW > 0 
        ? (MIN_CARD_WIDTH_PX / containerW) * 100 
        : MIN_CARD_WIDTH_PERCENT;
      const effectiveMinPercent = Math.max(MIN_CARD_WIDTH_PERCENT, minPercentFromPixels);

      let nextWidthPercent = startWidthPercent;
      let nextH = startH;

      const isCorner = resizeDirection.includes("-");

      if (isCorner) {
        // Corner resize: calculate deltas based on which corner
        let widthDeltaPercent = resizeDirection.endsWith("right") ? deltaPercent : -deltaPercent;
        let heightDelta = resizeDirection.startsWith("bottom") ? deltaY : -deltaY;

        const rawWidthPercent = startWidthPercent + widthDeltaPercent;
        const rawH = startH + heightDelta;

        nextWidthPercent = clamp(rawWidthPercent, effectiveMinPercent, MAX_CARD_WIDTH_PERCENT);
        nextH = clamp(rawH, MIN_CARD_HEIGHT, MAX_CARD_HEIGHT);
      } else {
        if (resizeDirection === "right") {
          nextWidthPercent = clamp(startWidthPercent + deltaPercent, effectiveMinPercent, MAX_CARD_WIDTH_PERCENT);
        } else if (resizeDirection === "left") {
          // Dragging left (negative deltaX) increases width
          nextWidthPercent = clamp(startWidthPercent - deltaPercent, effectiveMinPercent, MAX_CARD_WIDTH_PERCENT);
        }

        if (resizeDirection === "bottom") {
          nextH = clamp(startH + deltaY, MIN_CARD_HEIGHT, MAX_CARD_HEIGHT);
        } else if (resizeDirection === "top") {
          // Dragging up (negative deltaY) increases height
          nextH = clamp(startH - deltaY, MIN_CARD_HEIGHT, MAX_CARD_HEIGHT);
        }
      }

      // Check which sides are at their limit
      const el = cardRef.current;
      const parent = el?.parentElement;
      if (el && parent) {
        const cardRect = el.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        const style = window.getComputedStyle(parent);

        const padLeft = parseFloat(style.paddingLeft) || 0;
        const padRight = parseFloat(style.paddingRight) || 0;
        const padTop = parseFloat(style.paddingTop) || 0;
        const padBottom = parseFloat(style.paddingBottom) || 0;

        const innerLeft = parentRect.left + padLeft;
        const innerRight = parentRect.right - padRight;
        const innerTop = parentRect.top + padTop;
        const innerBottom = parentRect.bottom - padBottom;

        const THRESHOLD = 2; // pixels tolerance
        const newLimits = {
          left: cardRect.left <= innerLeft + THRESHOLD,
          right: cardRect.right >= innerRight - THRESHOLD,
          top: cardRect.top <= innerTop + THRESHOLD,
          bottom: cardRect.bottom >= innerBottom - THRESHOLD,
        };

        if (
          newLimits.left !== limitsRef.current.left ||
          newLimits.right !== limitsRef.current.right ||
          newLimits.top !== limitsRef.current.top ||
          newLimits.bottom !== limitsRef.current.bottom
        ) {
          limitsRef.current = newLimits;
          setAtLimit(newLimits);
        }
      }

      const prev = currentSizeRef.current;
      if (nextWidthPercent !== prev.widthPercent || nextH !== prev.height) {
        const next: CardSize = { widthPercent: nextWidthPercent, height: nextH };
        currentSizeRef.current = next;
        setCurrentSize(next);
        onResize(card.id, next, resizeDirection);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDirection(null);
      // Clear limits after resize ends
      limitsRef.current = { left: false, right: false, top: false, bottom: false };
      setAtLimit({ left: false, right: false, top: false, bottom: false });
    };

    document.addEventListener("pointermove", handleMouseMove);
    document.addEventListener("pointerup", handleMouseUp);
    document.addEventListener("pointercancel", handleMouseUp);

    return () => {
      document.removeEventListener("pointermove", handleMouseMove);
      document.removeEventListener("pointerup", handleMouseUp);
      document.removeEventListener("pointercancel", handleMouseUp);
    };
  }, [isResizing, resizeDirection, card.id, onResize]);

  const renderChart = () => {
    const isLarge = currentSize.height >= 280;
    
    switch (card.chartType) {
      case "pie":
        const pieData = chartData as Array<{ name: string; value: number; color: string }>;
        if (!Array.isArray(pieData) || pieData.length === 0 || pieData.every(d => d.value === 0)) {
          return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-16 h-12 bg-muted/60 rounded-lg flex items-center justify-center">
                <Folder className="h-8 w-8 text-muted-foreground/50" fill="currentColor" strokeWidth={1} />
              </div>
              <span className="text-muted-foreground text-sm">Conecte uma fonte de dados</span>
            </div>
          );
        }
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={isLarge ? 50 : 30}
                outerRadius={isLarge ? 80 : 50}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string) => [value, name]}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      case "area":
        const areaData = chartData as Array<{ date: string; count: number }>;
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`colorCount-${card.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10 }} 
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 10 }} 
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                fillOpacity={1}
                fill={`url(#colorCount-${card.id})`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case "bar":
        const barData = chartData as Array<{ name: string; count: number; color: string }>;
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "number":
        const numberData = chartData as { total: number };
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="text-4xl font-bold text-foreground">{numberData.total}</span>
            {previousPeriodChange && (
              <div className={cn(
                "flex items-center gap-1 mt-2 text-sm",
                previousPeriodChange.direction === "up" ? "text-green-600" : "text-red-600"
              )}>
                {previousPeriodChange.direction === "up" ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                <span>{previousPeriodChange.change}% vs últimos 30 dias</span>
              </div>
            )}
          </div>
        );

      case "list":
        const listData = chartData as Lead[];
        return (
          <div className="flex flex-col gap-2 overflow-y-auto h-full pr-2">
            {listData.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                  {lead.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(lead.created_at), "dd/MM", { locale: ptBR })}
                </span>
              </div>
            ))}
          </div>
        );

      case "funnel":
        const funnelData = chartData as Array<{ name: string; value: number; fill: string }>;
        if (!Array.isArray(funnelData) || funnelData.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-16 h-12 bg-muted/60 rounded-lg flex items-center justify-center">
                <Folder className="h-8 w-8 text-muted-foreground/50" fill="currentColor" strokeWidth={1} />
              </div>
              <span className="text-muted-foreground text-sm">Conecte uma fonte de dados</span>
            </div>
          );
        }
        return (
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Funnel
                data={funnelData}
                dataKey="value"
                nameKey="name"
                isAnimationActive
              >
                <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="name" fontSize={11} />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Tipo de gráfico não suportado
          </div>
        );
    }
  };

  // Resize handle class
  const handleClass = () => cn(
    "absolute bg-transparent z-10"
  );

  const cornerClass = cn(
    "absolute w-4 h-4 bg-transparent z-20"
  );

  // Calculate pixel width for DragOverlay (which has no percentage wrapper)
  const dragPixelWidth = containerWidth > 0 
    ? (currentSize.widthPercent / 100) * containerWidth 
    : undefined;

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative rounded-xl border bg-card p-4 transition-shadow",
        !isDragging && "w-full", // w-full only when NOT dragging (uses wrapper percentage)
        isDragging && "opacity-50",
        isResizing ? "shadow-lg" : "shadow-sm"
      )}
      style={{
        height: currentSize.height,
        // When dragging (in DragOverlay), use fixed pixel width to maintain size
        ...(isDragging && dragPixelWidth ? { width: dragPixelWidth } : {}),
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Drag handle */}
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <h3 className="font-medium text-sm text-foreground truncate">{card.title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onConnectDataSource?.(card)}
            title="Configurar fonte de dados"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onDelete(card.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Chart content */}
      <div className="h-[calc(100%-40px)]">
        {card.dataSource ? (
          renderChart()
        ) : (
          <button
            type="button"
            onClick={() => onConnectDataSource?.(card)}
            className="flex flex-col items-center justify-center h-full gap-3 w-full rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 transition-colors cursor-pointer"
          >
            <div className="w-16 h-12 bg-muted/60 rounded-lg flex items-center justify-center">
              <Folder className="h-8 w-8 text-muted-foreground/50" fill="currentColor" strokeWidth={1} />
            </div>
            <span className="text-muted-foreground text-sm">Conectar fonte de dados</span>
          </button>
        )}
      </div>

      {/* Resize handles – edges */}
      <div
        data-no-dnd="true"
        className={cn(handleClass(), "left-0 top-2 bottom-2 w-2 cursor-ew-resize")}
        onPointerDown={(e) => handleResizeStart(e, "left")}
      />
      <div
        data-no-dnd="true"
        className={cn(handleClass(), "right-0 top-2 bottom-2 w-2 cursor-ew-resize")}
        onPointerDown={(e) => handleResizeStart(e, "right")}
      />
      <div
        data-no-dnd="true"
        className={cn(handleClass(), "top-0 left-2 right-2 h-2 cursor-ns-resize")}
        onPointerDown={(e) => handleResizeStart(e, "top")}
      />
      <div
        data-no-dnd="true"
        className={cn(handleClass(), "bottom-0 left-2 right-2 h-2 cursor-ns-resize")}
        onPointerDown={(e) => handleResizeStart(e, "bottom")}
      />

      {/* Corner handles */}
      <div
        data-no-dnd="true"
        className={cn(cornerClass, "top-0 left-0 cursor-nwse-resize")}
        onPointerDown={(e) => handleResizeStart(e, "top-left")}
      />
      <div
        data-no-dnd="true"
        className={cn(cornerClass, "top-0 right-0 cursor-nesw-resize")}
        onPointerDown={(e) => handleResizeStart(e, "top-right")}
      />
      <div
        data-no-dnd="true"
        className={cn(cornerClass, "bottom-0 left-0 cursor-nesw-resize")}
        onPointerDown={(e) => handleResizeStart(e, "bottom-left")}
      />
      <div
        data-no-dnd="true"
        className={cn(cornerClass, "bottom-0 right-0 cursor-nwse-resize")}
        onPointerDown={(e) => handleResizeStart(e, "bottom-right")}
      />
    </div>
  );
}
