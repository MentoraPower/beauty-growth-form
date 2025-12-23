import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Folder, FolderOpen, Facebook, ChevronRight, ArrowLeft, Users, UserPlus, UserMinus, TrendingUp, Globe, Target, Megaphone, FormInput, DollarSign, BarChart3, MousePointer, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
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

interface FbCampaign {
  id: string;
  name: string;
}

interface FbConnection {
  id: string;
  ad_account_name: string | null;
  ad_account_id: string;
  selected_campaigns: FbCampaign[];
  selected_metrics: { spend: boolean; cpm: boolean; cpc: boolean };
}

export interface WidgetSource {
  type: 'origin' | 'sub_origin' | 'facebook_ads' | 'tracking_grupo_entrada' | 'tracking_grupo_saida' | 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_all' | 'custom_field' | 'cost_per_lead';
  sourceId?: string;
  sourceName?: string;
  customFieldId?: string;
  customFieldLabel?: string;
  fbCampaignId?: string;
  fbCampaignName?: string;
  fbMetric?: 'spend' | 'cpm' | 'cpc';
  // For cost_per_lead
  fbConnectionId?: string;
  subOriginIdForLeads?: string;
  subOriginNameForLeads?: string;
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

type Step = 'sources' | 'origins' | 'sub_origins' | 'facebook_form' | 'facebook_campaigns' | 'facebook_metrics' | 'tracking' | 'tracking_origins' | 'tracking_sub_origins' | 'utm_options' | 'utm_origins' | 'utm_sub_origins' | 'custom_fields_origins' | 'custom_fields_sub_origins' | 'custom_fields_select' | 'cpl_fb_connection' | 'cpl_fb_campaign' | 'cpl_select_sub_origin';

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
  const [fbConnections, setFbConnections] = useState<FbConnection[]>([]);
  const [selectedFbConnectionId, setSelectedFbConnectionId] = useState<string>("");
  const [selectedFbCampaign, setSelectedFbCampaign] = useState<FbCampaign | null>(null);
  const [selectedFbMetric, setSelectedFbMetric] = useState<'spend' | 'cpm' | 'cpc' | null>(null);
  const [isFbConnectionsLoading, setIsFbConnectionsLoading] = useState(false);
  const [isRefreshingCampaigns, setIsRefreshingCampaigns] = useState(false);
  const [liveCampaigns, setLiveCampaigns] = useState<FbCampaign[]>([]);

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
      setSelectedFbCampaign(null);
      setSelectedFbMetric(null);
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
          .select('id, ad_account_name, ad_account_id, selected_campaigns, selected_metrics')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        const formatted: FbConnection[] = (connections || []).map((c: any) => ({
          id: c.id,
          ad_account_name: c.ad_account_name,
          ad_account_id: c.ad_account_id,
          selected_campaigns: (c.selected_campaigns as FbCampaign[]) || [],
          selected_metrics: (c.selected_metrics as { spend: boolean; cpm: boolean; cpc: boolean }) || { spend: true, cpm: true, cpc: true }
        }));
        setFbConnections(formatted);
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
    if (step === 'origins' || step === 'facebook_form' || step === 'tracking' || step === 'utm_options' || step === 'custom_fields_origins' || step === 'cpl_fb_connection') {
      setStep('sources');
    } else if (step === 'sub_origins') {
      setStep('origins');
      setSelectedOrigin(null);
    } else if (step === 'facebook_campaigns') {
      setStep('facebook_form');
      setSelectedFbCampaign(null);
    } else if (step === 'facebook_metrics') {
      setStep('facebook_campaigns');
      setSelectedFbMetric(null);
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
    } else if (step === 'cpl_fb_campaign') {
      setStep('cpl_fb_connection');
      setSelectedFbCampaign(null);
    } else if (step === 'cpl_select_sub_origin') {
      setStep('cpl_fb_campaign');
      setSelectedOrigin(null);
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

  const handleSelectFbConnection = async () => {
    if (!selectedFbConnectionId) return;
    
    // Auto-fetch live campaigns when entering the campaigns step
    await fetchLiveCampaigns(selectedFbConnectionId);
    setStep('facebook_campaigns');
  };

  const fetchLiveCampaigns = async (connectionId: string) => {
    const connection = fbConnections.find(c => c.id === connectionId);
    if (!connection) return;
    
    setIsRefreshingCampaigns(true);
    setLiveCampaigns([]);
    
    try {
      // Get the access token from the connection
      const { data: connData } = await supabase
        .from('facebook_ads_connections')
        .select('access_token, ad_account_id')
        .eq('id', connectionId)
        .single();
      
      if (!connData) {
        // Fallback to saved campaigns
        setLiveCampaigns(connection.selected_campaigns);
        return;
      }

      // Fetch live campaigns from Facebook
      const { data, error } = await supabase.functions.invoke('facebook-ads', {
        body: { 
          action: 'get-campaigns',
          accessToken: connData.access_token,
          adAccountId: connData.ad_account_id
        }
      });

      if (error) {
        console.error('Error fetching campaigns:', error);
        toast.error("Erro ao buscar campanhas. Usando campanhas salvas.");
        setLiveCampaigns(connection.selected_campaigns);
        return;
      }
      
      if (data.campaigns) {
        const formattedCampaigns: FbCampaign[] = data.campaigns.map((c: any) => ({
          id: c.id,
          name: c.name,
        }));
        setLiveCampaigns(formattedCampaigns);
        
        // Update the connection with new campaigns if there are new ones
        const newCampaignIds = formattedCampaigns.map(c => c.id);
        const savedCampaignIds = connection.selected_campaigns.map(c => c.id);
        const hasNewCampaigns = newCampaignIds.some(id => !savedCampaignIds.includes(id));
        
        if (hasNewCampaigns) {
          // Auto-update the saved campaigns with all available
          await supabase
            .from('facebook_ads_connections')
            .update({ 
              selected_campaigns: formattedCampaigns as unknown as any,
              updated_at: new Date().toISOString()
            })
            .eq('id', connectionId);
          
          // Update local state
          setFbConnections(prev => prev.map(c => 
            c.id === connectionId 
              ? { ...c, selected_campaigns: formattedCampaigns }
              : c
          ));
          
          toast.success(`${formattedCampaigns.length} campanhas atualizadas!`);
        }
      }
    } catch (err) {
      console.error('Error:', err);
      setLiveCampaigns(connection.selected_campaigns);
    } finally {
      setIsRefreshingCampaigns(false);
    }
  };

  const handleSelectFbCampaign = (campaign: FbCampaign) => {
    setSelectedFbCampaign(campaign);
    setStep('facebook_metrics');
  };

  const handleSelectFbMetric = (metric: 'spend' | 'cpm' | 'cpc') => {
    const connection = fbConnections.find((c) => c.id === selectedFbConnectionId);
    if (!connection || !selectedFbCampaign) return;

    const metricLabels = { spend: 'Valor Gasto', cpm: 'CPM', cpc: 'CPC' };

    onConnect({
      type: 'facebook_ads',
      sourceId: connection.id,
      sourceName: `${metricLabels[metric]} - ${selectedFbCampaign.name}`,
      fbCampaignId: selectedFbCampaign.id,
      fbCampaignName: selectedFbCampaign.name,
      fbMetric: metric,
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

            {/* Custo por Lead option */}
            <button
              onClick={() => setStep('cpl_fb_connection')}
              className="w-full flex items-center gap-4 p-4 bg-white border border-border rounded-xl text-left transition-all duration-200 hover:shadow-md hover:border-foreground/20"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-foreground">Custo por Lead (CPL)</h3>
                <p className="text-xs text-muted-foreground">Valor gasto ÷ Leads pagos da origem</p>
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
                  Selecione uma conta conectada
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
                  const campaignsCount = c.selected_campaigns.length;
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
                          {campaignsCount} campanha(s) disponível(is)
                        </p>
                      </div>
                      <div className={`h-3 w-3 rounded-full ${isSelected ? 'bg-[#1877F2]' : 'bg-muted'}`} />
                    </button>
                  );
                })}
              </div>
            )}

            <Button
              onClick={handleSelectFbConnection}
              disabled={!selectedFbConnectionId}
              className="w-full h-11 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
            >
              Continuar
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        );

      case 'facebook_campaigns':
        const selectedConnection = fbConnections.find(c => c.id === selectedFbConnectionId);
        // Use live campaigns if available, otherwise fall back to saved
        const campaigns = liveCampaigns.length > 0 ? liveCampaigns : (selectedConnection?.selected_campaigns || []);
        return (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-[#1877F2]/10 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Facebook className="h-4 w-4 text-[#1877F2] shrink-0" />
                <span className="text-sm font-medium truncate">
                  {selectedConnection?.ad_account_name || selectedConnection?.ad_account_id}
                </span>
              </div>
              <button
                onClick={() => fetchLiveCampaigns(selectedFbConnectionId)}
                disabled={isRefreshingCampaigns}
                className="p-1.5 rounded-lg hover:bg-[#1877F2]/20 transition-colors shrink-0"
                title="Atualizar campanhas"
              >
                <RefreshCw className={`h-4 w-4 text-[#1877F2] ${isRefreshingCampaigns ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Selecione a campanha que deseja monitorar
            </p>
            
            {isRefreshingCampaigns ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="h-5 w-5 text-[#1877F2] animate-spin" />
                <span className="text-sm text-muted-foreground">Buscando campanhas do Facebook...</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto overflow-x-hidden pr-1">
                {campaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhuma campanha encontrada. Verifique se há campanhas ativas na conta.
                  </p>
                ) : (
                  campaigns.map((campaign) => (
                    <button
                      key={campaign.id}
                      onClick={() => handleSelectFbCampaign(campaign)}
                      className="w-full flex items-center justify-between gap-3 p-3 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-[#1877F2]/30 overflow-hidden"
                    >
                      <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{campaign.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        );

      case 'facebook_metrics':
        return (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[#1877F2]/10">
              <Facebook className="h-4 w-4 text-[#1877F2]" />
              <span className="text-sm font-medium truncate">
                {selectedFbCampaign?.name}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Selecione a métrica que deseja visualizar
            </p>
            
            <div className="space-y-2">
              <button
                onClick={() => handleSelectFbMetric('spend')}
                className="w-full flex items-center gap-4 p-4 bg-white border border-border rounded-xl text-left transition-all duration-200 hover:bg-muted/30 hover:border-green-500/30"
              >
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Valor Gasto</p>
                  <p className="text-xs text-muted-foreground">Total investido na campanha</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>

              <button
                onClick={() => handleSelectFbMetric('cpm')}
                className="w-full flex items-center gap-4 p-4 bg-white border border-border rounded-xl text-left transition-all duration-200 hover:bg-muted/30 hover:border-blue-500/30"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">CPM</p>
                  <p className="text-xs text-muted-foreground">Custo por mil impressões</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>

              <button
                onClick={() => handleSelectFbMetric('cpc')}
                className="w-full flex items-center gap-4 p-4 bg-white border border-border rounded-xl text-left transition-all duration-200 hover:bg-muted/30 hover:border-purple-500/30"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <MousePointer className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">CPC</p>
                  <p className="text-xs text-muted-foreground">Custo por clique</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
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

      case 'cpl_fb_connection':
        return (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <DollarSign className="h-8 w-8 text-amber-600" />
              <div>
                <h3 className="text-sm font-medium text-foreground">Custo por Lead</h3>
                <p className="text-xs text-muted-foreground">
                  Valor Gasto (Facebook) ÷ Leads Pagos
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              1. Selecione a conta do Facebook Ads
            </p>

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
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedFbConnectionId(c.id)}
                      className={`w-full flex items-center justify-between gap-3 p-3 border rounded-lg text-left transition-all duration-200 ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50'
                          : 'bg-white border-border hover:bg-muted/30 hover:border-foreground/20'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {c.ad_account_name || c.ad_account_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.selected_campaigns.length} campanha(s) disponível(is)
                        </p>
                      </div>
                      <div className={`h-3 w-3 rounded-full ${isSelected ? 'bg-amber-500' : 'bg-muted'}`} />
                    </button>
                  );
                })}
              </div>
            )}

            <Button
              onClick={async () => {
                if (selectedFbConnectionId) {
                  await fetchLiveCampaigns(selectedFbConnectionId);
                  setStep('cpl_fb_campaign');
                }
              }}
              disabled={!selectedFbConnectionId}
              className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white"
            >
              Continuar
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        );

      case 'cpl_fb_campaign':
        const cplConnection = fbConnections.find(c => c.id === selectedFbConnectionId);
        // Use live campaigns if available
        const cplCampaigns = liveCampaigns.length > 0 ? liveCampaigns : (cplConnection?.selected_campaigns || []);
        return (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-amber-500/10 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Facebook className="h-4 w-4 text-[#1877F2] shrink-0" />
                <span className="text-sm font-medium truncate">
                  {cplConnection?.ad_account_name || cplConnection?.ad_account_id}
                </span>
              </div>
              <button
                onClick={() => fetchLiveCampaigns(selectedFbConnectionId)}
                disabled={isRefreshingCampaigns}
                className="p-1.5 rounded-lg hover:bg-amber-500/20 transition-colors shrink-0"
                title="Atualizar campanhas"
              >
                <RefreshCw className={`h-4 w-4 text-amber-600 ${isRefreshingCampaigns ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              2. Selecione a campanha para calcular o gasto
            </p>
            
            {isRefreshingCampaigns ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                <span className="text-sm text-muted-foreground">Buscando campanhas do Facebook...</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto overflow-x-hidden pr-1">
                {cplCampaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhuma campanha encontrada. Verifique se há campanhas ativas na conta.
                  </p>
                ) : (
                  cplCampaigns.map((campaign) => (
                    <button
                      key={campaign.id}
                      onClick={() => {
                        setSelectedFbCampaign(campaign);
                        setStep('cpl_select_sub_origin');
                      }}
                      className="w-full flex items-center justify-between gap-3 p-3 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-amber-500/30 overflow-hidden"
                    >
                      <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{campaign.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        );

      case 'cpl_select_sub_origin':
        return (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 min-w-0">
              <DollarSign className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium truncate">
                {selectedFbCampaign?.name}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              3. Selecione a sub-origem para contar os <strong>leads pagos</strong> (utm_source=facebook_ads ou utm_medium=cpc)
            </p>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {origins.map((origin) => {
                const subs = getSubOriginsForOrigin(origin.id);
                if (subs.length === 0) return null;
                return (
                  <div key={origin.id} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground px-1">{origin.nome}</p>
                    {subs.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          onConnect({
                            type: 'cost_per_lead',
                            sourceId: selectedFbConnectionId,
                            sourceName: `CPL - ${selectedFbCampaign?.name}`,
                            fbConnectionId: selectedFbConnectionId,
                            fbCampaignId: selectedFbCampaign?.id,
                            fbCampaignName: selectedFbCampaign?.name,
                            subOriginIdForLeads: sub.id,
                            subOriginNameForLeads: sub.nome,
                          });
                          onOpenChange(false);
                        }}
                        className="w-full flex items-center gap-3 p-3 bg-white border border-border rounded-lg text-left transition-all duration-200 hover:bg-muted/30 hover:border-amber-500/30"
                      >
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="flex-1 text-sm font-medium text-foreground">{sub.nome}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
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
      case 'facebook_campaigns':
        return 'Selecione a campanha';
      case 'facebook_metrics':
        return 'Selecione a métrica';
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
      case 'cpl_fb_connection':
        return 'Custo por Lead';
      case 'cpl_fb_campaign':
        return 'Selecione a campanha';
      case 'cpl_select_sub_origin':
        return 'Origem dos Leads Pagos';
      default:
        return 'Conectar fonte';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-background overflow-hidden">
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
