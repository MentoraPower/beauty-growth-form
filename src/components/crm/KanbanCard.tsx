import { memo, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lead } from "@/types/crm";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, X } from "lucide-react";
import Instagram from "@/components/icons/Instagram";
import WhatsApp from "@/components/icons/WhatsApp";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KanbanCardProps {
  lead: Lead;
  isDragging?: boolean;
  subOriginId?: string | null;
}

export const KanbanCard = memo(function KanbanCard({ lead, isDragging: isDraggingOverlay, subOriginId }: KanbanCardProps) {
  const navigate = useNavigate();
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const wasDragged = useRef(false);
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [activeContactTab, setActiveContactTab] = useState<"instagram" | "whatsapp">("instagram");
  
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
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1), opacity 200ms ease-out',
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

  const handleContactClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowContactPanel(true);
  };

  const getInstagramHandle = () => {
    let handle = lead.instagram || "";
    handle = handle.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "");
    return handle.split("/")[0].split("?")[0];
  };

  const getWhatsAppNumber = () => {
    const countryCode = (lead.country_code || "+55").replace(/\D/g, "");
    const phone = (lead.whatsapp || "").replace(/\D/g, "");
    return `${countryCode}${phone}`;
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing bg-card shadow-none select-none touch-none overflow-hidden transition-all duration-200 ${
        isBeingDragged ? "opacity-100" : ""
      } ${showContactPanel ? "!w-[420px]" : ""}`}
      onPointerDown={showContactPanel ? undefined : handlePointerDown}
      onPointerMove={showContactPanel ? undefined : handlePointerMove}
      onClick={showContactPanel ? undefined : handleClick}
    >
      <div className="flex">
        {/* Main Card Content */}
        <CardContent className={`p-4 space-y-2 transition-all duration-200 ${showContactPanel ? "w-[140px] flex-shrink-0" : "w-full"}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm truncate">{lead.name}</h3>
            {!showContactPanel && lead.is_mql !== null && (
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
            {!showContactPanel && (
              <>
                <div className="flex items-center gap-2">
                  <Mail className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  <span>{lead.country_code} {lead.whatsapp}</span>
                </div>
              </>
            )}
            
            <button
              onClick={handleContactClick}
              className="flex items-center gap-2 hover:text-primary transition-colors w-full text-left"
            >
              <Instagram className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{showContactPanel ? "Fechar" : lead.instagram}</span>
            </button>
          </div>

          {!showContactPanel && (
            <div className="flex items-center justify-between pt-2 text-[10px] text-muted-foreground">
              <span>
                {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
          )}
        </CardContent>

        {/* Contact Side Panel */}
        {showContactPanel && (
          <div className="flex-1 border-l border-border animate-in slide-in-from-right duration-200">
            {/* Tabs */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveContactTab("instagram")}
                className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                  activeContactTab === "instagram" 
                    ? "text-primary border-b-2 border-primary" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Instagram className="w-3 h-3" />
                Instagram
              </button>
              <button
                onClick={() => setActiveContactTab("whatsapp")}
                className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                  activeContactTab === "whatsapp" 
                    ? "text-primary border-b-2 border-primary" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <WhatsApp className="w-3 h-3" />
                WhatsApp
              </button>
            </div>

            {/* Content */}
            <div className="h-[200px] overflow-hidden">
              {activeContactTab === "instagram" ? (
                <iframe
                  src={`https://www.instagram.com/${getInstagramHandle()}/`}
                  className="w-full h-full border-0 scale-[0.6] origin-top-left"
                  style={{ width: "166%", height: "166%" }}
                  title={`Instagram de ${lead.name}`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-3 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                    <WhatsApp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    {lead.country_code} {lead.whatsapp}
                  </p>
                  <a
                    href={`https://wa.me/${getWhatsAppNumber()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded text-xs font-medium hover:bg-emerald-600 transition-colors"
                  >
                    <WhatsApp className="w-3 h-3" />
                    Abrir
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
});
