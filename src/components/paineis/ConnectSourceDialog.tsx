import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Folder, FolderOpen, Facebook, ChevronRight, ArrowLeft, Users, UserPlus, UserMinus, TrendingUp, Globe, Target, Megaphone, FormInput } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChartType } from "./ChartSelectorDialog";

interface SubOrigin {
  id: string;
  nome: string;
  origin_id: string;
}

interface Origin {
  id: string;
  nome: string;
}

interface CustomField {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  sub_origin_id: string;
  options?: any;
}

export interface WidgetSource {
  type: 'origin' | 'sub_origin' | 'facebook_ads' | 'tracking_grupo_entrada' | 'tracking_grupo_saida' | 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_all' | 'custom_field';
  sourceId?: string;
  sourceName?: string;
  customFieldId?: string;
  customFieldLabel?: string;
  credentials?: {
    appId?: string;
    appSecret?: string;
    accessToken?: string;
  };
}

interface ConnectSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedChart: ChartType | null;
  onConnect: (source: WidgetSource) => void;
}

type Step = 'sources' | 'origins' | 'sub_origins' | 'facebook_form' | 'tracking' | 'tracking_origins' | 'tracking_sub_origins' | 'utm_options' | 'utm_origins' | 'utm_sub_origins' | 'custom_fields_origins' | 'custom_fields_sub_origins' | 'custom_fields_select';

export function ConnectSourceDialog({ 
  open, 
  onOpenChange, 
  selectedChart,
  onConnect 
}: ConnectSourceDialogProps) {
  const [step, setStep] = useState<Step>('sources');
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [subOrigins, setSubOrigins] = useState<SubOrigin[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<Origin | null>(null);
  const [selectedSubOrigin, setSelectedSubOrigin] = useState<SubOrigin | null>(null);
  const [selectedTrackingType, setSelectedTrackingType] = useState<'grupo_entrada' | 'grupo_saida' | null>(null);
  const [selectedUtmType, setSelectedUtmType] = useState<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_all' | null>(null);
  
  // Facebook Ads connections state
  const [fbConnections, setFbConnections] = useState<
    { id: string; ad_account_name: string | null; ad_account_id: string; selected_campaigns: any }[]
  >([]);
  const [selectedFbConnectionId, setSelectedFbConnectionId] = useState<string>("");
  const [isFbConnectionsLoading, setIsFbConnectionsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('sources');
      setSelectedOrigin(null);
      setSelectedSubOrigin(null);
      setSelectedTrackingType(null);
      setSelectedUtmType(null);
      setCustomFields([]);
      setFbConnections([]);
      setSelectedFbConnectionId("");
      return;
    }

    const fetchData = async () => {
      const [originsRes, subOriginsRes] = await Promise.all([
        supabase.from("crm_origins").select("*").order("ordem"),
        supabase.from("crm_sub_origins").select("*").order("ordem"),
      ]);

      if (originsRes.data) setOrigins(originsRes.data);
      if (subOriginsRes.data) setSubOrigins(subOriginsRes.data);

      // Load existing Facebook Ads connections (created in Integrações)
      setIsFbConnectionsLoading(true);
      try {
        const { data: connections } = await supabase
          .from('facebook_ads_connections')
          .select('id, ad_account_name, ad_account_id, selected_campaigns')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        setFbConnections((connections || []) as any);
      } finally {
        setIsFbConnectionsLoading(false);
      }
    };

    fetchData();
  }, [open]);

  const getSubOriginsForOrigin = (originId: string) => {
    return subOrigins.filter((so) => so.origin_id === originId);
  };

  const fetchCustomFieldsForSubOrigin = async (subOriginId: string) => {
    const { data } = await supabase
      .from("sub_origin_custom_fields")
      .select("*")
      .eq("sub_origin_id", subOriginId)
      .order("ordem");
    
    if (data) {
      setCustomFields(data);
    }
  };

  const handleBack = () => {
    if (step === 'origins' || step === 'facebook_form' || step === 'tracking' || step === 'utm_options' || step === 'custom_fields_origins') {
      setStep('sources');
    } else if (step === 'sub_origins') {
      setStep('origins');
      setSelectedOrigin(null);
    } else if (step === 'tracking_origins') {
      setStep('tracking');
    } else if (step === 'tracking_sub_origins') {
      setStep('tracking_origins');
      setSelectedOrigin(null);
    } else if (step === 'utm_origins') {
      setStep('utm_options');
    } else if (step === 'utm_sub_origins') {
      setStep('utm_origins');
      setSelectedOrigin(null);
    } else if (step === 'custom_fields_sub_origins') {
      setStep('custom_fields_origins');
      setSelectedOrigin(null);
    } else if (step === 'custom_fields_select') {
      setStep('custom_fields_sub_origins');
      setSelectedSubOrigin(null);
      setCustomFields([]);
    }
  };

  const handleSelectOrigin = (origin: Origin) => {
    const subs = getSubOriginsForOrigin(origin.id);
    if (subs.length > 0) {
      setSelectedOrigin(origin);
      setStep('sub_origins');
    } else {
      // Connect directly to origin if no sub-origins
      onConnect({
        type: 'origin',
        sourceId: origin.id,
        sourceName: origin.nome,
      });
      onOpenChange(false);
    }
  };

  const handleSelectSubOrigin = (subOrigin: SubOrigin) => {
    onConnect({
      type: 'sub_origin',
      sourceId: subOrigin.id,
      sourceName: subOrigin.nome,
    });
    onOpenChange(false);
  };

  const handleConnectFacebook = () => {
    if (!selectedFbConnectionId) return;

    const connection = fbConnections.find((c) => c.id === selectedFbConnectionId);
    if (!connection) return;

    onConnect({
      type: 'facebook_ads',
      sourceId: connection.id,
      sourceName: `Facebook Ads - ${connection.ad_account_name || connection.ad_account_id}`,
    });
    onOpenChange(false);
  };

  const handleSelectTracking = (trackingType: 'grupo_entrada' | 'grupo_saida') => {
    setSelectedTrackingType(trackingType);
    setStep('tracking_origins');
  };

  const handleSelectTrackingOrigin = (origin: Origin) => {
    const subs = getSubOriginsForOrigin(origin.id);
    if (subs.length > 0) {
      setSelectedOrigin(origin);
      setStep('tracking_sub_origins');
    }
  };

  const handleSelectTrackingSubOrigin = (subOrigin: SubOrigin) => {
    const sourceName = selectedTrackingType === 'grupo_entrada' 
      ? `Entradas - ${subOrigin.nome}` 
      : `Saídas - ${subOrigin.nome}`;
    onConnect({
      type: selectedTrackingType === 'grupo_entrada' ? 'tracking_grupo_entrada' : 'tracking_grupo_saida',
      sourceId: subOrigin.id,
      sourceName,
    });
    onOpenChange(false);
  };

  const handleSelectUtmType = (utmType: 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_all') => {
    setSelectedUtmType(utmType);
    setStep('utm_origins');
  };

  const handleSelectUtmOrigin = (origin: Origin) => {
    const subs = getSubOriginsForOrigin(origin.id);
    if (subs.length > 0) {
      setSelectedOrigin(origin);
      setStep('utm_sub_origins');
    }
  };

  const handleSelectUtmSubOrigin = (subOrigin: SubOrigin) => {
    const utmLabels: Record<string, string> = {
      'utm_source': 'UTM Source',
      'utm_medium': 'UTM Medium',
      'utm_campaign': 'UTM Campaign',
      'utm_all': 'Todas as UTMs',
    };
    const sourceName = `${utmLabels[selectedUtmType || 'utm_all']} - ${subOrigin.nome}`;
    onConnect({
      type: selectedUtmType || 'utm_all',
      sourceId: subOrigin.id,
      sourceName,
    });
    onOpenChange(false);
  };

  const renderContent = () => {
    switch (step) {
      case 'sources':
        return (
          <div className="space-y-3 py-4">
            {/* Origins option */}
            <button
              onClick={() => setStep('origins')}
              className="w-full flex items-center gap-4 p-4 bg-white border border-border rounded-xl text-left transition-all duration-200 hover:shadow-md hover:border-foreground/20"
            >
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <Folder className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-foreground">Origens do CRM</h3>
                <p className="text-xs text-muted-foreground">Conecte leads e agendamentos das suas origens</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            {/* Tracking option */}
            <button
              onClick={() => setStep('tracking')}
              className="w-full flex items-center gap-4 p-4 bg-white border border-border rounded-xl text-left transition-all duration-200 hover:shadow-md hover:border-foreground/20"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-foreground">Rastreamento de Grupos</h3>
                <p className="text-xs text-muted-foreground">Entradas e saídas de leads em grupos</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            {/* UTM Tracking option */}
            <button
              onClick={() => setStep('utm_options')}
              className="w-full flex items-center gap-4 p-4 bg-white border border-border rounded-xl text-left transition-all duration-200 hover:shadow-md hover:border-foreground/20"
            >
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-violet-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-foreground">UTMs e Tráfego</h3>
                <p className="text-xs text-muted-foreground">Orgânico, pago e campanhas por UTM</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            {/* Custom Fields option */}
            <button
              onClick={() => setStep('custom_fields_origins')}
              className="w-full flex items-center gap-4 p-4 bg-white border border-border rounded-xl text-left transition-all duration-200 hover:shadow-md hover:border-foreground/20"
            >
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <FormInput className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-foreground">Campos Personalizados</h3>
                <p className="text-xs text-muted-foreground">Respostas por campo personalizado</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            <div className="relative py-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground">
                  Integrações externas
                </span>
              </div>
            </div>

            {/* Facebook Ads option */}
            <button
              onClick={() => setStep('facebook_form')}
              className="w-full flex items-center gap-4 p-4 bg-white border border-border rounded-xl text-left transition-all duration-200 hover:shadow-md hover:border-foreground/20"
            >
              <div className="w-12 h-12 rounded-xl bg-[#1877F2]/10 flex items-center justify-center">
                <Facebook className="h-6 w-6 text-[#1877F2]" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-foreground">Conectar com Facebook Ads</h3>
                <p className="text-xs text-muted-foreground">Puxe métricas de campanhas em tempo real</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        );

      case 'origins':
        return (
          <div className="space-y-2 py-4">
            {origins.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma origem encontrada. Crie origens no CRM primeiro.
              </p>
            ) : (
              origins.map((origin) => (
                <button
                  key={origin.id}
                  onClick={() => handleSelectOrigin(origin)}
                  className="w-full flex items-center gap-3 p-3 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-foreground/20"
                >
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-foreground">{origin.nome}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        );

      case 'sub_origins':
        const subOriginsForOrigin = selectedOrigin ? getSubOriginsForOrigin(selectedOrigin.id) : [];
        return (
          <div className="space-y-2 py-4">
            <p className="text-xs text-muted-foreground mb-3">
              Sub-origens de <strong>{selectedOrigin?.nome}</strong>
            </p>
            {subOriginsForOrigin.map((subOrigin) => (
              <button
                key={subOrigin.id}
                onClick={() => handleSelectSubOrigin(subOrigin)}
                className="w-full flex items-center gap-3 p-3 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-foreground/20"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="flex-1 text-sm font-medium text-foreground">{subOrigin.nome}</span>
              </button>
            ))}
          </div>
        );

      case 'facebook_form':
        return (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 bg-[#1877F2]/5 border border-[#1877F2]/20 rounded-xl">
              <Facebook className="h-8 w-8 text-[#1877F2]" />
              <div>
                <h3 className="text-sm font-medium text-foreground">Facebook Ads</h3>
                <p className="text-xs text-muted-foreground">
                  Selecione uma integração já conectada em <strong>Integrações</strong>
                </p>
              </div>
            </div>

            {isFbConnectionsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Carregando conexões...</p>
            ) : fbConnections.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma conexão encontrada. Abra <strong>Integrações</strong> e conecte o Facebook Ads primeiro.
              </p>
            ) : (
              <div className="space-y-2">
                {fbConnections.map((c) => {
                  const isSelected = selectedFbConnectionId === c.id;
                  const campaignsCount = Array.isArray(c.selected_campaigns) ? c.selected_campaigns.length : 0;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedFbConnectionId(c.id)}
                      className={`w-full flex items-center justify-between gap-3 p-3 border rounded-lg text-left transition-all duration-200 ${
                        isSelected
                          ? 'border-[#1877F2] bg-[#1877F2]/5'
                          : 'bg-white border-border hover:bg-muted/30 hover:border-foreground/20'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {c.ad_account_name || c.ad_account_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {campaignsCount} campanha(s) selecionada(s)
                        </p>
                      </div>
                      <div className={`h-3 w-3 rounded-full ${isSelected ? 'bg-[#1877F2]' : 'bg-muted'}`} />
                    </button>
                  );
                })}
              </div>
            )}

            <Button
              onClick={handleConnectFacebook}
              disabled={!selectedFbConnectionId}
              className="w-full h-11 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
            >
              Conectar Facebook Ads
            </Button>
          </div>
        );

      case 'tracking':
        return (
          <div className="space-y-3 py-4">
            <p className="text-xs text-muted-foreground mb-3">
              Selecione o tipo de rastreamento
            </p>
            
            {/* Entradas em Grupo */}
            <button
              onClick={() => handleSelectTracking('grupo_entrada')}
              className="w-full flex items-center gap-3 p-4 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-emerald-500/30"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-foreground">Entradas em Grupo</span>
                <p className="text-xs text-muted-foreground">Quantidade de leads que entraram em grupos</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Saídas de Grupo */}
            <button
              onClick={() => handleSelectTracking('grupo_saida')}
              className="w-full flex items-center gap-3 p-4 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-red-500/30"
            >
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <UserMinus className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-foreground">Saídas de Grupo</span>
                <p className="text-xs text-muted-foreground">Quantidade de leads que saíram de grupos</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        );

      case 'tracking_origins':
        return (
          <div className="space-y-2 py-4">
            <div className={`flex items-center gap-2 p-3 rounded-lg mb-3 ${
              selectedTrackingType === 'grupo_entrada' ? 'bg-emerald-500/10' : 'bg-red-500/10'
            }`}>
              {selectedTrackingType === 'grupo_entrada' ? (
                <UserPlus className="h-4 w-4 text-emerald-600" />
              ) : (
                <UserMinus className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm font-medium">
                {selectedTrackingType === 'grupo_entrada' ? 'Entradas em Grupo' : 'Saídas de Grupo'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Selecione a origem
            </p>
            {origins.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma origem encontrada.
              </p>
            ) : (
              origins.map((origin) => {
                const subs = getSubOriginsForOrigin(origin.id);
                if (subs.length === 0) return null;
                return (
                  <button
                    key={origin.id}
                    onClick={() => handleSelectTrackingOrigin(origin)}
                    className="w-full flex items-center gap-3 p-3 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-foreground/20"
                  >
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-foreground">{origin.nome}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })
            )}
          </div>
        );

      case 'utm_options':
        return (
          <div className="space-y-3 py-4">
            <p className="text-xs text-muted-foreground mb-3">
              Selecione o tipo de análise de tráfego
            </p>
            
            {/* UTM Source - Organic vs Paid */}
            <button
              onClick={() => handleSelectUtmType('utm_source')}
              className="w-full flex items-center gap-3 p-4 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-violet-500/30"
            >
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-foreground">Por Fonte (utm_source)</span>
                <p className="text-xs text-muted-foreground">Google, Facebook, Instagram, Orgânico...</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* UTM Medium */}
            <button
              onClick={() => handleSelectUtmType('utm_medium')}
              className="w-full flex items-center gap-3 p-4 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-violet-500/30"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-foreground">Por Mídia (utm_medium)</span>
                <p className="text-xs text-muted-foreground">CPC, Email, Social, Orgânico...</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* UTM Campaign */}
            <button
              onClick={() => handleSelectUtmType('utm_campaign')}
              className="w-full flex items-center gap-3 p-4 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-violet-500/30"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Megaphone className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-foreground">Por Campanha (utm_campaign)</span>
                <p className="text-xs text-muted-foreground">Nome das campanhas de marketing</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* All UTMs */}
            <button
              onClick={() => handleSelectUtmType('utm_all')}
              className="w-full flex items-center gap-3 p-4 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-violet-500/30"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-foreground">Orgânico vs Pago</span>
                <p className="text-xs text-muted-foreground">Comparativo geral de fontes de tráfego</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        );

      case 'utm_origins':
        return (
          <div className="space-y-2 py-4">
            <div className="flex items-center gap-2 p-3 rounded-lg mb-3 bg-violet-500/10">
              <TrendingUp className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-medium">
                {selectedUtmType === 'utm_source' && 'Por Fonte (utm_source)'}
                {selectedUtmType === 'utm_medium' && 'Por Mídia (utm_medium)'}
                {selectedUtmType === 'utm_campaign' && 'Por Campanha (utm_campaign)'}
                {selectedUtmType === 'utm_all' && 'Orgânico vs Pago'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Selecione a origem
            </p>
            {origins.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma origem encontrada.
              </p>
            ) : (
              origins.map((origin) => {
                const subs = getSubOriginsForOrigin(origin.id);
                if (subs.length === 0) return null;
                return (
                  <button
                    key={origin.id}
                    onClick={() => handleSelectUtmOrigin(origin)}
                    className="w-full flex items-center gap-3 p-3 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-foreground/20"
                  >
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-foreground">{origin.nome}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })
            )}
          </div>
        );

      case 'utm_sub_origins':
        const utmSubOriginsForOrigin = selectedOrigin ? getSubOriginsForOrigin(selectedOrigin.id) : [];
        return (
          <div className="space-y-2 py-4">
            <div className="flex items-center gap-2 p-3 rounded-lg mb-3 bg-violet-500/10">
              <TrendingUp className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-medium">
                {selectedUtmType === 'utm_source' && 'Por Fonte (utm_source)'}
                {selectedUtmType === 'utm_medium' && 'Por Mídia (utm_medium)'}
                {selectedUtmType === 'utm_campaign' && 'Por Campanha (utm_campaign)'}
                {selectedUtmType === 'utm_all' && 'Orgânico vs Pago'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Sub-origens de <strong>{selectedOrigin?.nome}</strong>
            </p>
            {utmSubOriginsForOrigin.map((subOrigin) => (
              <button
                key={subOrigin.id}
                onClick={() => handleSelectUtmSubOrigin(subOrigin)}
                className="w-full flex items-center gap-3 p-3 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-foreground/20"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="flex-1 text-sm font-medium text-foreground">{subOrigin.nome}</span>
              </button>
            ))}
          </div>
        );
        const trackingSubOriginsForOrigin = selectedOrigin ? getSubOriginsForOrigin(selectedOrigin.id) : [];
        return (
          <div className="space-y-2 py-4">
            <div className={`flex items-center gap-2 p-3 rounded-lg mb-3 ${
              selectedTrackingType === 'grupo_entrada' ? 'bg-emerald-500/10' : 'bg-red-500/10'
            }`}>
              {selectedTrackingType === 'grupo_entrada' ? (
                <UserPlus className="h-4 w-4 text-emerald-600" />
              ) : (
                <UserMinus className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm font-medium">
                {selectedTrackingType === 'grupo_entrada' ? 'Entradas em Grupo' : 'Saídas de Grupo'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Sub-origens de <strong>{selectedOrigin?.nome}</strong>
            </p>
            {trackingSubOriginsForOrigin.map((subOrigin) => (
              <button
                key={subOrigin.id}
                onClick={() => handleSelectTrackingSubOrigin(subOrigin)}
                className="w-full flex items-center gap-3 p-3 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-foreground/20"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="flex-1 text-sm font-medium text-foreground">{subOrigin.nome}</span>
              </button>
            ))}
          </div>
        );

      case 'custom_fields_origins':
        return (
          <div className="space-y-2 py-4">
            <div className="flex items-center gap-2 p-3 rounded-lg mb-3 bg-orange-500/10">
              <FormInput className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">Campos Personalizados</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Selecione a origem
            </p>
            {origins.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma origem encontrada.
              </p>
            ) : (
              origins.map((origin) => {
                const subs = getSubOriginsForOrigin(origin.id);
                if (subs.length === 0) return null;
                return (
                  <button
                    key={origin.id}
                    onClick={() => {
                      setSelectedOrigin(origin);
                      setStep('custom_fields_sub_origins');
                    }}
                    className="w-full flex items-center gap-3 p-3 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-foreground/20"
                  >
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-foreground">{origin.nome}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })
            )}
          </div>
        );

      case 'custom_fields_sub_origins':
        const cfSubOriginsForOrigin = selectedOrigin ? getSubOriginsForOrigin(selectedOrigin.id) : [];
        return (
          <div className="space-y-2 py-4">
            <div className="flex items-center gap-2 p-3 rounded-lg mb-3 bg-orange-500/10">
              <FormInput className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">Campos Personalizados</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Sub-origens de <strong>{selectedOrigin?.nome}</strong>
            </p>
            {cfSubOriginsForOrigin.map((subOrigin) => (
              <button
                key={subOrigin.id}
                onClick={async () => {
                  setSelectedSubOrigin(subOrigin);
                  await fetchCustomFieldsForSubOrigin(subOrigin.id);
                  setStep('custom_fields_select');
                }}
                className="w-full flex items-center gap-3 p-3 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-foreground/20"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="flex-1 text-sm font-medium text-foreground">{subOrigin.nome}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        );

      case 'custom_fields_select':
        return (
          <div className="space-y-2 py-4">
            <div className="flex items-center gap-2 p-3 rounded-lg mb-3 bg-orange-500/10">
              <FormInput className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">{selectedSubOrigin?.nome}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Selecione o campo personalizado
            </p>
            {customFields.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum campo personalizado encontrado nesta sub-origem.
              </p>
            ) : (
              customFields.map((field) => (
                <button
                  key={field.id}
                  onClick={() => {
                    onConnect({
                      type: 'custom_field',
                      sourceId: selectedSubOrigin?.id,
                      sourceName: `${field.field_label} - ${selectedSubOrigin?.nome}`,
                      customFieldId: field.id,
                      customFieldLabel: field.field_label,
                    });
                    onOpenChange(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-orange-500/30"
                >
                  <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <FormInput className="h-4 w-4 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">{field.field_label}</span>
                    <p className="text-xs text-muted-foreground">{field.field_type}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        );
    }
  };

  const getTitle = () => {
    switch (step) {
      case 'sources':
        return 'Conectar fonte de dados';
      case 'origins':
        return 'Selecione uma origem';
      case 'sub_origins':
        return 'Selecione uma sub-origem';
      case 'facebook_form':
        return 'Conectar Facebook Ads';
      case 'tracking':
        return 'Rastreamento de Grupos';
      case 'tracking_origins':
        return 'Selecione a origem';
      case 'tracking_sub_origins':
        return 'Selecione a sub-origem';
      case 'utm_options':
        return 'UTMs e Tráfego';
      case 'utm_origins':
        return 'Selecione a origem';
      case 'utm_sub_origins':
        return 'Selecione a sub-origem';
      case 'custom_fields_origins':
        return 'Campos Personalizados';
      case 'custom_fields_sub_origins':
        return 'Selecione a sub-origem';
      case 'custom_fields_select':
        return 'Selecione o campo';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-0 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {step !== 'sources' && (
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold">
                {getTitle()}
              </DialogTitle>
              {selectedChart && step === 'sources' && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Para: {selectedChart.name}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
