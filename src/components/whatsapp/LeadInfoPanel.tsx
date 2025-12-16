import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Mail, Instagram, ChevronRight, ChevronDown, Clock, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  clinic_name: string | null;
  created_at: string;
  is_mql: boolean | null;
  estimated_revenue: number | null;
  average_ticket: number | null;
  biggest_difficulty: string | null;
  photo_url: string | null;
}

interface LeadInfoPanelProps {
  phone: string;
  photoUrl?: string | null;
  contactName?: string | null;
  onClose?: () => void;
}

const LeadInfoPanel = ({ phone, photoUrl, contactName, onClose }: LeadInfoPanelProps) => {
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    contato: true,
    negocio: false,
    historico: false,
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLead = async () => {
      if (!phone) {
        setLead(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      
      const cleanPhone = phone.replace(/\D/g, "");
      
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .or(`whatsapp.eq.${cleanPhone},whatsapp.eq.${cleanPhone.slice(-11)},whatsapp.eq.${cleanPhone.slice(-10)}`)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching lead:", error);
      }
      
      if (data && photoUrl && !data.photo_url) {
        await supabase
          .from("leads")
          .update({ photo_url: photoUrl })
          .eq("id", data.id);
        data.photo_url = photoUrl;
      }
      
      setLead(data);
      setIsLoading(false);
    };

    fetchLead();
  }, [phone, photoUrl]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const displayPhoto = lead?.photo_url || photoUrl;
  const defaultAvatar = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMTIgMjEyIj48cGF0aCBmaWxsPSIjREZFNUU3IiBkPSJNMCAwaDIxMnYyMTJIMHoiLz48cGF0aCBmaWxsPSIjRkZGIiBkPSJNMTA2IDEwNmMtMjUuNCAwLTQ2LTIwLjYtNDYtNDZzMjAuNi00NiA0Ni00NiA0NiAyMC42IDQ2IDQ2LTIwLjYgNDYtNDYgNDZ6bTAgMTNjMzAuNiAwIDkyIDE1LjQgOTIgNDZ2MjNIMTR2LTIzYzAtMzAuNiA2MS40LTQ2IDkyLTQ2eiIvPjwvc3ZnPg==";

  if (isLoading) {
    return (
      <div className="w-[340px] border-l border-border bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
          <div className="animate-pulse text-muted-foreground text-sm">Carregando...</div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="w-[340px] border-l border-border bg-background flex flex-col">
        {/* Header */}
        <div className="bg-indigo-50 dark:bg-indigo-950/30 px-4 py-6">
          <img 
            src={photoUrl || defaultAvatar} 
            alt={contactName || "Contato"} 
            className="w-12 h-12 rounded-full object-cover bg-muted" 
          />
        </div>
        
        <div className="p-4 text-center">
          <p className="text-base font-medium text-foreground">{contactName || phone}</p>
          <p className="text-sm text-muted-foreground mt-1">Contato não encontrado no CRM</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[340px] border-l border-border bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-50 dark:bg-indigo-950/30 px-4 py-5">
        <div className="flex items-start gap-3">
          <img 
            src={displayPhoto || defaultAvatar} 
            alt={lead.name} 
            className="w-10 h-10 rounded-full object-cover bg-muted flex-shrink-0" 
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground truncate">{lead.name}</h3>
            {lead.clinic_name && (
              <p className="text-xs text-muted-foreground truncate">{lead.clinic_name}</p>
            )}
            {lead.is_mql !== null && (
              <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded text-[10px] font-medium ${
                lead.is_mql 
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" 
                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
              }`}>
                {lead.is_mql ? "MQL" : "Não qualificado"}
              </span>
            )}
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2 mt-4">
          <button className="w-8 h-8 rounded-lg bg-background/60 hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Phone className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 rounded-lg bg-background/60 hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Mail className="w-4 h-4" />
          </button>
          <button 
            onClick={() => navigate(`/admin/crm/${lead.id}`)}
            className="w-8 h-8 rounded-lg bg-background/60 hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Contato Section */}
        <Collapsible open={openSections.contato} onOpenChange={() => toggleSection('contato')}>
          <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border">
            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Contato</span>
            {openSections.contato ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 py-3 space-y-3 border-b border-border">
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <p className="text-sm text-foreground mt-0.5 truncate">{lead.email || "-"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Telefone</label>
                <p className="text-sm text-foreground mt-0.5">{lead.country_code} {lead.whatsapp}</p>
              </div>
              {lead.instagram && (
                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Instagram className="w-3 h-3" /> Instagram
                  </label>
                  <a 
                    href={`https://instagram.com/${lead.instagram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-0.5 block"
                  >
                    {lead.instagram}
                  </a>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Negócio Section */}
        <Collapsible open={openSections.negocio} onOpenChange={() => toggleSection('negocio')}>
          <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border">
            <span className="text-sm font-medium text-foreground">Negócio</span>
            {openSections.negocio ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 py-3 space-y-3 border-b border-border">
              {lead.service_area && (
                <div>
                  <label className="text-xs text-muted-foreground">Área de Atuação</label>
                  <p className="text-sm text-foreground mt-0.5">{lead.service_area}</p>
                </div>
              )}
              {lead.workspace_type && (
                <div>
                  <label className="text-xs text-muted-foreground">Espaço</label>
                  <p className="text-sm text-foreground mt-0.5">{lead.workspace_type}</p>
                </div>
              )}
              {lead.years_experience && (
                <div>
                  <label className="text-xs text-muted-foreground">Experiência</label>
                  <p className="text-sm text-foreground mt-0.5">{lead.years_experience}</p>
                </div>
              )}
              {lead.monthly_billing && (
                <div>
                  <label className="text-xs text-muted-foreground">Faturamento Mensal</label>
                  <p className="text-sm text-foreground mt-0.5">{lead.monthly_billing}</p>
                </div>
              )}
              {lead.weekly_attendance && (
                <div>
                  <label className="text-xs text-muted-foreground">Atendimentos/semana</label>
                  <p className="text-sm text-foreground mt-0.5">{lead.weekly_attendance}</p>
                </div>
              )}
              {lead.average_ticket && (
                <div>
                  <label className="text-xs text-muted-foreground">Ticket Médio</label>
                  <p className="text-sm text-foreground mt-0.5">{formatCurrency(lead.average_ticket)}</p>
                </div>
              )}
              {lead.estimated_revenue && (
                <div>
                  <label className="text-xs text-muted-foreground">Receita Estimada</label>
                  <p className="text-sm font-medium text-foreground mt-0.5">{formatCurrency(lead.estimated_revenue)}</p>
                </div>
              )}
              {lead.biggest_difficulty && (
                <div>
                  <label className="text-xs text-muted-foreground">Maior Dificuldade</label>
                  <p className="text-sm text-foreground mt-0.5">{lead.biggest_difficulty}</p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Histórico Section */}
        <Collapsible open={openSections.historico} onOpenChange={() => toggleSection('historico')}>
          <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border">
            <span className="text-sm font-medium text-foreground">Histórico</span>
            {openSections.historico ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Novo contato criado</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(lead.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};

export default LeadInfoPanel;
