import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Calendar, Building2, Clock, DollarSign, Users, Briefcase, MoreVertical, Trash2, User, MessageSquare, ArrowRightLeft } from "lucide-react";
import Instagram from "@/components/icons/Instagram";
import WhatsApp from "@/components/icons/WhatsApp";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { ActivitiesBoard } from "@/components/activities/ActivitiesBoard";
import { LeadTagsManager } from "@/components/crm/LeadTagsManager";
import { LeadTrackingTimeline } from "@/components/crm/LeadTrackingTimeline";
import { LeadAnalysis } from "@/components/crm/LeadAnalysis";
import { MoveLeadDropdown } from "@/components/crm/MoveLeadDropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
  clinic_name: string | null;
  service_area: string;
  monthly_billing: string;
  weekly_attendance: string;
  workspace_type: string;
  years_experience: string;
  pipeline_id: string | null;
  sub_origin_id: string | null;
  ordem: number;
  created_at: string;
  average_ticket: number | null;
  estimated_revenue: number | null;
  can_afford: string | null;
  wants_more_info: boolean | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  ai_analysis: string | null;
  is_mql: boolean | null;
  analysis_created_at: string | null;
  biggest_difficulty: string | null;
  photo_url: string | null;
}

interface Pipeline {
  id: string;
  nome: string;
  cor: string;
}

const tabs = [
  { id: "atividades", label: "Atividades" },
  { id: "contato", label: "Contato" },
  { id: "rastreamento", label: "Rastreamento" },
];

export default function LeadDetail() {
  const { isLoading: authLoading } = useAuth("/auth");
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const subOriginId = searchParams.get("origin");
  const searchQuery = searchParams.get("search");
  const tabParam = searchParams.get("tab");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lead, setLead] = useState<LeadData | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Build CRM URL preserving search params
  const buildCrmUrl = () => {
    const params = new URLSearchParams();
    if (subOriginId) params.set("origin", subOriginId);
    if (searchQuery) params.set("search", searchQuery);
    const queryString = params.toString();
    return `/admin/crm${queryString ? `?${queryString}` : ''}`;
  };
  
  // Use URL param for tab persistence, default to "atividades"
  const activeTab = tabParam && ["atividades", "contato", "rastreamento"].includes(tabParam) 
    ? tabParam 
    : "atividades";

  const setActiveTab = (tab: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", tab);
    setSearchParams(newParams, { replace: true });
  };

  useEffect(() => {
    const fetchLead = async () => {
      if (!id || authLoading) return;
      
      setIsLoading(true);
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching lead:", error);
        navigate(buildCrmUrl());
        return;
      }

      if (!data) {
        navigate(buildCrmUrl());
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
  }, [id, navigate, authLoading, subOriginId]);

  if (authLoading) {
    return <div className="h-screen" />;
  }

  const handleDelete = async () => {
    if (!lead) return;

    setIsDeleting(true);

    const keySubOriginId = (lead.sub_origin_id ?? subOriginId) || null;

    // Optimistically update the cache immediately
    queryClient.setQueryData<Lead[]>(["crm-leads", keySubOriginId], (oldData) => {
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
      queryClient.invalidateQueries({ queryKey: ["crm-leads", keySubOriginId] });
      setIsDeleting(false);
      return;
    }

    toast.success("Lead excluído com sucesso");
    navigate(buildCrmUrl());
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || value === 0) return "incompleto";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Calculate estimated revenue if not stored
  const getEstimatedRevenue = () => {
    if (lead?.estimated_revenue) return lead.estimated_revenue;
    
    const weeklyAttendance = parseInt(lead?.weekly_attendance || "0") || 0;
    const averageTicket = lead?.average_ticket || 0;
    const calculated = weeklyAttendance * 4 * averageTicket;
    
    return calculated > 0 ? calculated : null;
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

  // Check if lead has incomplete essential fields (abandoned form)
  const isLeadIncomplete = (leadData: LeadData) => {
    const essentialFields = [
      leadData.service_area,
      leadData.monthly_billing,
      leadData.weekly_attendance,
      leadData.workspace_type,
      leadData.years_experience
    ];
    // Lead is incomplete if more than 2 essential fields are empty
    const emptyCount = essentialFields.filter(f => !f || f.trim() === "").length;
    return emptyCount >= 3;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <span className="text-muted-foreground">&gt;</span>
          <Skeleton className="h-4 w-32" />
        </div>

        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-40" />
            </div>
          </div>
          <Skeleton className="h-10 w-10 rounded-md" />
        </div>

        {/* Tags skeleton */}
        <div className="pl-[44px] flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>

        {/* Separator */}
        <div className="px-8 py-2">
          <div className="border-t border-black/10" />
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-6 border-b border-black/10 pb-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!lead) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="space-y-3"
      >
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => navigate(buildCrmUrl())}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Lista Geral
          </button>
          <span className="text-muted-foreground">&gt;</span>
          <span className="text-foreground font-medium">
            {lead.name === "Incompleto" ? "incompleto" : lead.name}
          </span>
        </div>

        {/* Header with Avatar, Name and Tags */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              {lead.photo_url ? (
                <img 
                  src={lead.photo_url} 
                  alt={lead.name} 
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-border/20" 
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-black/5">
                  <User className="h-5 w-5 text-primary/70" />
                </div>
              )}
              
              {/* Name and Company */}
              <div>
                <div className="flex items-center gap-2">
                  {lead.clinic_name && (
                    <p className="uppercase tracking-wide text-xs text-muted-foreground font-medium">
                      {lead.clinic_name}
                    </p>
                  )}
                  {isLeadIncomplete(lead) && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-400 text-amber-600 bg-amber-50">
                      Cadastro incompleto
                    </Badge>
                  )}
                </div>
                <h1 className="text-xl font-bold leading-tight">
                  {lead.name === "Incompleto" ? "incompleto" : lead.name}
                </h1>
              </div>
            </div>
            
            {/* Three dots menu with nested move dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <MoveLeadDropdown
                  leadId={lead.id}
                  leadName={lead.name}
                  currentSubOriginId={lead.sub_origin_id}
                  onMoved={() => {
                    // Navigate first (snappier), then refresh CRM list in the background
                    const keySubOriginId = (subOriginId ?? null);
                    navigate(buildCrmUrl());
                    window.setTimeout(() => {
                      queryClient.invalidateQueries({ queryKey: ["crm-leads", keySubOriginId] });
                    }, 0);
                  }}
                >
                  <DropdownMenuItem 
                    className="cursor-pointer"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Mover para outra origem
                  </DropdownMenuItem>
                </MoveLeadDropdown>
                <DropdownMenuSeparator />
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

          {/* Tags Section - directly below name */}
          <div className="pl-[44px] mt-0.5">
            <LeadTagsManager leadId={lead.id} />
          </div>
        </div>

        {/* Separator */}
        <div className="px-8 py-2">
          <div className="border-t border-black/10" />
        </div>

        {/* Tabs Navigation */}
        <LayoutGroup>
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
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#F40000] to-[#A10000]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </LayoutGroup>

        {/* Tab Content */}
        <div className="mt-4">
          <AnimatePresence mode="wait">
            {activeTab === "atividades" && (
              <motion.div
                key="atividades"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ActivitiesBoard
                  leadId={lead.id}
                  leadName={lead.name}
                  currentPipelineId={lead.pipeline_id}
                  currentSubOriginId={lead.sub_origin_id}
                  subOriginId={lead.sub_origin_id || subOriginId}
                  onLeadMoved={() => {
                    queryClient.invalidateQueries({ queryKey: ["leads"] });
                    navigate(buildCrmUrl());
                  }}
                />
              </motion.div>
            )}

            {activeTab === "contato" && (
              <motion.div
                key="contato"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* Lead Analysis Card */}
                <LeadAnalysis lead={lead} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contact Info */}
              <Card className="border-[#00000010] shadow-none">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    Informações de Contato
                  </h3>
                  
                  
                  <div className="flex items-center gap-3 p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <div className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-neutral-600" />
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

                  <div className="flex items-center gap-3 p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <div className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center">
                      <WhatsApp className="h-5 w-5 text-neutral-600" />
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

                  <div className="flex items-center gap-3 p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <div className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center">
                      <Instagram className="h-5 w-5 text-neutral-600" />
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

                  <div className="flex items-center gap-3 p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <div className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-neutral-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Data de Cadastro</p>
                      <p className="text-sm font-medium">{formatDate(lead.created_at)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Business Info */}
              <Card className="border-[#00000010] shadow-none">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    Informações do Negócio
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Área de Atuação</p>
                      </div>
                      <p className={`text-sm font-medium ${!lead.service_area ? "text-muted-foreground italic" : ""}`}>
                        {displayValue(lead.service_area)}
                      </p>
                    </div>

                    <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Faturamento Mensal</p>
                      </div>
                      <p className={`text-sm font-medium ${!lead.monthly_billing ? "text-muted-foreground italic" : ""}`}>
                        {displayValue(lead.monthly_billing)}
                      </p>
                    </div>

                    <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Atendimentos/Semana</p>
                      </div>
                      <p className={`text-sm font-medium ${!lead.weekly_attendance ? "text-muted-foreground italic" : ""}`}>
                        {displayValue(lead.weekly_attendance)}
                      </p>
                    </div>

                    <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Ticket Médio</p>
                      </div>
                      <p className={`text-sm font-medium ${lead.average_ticket === null ? "text-muted-foreground italic" : ""}`}>
                        {formatCurrency(lead.average_ticket)}
                      </p>
                    </div>

                    <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Tipo de Espaço</p>
                      </div>
                      <p className={`text-sm font-medium ${!lead.workspace_type ? "text-muted-foreground italic" : ""}`}>
                        {getWorkspaceLabel(lead.workspace_type)}
                      </p>
                    </div>

                    <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Anos de Experiência</p>
                      </div>
                      <p className={`text-sm font-medium ${!lead.years_experience ? "text-muted-foreground italic" : ""}`}>
                        {lead.years_experience ? `${lead.years_experience} anos` : "incompleto"}
                      </p>
                    </div>

                    <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Receita Estimada</p>
                      </div>
                      <p className={`text-sm font-medium ${getEstimatedRevenue() === null ? "text-muted-foreground italic" : ""}`}>
                        {getEstimatedRevenue() !== null 
                          ? `${formatCurrency(getEstimatedRevenue())}/mês` 
                          : "incompleto"}
                      </p>
                    </div>

                    <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Quer mais informações?</p>
                      </div>
                      <p className={`text-sm font-medium ${lead.wants_more_info === null ? "text-muted-foreground italic" : ""}`}>
                        {lead.wants_more_info === true ? "Sim" : lead.wants_more_info === false ? "Não" : "incompleto"}
                      </p>
                    </div>
                  </div>

                  {/* Biggest Difficulty - Full width */}
                  <div className="col-span-2 p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Maior Dificuldade</p>
                    </div>
                    <p className={`text-sm font-medium whitespace-pre-wrap ${!lead.biggest_difficulty ? "text-muted-foreground italic" : ""}`}>
                      {lead.biggest_difficulty || "incompleto"}
                    </p>
                  </div>

                  {/* Investment Summary Card */}
                  <div className="p-4 bg-muted/20 border border-[#00000010] rounded-lg mt-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Resumo de Investimento
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Pergunta: "Você consegue investir R$1.800/mês?"</span>
                        <Badge 
                          variant={lead.can_afford === "yes" ? "default" : lead.can_afford === "no" ? "secondary" : "outline"}
                          className={lead.can_afford === "yes" ? "bg-green-500" : lead.can_afford === "no" ? "bg-orange-500" : ""}
                        >
                          {lead.can_afford === "yes" ? "Clicou: SIM" : lead.can_afford === "no" ? "Clicou: NÃO" : "Não respondeu"}
                        </Badge>
                      </div>
                      {lead.can_afford === "no" && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Pergunta: "Quer saber mais?"</span>
                          <Badge 
                            variant={lead.wants_more_info ? "default" : "secondary"}
                            className={lead.wants_more_info ? "bg-blue-500" : ""}
                          >
                            {lead.wants_more_info ? "Clicou: SIM" : "Clicou: NÃO"}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
                </div>
              </motion.div>
            )}

            {activeTab === "rastreamento" && (
              <motion.div
                key="rastreamento"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <LeadTrackingTimeline
                  leadId={lead.id}
                  utmData={{
                    utm_source: lead.utm_source,
                    utm_medium: lead.utm_medium,
                    utm_campaign: lead.utm_campaign,
                    utm_term: lead.utm_term,
                    utm_content: lead.utm_content,
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>


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
    );
  );
}
