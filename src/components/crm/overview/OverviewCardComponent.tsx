import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { 
  MoreHorizontal, 
  Trash2,
  GripVertical,
  ArrowUpRight,
  ArrowDownRight,
  Folder,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { OverviewCard, CardSize, MIN_CARD_WIDTH, MIN_CARD_HEIGHT, MAX_CARD_WIDTH, MAX_CARD_HEIGHT } from "./types";
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
  onResize: (id: string, size: CardSize) => void;
  onConnectDataSource?: (card: OverviewCard) => void;
  isDragging?: boolean;
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
}: OverviewCardComponentProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection | null>(null);
  const [currentSize, setCurrentSize] = useState<CardSize>(card.size);
  const [containerWidth, setContainerWidth] = useState(0);
  const [atLimit, setAtLimit] = useState<{ left: boolean; right: boolean; top: boolean; bottom: boolean }>({
    left: false,
    right: false,
    top: false,
    bottom: false,
  });

  const cardRef = useRef<HTMLDivElement | null>(null);
  const maxSizeRef = useRef({ maxW: MAX_CARD_WIDTH, maxH: MAX_CARD_HEIGHT });
  const limitsRef = useRef({ left: false, right: false, top: false, bottom: false });
  const containerWidthRef = useRef(0);

  const startPosRef = useRef({ x: 0, y: 0 });
  const startSizeRef = useRef({ width: card.size.width, height: card.size.height });
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
  useEffect(() => {
    const parent = cardRef.current?.parentElement;
    if (!parent) return;

    const updateContainerWidth = () => {
      const width = parent.getBoundingClientRect().width;
      setContainerWidth(width);
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
  }, []);

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

      const startW = currentSizeRef.current.width;
      const startH = currentSizeRef.current.height;

      // O limite máximo é o container completo (alinhado com o botão + Adicionar cartão)
      const availableWidth = containerWidthRef.current > 0 
        ? containerWidthRef.current 
        : window.innerWidth - 320; // fallback: viewport - sidebar aproximada
      
      maxSizeRef.current = { maxW: availableWidth, maxH: MAX_CARD_HEIGHT };

      setIsResizing(true);
      setResizeDirection(direction);
      startPosRef.current = { x: e.clientX, y: e.clientY };
      startSizeRef.current = {
        width: startW,
        height: startH,
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

      const startW = startSizeRef.current.width;
      const startH = startSizeRef.current.height;

      const maxW = maxSizeRef.current.maxW;
      const maxH = maxSizeRef.current.maxH;

      let nextW = startW;
      let nextH = startH;

      const isCorner = resizeDirection.includes("-");

      if (isCorner) {
        // Corner resize: allow growth only towards bottom/right in this flow layout.
        // Growing towards top/left would visually "force" the opposite side.
        let widthDelta = resizeDirection.endsWith("right") ? deltaX : -deltaX;
        let heightDelta = resizeDirection.startsWith("bottom") ? deltaY : -deltaY;

        if (resizeDirection.includes("left") && deltaX < 0) {
          // Dragging left would mean grow-to-left: block
          widthDelta = 0;
        }
        if (resizeDirection.includes("top") && deltaY < 0) {
          // Dragging up would mean grow-to-top: block
          heightDelta = 0;
        }

        const rawW = startW + widthDelta;
        const rawH = startH + heightDelta;

        const clampedW = clamp(rawW, MIN_CARD_WIDTH, maxW);
        const clampedH = clamp(rawH, MIN_CARD_HEIGHT, maxH);

        const allowedW = clampedW - startW;
        const allowedH = clampedH - startH;

        // If one axis hits a limit first, scale BOTH deltas so the other axis doesn't keep growing alone.
        let s = 1;
        if (widthDelta !== 0 && allowedW !== widthDelta) s = Math.min(s, allowedW / widthDelta);
        if (heightDelta !== 0 && allowedH !== heightDelta) s = Math.min(s, allowedH / heightDelta);

        nextW = clamp(startW + widthDelta * s, MIN_CARD_WIDTH, maxW);
        nextH = clamp(startH + heightDelta * s, MIN_CARD_HEIGHT, maxH);
      } else {
        if (resizeDirection === "right") {
          nextW = clamp(startW + deltaX, MIN_CARD_WIDTH, maxW);
        } else if (resizeDirection === "left") {
          // Don't allow grow-to-left (deltaX < 0)
          nextW = clamp(startW - Math.max(0, deltaX), MIN_CARD_WIDTH, maxW);
        }

        if (resizeDirection === "bottom") {
          nextH = clamp(startH + deltaY, MIN_CARD_HEIGHT, maxH);
        } else if (resizeDirection === "top") {
          // Don't allow grow-to-top (deltaY < 0)
          nextH = clamp(startH - Math.max(0, deltaY), MIN_CARD_HEIGHT, maxH);
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
      if (nextW !== prev.width || nextH !== prev.height) {
        const next = { width: nextW, height: nextH };
        currentSizeRef.current = next;
        setCurrentSize(next);
        onResize(card.id, next);
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
          <div className="flex flex-col gap-2 overflow-auto h-full pr-2">
            {listData.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm shrink-0">
                  {lead.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                </div>
              </div>
            ))}
            {listData.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-16 h-12 bg-muted/60 rounded-lg flex items-center justify-center">
                  <Folder className="h-8 w-8 text-muted-foreground/50" fill="currentColor" strokeWidth={1} />
                </div>
                <span className="text-muted-foreground text-sm">Conecte uma fonte de dados</span>
              </div>
            )}
          </div>
        );

      case "funnel":
        const funnelData = chartData as Array<{ name: string; value: number; fill: string }>;
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
                dataKey="value"
                data={funnelData}
                isAnimationActive
              >
                <LabelList position="right" fill="#000" stroke="none" dataKey="name" fontSize={11} />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "bg-white rounded-xl border border-[#00000015] shadow-sm overflow-hidden flex flex-col group relative",
        isDragging && "opacity-50 shadow-lg",
        isResizing && "select-none"
      )}
      style={{
        // CSS min() nativo garante que o card nunca ultrapasse o container
        // Alinhado com o botão + Adicionar cartão (sem margem extra)
        width: `min(${currentSize.width}px, 100%)`,
        height: currentSize.height,
        maxWidth: '100%',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
          <h3 className="font-medium text-sm text-foreground">{card.title}</h3>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                Remover
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Chart Content */}
      <div className="flex-1 p-4 min-h-0 overflow-hidden">
        {!card.dataSource ? (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onConnectDataSource?.(card);
            }}
            className="w-full h-full flex flex-col items-center justify-center gap-3 hover:bg-muted/30 rounded-lg transition-colors cursor-pointer"
          >
            <div className="w-16 h-12 bg-muted/60 rounded-lg flex items-center justify-center">
              <Folder className="h-8 w-8 text-muted-foreground/50" fill="currentColor" strokeWidth={1} />
            </div>
            <span className="text-muted-foreground text-sm">Conecte uma fonte de dados</span>
          </button>
        ) : (
          renderChart()
        )}
      </div>

      {/* Limit indicators - show lines when at edge */}
      {isResizing && atLimit.left && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive z-30" />
      )}
      {isResizing && atLimit.right && (
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-destructive z-30" />
      )}
      {isResizing && atLimit.top && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-destructive z-30" />
      )}
      {isResizing && atLimit.bottom && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-destructive z-30" />
      )}

      {/* Resize Handles */}
      {/* Left handle */}
      <div
        className="absolute left-0 top-2 bottom-2 w-2 cursor-ew-resize opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-primary/20 z-40 touch-none"
        onPointerDown={(e) => handleResizeStart(e, "left")}
      />
      
      {/* Right handle (inset to avoid ScrollArea scrollbar overlap) */}
      <div
        className="absolute right-3 top-2 bottom-2 w-3 cursor-ew-resize opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-primary/20 z-40 touch-none"
        onPointerDown={(e) => handleResizeStart(e, "right")}
      />
      
      {/* Top handle */}
      <div
        className="absolute top-0 left-2 right-2 h-2 cursor-ns-resize opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-primary/20 z-40 touch-none"
        onPointerDown={(e) => handleResizeStart(e, "top")}
      />
      
      {/* Bottom handle */}
      <div
        className="absolute bottom-0 left-2 right-2 h-2 cursor-ns-resize opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-primary/20 z-40 touch-none"
        onPointerDown={(e) => handleResizeStart(e, "bottom")}
      />
      
      {/* Top-left corner */}
      <div
        className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-primary/20 z-50 touch-none"
        onPointerDown={(e) => handleResizeStart(e, "top-left")}
      />
      
      {/* Top-right corner (inset to avoid ScrollArea scrollbar overlap) */}
      <div
        className="absolute top-0 right-3 w-3 h-3 cursor-nesw-resize opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-primary/20 z-50 touch-none"
        onPointerDown={(e) => handleResizeStart(e, "top-right")}
      />
      
      {/* Bottom-left corner */}
      <div
        className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-primary/20 z-50 touch-none"
        onPointerDown={(e) => handleResizeStart(e, "bottom-left")}
      />
      
      {/* Bottom-right corner (inset to avoid ScrollArea scrollbar overlap) */}
      <div
        className="absolute bottom-0 right-3 w-4 h-4 cursor-nwse-resize opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto z-50 touch-none"
        onPointerDown={(e) => handleResizeStart(e, "bottom-right")}
      >
        <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-muted-foreground/50 group-hover:border-primary" />
      </div>
    </div>
  );
}
