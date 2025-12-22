import { useEffect, useState } from "react";
import { Facebook, Check, Loader2, ChevronRight, BarChart3, DollarSign, MousePointer, Pencil, Plus, Trash2, RefreshCw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface FacebookAdsIntegrationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Campaign {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED";
  selected: boolean;
}

interface AdAccount {
  id: string;
  name: string;
  account_status: number;
}

interface ExistingConnection {
  id: string;
  ad_account_id: string;
  ad_account_name: string | null;
  access_token: string;
  selected_campaigns: { id: string; name: string }[];
  selected_metrics: { spend: boolean; cpm: boolean; cpc: boolean };
  is_active: boolean;
}

type Step = "list" | "connect" | "select-account" | "select-campaigns" | "select-metrics";

export function FacebookAdsIntegration({ open, onOpenChange }: FacebookAdsIntegrationProps) {
  const [step, setStep] = useState<Step>("list");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [accessToken, setAccessToken] = useState<string>("");
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState({
    spend: true,
    cpm: true,
    cpc: true,
  });
  
  // Existing connections
  const [existingConnections, setExistingConnections] = useState<ExistingConnection[]>([]);
  const [editingConnection, setEditingConnection] = useState<ExistingConnection | null>(null);

  // Load existing connections on open
  const loadExistingConnections = async () => {
    setIsLoadingConnections(true);
    try {
      const { data, error } = await supabase
        .from('facebook_ads_connections')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const connections = (data || []).map(conn => ({
        id: conn.id,
        ad_account_id: conn.ad_account_id,
        ad_account_name: conn.ad_account_name,
        access_token: conn.access_token,
        selected_campaigns: (conn.selected_campaigns as { id: string; name: string }[]) || [],
        selected_metrics: (conn.selected_metrics as { spend: boolean; cpm: boolean; cpc: boolean }) || { spend: true, cpm: true, cpc: true },
        is_active: conn.is_active
      }));
      
      setExistingConnections(connections);
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setIsLoadingConnections(false);
    }
  };

  useEffect(() => {
    if (open) {
      setStep("list");
      loadExistingConnections();
    }
  }, [open]);

  const handleStartNewConnection = async () => {
    setEditingConnection(null);
    setIsConnecting(true);
    
    try {
      // Check for stored token first
      const { data, error } = await supabase.functions.invoke('facebook-ads', {
        body: { action: 'get-stored-token' }
      });

      if (!error && data?.hasToken && data?.isValid) {
        setAccessToken(data.accessToken);
        await fetchAdAccounts(data.accessToken);
      } else {
        setStep("connect");
      }
    } catch (err) {
      console.error('Error checking stored token:', err);
      setStep("connect");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleEditConnection = async (connection: ExistingConnection) => {
    setEditingConnection(connection);
    setAccessToken(connection.access_token);
    setSelectedAdAccount(connection.ad_account_id);
    setSelectedMetrics(connection.selected_metrics);
    
    // Load campaigns for this connection
    setIsLoadingCampaigns(true);
    try {
      const { data, error } = await supabase.functions.invoke('facebook-ads', {
        body: { 
          action: 'get-campaigns',
          accessToken: connection.access_token,
          adAccountId: connection.ad_account_id
        }
      });

      if (error) throw error;
      
      if (data.campaigns) {
        const formattedCampaigns: Campaign[] = data.campaigns.map((c: any) => ({
          id: c.id,
          name: c.name,
          status: c.status as "ACTIVE" | "PAUSED",
          selected: connection.selected_campaigns.some(sc => sc.id === c.id)
        }));
        setCampaigns(formattedCampaigns);
        setStep("select-campaigns");
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast.error("Erro ao buscar campanhas. O token pode ter expirado.");
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    try {
      // Delete insights first
      await supabase
        .from('facebook_ads_insights')
        .delete()
        .eq('connection_id', connectionId);
      
      // Delete connection
      const { error } = await supabase
        .from('facebook_ads_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      toast.success("Conexão removida!");
      loadExistingConnections();
    } catch (error) {
      console.error('Error deleting connection:', error);
      toast.error("Erro ao remover conexão");
    }
  };

  const handleRefreshInsights = async (connection: ExistingConnection) => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('facebook-ads', {
        body: { 
          action: 'cache-insights',
          connectionId: connection.id
        }
      });

      if (error) throw error;

      toast.success(`${data.cached} insights atualizados!`);
    } catch (error) {
      console.error('Error refreshing insights:', error);
      toast.error("Erro ao atualizar insights");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConnectWithToken = async () => {
    if (!accessToken.trim()) {
      toast.error("Cole o token de acesso");
      return;
    }

    setIsConnecting(true);
    try {
      const { data: extendData, error: extendError } = await supabase.functions.invoke('facebook-ads', {
        body: { 
          action: 'extend-token',
          accessToken: accessToken.trim()
        }
      });

      let tokenToUse = accessToken.trim();
      
      if (!extendError && extendData?.accessToken) {
        tokenToUse = extendData.accessToken;
        setAccessToken(tokenToUse);
        const expiresIn = extendData.expiresIn ? Math.floor(extendData.expiresIn / 86400) : 60;
        toast.success(`Token estendido para ${expiresIn} dias!`);
      }

      await fetchAdAccounts(tokenToUse);
    } catch (error) {
      console.error('Token error:', error);
      toast.error("Token inválido ou expirado");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleUseStoredToken = async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('facebook-ads', {
        body: { action: 'get-stored-token' }
      });

      if (error || !data?.isValid) {
        toast.error("Token armazenado inválido ou expirado");
        return;
      }

      setAccessToken(data.accessToken);
      await fetchAdAccounts(data.accessToken);
      toast.success("Conectado com token armazenado!");
    } catch (error) {
      console.error('Stored token error:', error);
      toast.error("Erro ao usar token armazenado");
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchAdAccounts = async (token: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('facebook-ads', {
        body: { 
          action: 'get-ad-accounts',
          accessToken: token
        }
      });

      if (error) throw error;
      
      if (data.adAccounts && data.adAccounts.length > 0) {
        setAdAccounts(data.adAccounts);
        setStep("select-account");
      } else {
        toast.error("Nenhuma conta de anúncios encontrada");
      }
    } catch (error) {
      console.error('Error fetching ad accounts:', error);
      toast.error("Erro ao buscar contas de anúncios");
    }
  };

  const handleSelectAdAccount = async () => {
    if (!selectedAdAccount || !accessToken) {
      toast.error("Selecione uma conta de anúncios");
      return;
    }

    setIsLoadingCampaigns(true);
    try {
      const { data, error } = await supabase.functions.invoke('facebook-ads', {
        body: { 
          action: 'get-campaigns',
          accessToken,
          adAccountId: selectedAdAccount
        }
      });

      if (error) throw error;
      
      if (data.campaigns) {
        const formattedCampaigns: Campaign[] = data.campaigns.map((c: any) => ({
          id: c.id,
          name: c.name,
          status: c.status as "ACTIVE" | "PAUSED",
          selected: false
        }));
        setCampaigns(formattedCampaigns);
        setStep("select-campaigns");
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast.error("Erro ao buscar campanhas");
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  const toggleCampaign = (campaignId: string) => {
    setCampaigns(prev => 
      prev.map(c => 
        c.id === campaignId ? { ...c, selected: !c.selected } : c
      )
    );
  };

  const selectAllCampaigns = () => {
    const allSelected = campaigns.every(c => c.selected);
    setCampaigns(prev => prev.map(c => ({ ...c, selected: !allSelected })));
  };

  const handleConfirmCampaigns = () => {
    const selected = campaigns.filter(c => c.selected);
    if (selected.length === 0) {
      toast.error("Selecione pelo menos uma campanha");
      return;
    }
    setStep("select-metrics");
  };

  const handleFinish = async () => {
    const selected = campaigns.filter(c => c.selected);
    
    try {
      if (editingConnection) {
        // Update existing connection
        const { error } = await supabase
          .from('facebook_ads_connections')
          .update({
            selected_campaigns: selected.map(c => ({ id: c.id, name: c.name })),
            selected_metrics: selectedMetrics,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingConnection.id);

        if (error) throw error;

        // Refresh insights
        supabase.functions.invoke('facebook-ads', {
          body: { 
            action: 'cache-insights',
            connectionId: editingConnection.id
          }
        }).then(({ data, error }) => {
          if (error) {
            console.error('Error caching insights:', error);
          } else {
            console.log('Insights cached:', data);
          }
        });

        toast.success(`Conexão atualizada com ${selected.length} campanhas!`);
      } else {
        // Create new connection with upsert to avoid duplicates
        const { data: existingConn } = await supabase
          .from('facebook_ads_connections')
          .select('id')
          .eq('ad_account_id', selectedAdAccount)
          .single();

        if (existingConn) {
          // Update existing
          const { error } = await supabase
            .from('facebook_ads_connections')
            .update({
              access_token: accessToken,
              ad_account_name: adAccounts.find(a => a.id === selectedAdAccount)?.name || null,
              selected_campaigns: selected.map(c => ({ id: c.id, name: c.name })),
              selected_metrics: selectedMetrics,
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingConn.id);

          if (error) throw error;

          supabase.functions.invoke('facebook-ads', {
            body: { action: 'cache-insights', connectionId: existingConn.id }
          });

          toast.success(`Conexão atualizada com ${selected.length} campanhas!`);
        } else {
          // Create new
          const { data: connection, error } = await supabase.from('facebook_ads_connections').insert({
            access_token: accessToken,
            ad_account_id: selectedAdAccount,
            ad_account_name: adAccounts.find(a => a.id === selectedAdAccount)?.name || null,
            selected_campaigns: selected.map(c => ({ id: c.id, name: c.name })),
            selected_metrics: selectedMetrics,
            is_active: true
          }).select().single();

          if (error) throw error;

          if (connection) {
            supabase.functions.invoke('facebook-ads', {
              body: { action: 'cache-insights', connectionId: connection.id }
            });
          }

          toast.success(`${selected.length} campanhas configuradas!`);
        }
      }

      onOpenChange(false);
      
      // Reset state
      setTimeout(() => {
        setStep("list");
        setAccessToken("");
        setAdAccounts([]);
        setSelectedAdAccount("");
        setCampaigns([]);
        setEditingConnection(null);
      }, 300);
    } catch (error) {
      console.error('Error saving connection:', error);
      toast.error("Erro ao salvar configuração");
    }
  };

  const selectedCount = campaigns.filter(c => c.selected).length;

  const getStepNumber = () => {
    switch(step) {
      case "list": return 0;
      case "connect": return 1;
      case "select-account": return 2;
      case "select-campaigns": return 3;
      case "select-metrics": return 4;
    }
  };

  const getActiveMetricsText = (metrics: { spend: boolean; cpm: boolean; cpc: boolean }) => {
    const active = [];
    if (metrics.spend) active.push('Spend');
    if (metrics.cpm) active.push('CPM');
    if (metrics.cpc) active.push('CPC');
    return active.join(', ') || 'Nenhuma';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg border-l border-border/50">
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#1877F2] flex items-center justify-center">
              <Facebook className="h-5 w-5 text-white" />
            </div>
            Facebook Ads
          </SheetTitle>
          <SheetDescription>
            {step === "list" && "Gerencie suas conexões do Facebook Ads"}
            {step === "connect" && "Conecte sua conta para importar dados de campanhas"}
            {step === "select-account" && "Selecione a conta de anúncios"}
            {step === "select-campaigns" && "Selecione as campanhas que deseja monitorar"}
            {step === "select-metrics" && "Escolha as métricas para exibir nos gráficos"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {/* Step Indicator (only show when not on list) */}
          {step !== "list" && (
            <div className="flex items-center gap-2 mb-6">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                getStepNumber() >= 1 ? (getStepNumber() > 1 ? "bg-green-500 text-white" : "bg-[#1877F2] text-white") : "bg-muted text-muted-foreground"
              }`}>
                {getStepNumber() > 1 ? <Check className="h-4 w-4" /> : "1"}
              </div>
              <div className={`flex-1 h-0.5 ${getStepNumber() > 1 ? "bg-green-500" : "bg-border"}`} />
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                getStepNumber() >= 2 ? (getStepNumber() > 2 ? "bg-green-500 text-white" : "bg-[#1877F2] text-white") : "bg-muted text-muted-foreground"
              }`}>
                {getStepNumber() > 2 ? <Check className="h-4 w-4" /> : "2"}
              </div>
              <div className={`flex-1 h-0.5 ${getStepNumber() > 2 ? "bg-green-500" : "bg-border"}`} />
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                getStepNumber() >= 3 ? (getStepNumber() > 3 ? "bg-green-500 text-white" : "bg-[#1877F2] text-white") : "bg-muted text-muted-foreground"
              }`}>
                {getStepNumber() > 3 ? <Check className="h-4 w-4" /> : "3"}
              </div>
              <div className={`flex-1 h-0.5 ${getStepNumber() > 3 ? "bg-green-500" : "bg-border"}`} />
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                getStepNumber() === 4 ? "bg-[#1877F2] text-white" : "bg-muted text-muted-foreground"
              }`}>
                4
              </div>
            </div>
          )}

          {/* Step: List Existing Connections */}
          {step === "list" && (
            <div className="space-y-4">
              {isLoadingConnections ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#1877F2]" />
                </div>
              ) : (
                <>
                  {existingConnections.length > 0 ? (
                    <ScrollArea className="h-[320px] pr-2">
                      <div className="space-y-3">
                        {existingConnections.map((conn) => (
                          <div
                            key={conn.id}
                            className="p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {conn.ad_account_name || conn.ad_account_id}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {conn.selected_campaigns.length} campanha(s) selecionada(s)
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Métricas: {getActiveMetricsText(conn.selected_metrics)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleRefreshInsights(conn)}
                                  disabled={isRefreshing}
                                >
                                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditConnection(conn)}
                                  disabled={isLoadingCampaigns}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteConnection(conn.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Show campaigns */}
                            <div className="mt-3 flex flex-wrap gap-1">
                              {conn.selected_campaigns.slice(0, 3).map((camp) => (
                                <span
                                  key={camp.id}
                                  className="text-xs px-2 py-0.5 rounded-full bg-[#1877F2]/10 text-[#1877F2]"
                                >
                                  {camp.name}
                                </span>
                              ))}
                              {conn.selected_campaigns.length > 3 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  +{conn.selected_campaigns.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-2xl bg-[#1877F2]/10 flex items-center justify-center mx-auto mb-4">
                        <Facebook className="h-9 w-9 text-[#1877F2]" />
                      </div>
                      <p className="text-muted-foreground mb-4">
                        Nenhuma conexão configurada
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleStartNewConnection}
                    disabled={isConnecting}
                    className="w-full h-11 bg-[#1877F2] hover:bg-[#1565C0] text-white"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5 mr-2" />
                        Nova conexão
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Step: Connect */}
          {step === "connect" && (
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-2xl p-6">
                <div className="w-16 h-16 rounded-2xl bg-[#1877F2] flex items-center justify-center mx-auto mb-4">
                  <Facebook className="h-9 w-9 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2 text-center">Conectar com Facebook Ads</h3>
                
                <Button
                  onClick={handleUseStoredToken}
                  disabled={isConnecting}
                  className="w-full h-12 bg-[#1877F2] hover:bg-[#1565C0] text-white mb-4"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Facebook className="h-5 w-5 mr-2" />
                      Usar Token Armazenado
                    </>
                  )}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-muted/50 px-2 text-muted-foreground">ou cole manualmente</span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-4 text-center">
                  Cole o token de acesso gerado no Graph API Explorer com as permissões <code className="bg-muted px-1 rounded">ads_read</code> e <code className="bg-muted px-1 rounded">ads_management</code>.
                </p>

                <div className="space-y-3">
                  <Input
                    placeholder="Cole o Access Token aqui"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    className="h-11 font-mono text-xs"
                  />

                  <Button
                    onClick={handleConnectWithToken}
                    disabled={isConnecting || !accessToken.trim()}
                    variant="outline"
                    className="w-full h-11"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Validando e estendendo token...
                      </>
                    ) : (
                      "Conectar com Token Manual"
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <Button variant="ghost" size="sm" onClick={() => setStep("list")}>
                  ← Voltar
                </Button>
                <a 
                  href="https://developers.facebook.com/tools/explorer/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#1877F2] hover:underline"
                >
                  Abrir Graph API Explorer →
                </a>
              </div>
            </div>
          )}

          {/* Step: Select Ad Account */}
          {step === "select-account" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Conta de Anúncios</Label>
                <Select value={selectedAdAccount} onValueChange={setSelectedAdAccount}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {adAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name || account.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSelectAdAccount}
                disabled={!selectedAdAccount || isLoadingCampaigns}
                className="w-full h-11 bg-[#1877F2] hover:bg-[#1565C0] text-white"
              >
                {isLoadingCampaigns ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Carregando campanhas...
                  </>
                ) : (
                  <>
                    Continuar
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>

              <Button variant="ghost" size="sm" onClick={() => setStep("list")} className="w-full">
                ← Voltar
              </Button>
            </div>
          )}

          {/* Step: Select Campaigns */}
          {step === "select-campaigns" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedCount} de {campaigns.length} selecionadas
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllCampaigns}
                  className="text-xs"
                >
                  {campaigns.every(c => c.selected) ? "Desmarcar todas" : "Selecionar todas"}
                </Button>
              </div>

              <ScrollArea className="h-[320px] pr-4">
                <div className="space-y-2">
                  {campaigns.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma campanha encontrada
                    </div>
                  ) : (
                    campaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        onClick={() => toggleCampaign(campaign.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          campaign.selected 
                            ? "border-[#1877F2] bg-[#1877F2]/5" 
                            : "border-border hover:border-border/80 hover:bg-muted/30"
                        }`}
                      >
                        <Checkbox
                          checked={campaign.selected}
                          onCheckedChange={() => toggleCampaign(campaign.id)}
                          className="data-[state=checked]:bg-[#1877F2] data-[state=checked]:border-[#1877F2]"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{campaign.name}</p>
                          <span className={`text-xs ${
                            campaign.status === "ACTIVE" ? "text-green-500" : "text-muted-foreground"
                          }`}>
                            {campaign.status === "ACTIVE" ? "Ativa" : "Pausada"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              <Button
                onClick={handleConfirmCampaigns}
                disabled={selectedCount === 0}
                className="w-full h-11 bg-[#1877F2] hover:bg-[#1565C0] text-white"
              >
                Continuar
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>

              <Button variant="ghost" size="sm" onClick={() => setStep("list")} className="w-full">
                ← Voltar
              </Button>
            </div>
          )}

          {/* Step: Select Metrics */}
          {step === "select-metrics" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Escolha quais métricas deseja visualizar nos seus gráficos:
              </p>

              <div className="space-y-3">
                <div
                  onClick={() => setSelectedMetrics(prev => ({ ...prev, spend: !prev.spend }))}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedMetrics.spend 
                      ? "border-[#1877F2] bg-[#1877F2]/5" 
                      : "border-border hover:border-border/80"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Valor Gasto</p>
                    <p className="text-xs text-muted-foreground">Total investido nas campanhas</p>
                  </div>
                  <Checkbox
                    checked={selectedMetrics.spend}
                    onCheckedChange={() => setSelectedMetrics(prev => ({ ...prev, spend: !prev.spend }))}
                    className="data-[state=checked]:bg-[#1877F2] data-[state=checked]:border-[#1877F2]"
                  />
                </div>

                <div
                  onClick={() => setSelectedMetrics(prev => ({ ...prev, cpm: !prev.cpm }))}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedMetrics.cpm 
                      ? "border-[#1877F2] bg-[#1877F2]/5" 
                      : "border-border hover:border-border/80"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">CPM</p>
                    <p className="text-xs text-muted-foreground">Custo por mil impressões</p>
                  </div>
                  <Checkbox
                    checked={selectedMetrics.cpm}
                    onCheckedChange={() => setSelectedMetrics(prev => ({ ...prev, cpm: !prev.cpm }))}
                    className="data-[state=checked]:bg-[#1877F2] data-[state=checked]:border-[#1877F2]"
                  />
                </div>

                <div
                  onClick={() => setSelectedMetrics(prev => ({ ...prev, cpc: !prev.cpc }))}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedMetrics.cpc 
                      ? "border-[#1877F2] bg-[#1877F2]/5" 
                      : "border-border hover:border-border/80"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <MousePointer className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">CPC</p>
                    <p className="text-xs text-muted-foreground">Custo por clique</p>
                  </div>
                  <Checkbox
                    checked={selectedMetrics.cpc}
                    onCheckedChange={() => setSelectedMetrics(prev => ({ ...prev, cpc: !prev.cpc }))}
                    className="data-[state=checked]:bg-[#1877F2] data-[state=checked]:border-[#1877F2]"
                  />
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <Button
                  onClick={handleFinish}
                  disabled={!selectedMetrics.spend && !selectedMetrics.cpm && !selectedMetrics.cpc}
                  className="w-full h-11 bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 text-white"
                >
                  {editingConnection ? "Salvar alterações" : "Concluir configuração"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setStep("select-campaigns")}
                  className="w-full h-11"
                >
                  Voltar
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
