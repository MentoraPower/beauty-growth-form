import { useState, useEffect } from "react";
import { Facebook, Check, Loader2, ChevronRight, BarChart3, DollarSign, MousePointer, ExternalLink } from "lucide-react";
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

type Step = "connect" | "select-account" | "select-campaigns" | "select-metrics";

export function FacebookAdsIntegration({ open, onOpenChange }: FacebookAdsIntegrationProps) {
  const [step, setStep] = useState<Step>("connect");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [oauthAppId, setOauthAppId] = useState<string | null>(null);
  const [lastRedirectUri, setLastRedirectUri] = useState<string | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState({
    spend: true,
    cpm: true,
    cpc: true,
  });

  // Listen for OAuth callback
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const errorCode = urlParams.get('error_code');
      const errorMessage = urlParams.get('error_message');

      const storedAppId = localStorage.getItem('fb_ads_oauth_app_id');
      const storedRedirectUri = localStorage.getItem('fb_ads_oauth_redirect_uri');
      if (storedAppId) setOauthAppId(storedAppId);
      if (storedRedirectUri) setLastRedirectUri(storedRedirectUri);

      if (errorCode) {
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);

        const parsedMessage = errorMessage
          ? decodeURIComponent(errorMessage.replace(/\+/g, ' '))
          : 'Erro ao autenticar no Facebook';

        const appIdText = storedAppId ? ` (App ID: ${storedAppId})` : '';
        toast.error(`${parsedMessage}${appIdText}`);
        return;
      }

      if (code && state === 'facebook_ads_oauth') {
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);

        setIsConnecting(true);
        try {
          const redirectUri = `${window.location.origin}${window.location.pathname}`;

          const { data, error } = await supabase.functions.invoke('facebook-ads', {
            body: {
              action: 'exchange-token',
              code,
              redirectUri,
            },
          });

          if (error) throw error;

          if (data.accessToken) {
            setAccessToken(data.accessToken);
            await fetchAdAccounts(data.accessToken);
            toast.success("Conectado ao Facebook Ads!");
          }
        } catch (error) {
          console.error('OAuth error:', error);
          toast.error("Erro ao conectar com Facebook");
        } finally {
          setIsConnecting(false);
        }
      }
    };

    handleOAuthCallback();
  }, []);

  const handleFacebookLogin = async () => {
    setIsConnecting(true);

    try {
      const redirectUri = `${window.location.origin}${window.location.pathname}`;

      const { data, error } = await supabase.functions.invoke('facebook-ads', {
        body: {
          action: 'get-oauth-url',
          redirectUri,
        },
      });

      if (error) throw error;

      if (data?.appId) {
        setOauthAppId(data.appId);
        localStorage.setItem('fb_ads_oauth_app_id', data.appId);
      }

      const effectiveRedirectUri: string = data?.redirectUri || redirectUri;
      setLastRedirectUri(effectiveRedirectUri);
      localStorage.setItem('fb_ads_oauth_redirect_uri', effectiveRedirectUri);

      if (data?.oauthUrl) {
        // Add state parameter for security
        const oauthUrlWithState = `${data.oauthUrl}&state=facebook_ads_oauth`;
        window.location.href = oauthUrlWithState;
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error("Erro ao iniciar login do Facebook");
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
      // Save connection to database
      const { data: connection, error } = await supabase.from('facebook_ads_connections').insert({
        access_token: accessToken,
        ad_account_id: selectedAdAccount,
        ad_account_name: adAccounts.find(a => a.id === selectedAdAccount)?.name || null,
        selected_campaigns: selected.map(c => ({ id: c.id, name: c.name })),
        selected_metrics: selectedMetrics,
        is_active: true
      }).select().single();

      if (error) throw error;

      // Cache insights in background
      if (connection) {
        supabase.functions.invoke('facebook-ads', {
          body: { 
            action: 'cache-insights',
            connectionId: connection.id
          }
        }).then(({ data, error }) => {
          if (error) {
            console.error('Error caching insights:', error);
          } else {
            console.log('Insights cached:', data);
          }
        });
      }

      toast.success(`${selected.length} campanhas configuradas!`);
      onOpenChange(false);
      
      // Reset state
      setTimeout(() => {
        setStep("connect");
        setAccessToken(null);
        setAdAccounts([]);
        setSelectedAdAccount("");
        setCampaigns([]);
      }, 300);
    } catch (error) {
      console.error('Error saving connection:', error);
      toast.error("Erro ao salvar configuração");
    }
  };

  const selectedCount = campaigns.filter(c => c.selected).length;

  const getStepNumber = () => {
    switch(step) {
      case "connect": return 1;
      case "select-account": return 2;
      case "select-campaigns": return 3;
      case "select-metrics": return 4;
    }
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
            {step === "connect" && "Conecte sua conta para importar dados de campanhas"}
            {step === "select-account" && "Selecione a conta de anúncios"}
            {step === "select-campaigns" && "Selecione as campanhas que deseja monitorar"}
            {step === "select-metrics" && "Escolha as métricas para exibir nos gráficos"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {/* Step Indicator */}
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

          {/* Step: Connect */}
          {step === "connect" && (
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-2xl p-6">
                <div className="w-16 h-16 rounded-2xl bg-[#1877F2] flex items-center justify-center mx-auto mb-4">
                  <Facebook className="h-9 w-9 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2 text-center">Conectar com Facebook Ads</h3>
                <p className="text-sm text-muted-foreground mb-2 text-center">
                  Clique no botão abaixo para fazer login com sua conta do Facebook e autorizar o acesso aos dados de anúncios.
                </p>

                {(oauthAppId || lastRedirectUri) && (
                  <div className="mb-4 text-xs text-muted-foreground text-center space-y-1">
                    {oauthAppId && (
                      <div>
                        App ID em uso: <span className="font-mono">{oauthAppId}</span>
                      </div>
                    )}
                    {lastRedirectUri && (
                      <div className="truncate">
                        Redirect: <span className="font-mono">{lastRedirectUri}</span>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleFacebookLogin}
                  disabled={isConnecting}
                  className="w-full h-12 bg-[#1877F2] hover:bg-[#1565C0] text-white"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Facebook className="h-5 w-5 mr-2" />
                      Entrar com Facebook
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              <div className="text-xs text-muted-foreground text-center">
                Ao conectar, você autoriza o acesso aos dados das suas campanhas de anúncios.
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
                  Concluir configuração
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
