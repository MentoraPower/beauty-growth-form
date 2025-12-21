import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Folder, FolderOpen, Facebook, ChevronRight, ArrowLeft } from "lucide-react";
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

export interface WidgetSource {
  type: 'origin' | 'sub_origin' | 'facebook_ads';
  sourceId?: string;
  sourceName?: string;
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

type Step = 'sources' | 'origins' | 'sub_origins' | 'facebook_form';

export function ConnectSourceDialog({ 
  open, 
  onOpenChange, 
  selectedChart,
  onConnect 
}: ConnectSourceDialogProps) {
  const [step, setStep] = useState<Step>('sources');
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [subOrigins, setSubOrigins] = useState<SubOrigin[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<Origin | null>(null);
  
  // Facebook form state
  const [fbAppId, setFbAppId] = useState("");
  const [fbAppSecret, setFbAppSecret] = useState("");
  const [fbAccessToken, setFbAccessToken] = useState("");

  useEffect(() => {
    if (!open) {
      setStep('sources');
      setSelectedOrigin(null);
      setFbAppId("");
      setFbAppSecret("");
      setFbAccessToken("");
      return;
    }

    const fetchData = async () => {
      const [originsRes, subOriginsRes] = await Promise.all([
        supabase.from("crm_origins").select("*").order("ordem"),
        supabase.from("crm_sub_origins").select("*").order("ordem"),
      ]);

      if (originsRes.data) setOrigins(originsRes.data);
      if (subOriginsRes.data) setSubOrigins(subOriginsRes.data);
    };

    fetchData();
  }, [open]);

  const getSubOriginsForOrigin = (originId: string) => {
    return subOrigins.filter((so) => so.origin_id === originId);
  };

  const handleBack = () => {
    if (step === 'origins' || step === 'facebook_form') {
      setStep('sources');
    } else if (step === 'sub_origins') {
      setStep('origins');
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

  const handleConnectFacebook = () => {
    if (fbAppId && fbAppSecret && fbAccessToken) {
      onConnect({
        type: 'facebook_ads',
        sourceName: 'Facebook Ads',
        credentials: {
          appId: fbAppId,
          appSecret: fbAppSecret,
          accessToken: fbAccessToken,
        },
      });
      onOpenChange(false);
    }
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
                <p className="text-xs text-muted-foreground">Insira as credenciais da sua conta</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">App ID</label>
                <Input
                  value={fbAppId}
                  onChange={(e) => setFbAppId(e.target.value)}
                  placeholder="Seu App ID do Facebook"
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">App Secret</label>
                <Input
                  type="password"
                  value={fbAppSecret}
                  onChange={(e) => setFbAppSecret(e.target.value)}
                  placeholder="Seu App Secret"
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Access Token</label>
                <Input
                  type="password"
                  value={fbAccessToken}
                  onChange={(e) => setFbAccessToken(e.target.value)}
                  placeholder="Seu Access Token"
                  className="h-11"
                />
              </div>
            </div>

            <Button
              onClick={handleConnectFacebook}
              disabled={!fbAppId || !fbAppSecret || !fbAccessToken}
              className="w-full h-11 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
            >
              Conectar Facebook Ads
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Acesse o <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Facebook Developers</a> para obter suas credenciais
            </p>
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
