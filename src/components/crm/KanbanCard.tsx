import { memo, useRef } from "react";
import { useSortable, defaultAnimateLayoutChanges, AnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lead } from "@/types/crm";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, User } from "lucide-react";
import Instagram from "@/components/icons/Instagram";
import WhatsApp from "@/components/icons/WhatsApp";
import { useNavigate, useSearchParams } from "react-router-dom";
import { differenceInMinutes, differenceInHours, differenceInDays, differenceInWeeks, differenceInMonths, differenceInYears } from "date-fns";

interface KanbanCardProps {
  lead: Lead;
  isDragging?: boolean;
  subOriginId?: string | null;
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

export const KanbanCard = memo(function KanbanCard({ lead, isDragging: isDraggingOverlay, subOriginId }: KanbanCardProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const wasDragged = useRef(false);
  
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
        border border-black/10
        ${isBeingDragged ? "opacity-100 shadow-lg scale-[1.02]" : ""}
        hover:shadow-md
      `}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
    >
      <CardContent className="p-3">
        {/* Name with photo */}
        <div className="flex items-center gap-2 min-w-0 py-1">
          {lead.photo_url ? (
            <img 
              src={lead.photo_url} 
              alt={lead.name} 
              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          )}
          <h3 className="font-semibold text-sm truncate">{lead.name}</h3>
        </div>
        
        {/* Divider line */}
        <div className="h-px bg-border my-2 -mx-3 w-[calc(100%+1.5rem)]" />
        
        {/* Icons and time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasInstagram && (
              <Instagram className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            {hasWhatsapp && (
              <WhatsApp className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            {hasEmail && (
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {formatTimeAgo(new Date(lead.created_at))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});