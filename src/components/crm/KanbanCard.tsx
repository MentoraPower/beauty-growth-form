import { memo, useRef } from "react";
import { useSortable, defaultAnimateLayoutChanges, AnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lead, LeadTag } from "@/types/crm";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, User, Tags } from "lucide-react";
import Instagram from "@/components/icons/Instagram";
import WhatsApp from "@/components/icons/WhatsApp";
import { useNavigate, useSearchParams } from "react-router-dom";
import { differenceInMinutes, differenceInHours, differenceInDays, differenceInWeeks, differenceInMonths, differenceInYears } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface KanbanCardProps {
  lead: Lead;
  isDragging?: boolean;
  subOriginId?: string | null;
  tags?: LeadTag[];
}

// Custom animateLayoutChanges - disable animations after drop for instant positioning
const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { wasDragging } = args;
  // Nunca animar após soltar - card vai direto para posição final
  if (wasDragging) {
    return false;
  }
  return false;
};

// Format time ago in compact format
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  
  const years = differenceInYears(now, date);
  if (years > 0) return `${years}a`;
  
  const months = differenceInMonths(now, date);
  if (months > 0) return `${months}m`;
  
  const weeks = differenceInWeeks(now, date);
  if (weeks > 0) return `${weeks}sem`;
  
  const days = differenceInDays(now, date);
  if (days > 0) return `${days}d`;
  
  const hours = differenceInHours(now, date);
  if (hours > 0) return `${hours}h`;
  
  const minutes = differenceInMinutes(now, date);
  if (minutes > 0) return `${minutes}min`;
  
  return "agora";
};

export const KanbanCard = memo(function KanbanCard({ lead, isDragging: isDraggingOverlay, subOriginId, tags = [] }: KanbanCardProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const wasDragged = useRef(false);
  
  // Tags to display
  const visibleTags = tags.slice(0, 2);
  const extraTags = tags.slice(2);
  const hasExtraTags = extraTags.length > 0;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ 
    id: lead.id,
    animateLayoutChanges,
  });

  // Posicionamento instantâneo sem animação
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: undefined,
    opacity: isDragging ? 0 : 1,
    position: 'relative',
    zIndex: isDragging ? 0 : 1,
  };

  const isBeingDragged = isDraggingOverlay;

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    wasDragged.current = false;
    listeners?.onPointerDown?.(e as any);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartPos.current) {
      const dx = Math.abs(e.clientX - dragStartPos.current.x);
      const dy = Math.abs(e.clientY - dragStartPos.current.y);
      if (dx > 5 || dy > 5) {
        wasDragged.current = true;
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!wasDragged.current && !isDragging) {
      e.stopPropagation();
      const params = new URLSearchParams();
      if (subOriginId) params.set("origin", subOriginId);
      const searchQuery = searchParams.get("search");
      if (searchQuery) params.set("search", searchQuery);
      params.set("view", "quadro");
      const queryString = params.toString();
      const url = `/admin/crm/${lead.id}${queryString ? `?${queryString}` : ''}`;
      navigate(url);
    }
    dragStartPos.current = null;
    wasDragged.current = false;
  };

  const hasInstagram = lead.instagram && lead.instagram.trim() !== "";
  const hasWhatsapp = lead.whatsapp && lead.whatsapp.trim() !== "";
  const hasEmail = lead.email && lead.email.trim() !== "";

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      data-lead-id={lead.id}
      className={`
        cursor-grab active:cursor-grabbing bg-card shadow-none select-none touch-none
        border border-black/10 rounded-xl
        ${isBeingDragged ? "opacity-100 shadow-lg scale-[1.02]" : ""}
        hover:shadow-md
      `}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
    >
      <CardContent className="p-3">
        {/* Tags + Name with photo aligned to center */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            {/* Tags above name */}
            {tags.length > 0 && (
              <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                {visibleTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
            {/* Name */}
            <h3 className="font-semibold text-sm truncate">{lead.name}</h3>
          </div>
          {/* Photo aligned center */}
          {lead.photo_url ? (
            <img 
              src={lead.photo_url} 
              alt={lead.name} 
              className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>
        
        {/* Divider line */}
        <div className="h-px bg-border my-2 -mx-3 w-[calc(100%+1.5rem)]" />
        
        {/* Icons and time */}
        <div className="flex items-center justify-between">
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-2">
              {hasInstagram && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-pointer">
                      <Instagram className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p>@{lead.instagram.replace('@', '')}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {hasWhatsapp && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-pointer">
                      <WhatsApp className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p>{lead.whatsapp}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {hasEmail && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-pointer">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p>{lead.email}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {hasExtraTags && (
                <Popover>
                  <PopoverTrigger asChild>
                    <div 
                      className="cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tags 
                        className="w-3.5 h-3.5 transition-colors hover:opacity-70" 
                        style={{ color: extraTags[0]?.color }}
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent 
                    side="top" 
                    className="w-auto p-2 bg-background border shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-xs text-muted-foreground mb-2">Todas as tags</p>
                    <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                      {tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </TooltipProvider>
          <span className="text-[10px] text-muted-foreground">
            {formatTimeAgo(new Date(lead.created_at))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});