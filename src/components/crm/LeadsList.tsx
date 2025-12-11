import { Lead, Pipeline } from "@/types/crm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface LeadsListProps {
  leads: Lead[];
  pipelines: Pipeline[];
  activeDragId?: string | null;
}

interface DraggableRowProps {
  lead: Lead;
  isDragging?: boolean;
}

function DraggableRow({ lead, isDragging: isBeingDraggedGlobally }: DraggableRowProps) {
  const navigate = useNavigate();
  
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
    opacity: isDragging ? 0 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging) {
      navigate(`/admin/crm/${lead.id}`);
    }
  };

  return (
    <TableRow 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white hover:bg-muted/20 cursor-grab active:cursor-grabbing"
      onClick={handleClick}
    >
      <TableCell className="font-medium text-sm">{lead.name}</TableCell>
      <TableCell className="text-muted-foreground text-sm">{lead.email}</TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {lead.country_code} {lead.whatsapp}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">@{lead.instagram}</TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}
      </TableCell>
    </TableRow>
  );
}

interface PipelineListProps {
  pipeline: Pipeline;
  leads: Lead[];
  activeDragId?: string | null;
}

function PipelineList({ pipeline, leads, activeDragId }: PipelineListProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: pipeline.id,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`rounded-xl border overflow-hidden transition-all ${
        isOver 
          ? "border-primary/40 bg-primary/5 ring-2 ring-primary/20" 
          : "border-black/10 bg-muted/40"
      }`}
    >
      {/* Pipeline Header */}
      <div className={`px-4 py-3 border-b transition-colors ${
        isOver ? "border-primary/20 bg-primary/10" : "border-black/5 bg-muted/20"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{pipeline.nome}</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {leads.length}
            </span>
          </div>
          {isOver && (
            <span className="text-xs text-primary font-medium animate-pulse">
              Solte aqui
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="bg-white/50 hover:bg-white/50">
            <TableHead className="font-medium text-xs">Nome</TableHead>
            <TableHead className="font-medium text-xs">Email</TableHead>
            <TableHead className="font-medium text-xs">WhatsApp</TableHead>
            <TableHead className="font-medium text-xs">Instagram</TableHead>
            <TableHead className="font-medium text-xs">Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <DraggableRow 
              key={lead.id} 
              lead={lead} 
              isDragging={activeDragId === lead.id}
            />
          ))}
          {leads.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className={`text-center py-6 text-sm transition-colors ${
                isOver ? "text-primary" : "text-muted-foreground"
              }`}>
                {isOver ? "Solte aqui" : "Nenhum lead"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function LeadsList({ leads, pipelines, activeDragId }: LeadsListProps) {
  // Sort pipelines by ordem
  const sortedPipelines = [...pipelines].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="space-y-4 overflow-y-auto flex-1">
      {sortedPipelines.map((pipeline) => {
        const pipelineLeads = leads
          .filter((lead) => lead.pipeline_id === pipeline.id)
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

        return (
          <PipelineList
            key={pipeline.id}
            pipeline={pipeline}
            leads={pipelineLeads}
            activeDragId={activeDragId}
          />
        );
      })}
    </div>
  );
}
