import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lead } from "@/types/crm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone } from "lucide-react";
import Instagram from "@/components/icons/Instagram";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";

interface KanbanCardProps {
  lead: Lead;
  isDragging?: boolean;
}

export function KanbanCard({ lead, isDragging: isDraggingOverlay }: KanbanCardProps) {
  const navigate = useNavigate();
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const wasDragged = useRef(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: lead.id,
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isBeingDragged = isDragging || isDraggingOverlay;

  // Combine our pointer tracking with dnd-kit's listeners
  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    wasDragged.current = false;
    // Call dnd-kit's onPointerDown
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
    // Only navigate if mouse didn't move much (not a drag)
    if (!wasDragged.current && !isDragging) {
      e.stopPropagation();
      navigate(`/admin/crm/${lead.id}`);
    }
    dragStartPos.current = null;
    wasDragged.current = false;
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing transition-all duration-150 bg-card border-black/5 shadow-none select-none touch-none ${
        isBeingDragged
          ? "opacity-100"
          : isDragging
          ? "opacity-30"
          : "hover:border-black/10"
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
    >
      <CardContent className="p-4 space-y-2">
        <h3 className="font-semibold text-sm">{lead.name}</h3>
        
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span>{lead.country_code} {lead.whatsapp}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Instagram className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{lead.instagram}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 pt-2">
          <Badge variant="secondary" className="text-xs">
            {lead.service_area}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
