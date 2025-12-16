import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Mail, Phone, Instagram, Building2, Calendar, DollarSign, Users, MapPin, Clock, TrendingUp, ExternalLink, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

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

  const defaultAvatar = "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp_default_profile_photo.png";

  if (!lead) {
    return (
      <div className="w-96 border-l border-border/20 bg-gradient-to-b from-card to-muted/20 flex flex-col items-center justify-center p-8 text-center">
        <img 
          src={photoUrl || defaultAvatar} 
          alt={contactName || "Contato"} 
          className="w-24 h-24 rounded-full object-cover mb-4 ring-4 ring-muted/30" 
        />
        <p className="text-lg font-semibold text-foreground">{contactName || phone}</p>
        <p className="text-sm text-muted-foreground mt-2">Este contato não está no CRM</p>
        <button className="mt-6 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors">
          Criar lead
        </button>
      </div>
    );
  }

  return (
    <div className="w-96 border-l border-border/20 bg-gradient-to-b from-card to-muted/10 flex flex-col overflow-hidden">
      {/* Header with Photo */}
      <div className="relative">
        <div className="h-20 bg-gradient-to-r from-emerald-500/20 to-emerald-600/10" />
        <div className="px-6 pb-4 -mt-10">
          <div className="flex items-end gap-4">
            <img 
              src={displayPhoto || defaultAvatar} 
              alt={lead.name} 
              className="w-20 h-20 rounded-2xl object-cover ring-4 ring-card shadow-lg" 
            />
            <div className="flex-1 min-w-0 pb-1">
              {lead.clinic_name && (
                <p className="text-xs text-muted-foreground truncate uppercase tracking-wide">{lead.clinic_name}</p>
              )}
              <h3 className="text-lg font-bold text-foreground truncate">{lead.name}</h3>
            </div>
          </div>
          
          {/* MQL Badge */}
          {lead.is_mql !== null && (
            <div className="mt-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                lead.is_mql 
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" 
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
                {lead.is_mql ? "Lead Qualificado" : "Não Qualificado"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {/* Contact Info */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <div className="w-1 h-4 bg-emerald-500 rounded-full" />
            Contato
          </h4>
          
          <div className="space-y-2.5 pl-3">
            <div className="flex items-center gap-3 text-sm group">
              <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                <Mail className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600" />
              </div>
              <span className="truncate text-foreground">{lead.email}</span>
            </div>
            
            <div className="flex items-center gap-3 text-sm group">
              <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                <Phone className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600" />
              </div>
              <span className="text-foreground">{lead.country_code} {lead.whatsapp}</span>
            </div>
            
            {lead.instagram && (
              <a 
                href={`https://instagram.com/${lead.instagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm group"
              >
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-pink-500/10 transition-colors">
                  <Instagram className="w-4 h-4 text-muted-foreground group-hover:text-pink-600" />
                </div>
                <span className="text-emerald-600 hover:underline truncate">{lead.instagram}</span>
              </a>
            )}
          </div>
        </div>

        {/* Business Info */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <div className="w-1 h-4 bg-blue-500 rounded-full" />
            Negócio
          </h4>
          
          <div className="space-y-2.5 pl-3">
            {lead.service_area && (
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="text-foreground">{lead.service_area}</span>
              </div>
            )}
            
            {lead.workspace_type && (
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="text-foreground">{lead.workspace_type}</span>
              </div>
            )}
            
            {lead.years_experience && (
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="text-foreground">{lead.years_experience} de experiência</span>
              </div>
            )}
          </div>
        </div>

        {/* Financial Info */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <div className="w-1 h-4 bg-amber-500 rounded-full" />
            Financeiro
          </h4>
          
          <div className="space-y-2.5 pl-3">
            {lead.monthly_billing && (
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="text-foreground">{lead.monthly_billing}</span>
              </div>
            )}
            
            {lead.weekly_attendance && (
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                  <Users className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="text-foreground">{lead.weekly_attendance} atend./semana</span>
              </div>
            )}
            
            {lead.average_ticket && (
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="text-foreground">Ticket: {formatCurrency(lead.average_ticket)}</span>
              </div>
            )}
            
            {lead.estimated_revenue && (
              <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Receita Estimada</span>
                  <span className="text-foreground font-bold">{formatCurrency(lead.estimated_revenue)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Difficulty */}
        {lead.biggest_difficulty && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <div className="w-1 h-4 bg-red-500 rounded-full" />
              Maior Dificuldade
            </h4>
            <p className="text-sm text-foreground bg-muted/30 rounded-xl p-3 leading-relaxed ml-3">
              {lead.biggest_difficulty}
            </p>
          </div>
        )}

        {/* Registration Date */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-3 border-t border-border/30 ml-3">
          <Calendar className="w-3.5 h-3.5" />
          <span>Cadastrado em {formatDate(lead.created_at)}</span>
        </div>
      </div>

    </div>
  );
};

export default LeadInfoPanel;