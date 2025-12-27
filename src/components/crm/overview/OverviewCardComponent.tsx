import { useState, useRef, useCallback, useEffect } from "react";
import { 
  MoreHorizontal, 
  Trash2,
  GripVertical,
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
import { cn } from "@/lib/utils";
import { ChartRenderer } from "./ChartRenderer";

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

      // Use only percentage-based minimum to ensure consistent layout across all desktop screen sizes
      // This ensures cards maintain their proportional size on any screen
      const effectiveMinPercent = MIN_CARD_WIDTH_PERCENT;

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
        "relative rounded-xl bg-card p-4 transition-shadow group",
        !isDragging && "w-full", // w-full only when NOT dragging (uses wrapper percentage)
        isDragging && "opacity-50",
        isResizing ? "shadow-lg" : "shadow-sm"
      )}
      style={{
        height: currentSize.height,
        border: '1px solid #00000013',
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
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <h3 className="font-medium text-sm text-foreground truncate">{card.title}</h3>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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

      {/* Chart content wrapper */}
      <div className="h-[calc(100%-40px)] rounded-xl bg-muted/30 p-3">
        {card.dataSource ? (
          <ChartRenderer
            cardId={card.id}
            dataSource={card.dataSource}
            chartType={card.chartType}
            leads={leads}
            pipelines={pipelines}
            leadTags={leadTags}
            height={currentSize.height - 70}
          />
        ) : (
          <button
            type="button"
            onClick={() => onConnectDataSource?.(card)}
            className="flex flex-col items-center justify-center h-full gap-3 w-full rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 transition-colors cursor-pointer bg-background/50"
          >
            <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center">
              <Folder className="h-7 w-7 text-muted-foreground/40" fill="currentColor" strokeWidth={1} />
            </div>
            <span className="text-muted-foreground text-sm font-medium">Conectar fonte de dados</span>
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
