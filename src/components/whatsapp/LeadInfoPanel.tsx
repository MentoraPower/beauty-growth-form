import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Mail, Phone, Instagram, Building2, Calendar, DollarSign, Users, MapPin, Clock, TrendingUp, Sparkles } from "lucide-react";

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

  useEffect(() => {
    const fetchLead = async () => {
      if (!phone) {
        setLead(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      
      // Clean phone number for comparison
      const cleanPhone = phone.replace(/\D/g, "");
      
      // Try different phone formats
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .or(`whatsapp.eq.${cleanPhone},whatsapp.eq.${cleanPhone.slice(-11)},whatsapp.eq.${cleanPhone.slice(-10)}`)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching lead:", error);
      }
      
      // If lead found and we have a photoUrl but lead doesn't have photo_url, save it
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

  const displayPhoto = lead?.photo_url || photoUrl;

  if (isLoading) {
    return (
      <div className="w-96 border-l border-border/20 bg-gradient-to-b from-card to-muted/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-muted/50 animate-pulse" />
          <div className="animate-pulse text-muted-foreground text-sm">Buscando lead...</div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="w-96 border-l border-border/20 bg-gradient-to-b from-card to-muted/20 flex flex-col items-center justify-center p-8 text-center">
        {photoUrl ? (
          <img src={photoUrl} alt={contactName || "Contato"} className="w-24 h-24 rounded-full object-cover mb-4 ring-4 ring-muted/30" />
        ) : (
          <div className="w-24 h-24 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <User className="w-12 h-12 text-muted-foreground/40" />
          </div>
        )}
        <p className="text-lg font-semibold text-foreground">{contactName || phone}</p>
        <p className="text-sm text-muted-foreground mt-2">Este contato não está no CRM</p>
        <button className="mt-6 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors">
          Criar lead
        </button>
      </div>
    );
  }

  return (
    <div className="w-96 border-l border-border/10 bg-card flex flex-col overflow-hidden">
      {/* Header with Photo */}
      <div className="p-5 border-b border-border/10">
        <div className="flex items-center gap-4">
          {displayPhoto ? (
            <img 
              src={displayPhoto} 
              alt={lead.name} 
              className="w-16 h-16 rounded-full object-cover ring-2 ring-border/20" 
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-xl">
              {lead.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground truncate">{lead.name}</h3>
            {lead.clinic_name && (
              <p className="text-xs text-muted-foreground truncate">{lead.clinic_name}</p>
            )}
            {lead.is_mql !== null && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium mt-1.5 ${
                lead.is_mql 
                  ? "bg-emerald-500/10 text-emerald-600" 
                  : "bg-amber-500/10 text-amber-600"
              }`}>
                <Sparkles className="w-3 h-3" />
                {lead.is_mql ? "Qualificado" : "Não Qualificado"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Contact Info */}
        <div className="space-y-2.5">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Contato</h4>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 text-sm text-foreground">
              <Mail className="w-3.5 h-3.5 text-muted-foreground/70" />
              <span className="truncate">{lead.email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-foreground">
              <Phone className="w-3.5 h-3.5 text-muted-foreground/70" />
              <span>{lead.country_code} {lead.whatsapp}</span>
            </div>
            {lead.instagram && (
              <a 
                href={`https://instagram.com/${lead.instagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-sm text-emerald-600 hover:underline"
              >
                <Instagram className="w-3.5 h-3.5 text-muted-foreground/70" />
                <span className="truncate">{lead.instagram}</span>
              </a>
            )}
          </div>
        </div>

        {/* Business Info */}
        {(lead.service_area || lead.workspace_type || lead.years_experience) && (
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Negócio</h4>
            <div className="space-y-1.5">
              {lead.service_area && (
                <div className="flex items-center gap-2.5 text-sm text-foreground">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground/70" />
                  <span>{lead.service_area}</span>
                </div>
              )}
              {lead.workspace_type && (
                <div className="flex items-center gap-2.5 text-sm text-foreground">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground/70" />
                  <span>{lead.workspace_type}</span>
                </div>
              )}
              {lead.years_experience && (
                <div className="flex items-center gap-2.5 text-sm text-foreground">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
                  <span>{lead.years_experience}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Financial Info */}
        {(lead.monthly_billing || lead.weekly_attendance || lead.average_ticket || lead.estimated_revenue) && (
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Financeiro</h4>
            <div className="space-y-1.5">
              {lead.monthly_billing && (
                <div className="flex items-center gap-2.5 text-sm text-foreground">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground/70" />
                  <span>{lead.monthly_billing}</span>
                </div>
              )}
              {lead.weekly_attendance && (
                <div className="flex items-center gap-2.5 text-sm text-foreground">
                  <Users className="w-3.5 h-3.5 text-muted-foreground/70" />
                  <span>{lead.weekly_attendance} atend./semana</span>
                </div>
              )}
              {lead.average_ticket && (
                <div className="flex items-center gap-2.5 text-sm text-foreground">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground/70" />
                  <span>Ticket: {formatCurrency(lead.average_ticket)}</span>
                </div>
              )}
              {lead.estimated_revenue && (
                <div className="flex items-center gap-2.5 text-sm">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-foreground font-medium">{formatCurrency(lead.estimated_revenue)}/mês</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Difficulty */}
        {lead.biggest_difficulty && (
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Dificuldade</h4>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {lead.biggest_difficulty}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border/10 text-xs text-muted-foreground flex items-center gap-1.5">
        <Calendar className="w-3 h-3" />
        <span>Cadastrado em {formatDate(lead.created_at)}</span>
      </div>
    </div>
  );
};

export default LeadInfoPanel;