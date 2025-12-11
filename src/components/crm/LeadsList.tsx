import { Lead, Pipeline } from "@/types/crm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface LeadsListProps {
  leads: Lead[];
  pipelines: Pipeline[];
}

interface PipelineListProps {
  pipeline: Pipeline;
  leads: Lead[];
}

function PipelineList({ pipeline, leads }: PipelineListProps) {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-black/10 bg-muted/40 overflow-hidden">
      {/* Pipeline Header */}
      <div className="px-4 py-3 border-b border-black/5 bg-muted/20">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{pipeline.nome}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {leads.length}
          </span>
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
            <TableRow 
              key={lead.id} 
              className="bg-white hover:bg-muted/20 cursor-pointer"
              onClick={() => navigate(`/admin/crm/${lead.id}`)}
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
          ))}
          {leads.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                Nenhum lead
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function LeadsList({ leads, pipelines }: LeadsListProps) {
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
          />
        );
      })}
    </div>
  );
}
