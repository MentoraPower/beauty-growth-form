import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Mail, Instagram, ChevronRight, ChevronDown, Clock, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { countries } from "@/data/countries";

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

  // Get country code from dial code
  const getCountryFromDialCode = (dialCode: string) => {
    const cleanDialCode = dialCode?.replace(/[^+\d]/g, "") || "+55";
    return countries.find(c => c.dialCode === cleanDialCode) || countries[0]; // Default to Brazil
  };

  const displayPhoto = lead?.photo_url || photoUrl;
  const defaultAvatar = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMTIgMjEyIj48cGF0aCBmaWxsPSIjREZFNUU3IiBkPSJNMCAwaDIxMnYyMTJIMHoiLz48cGF0aCBmaWxsPSIjRkZGIiBkPSJNMTA2IDEwNmMtMjUuNCAwLTQ2LTIwLjYtNDYtNDZzMjAuNi00NiA0Ni00NiA0NiAyMC42IDQ2IDQ2LTIwLjYgNDYtNDYgNDZ6bTAgMTNjMzAuNiAwIDkyIDE1LjQgOTIgNDZ2MjNIMTR2LTIzYzAtMzAuNiA2MS40LTQ2IDkyLTQ2eiIvPjwvc3ZnPg==";

  // Field component for consistent styling
  const Field = ({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) => (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </label>
      <div className="bg-muted/30 rounded-lg px-3 py-2.5 text-sm text-foreground border border-border/50">
        {value || <span className="text-muted-foreground/60">Clique aqui para adicionar</span>}
      </div>
    </div>
  );

  // Phone field with flag
  const PhoneField = ({ dialCode, phoneNumber }: { dialCode: string; phoneNumber: string }) => {
    const country = getCountryFromDialCode(dialCode);
    const flagUrl = `https://flagcdn.com/w40/${country.code.toLowerCase()}.png`;
    
    return (
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Telefone</label>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-muted/30 rounded-lg px-2.5 py-2.5 border border-border/50">
            <img 
              src={flagUrl} 
              alt={country.name}
              className="w-5 h-3.5 object-cover rounded-sm"
            />
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </div>
          <div className="flex-1 bg-muted/30 rounded-lg px-3 py-2.5 text-sm text-foreground border border-border/50">
            {phoneNumber || <span className="text-muted-foreground/60">Clique aqui para adicionar</span>}
          </div>
        </div>
      </div>
    );
  };

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
        <div className="bg-muted/50 dark:bg-muted/30 px-4 py-6">
          <div className="flex items-center gap-3">
            <img 
              src={photoUrl || defaultAvatar} 
              alt={contactName || "Contato"} 
              className="w-10 h-10 rounded-full object-cover bg-muted" 
            />
            <span className="text-sm font-medium text-foreground">{contactName || phone}</span>
          </div>
        </div>
        
        <div className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Contato não encontrado no CRM</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[340px] border-l border-border bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-muted/50 dark:bg-muted/30 px-4 py-4">
        <div className="flex items-center gap-3">
          <img 
            src={displayPhoto || defaultAvatar} 
            alt={lead.name} 
            className="w-10 h-10 rounded-full object-cover bg-muted flex-shrink-0" 
          />
          <span className="text-sm font-medium text-foreground truncate">{lead.name}</span>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2 mt-3">
          <button className="w-7 h-7 rounded-md bg-background/60 hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Phone className="w-3.5 h-3.5" />
          </button>
          <button className="w-7 h-7 rounded-md bg-background/60 hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Mail className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => navigate(`/admin/crm/${lead.id}`)}
            className="w-7 h-7 rounded-md bg-background/60 hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <User className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Contato Section */}
        <Collapsible open={openSections.contato} onOpenChange={() => toggleSection('contato')}>
          <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border">
            <span className="text-sm font-medium text-foreground">Contato</span>
            {openSections.contato ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 py-4 space-y-4 border-b border-border">
              <Field label="Nome" value={lead.name} />
              <Field label="Email" value={lead.email} />
              <PhoneField 
                dialCode={lead.country_code}
                phoneNumber={lead.whatsapp}
              />
              <Field 
                label="Instagram" 
                value={lead.instagram}
                icon={<Instagram className="w-3 h-3" />}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Negócio Section */}
        <Collapsible open={openSections.negocio} onOpenChange={() => toggleSection('negocio')}>
          <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border">
            <span className="text-sm font-medium text-foreground">Negócio</span>
            {openSections.negocio ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 py-4 space-y-4 border-b border-border">
              <Field label="Área de Atuação" value={lead.service_area} />
              <Field label="Espaço" value={lead.workspace_type} />
              <Field label="Experiência" value={lead.years_experience} />
              <Field label="Faturamento Mensal" value={lead.monthly_billing} />
              <Field label="Atendimentos/semana" value={lead.weekly_attendance} />
              {lead.average_ticket && (
                <Field label="Ticket Médio" value={formatCurrency(lead.average_ticket)} />
              )}
              {lead.estimated_revenue && (
                <Field label="Receita Estimada" value={formatCurrency(lead.estimated_revenue)} />
              )}
              {lead.biggest_difficulty && (
                <Field label="Maior Dificuldade" value={lead.biggest_difficulty} />
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Histórico Section */}
        <Collapsible open={openSections.historico} onOpenChange={() => toggleSection('historico')}>
          <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border">
            <span className="text-sm font-medium text-foreground">Histórico</span>
            {openSections.historico ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 py-4 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
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
