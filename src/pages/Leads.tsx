import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Eye, Mail, Phone, Instagram, Building2, Home, Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

interface Lead {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  country_code: string;
  instagram: string;
  service_area: string;
  monthly_billing: string;
  weekly_attendance: string;
  workspace_type: string;
  years_experience: string;
  created_at: string;
}

const LeadsTableSkeleton = () => (
  <div className="space-y-3 p-6">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-3 w-[150px]" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
    ))}
  </div>
);

const Leads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => {
    fetchLeads();

    const channel = supabase
      .channel("leads-realtime-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLeads((prev) => [payload.new as Lead, ...prev]);
          } else if (payload.eventType === "DELETE") {
            setLeads((prev) => prev.filter((lead) => lead.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            setLeads((prev) =>
              prev.map((lead) =>
                lead.id === payload.new.id ? (payload.new as Lead) : lead
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(
    (lead) =>
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.instagram.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.service_area.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 bg-card border-border/50"
            />
          </div>
        </div>

        {/* Table */}
        <Card className="bg-card border-border/50 overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <LeadsTableSkeleton />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent bg-muted/30">
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lead</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Área</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <Users className="h-8 w-8 text-muted-foreground/50" />
                            <p className="text-sm">
                              {searchTerm
                                ? "Nenhum lead encontrado para essa busca"
                                : "Nenhum lead cadastrado ainda"}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLeads.map((lead) => (
                        <TableRow
                          key={lead.id}
                          className="border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => setSelectedLead(lead)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-sm font-semibold text-primary-foreground shrink-0">
                                {lead.name.charAt(0).toUpperCase()}
                              </div>
                              <p className="font-medium text-foreground truncate">{lead.name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-normal text-xs">
                              {lead.service_area}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(lead.created_at), "dd/MM/yy", { locale: ptBR })}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLead(lead);
                              }}
                              className="p-2 hover:bg-muted rounded-lg transition-colors inline-flex"
                            >
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lead Detail Modal */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Detalhes do Lead</DialogTitle>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-5 mt-2">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-xl font-bold text-primary-foreground">
                  {selectedLead.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{selectedLead.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(selectedLead.created_at), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                  <Mail className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">E-mail</p>
                    <p className="text-sm font-medium text-foreground truncate">{selectedLead.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                  <Phone className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">WhatsApp</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedLead.country_code} {selectedLead.whatsapp}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                  <Instagram className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Instagram</p>
                    <a
                      href={`https://instagram.com/${selectedLead.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      @{selectedLead.instagram}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                  <Users className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Área de Atuação</p>
                    <p className="text-sm font-medium text-foreground">{selectedLead.service_area}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/40 rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Faturamento</p>
                    <p className="text-sm font-medium text-foreground">{selectedLead.monthly_billing}</p>
                  </div>

                  <div className="p-3 bg-muted/40 rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Atend./Semana</p>
                    <p className="text-sm font-medium text-foreground">{selectedLead.weekly_attendance}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2.5 p-3 bg-muted/40 rounded-lg">
                    {selectedLead.workspace_type === "physical" ? (
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Home className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Espaço</p>
                      <p className="text-sm font-medium text-foreground">
                        {selectedLead.workspace_type === "physical" ? "Físico" : "Domicílio"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 bg-muted/40 rounded-lg">
                    <Calendar className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Experiência</p>
                      <p className="text-sm font-medium text-foreground">
                        {selectedLead.years_experience} anos
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Leads;
