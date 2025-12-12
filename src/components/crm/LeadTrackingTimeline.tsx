import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, PhoneOff, UserCheck, Webhook, Globe, Tag, ChevronDown, ChevronUp, Instagram, MessageCircle, Megaphone, Search, Link2, Mail, Smartphone } from "lucide-react";
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

// Identify traffic source from UTM data
const identifyTrafficSource = (utmData: UTMData): { 
  source: string; 
  type: 'instagram' | 'whatsapp' | 'facebook' | 'google' | 'tiktok' | 'email' | 'organic' | 'direct' | 'referral' | 'other';
  icon: React.ReactNode;
  color: string;
  description: string;
} => {
  const source = (utmData.utm_source || '').toLowerCase();
  const medium = (utmData.utm_medium || '').toLowerCase();

  // Instagram
  if (source.includes('instagram') || source.includes('ig') || source === 'insta') {
    const isAds = medium.includes('cpc') || medium.includes('paid') || medium.includes('ads') || medium.includes('pago');
    return {
      source: 'Instagram',
      type: 'instagram',
      icon: <Instagram className="h-4 w-4" />,
      color: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
      description: isAds ? 'Tráfego pago do Instagram Ads' : 'Tráfego orgânico do Instagram'
    };
  }

  // WhatsApp
  if (source.includes('whatsapp') || source.includes('wpp') || source === 'wa') {
    return {
      source: 'WhatsApp',
      type: 'whatsapp',
      icon: <MessageCircle className="h-4 w-4" />,
      color: 'bg-emerald-500 text-white',
      description: 'Tráfego via WhatsApp'
    };
  }

  // Facebook
  if (source.includes('facebook') || source.includes('fb')) {
    const isAds = medium.includes('cpc') || medium.includes('paid') || medium.includes('ads') || medium.includes('pago');
    return {
      source: 'Facebook',
      type: 'facebook',
      icon: <Globe className="h-4 w-4" />,
      color: 'bg-blue-600 text-white',
      description: isAds ? 'Tráfego pago do Facebook Ads' : 'Tráfego orgânico do Facebook'
    };
  }

  // Google
  if (source.includes('google')) {
    const isAds = medium.includes('cpc') || medium.includes('paid') || medium.includes('ads') || medium.includes('pago');
    return {
      source: 'Google',
      type: 'google',
      icon: <Search className="h-4 w-4" />,
      color: 'bg-red-500 text-white',
      description: isAds ? 'Tráfego pago do Google Ads' : 'Busca orgânica do Google'
    };
  }

  // TikTok
  if (source.includes('tiktok') || source.includes('tt')) {
    const isAds = medium.includes('cpc') || medium.includes('paid') || medium.includes('ads') || medium.includes('pago');
    return {
      source: 'TikTok',
      type: 'tiktok',
      icon: <Smartphone className="h-4 w-4" />,
      color: 'bg-black text-white',
      description: isAds ? 'Tráfego pago do TikTok Ads' : 'Tráfego orgânico do TikTok'
    };
  }

  // Email
  if (source.includes('email') || source.includes('newsletter') || medium.includes('email')) {
    return {
      source: 'Email',
      type: 'email',
      icon: <Mail className="h-4 w-4" />,
      color: 'bg-amber-500 text-white',
      description: 'Tráfego via campanha de email'
    };
  }

  // Generic Paid Traffic
  if (medium.includes('cpc') || medium.includes('paid') || medium.includes('ads') || medium.includes('pago')) {
    return {
      source: utmData.utm_source || 'Anúncios',
      type: 'other',
      icon: <Megaphone className="h-4 w-4" />,
      color: 'bg-orange-500 text-white',
      description: 'Tráfego pago'
    };
  }

  // Referral
  if (medium.includes('referral') || source) {
    return {
      source: utmData.utm_source || 'Referência',
      type: 'referral',
      icon: <Link2 className="h-4 w-4" />,
      color: 'bg-indigo-500 text-white',
      description: `Tráfego de ${utmData.utm_source || 'site externo'}`
    };
  }

  // Direct / Organic (no UTM)
  if (!utmData.utm_source && !utmData.utm_medium) {
    return {
      source: 'Direto / Orgânico',
      type: 'direct',
      icon: <Globe className="h-4 w-4" />,
      color: 'bg-gray-500 text-white',
      description: 'Acesso direto ou busca orgânica (sem parâmetros UTM)'
    };
  }

  return {
    source: utmData.utm_source || 'Desconhecido',
    type: 'other',
    icon: <Globe className="h-4 w-4" />,
    color: 'bg-gray-400 text-white',
    description: 'Origem não identificada'
  };
};

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

  const trafficSource = identifyTrafficSource(utmData);
  const hasUTMData = utmData.utm_source || utmData.utm_medium || utmData.utm_campaign || utmData.utm_term || utmData.utm_content;

  return (
    <div className="space-y-6">
      {/* Traffic Source Card - Full Width */}
      <Card className="border-[#00000010] shadow-none">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Origem do Tráfego
            </h3>
          </div>
          
          <div className="flex items-center gap-4 mb-4">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${trafficSource.color}`}>
              {trafficSource.icon}
            </div>
            <div>
              <p className="text-lg font-semibold">{trafficSource.source}</p>
              <p className="text-sm text-muted-foreground">{trafficSource.description}</p>
            </div>
          </div>

          {/* Campaign Details */}
          {(utmData.utm_campaign || utmData.utm_content || utmData.utm_term) && (
            <div className="mt-4 pt-4 border-t border-black/5 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detalhes da Campanha</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {utmData.utm_campaign && (
                  <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Campanha</p>
                    <p className="text-sm font-medium">{utmData.utm_campaign}</p>
                  </div>
                )}
                {utmData.utm_content && (
                  <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Criativo / Conjunto</p>
                    <p className="text-sm font-medium">{utmData.utm_content}</p>
                  </div>
                )}
                {utmData.utm_term && (
                  <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Termo / Palavra-chave</p>
                    <p className="text-sm font-medium">{utmData.utm_term}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* UTM Data Card */}
        <Card className="border-[#00000010] shadow-none">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Parâmetros UTM
              </h3>
            </div>
            
            {hasUTMData ? (
              <div className="space-y-3">
                {utmData.utm_source && (
                  <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <p className="text-xs text-muted-foreground">utm_source</p>
                    <p className="text-sm font-medium font-mono">{utmData.utm_source}</p>
                  </div>
                )}
                {utmData.utm_medium && (
                  <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <p className="text-xs text-muted-foreground">utm_medium</p>
                    <p className="text-sm font-medium font-mono">{utmData.utm_medium}</p>
                  </div>
                )}
                {utmData.utm_campaign && (
                  <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <p className="text-xs text-muted-foreground">utm_campaign</p>
                    <p className="text-sm font-medium font-mono">{utmData.utm_campaign}</p>
                  </div>
                )}
                {utmData.utm_term && (
                  <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <p className="text-xs text-muted-foreground">utm_term</p>
                    <p className="text-sm font-medium font-mono">{utmData.utm_term}</p>
                  </div>
                )}
                {utmData.utm_content && (
                  <div className="p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <p className="text-xs text-muted-foreground">utm_content</p>
                    <p className="text-sm font-medium font-mono">{utmData.utm_content}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-muted/20 rounded-lg border border-dashed border-black/10">
                <p className="text-sm text-muted-foreground text-center">
                  Nenhum parâmetro UTM registrado
                </p>
                <p className="text-xs text-muted-foreground/70 text-center mt-1">
                  Lead acessou diretamente ou via busca orgânica
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <div className="space-y-0">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6 px-4">
            Histórico de Atualizações
          </h3>
          
          {isLoading ? (
            <div className="space-y-4 px-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 animate-pulse py-6">
                  <div className="h-10 w-10 rounded-lg bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/4" />
                    <div className="h-3 bg-muted rounded w-2/3 mt-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="p-4 bg-muted/20 rounded-lg border border-dashed border-black/10 mx-4">
              <p className="text-sm text-muted-foreground text-center">Nenhuma atualização registrada</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical timeline line on left edge */}
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gray-200 rounded-full" />
              
              <div>
                {events.map((event, index) => (
                  <div key={event.id}>
                    {/* Event Item */}
                    <div className="relative flex gap-4 py-6 pl-8 pr-4 bg-white">
                      {/* Icon */}
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getIconBgColor(event.tipo)}`}>
                        {getIconForType(event.tipo)}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Title */}
                        <p className="text-sm font-semibold text-foreground">{event.titulo}</p>
                        
                        {/* Origin subtitle */}
                        {event.origem && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ORIGEM: <span className="font-medium">{event.origem}</span> <span className="mx-1 text-gray-400">&gt;</span> <span className="font-medium">LISTA GERAL</span>
                          </p>
                        )}
                        
                        {/* Description */}
                        {event.descricao && (
                          <p className="text-sm text-foreground mt-3">
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
                              <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs overflow-x-auto border border-gray-100">
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
                              locale: ptBR
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Separator line between items */}
                    {index < events.length - 1 && (
                      <div className="border-b border-gray-100 ml-8" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
