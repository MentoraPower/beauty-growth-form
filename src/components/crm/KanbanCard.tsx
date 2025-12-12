import { memo, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lead } from "@/types/crm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone } from "lucide-react";
import Instagram from "@/components/icons/Instagram";
import { useNavigate } from "react-router-dom";

interface KanbanCardProps {
  lead: Lead;
  isDragging?: boolean;
  subOriginId?: string | null;
}

export const KanbanCard = memo(function KanbanCard({ lead, isDragging: isDraggingOverlay, subOriginId }: KanbanCardProps) {
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
      duration: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
    border: '1px solid #00000020',
    opacity: isDragging ? 0 : 1,
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
      const url = subOriginId 
        ? `/admin/crm/${lead.id}?origin=${subOriginId}` 
        : `/admin/crm/${lead.id}`;
      navigate(url);
    }
    dragStartPos.current = null;
    wasDragged.current = false;
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing bg-card shadow-none select-none touch-none ${
        isBeingDragged ? "opacity-100" : ""
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm truncate">{lead.name}</h3>
          {lead.is_mql !== null && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${
              lead.is_mql 
                ? "bg-emerald-100 text-emerald-700" 
                : "bg-orange-100 text-orange-700"
            }`}>
              {lead.is_mql ? "MQL" : "Não MQL"}
            </span>
          )}
        </div>
        
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
});
