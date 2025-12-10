import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, Calendar, Building2, Clock, DollarSign, Users, Briefcase } from "lucide-react";
import Instagram from "@/components/icons/Instagram";
import { Skeleton } from "@/components/ui/skeleton";

interface LeadData {
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
  pipeline_id: string | null;
  ordem: number;
  created_at: string;
  average_ticket: number | null;
  estimated_revenue: number | null;
  can_afford: string | null;
  wants_more_info: boolean | null;
}

interface Pipeline {
  id: string;
  nome: string;
  cor: string;
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadData | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLead = async () => {
      if (!id) return;
      
      setIsLoading(true);
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching lead:", error);
        navigate("/admin/crm");
        return;
      }

      if (!data) {
        navigate("/admin/crm");
        return;
      }

      setLead(data);

      // Fetch pipeline info
      if (data.pipeline_id) {
        const { data: pipelineData } = await supabase
          .from("pipelines")
          .select("id, nome, cor")
          .eq("id", data.pipeline_id)
          .maybeSingle();
        
        if (pipelineData) {
          setPipeline(pipelineData);
        }
      }

      setIsLoading(false);
    };

    fetchLead();
  }, [id, navigate]);

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getWorkspaceLabel = (type: string) => {
    if (type === "physical") return "Espaço Físico";
    if (type === "home") return "Domicílio/Casa";
    return type || "—";
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/admin/crm")}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{lead.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {pipeline && (
                <Badge
                  style={{ backgroundColor: pipeline.cor, color: "#fff" }}
                  className="text-xs"
                >
                  {pipeline.nome}
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                {lead.service_area}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contact Info */}
          <Card className="border-black/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Informações de Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <a href={`mailto:${lead.email}`} className="text-sm font-medium hover:underline">
                    {lead.email}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                  <a 
                    href={`https://wa.me/${lead.country_code.replace("+", "")}${lead.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline"
                  >
                    {lead.country_code} {lead.whatsapp}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="h-10 w-10 rounded-full bg-pink-500/10 flex items-center justify-center">
                  <Instagram className="h-5 w-5 text-pink-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Instagram</p>
                  <a 
                    href={`https://instagram.com/${lead.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline"
                  >
                    @{lead.instagram}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data de Cadastro</p>
                  <p className="text-sm font-medium">{formatDate(lead.created_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Info */}
          <Card className="border-black/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Informações do Negócio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Faturamento Mensal</p>
                  </div>
                  <p className="text-sm font-medium">{lead.monthly_billing || "—"}</p>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Atendimentos/Semana</p>
                  </div>
                  <p className="text-sm font-medium">{lead.weekly_attendance || "—"}</p>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Ticket Médio</p>
                  </div>
                  <p className="text-sm font-medium">{formatCurrency(lead.average_ticket)}</p>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Tipo de Espaço</p>
                  </div>
                  <p className="text-sm font-medium">{getWorkspaceLabel(lead.workspace_type)}</p>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Anos de Experiência</p>
                  </div>
                  <p className="text-sm font-medium">{lead.years_experience || "—"} anos</p>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Receita Estimada</p>
                  </div>
                  <p className="text-sm font-medium">{formatCurrency(lead.estimated_revenue)}</p>
                </div>
              </div>

              {/* Affordability Status */}
              {lead.can_afford && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Capacidade de Investimento</p>
                  <Badge 
                    variant={lead.can_afford === "yes" ? "default" : "secondary"}
                    className={lead.can_afford === "yes" ? "bg-green-500" : ""}
                  >
                    {lead.can_afford === "yes" ? "Pode Investir" : "Não no Momento"}
                  </Badge>
                  {lead.wants_more_info && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Solicitou mais informações
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
