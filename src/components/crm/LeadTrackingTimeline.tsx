import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, PhoneOff, UserCheck, Webhook, Globe, ChevronDown, ChevronUp, ArrowRight, ListOrdered, MoveRight, UserPlus, FileText, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface TrackingEvent {
  id: string;
  lead_id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  origem: string | null;
  dados: unknown;
  created_at: string;
}

interface UTMData {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
}

interface OtherOriginLead {
  id: string;
  name: string;
  sub_origin_id: string | null;
  sub_origin_name: string;
  origin_name: string;
  pipeline_name: string | null;
  created_at: string;
}

interface LeadTrackingTimelineProps {
  leadId: string;
  utmData: UTMData;
  leadEmail?: string;
  leadWhatsapp?: string;
}

const getIconForType = (tipo: string) => {
  switch (tipo) {
    case "chamada_recusada":
      return <PhoneOff className="h-5 w-5" />;
    case "mudou_usuario":
      return <UserCheck className="h-5 w-5" />;
    case "webhook":
      return <Webhook className="h-5 w-5" />;
    case "mudou_pipeline":
      return <MoveRight className="h-5 w-5" />;
    case "mudou_posicao":
      return <ListOrdered className="h-5 w-5" />;
    case "cadastro":
      return <UserPlus className="h-5 w-5" />;
    case "formulario":
      return <FileText className="h-5 w-5" />;
    default:
      return <ListOrdered className="h-5 w-5" />;
  }
};

const getIconColors = (tipo: string): { bg: string; text: string } => {
  switch (tipo) {
    case "chamada_recusada":
      return { bg: "bg-red-500", text: "text-white" };
    case "mudou_usuario":
      return { bg: "bg-pink-500", text: "text-white" };
    case "webhook":
      return { bg: "bg-indigo-500", text: "text-white" };
    case "mudou_pipeline":
      return { bg: "bg-violet-500", text: "text-white" };
    case "mudou_posicao":
      return { bg: "bg-violet-500", text: "text-white" };
    case "cadastro":
      return { bg: "bg-emerald-500", text: "text-white" };
    case "formulario":
      return { bg: "bg-blue-500", text: "text-white" };
    default:
      return { bg: "bg-violet-500", text: "text-white" };
  }
};

export function LeadTrackingTimeline({ leadId, utmData, leadEmail, leadWhatsapp }: LeadTrackingTimelineProps) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [otherOriginLeads, setOtherOriginLeads] = useState<OtherOriginLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
    fetchOtherOriginLeads();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('lead-tracking-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_tracking',
          filter: `lead_id=eq.${leadId}`
        },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, leadEmail, leadWhatsapp]);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from("lead_tracking")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tracking events:", error);
    } else {
      setEvents(data || []);
    }
    setIsLoading(false);
  };

  const fetchOtherOriginLeads = async () => {
    if (!leadEmail && !leadWhatsapp) return;

    // Build query to find leads with same email or whatsapp but different ID
    let query = supabase
      .from("leads")
      .select(`
        id,
        name,
        sub_origin_id,
        pipeline_id,
        created_at,
        crm_sub_origins!inner (
          id,
          nome,
          crm_origins!inner (
            nome
          )
        ),
        pipelines (
          nome
        )
      `)
      .neq("id", leadId);

    // Check for email match (excluding temp emails)
    if (leadEmail && !leadEmail.includes("incompleto_") && !leadEmail.includes("@temp.com")) {
      query = query.eq("email", leadEmail);
    } else if (leadWhatsapp) {
      query = query.eq("whatsapp", leadWhatsapp);
    } else {
      return;
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching other origin leads:", error);
      return;
    }

    if (data && data.length > 0) {
      const mappedLeads: OtherOriginLead[] = data.map((lead: any) => ({
        id: lead.id,
        name: lead.name,
        sub_origin_id: lead.sub_origin_id,
        sub_origin_name: lead.crm_sub_origins?.nome || "Desconhecido",
        origin_name: lead.crm_sub_origins?.crm_origins?.nome || "Desconhecido",
        pipeline_name: lead.pipelines?.nome || null,
        created_at: lead.created_at,
      }));
      setOtherOriginLeads(mappedLeads);
    }
  };

  const hasUTMData = utmData.utm_source || utmData.utm_medium || utmData.utm_campaign || utmData.utm_term || utmData.utm_content;

  // Prepare UTM items for timeline
  const utmItems = [];
  if (utmData.utm_source) utmItems.push({ label: 'utm_source', value: utmData.utm_source });
  if (utmData.utm_medium) utmItems.push({ label: 'utm_medium', value: utmData.utm_medium });
  if (utmData.utm_campaign) utmItems.push({ label: 'utm_campaign', value: utmData.utm_campaign });
  if (utmData.utm_term) utmItems.push({ label: 'utm_term', value: utmData.utm_term });
  if (utmData.utm_content) utmItems.push({ label: 'utm_content', value: utmData.utm_content });

  // Check if there's content below the "other origins" item
  const hasContentBelow = hasUTMData || events.length > 0;

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Histórico de Rastreamento
      </h3>
      
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-lg bg-muted flex-shrink-0" />
                <div className="flex-1 bg-muted rounded-lg h-24" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative">
          {/* Other Origins - First in Timeline */}
          {otherOriginLeads.length > 0 && (
            <div className="relative flex">
              {/* Left side - Icon and vertical line */}
              <div className="flex flex-col items-center mr-4">
                {/* Icon */}
                <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500 text-white shadow-md z-10">
                  <Users className="h-5 w-5" />
                </div>
                
                {/* Vertical line */}
                {hasContentBelow && (
                  <div className="w-0.5 flex-1 bg-gray-200 my-2" />
                )}
              </div>
              
              {/* Right side - Card content */}
              <div className="flex-1 pb-6">
                <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold text-amber-900">Lead existe em outras origens</p>
                    <p className="text-xs text-amber-700 mb-3">
                      Encontrado em {otherOriginLeads.length} {otherOriginLeads.length === 1 ? 'outra origem' : 'outras origens'}
                    </p>
                    
                    <div className="space-y-2">
                      {otherOriginLeads.map((otherLead) => (
                        <button
                          key={otherLead.id}
                          onClick={() => navigate(`/admin/crm/${otherLead.id}?origin=${otherLead.sub_origin_id}&tab=rastreamento`)}
                          className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-amber-200 hover:bg-amber-100 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-amber-900 truncate">
                                {otherLead.origin_name}
                              </span>
                              <ArrowRight className="h-3 w-3 text-amber-500 flex-shrink-0" />
                              <span className="text-xs font-medium text-amber-900 truncate">
                                {otherLead.sub_origin_name}
                              </span>
                            </div>
                            {otherLead.pipeline_name && (
                              <Badge variant="outline" className="mt-1 text-[10px] h-5 bg-amber-100 border-amber-300 text-amber-800">
                                {otherLead.pipeline_name}
                              </Badge>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 text-amber-600 flex-shrink-0 ml-2" />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* UTM Parameters Card */}
          {hasUTMData && (
            <div className="relative flex">
              {/* Left side - Icon and vertical line */}
              <div className="flex flex-col items-center mr-4">
                {/* Icon */}
                <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-500 text-white shadow-md z-10">
                  <Globe className="h-5 w-5" />
                </div>
                
                {/* Vertical line */}
                {events.length > 0 && (
                  <div className="w-0.5 flex-1 bg-gray-200 my-2" />
                )}
              </div>
              
              {/* Right side - UTM Card content */}
              <div className="flex-1 pb-6">
                <Card className="border-[#00000010] shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold text-foreground mb-3">Parâmetros UTM</p>
                    
                    <div className="space-y-2">
                      {utmItems.map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-24">{item.label}</span>
                          <span className="text-xs font-medium font-mono bg-muted/50 px-2 py-1 rounded">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* No UTM and no events */}
          {!hasUTMData && events.length === 0 && (
            <div className="p-4 bg-muted/20 rounded-lg border border-dashed border-black/10">
              <p className="text-sm text-muted-foreground text-center">Nenhum rastreamento registrado</p>
            </div>
          )}

          {/* Timeline Events */}
          {events.map((event, index) => {
            const iconColors = getIconColors(event.tipo);
            const isLast = index === events.length - 1;
            
            return (
              <div key={event.id} className="relative flex">
                {/* Left side - Icon and vertical line */}
                <div className="flex flex-col items-center mr-4">
                  {/* Icon */}
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColors.bg} ${iconColors.text} shadow-md z-10`}>
                    {getIconForType(event.tipo)}
                  </div>
                  
                  {/* Vertical line */}
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-gray-200 my-2" />
                  )}
                </div>
                
                {/* Right side - Card content */}
                <div className="flex-1 pb-6">
                  <Card className="border-[#00000010] shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      {/* Title */}
                      <p className="text-sm font-semibold text-foreground">{event.titulo}</p>
                      
                      {/* Origin breadcrumb */}
                      {event.origem && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wide flex items-center gap-1">
                          ORIGEM: <span className="font-semibold text-foreground">{event.origem.toUpperCase()}</span> 
                          <ArrowRight className="h-3 w-3" /> 
                          <span className="font-semibold text-foreground">{event.origem.toUpperCase()}</span>
                        </p>
                      )}
                      
                      {/* Description */}
                      {event.descricao && (
                        <p className="text-sm text-muted-foreground mt-3">
                          {event.descricao}
                        </p>
                      )}
                      
                      {/* Expandable data */}
                      {event.dados && typeof event.dados === 'object' && Object.keys(event.dados as object).length > 0 && (
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs border-gray-200"
                            onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                          >
                            {expandedEvent === event.id ? (
                              <>
                                <ChevronUp className="h-3 w-3 mr-1" />
                                Ocultar dados
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3 mr-1" />
                                Mostrar dados
                              </>
                            )}
                          </Button>
                          
                          {expandedEvent === event.id && (
                            <pre className="mt-2 p-3 bg-muted/50 rounded-lg text-xs overflow-x-auto border border-[#00000010]">
                              {JSON.stringify(event.dados, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                      
                      {/* Timestamp */}
                      <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(event.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LeadTrackingTimeline;
