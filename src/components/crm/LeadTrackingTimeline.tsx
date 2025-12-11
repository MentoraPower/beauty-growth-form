import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, PhoneOff, UserCheck, Webhook, Globe, Tag, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface LeadTrackingTimelineProps {
  leadId: string;
  utmData: UTMData;
}

const getIconForType = (tipo: string) => {
  switch (tipo) {
    case "chamada_recusada":
      return <PhoneOff className="h-4 w-4" />;
    case "mudou_usuario":
      return <UserCheck className="h-4 w-4" />;
    case "webhook":
      return <Webhook className="h-4 w-4" />;
    case "mudou_pipeline":
      return <Tag className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getIconBgColor = (tipo: string) => {
  switch (tipo) {
    case "chamada_recusada":
      return "bg-red-100 text-red-600";
    case "mudou_usuario":
      return "bg-pink-100 text-pink-600";
    case "webhook":
      return "bg-indigo-100 text-indigo-600";
    case "mudou_pipeline":
      return "bg-blue-100 text-blue-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

export function LeadTrackingTimeline({ leadId, utmData }: LeadTrackingTimelineProps) {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();

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
  }, [leadId]);

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

  const hasUTMData = utmData.utm_source || utmData.utm_medium || utmData.utm_campaign || utmData.utm_term || utmData.utm_content;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* UTM Data Card */}
      <Card className="border-[#00000010] shadow-none">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Dados UTM
            </h3>
          </div>
          
          {hasUTMData ? (
            <div className="space-y-3">
              {utmData.utm_source && (
                <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="text-sm font-medium">{utmData.utm_source}</p>
                </div>
              )}
              {utmData.utm_medium && (
                <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                  <p className="text-xs text-muted-foreground">Medium</p>
                  <p className="text-sm font-medium">{utmData.utm_medium}</p>
                </div>
              )}
              {utmData.utm_campaign && (
                <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                  <p className="text-xs text-muted-foreground">Campaign</p>
                  <p className="text-sm font-medium">{utmData.utm_campaign}</p>
                </div>
              )}
              {utmData.utm_term && (
                <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                  <p className="text-xs text-muted-foreground">Term</p>
                  <p className="text-sm font-medium">{utmData.utm_term}</p>
                </div>
              )}
              {utmData.utm_content && (
                <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                  <p className="text-xs text-muted-foreground">Content</p>
                  <p className="text-sm font-medium">{utmData.utm_content}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Nenhum dado UTM registrado</p>
          )}
        </CardContent>
      </Card>

      {/* Timeline Card */}
      <Card className="border-[#00000010] shadow-none">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Histórico de Atualizações
          </h3>
          
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhuma atualização registrada</p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
              
              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="relative flex gap-4">
                    {/* Icon */}
                    <div className={`relative z-10 h-10 w-10 rounded-full flex items-center justify-center ${getIconBgColor(event.tipo)}`}>
                      {getIconForType(event.tipo)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="bg-muted/30 border border-[#00000010] rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium">{event.titulo}</p>
                            {event.origem && (
                              <p className="text-xs text-muted-foreground">
                                ORIGEM: {event.origem}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {event.descricao && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {event.descricao}
                          </p>
                        )}
                        
                        {event.dados && typeof event.dados === 'object' && Object.keys(event.dados as object).length > 0 && (
                          <div className="mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
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
                              <pre className="mt-2 p-2 bg-muted/50 rounded text-xs overflow-x-auto">
                                {JSON.stringify(event.dados, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatDistanceToNow(new Date(event.created_at), {
                              addSuffix: true,
                              locale: ptBR
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
