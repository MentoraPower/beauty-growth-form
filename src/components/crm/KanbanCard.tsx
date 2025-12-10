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

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only navigate if not dragging (mouse moved less than 5px)
    if (dragStartPos.current) {
      const dx = Math.abs(e.clientX - dragStartPos.current.x);
      const dy = Math.abs(e.clientY - dragStartPos.current.y);
      if (dx < 5 && dy < 5 && !isDragging) {
        e.stopPropagation();
        navigate(`/admin/crm/${lead.id}`);
      }
    }
    dragStartPos.current = null;
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing transition-all duration-150 bg-card border-black/5 select-none touch-none ${
        isBeingDragged
          ? "shadow-xl opacity-100 ring-2 ring-primary/20"
          : isDragging
          ? "opacity-30"
          : "hover:shadow-md hover:border-black/10"
      }`}
      onPointerDown={handlePointerDown}
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
