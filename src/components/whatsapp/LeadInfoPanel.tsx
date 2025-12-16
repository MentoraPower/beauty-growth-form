import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Mail, Phone, Instagram, Building2, Calendar, DollarSign, Users, MapPin, Clock, TrendingUp, ExternalLink } from "lucide-react";
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
}

interface LeadInfoPanelProps {
  phone: string;
  onClose?: () => void;
}

const LeadInfoPanel = ({ phone, onClose }: LeadInfoPanelProps) => {
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
      
      setLead(data);
      setIsLoading(false);
    };

    fetchLead();
  }, [phone]);

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

  if (isLoading) {
    return (
      <div className="w-72 border-l border-border/30 bg-card/50 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Buscando lead...</div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="w-72 border-l border-border/30 bg-card/50 flex flex-col items-center justify-center p-6 text-center">
        <User className="w-12 h-12 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Nenhum lead encontrado</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Este contato não está no CRM</p>
      </div>
    );
  }

  return (
    <div className="w-72 border-l border-border/30 bg-card/50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-semibold text-lg">
            {lead.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{lead.name}</h3>
            {lead.clinic_name && (
              <p className="text-xs text-muted-foreground truncate">{lead.clinic_name}</p>
            )}
          </div>
        </div>
        
        {/* MQL Badge */}
        {lead.is_mql !== null && (
          <div className="mt-3">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              lead.is_mql 
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            }`}>
              <TrendingUp className="w-3 h-3" />
              {lead.is_mql ? "MQL Qualificado" : "Não MQL"}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Contact Info */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato</h4>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate text-foreground">{lead.email}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">{lead.country_code} {lead.whatsapp}</span>
            </div>
            
            {lead.instagram && (
              <div className="flex items-center gap-2 text-sm">
                <Instagram className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <a 
                  href={`https://instagram.com/${lead.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:underline truncate"
                >
                  {lead.instagram}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Business Info */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Negócio</h4>
          
          <div className="space-y-2">
            {lead.service_area && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="text-foreground">{lead.service_area}</span>
              </div>
            )}
            
            {lead.workspace_type && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">{lead.workspace_type}</span>
              </div>
            )}
            
            {lead.years_experience && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">{lead.years_experience} de experiência</span>
              </div>
            )}
          </div>
        </div>

        {/* Financial Info */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Financeiro</h4>
          
          <div className="space-y-2">
            {lead.monthly_billing && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">Faturamento: {lead.monthly_billing}</span>
              </div>
            )}
            
            {lead.weekly_attendance && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">{lead.weekly_attendance} atend./semana</span>
              </div>
            )}
            
            {lead.average_ticket && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">Ticket: {formatCurrency(lead.average_ticket)}</span>
              </div>
            )}
            
            {lead.estimated_revenue && (
              <div className="flex items-center gap-2 text-sm bg-muted/30 rounded-md p-2">
                <TrendingUp className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <div>
                  <span className="text-xs text-muted-foreground block">Receita Estimada</span>
                  <span className="text-foreground font-medium">{formatCurrency(lead.estimated_revenue)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Difficulty */}
        {lead.biggest_difficulty && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Maior Dificuldade</h4>
            <p className="text-sm text-foreground bg-muted/20 rounded-md p-2 leading-relaxed">
              {lead.biggest_difficulty}
            </p>
          </div>
        )}

        {/* Registration Date */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/30">
          <Calendar className="w-3 h-3" />
          <span>Cadastrado em {formatDate(lead.created_at)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border/30 bg-muted/20">
        <button
          onClick={() => navigate(`/admin/crm/${lead.id}`)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Ver no CRM
        </button>
      </div>
    </div>
  );
};

export default LeadInfoPanel;
