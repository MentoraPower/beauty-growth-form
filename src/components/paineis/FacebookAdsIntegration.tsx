import { useState } from "react";
import { Facebook, Check, Loader2, ChevronRight, BarChart3, DollarSign, MousePointer } from "lucide-react";
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
import { toast } from "sonner";

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

// Mock campaigns for demo
const mockCampaigns: Campaign[] = [
  { id: "1", name: "Campanha Black Friday 2024", status: "ACTIVE", selected: false },
  { id: "2", name: "Remarketing - Carrinho Abandonado", status: "ACTIVE", selected: false },
  { id: "3", name: "Lookalike - Compradores VIP", status: "ACTIVE", selected: false },
  { id: "4", name: "Conversão - Landing Page Principal", status: "PAUSED", selected: false },
  { id: "5", name: "Tráfego - Blog Posts", status: "ACTIVE", selected: false },
  { id: "6", name: "Engajamento - Stories", status: "PAUSED", selected: false },
];

type Step = "connect" | "select-campaigns" | "select-metrics";

export function FacebookAdsIntegration({ open, onOpenChange }: FacebookAdsIntegrationProps) {
  const [step, setStep] = useState<Step>("connect");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockCampaigns);
  const [selectedMetrics, setSelectedMetrics] = useState({
    spend: true,
    cpm: true,
    cpc: true,
  });

  const handleFacebookLogin = async () => {
    setIsConnecting(true);
    
    // Simulate Facebook OAuth
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsConnecting(false);
    setIsConnected(true);
    setStep("select-campaigns");
    toast.success("Conectado ao Facebook Ads!");
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

  const handleFinish = () => {
    const selected = campaigns.filter(c => c.selected);
    toast.success(`${selected.length} campanhas configuradas!`);
    onOpenChange(false);
    
    // Reset state
    setTimeout(() => {
      setStep("connect");
      setIsConnected(false);
      setCampaigns(mockCampaigns);
    }, 300);
  };

  const selectedCount = campaigns.filter(c => c.selected).length;

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
            {step === "select-campaigns" && "Selecione as campanhas que deseja monitorar"}
            {step === "select-metrics" && "Escolha as métricas para exibir nos gráficos"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
              step === "connect" ? "bg-[#1877F2] text-white" : "bg-green-500 text-white"
            }`}>
              {step !== "connect" ? <Check className="h-4 w-4" /> : "1"}
            </div>
            <div className={`flex-1 h-0.5 ${step !== "connect" ? "bg-green-500" : "bg-border"}`} />
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
              step === "select-campaigns" ? "bg-[#1877F2] text-white" : 
              step === "select-metrics" ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
            }`}>
              {step === "select-metrics" ? <Check className="h-4 w-4" /> : "2"}
            </div>
            <div className={`flex-1 h-0.5 ${step === "select-metrics" ? "bg-green-500" : "bg-border"}`} />
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
              step === "select-metrics" ? "bg-[#1877F2] text-white" : "bg-muted text-muted-foreground"
            }`}>
              3
            </div>
          </div>

          {/* Step: Connect */}
          {step === "connect" && (
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-2xl p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#1877F2] flex items-center justify-center mx-auto mb-4">
                  <Facebook className="h-9 w-9 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Conectar com Facebook</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Faça login com sua conta do Facebook para acessar os dados das suas campanhas de anúncios.
                </p>
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
                    </>
                  )}
                </Button>
              </div>

              <div className="text-xs text-muted-foreground text-center">
                Ao conectar, você autoriza o acesso aos dados das suas campanhas de anúncios.
              </div>
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
                  {campaigns.map((campaign) => (
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
                  ))}
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
