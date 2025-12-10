import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lead } from "@/types/crm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone } from "lucide-react";
import Instagram from "@/components/icons/Instagram";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface KanbanCardProps {
  lead: Lead;
  isDragging?: boolean;
}

export function KanbanCard({ lead, isDragging: isDraggingOverlay }: KanbanCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  
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

  return (
    <>
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
        onClick={(e) => {
          if (!isDragging) {
            e.stopPropagation();
            setIsOpen(true);
          }
        }}
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

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{lead.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold">Email</label>
                <p className="text-sm text-muted-foreground">{lead.email}</p>
              </div>
              
              <div>
                <label className="text-sm font-semibold">WhatsApp</label>
                <p className="text-sm text-muted-foreground">{lead.country_code} {lead.whatsapp}</p>
              </div>
              
              <div>
                <label className="text-sm font-semibold">Instagram</label>
                <p className="text-sm text-muted-foreground">{lead.instagram}</p>
              </div>
              
              <div>
                <label className="text-sm font-semibold">Área de Serviço</label>
                <p className="text-sm text-muted-foreground">{lead.service_area}</p>
              </div>
              
              <div>
                <label className="text-sm font-semibold">Faturamento Mensal</label>
                <p className="text-sm text-muted-foreground">{lead.monthly_billing}</p>
              </div>
              
              <div>
                <label className="text-sm font-semibold">Atendimentos Semanais</label>
                <p className="text-sm text-muted-foreground">{lead.weekly_attendance}</p>
              </div>
              
              <div>
                <label className="text-sm font-semibold">Tipo de Espaço</label>
                <p className="text-sm text-muted-foreground">{lead.workspace_type}</p>
              </div>
              
              <div>
                <label className="text-sm font-semibold">Anos de Experiência</label>
                <p className="text-sm text-muted-foreground">{lead.years_experience}</p>
              </div>
              
              <div>
                <label className="text-sm font-semibold">Data de Cadastro</label>
                <p className="text-sm text-muted-foreground">
                  {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
