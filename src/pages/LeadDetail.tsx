import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, Calendar, Building2, Clock, DollarSign, Users, Briefcase, MoreVertical, Trash2, User } from "lucide-react";
import Instagram from "@/components/icons/Instagram";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { ActivitiesBoard } from "@/components/activities/ActivitiesBoard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Lead } from "@/types/crm";

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

const tabs = [
  { id: "atividades", label: "Atividades" },
  { id: "contato", label: "Contato" },
];

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lead, setLead] = useState<LeadData | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("atividades");

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

  const handleDelete = async () => {
    if (!lead) return;
    
    setIsDeleting(true);
    
    // Optimistically update the cache immediately
    queryClient.setQueryData<Lead[]>(["crm-leads"], (oldData) => {
      if (!oldData) return [];
      return oldData.filter((l) => l.id !== lead.id);
    });
    
    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", lead.id);

    if (error) {
      console.error("Error deleting lead:", error);
      toast.error("Erro ao excluir lead");
      // Revert the optimistic update
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      setIsDeleting(false);
      return;
    }

    toast.success("Lead excluído com sucesso");
    navigate("/admin/crm");
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "incompleto";
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
    return type || "incompleto";
  };

  // Helper to display field value or "incompleto"
  const displayValue = (value: string | null | undefined) => {
    if (!value || value.trim() === "" || value === "Incompleto") return "incompleto";
    return value;
  };

  // Check if email is a temp/incomplete email
  const isIncompleteEmail = (email: string) => {
    return email.includes("incompleto_") && email.includes("@temp.com");
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Avatar and Name */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/admin/crm")}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            
            {/* Avatar */}
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-black/5">
              <User className="h-5 w-5 text-primary/70" />
            </div>
            
            {/* Name and Badges */}
            <div>
              <h1 className="text-lg font-bold">
                {lead.name === "Incompleto" ? "incompleto" : lead.name}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                {lead.service_area && lead.service_area !== "" && (
                  <Badge variant="secondary" className="text-xs">
                    {lead.service_area}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Three dots menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir lead
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tabs Navigation */}
        <div className="relative">
          <div className="flex gap-6 border-b border-black/10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative pb-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {activeTab === "atividades" && (
            <ActivitiesBoard
              leadId={lead.id}
              leadName={lead.name}
              currentPipelineId={lead.pipeline_id}
            />
          )}

          {activeTab === "contato" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contact Info */}
              <Card className="border-black/5">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    Informações de Contato
                  </h3>
                  
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      {isIncompleteEmail(lead.email) ? (
                        <span className="text-sm font-medium text-muted-foreground italic">incompleto</span>
                      ) : (
                        <a href={`mailto:${lead.email}`} className="text-sm font-medium hover:underline">
                          {lead.email}
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">WhatsApp</p>
                      {!lead.whatsapp || lead.whatsapp === "" ? (
                        <span className="text-sm font-medium text-muted-foreground italic">incompleto</span>
                      ) : (
                        <a 
                          href={`https://wa.me/${lead.country_code.replace("+", "")}${lead.whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium hover:underline"
                        >
                          {lead.country_code} {lead.whatsapp}
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-pink-500/10 flex items-center justify-center">
                      <Instagram className="h-5 w-5 text-pink-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Instagram</p>
                      {!lead.instagram || lead.instagram === "" ? (
                        <span className="text-sm font-medium text-muted-foreground italic">incompleto</span>
                      ) : (
                        <a 
                          href={`https://instagram.com/${lead.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium hover:underline"
                        >
                          @{lead.instagram}
                        </a>
                      )}
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
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    Informações do Negócio
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Faturamento Mensal</p>
                      </div>
                      <p className={`text-sm font-medium ${!lead.monthly_billing ? "text-muted-foreground italic" : ""}`}>
                        {displayValue(lead.monthly_billing)}
                      </p>
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Atendimentos/Semana</p>
                      </div>
                      <p className={`text-sm font-medium ${!lead.weekly_attendance ? "text-muted-foreground italic" : ""}`}>
                        {displayValue(lead.weekly_attendance)}
                      </p>
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Ticket Médio</p>
                      </div>
                      <p className={`text-sm font-medium ${lead.average_ticket === null ? "text-muted-foreground italic" : ""}`}>
                        {formatCurrency(lead.average_ticket)}
                      </p>
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Tipo de Espaço</p>
                      </div>
                      <p className={`text-sm font-medium ${!lead.workspace_type ? "text-muted-foreground italic" : ""}`}>
                        {getWorkspaceLabel(lead.workspace_type)}
                      </p>
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Anos de Experiência</p>
                      </div>
                      <p className={`text-sm font-medium ${!lead.years_experience ? "text-muted-foreground italic" : ""}`}>
                        {lead.years_experience ? `${lead.years_experience} anos` : "incompleto"}
                      </p>
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Receita Estimada</p>
                      </div>
                      <p className={`text-sm font-medium ${lead.estimated_revenue === null ? "text-muted-foreground italic" : ""}`}>
                        {formatCurrency(lead.estimated_revenue)}
                      </p>
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
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lead será permanentemente excluído do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
