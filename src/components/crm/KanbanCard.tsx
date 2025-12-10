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
}

export function KanbanCard({ lead }: KanbanCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="cursor-move hover:shadow-md transition-shadow bg-card border-black/5"
        onClick={() => setIsOpen(true)}
      >
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-sm">{lead.name}</h3>
          
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="w-3 h-3" />
              <span className="truncate">{lead.email}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Phone className="w-3 h-3" />
              <span>{lead.country_code} {lead.whatsapp}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Instagram className="w-3 h-3" />
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
