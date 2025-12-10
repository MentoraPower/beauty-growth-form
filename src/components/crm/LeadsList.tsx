import { Lead, Pipeline } from "@/types/crm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadsListProps {
  leads: Lead[];
  pipelines: Pipeline[];
}

export function LeadsList({ leads, pipelines }: LeadsListProps) {
  const getPipelineName = (pipelineId: string | null) => {
    const pipeline = pipelines.find((p) => p.id === pipelineId);
    return pipeline?.nome || "Sem origem";
  };

  const getPipelineColor = (pipelineId: string | null) => {
    const pipeline = pipelines.find((p) => p.id === pipelineId);
    return pipeline?.cor || "#6366f1";
  };

  return (
    <div className="rounded-xl border border-black/5 bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="font-semibold">Nome</TableHead>
            <TableHead className="font-semibold">Email</TableHead>
            <TableHead className="font-semibold">WhatsApp</TableHead>
            <TableHead className="font-semibold">Instagram</TableHead>
            <TableHead className="font-semibold">Origem</TableHead>
            <TableHead className="font-semibold">Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id} className="hover:bg-muted/20">
              <TableCell className="font-medium">{lead.name}</TableCell>
              <TableCell className="text-muted-foreground">{lead.email}</TableCell>
              <TableCell className="text-muted-foreground">
                {lead.country_code} {lead.whatsapp}
              </TableCell>
              <TableCell className="text-muted-foreground">@{lead.instagram}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getPipelineColor(lead.pipeline_id) }}
                  />
                  <span className="text-sm">{getPipelineName(lead.pipeline_id)}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </TableCell>
            </TableRow>
          ))}
          {leads.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhum lead encontrado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}