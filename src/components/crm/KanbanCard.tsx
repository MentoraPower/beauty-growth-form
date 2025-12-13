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
    <>
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
            
            <button
              onClick={handleContactClick}
              className="flex items-center gap-2 hover:text-primary transition-colors w-full text-left"
            >
              <Instagram className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{lead.instagram}</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 text-[10px] text-muted-foreground">
            <span>
              {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Contact Side Panel */}
      {showContactPanel && (
        <div 
          className="fixed inset-0 z-50 flex justify-end"
          onClick={() => setShowContactPanel(false)}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div 
            className="relative w-[400px] h-full bg-card border-l border-border shadow-xl animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                  {lead.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">Contato</p>
                </div>
              </div>
              <button
                onClick={() => setShowContactPanel(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveContactTab("instagram")}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeContactTab === "instagram" 
                    ? "text-primary border-b-2 border-primary" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Instagram className="w-4 h-4" />
                Instagram
              </button>
              <button
                onClick={() => setActiveContactTab("whatsapp")}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeContactTab === "whatsapp" 
                    ? "text-primary border-b-2 border-primary" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <WhatsApp className="w-4 h-4" />
                WhatsApp
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 h-[calc(100vh-120px)]">
              {activeContactTab === "instagram" ? (
                <iframe
                  src={`https://www.instagram.com/${getInstagramHandle()}/`}
                  className="w-full h-full border-0"
                  title={`Instagram de ${lead.name}`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                    <WhatsApp className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Iniciar Conversa</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {lead.country_code} {lead.whatsapp}
                  </p>
                  <a
                    href={`https://wa.me/${getWhatsAppNumber()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
                  >
                    <WhatsApp className="w-5 h-5" />
                    Abrir WhatsApp
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
});
