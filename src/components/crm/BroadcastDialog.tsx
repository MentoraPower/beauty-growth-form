import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Send, Mail, ArrowRight, ArrowLeft, Clock, Check } from "lucide-react";
import WhatsAppIcon from "@/components/icons/WhatsApp";
import { toast } from "@/hooks/use-toast";

interface Origin {
  id: string;
  nome: string;
}

interface SubOrigin {
  id: string;
  nome: string;
  origin_id: string;
}

interface Pipeline {
  id: string;
  nome: string;
  sub_origin_id: string | null;
}

interface BroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ChannelType = "whatsapp_web" | "whatsapp_api" | "email";
type Step = "channel" | "origin" | "suborigin" | "pipeline" | "confirm";

export function BroadcastDialog({ open, onOpenChange }: BroadcastDialogProps) {
  const [step, setStep] = useState<Step>("channel");
  const [selectedChannel, setSelectedChannel] = useState<ChannelType | null>(null);
  const [selectedOrigin, setSelectedOrigin] = useState<Origin | null>(null);
  const [selectedSubOrigin, setSelectedSubOrigin] = useState<SubOrigin | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | "all" | null>(null);
  
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [subOrigins, setSubOrigins] = useState<SubOrigin[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [leadsCount, setLeadsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("channel");
      setSelectedChannel(null);
      setSelectedOrigin(null);
      setSelectedSubOrigin(null);
      setSelectedPipeline(null);
      setLeadsCount(0);
    }
  }, [open]);

  // Fetch origins
  useEffect(() => {
    if (open && step === "origin") {
      fetchOrigins();
    }
  }, [open, step]);

  // Fetch sub-origins when origin is selected
  useEffect(() => {
    if (selectedOrigin) {
      fetchSubOrigins(selectedOrigin.id);
    }
  }, [selectedOrigin]);

  // Fetch pipelines when sub-origin is selected
  useEffect(() => {
    if (selectedSubOrigin) {
      fetchPipelines(selectedSubOrigin.id);
    }
  }, [selectedSubOrigin]);

  // Fetch leads count when pipeline is selected
  useEffect(() => {
    if (selectedSubOrigin && selectedPipeline !== null) {
      fetchLeadsCount();
    }
  }, [selectedSubOrigin, selectedPipeline]);

  const fetchOrigins = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("crm_origins")
      .select("id, nome")
      .order("ordem");
    
    if (!error && data) {
      setOrigins(data);
    }
    setIsLoading(false);
  };

  const fetchSubOrigins = async (originId: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("crm_sub_origins")
      .select("id, nome, origin_id")
      .eq("origin_id", originId)
      .order("ordem");
    
    if (!error && data) {
      setSubOrigins(data);
    }
    setIsLoading(false);
  };

  const fetchPipelines = async (subOriginId: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("pipelines")
      .select("id, nome, sub_origin_id")
      .eq("sub_origin_id", subOriginId)
      .order("ordem");
    
    if (!error && data) {
      setPipelines(data);
    }
    setIsLoading(false);
  };

  const fetchLeadsCount = async () => {
    let query = supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("sub_origin_id", selectedSubOrigin?.id);
    
    if (selectedPipeline !== "all" && selectedPipeline) {
      query = query.eq("pipeline_id", selectedPipeline.id);
    }
    
    const { count } = await query;
    setLeadsCount(count || 0);
  };

  const handleSelectChannel = (channel: ChannelType) => {
    if (channel === "whatsapp_api") {
      toast({
        title: "Em breve",
        description: "A integração com a API oficial do WhatsApp estará disponível em breve.",
      });
      return;
    }
    setSelectedChannel(channel);
    setStep("origin");
  };

  const handleSelectOrigin = (origin: Origin) => {
    setSelectedOrigin(origin);
    setStep("suborigin");
  };

  const handleSelectSubOrigin = (subOrigin: SubOrigin) => {
    setSelectedSubOrigin(subOrigin);
    setStep("pipeline");
  };

  const handleSelectPipeline = (pipeline: Pipeline | "all") => {
    setSelectedPipeline(pipeline);
    setStep("confirm");
  };

  const handleBack = () => {
    if (step === "origin") {
      setStep("channel");
      setSelectedChannel(null);
    } else if (step === "suborigin") {
      setStep("origin");
      setSelectedOrigin(null);
    } else if (step === "pipeline") {
      setStep("suborigin");
      setSelectedSubOrigin(null);
    } else if (step === "confirm") {
      setStep("pipeline");
      setSelectedPipeline(null);
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    
    // Simulate sending - in real implementation, call an edge function
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({
      title: "Disparo iniciado",
      description: `Enviando para ${leadsCount} leads via ${selectedChannel === "whatsapp_web" ? "WhatsApp Web" : "E-mail"}.`,
    });
    
    setIsSending(false);
    onOpenChange(false);
  };

  const getChannelLabel = () => {
    if (selectedChannel === "whatsapp_web") return "WhatsApp Web";
    if (selectedChannel === "email") return "E-mail";
    return "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Disparo em Massa
          </DialogTitle>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 px-2 py-3 border-b border-border">
          <div className={`flex items-center gap-1.5 ${step === "channel" ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step === "channel" ? "bg-primary text-primary-foreground" : selectedChannel ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
              {selectedChannel ? <Check className="w-3.5 h-3.5" /> : "1"}
            </div>
            <span className="text-xs">Canal</span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className={`flex items-center gap-1.5 ${step === "origin" ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step === "origin" ? "bg-primary text-primary-foreground" : selectedOrigin ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
              {selectedOrigin ? <Check className="w-3.5 h-3.5" /> : "2"}
            </div>
            <span className="text-xs">Origem</span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className={`flex items-center gap-1.5 ${step === "suborigin" ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step === "suborigin" ? "bg-primary text-primary-foreground" : selectedSubOrigin ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
              {selectedSubOrigin ? <Check className="w-3.5 h-3.5" /> : "3"}
            </div>
            <span className="text-xs">Sub-origem</span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className={`flex items-center gap-1.5 ${step === "pipeline" ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step === "pipeline" ? "bg-primary text-primary-foreground" : selectedPipeline ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
              {selectedPipeline ? <Check className="w-3.5 h-3.5" /> : "4"}
            </div>
            <span className="text-xs">Pipeline</span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className={`flex items-center gap-1.5 ${step === "confirm" ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step === "confirm" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              5
            </div>
            <span className="text-xs">Confirmar</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {/* Step 1: Channel Selection */}
          {step === "channel" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Escolha o canal de disparo:</p>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => handleSelectChannel("whatsapp_web")}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-green-400 hover:bg-green-50 transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <WhatsAppIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">WhatsApp Web</h3>
                    <p className="text-sm text-muted-foreground">Enviar mensagens via WhatsApp Web conectado</p>
                  </div>
                </button>
                
                <button
                  onClick={() => handleSelectChannel("whatsapp_api")}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-green-400 transition-all text-left opacity-60 cursor-not-allowed relative"
                >
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <WhatsAppIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">WhatsApp API Oficial</h3>
                    <p className="text-sm text-muted-foreground">Integração com a API oficial do WhatsApp Business</p>
                  </div>
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Em breve
                  </span>
                </button>
                
                <button
                  onClick={() => handleSelectChannel("email")}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">E-mail</h3>
                    <p className="text-sm text-muted-foreground">Enviar e-mails em massa para os leads</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Origin Selection */}
          {step === "origin" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Selecione a origem:</p>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {origins.map((origin) => (
                    <button
                      key={origin.id}
                      onClick={() => handleSelectOrigin(origin)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                        {origin.nome.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground">{origin.nome}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Sub-origin Selection */}
          {step === "suborigin" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Selecione a sub-origem de <strong>{selectedOrigin?.nome}</strong>:</p>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : subOrigins.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma sub-origem encontrada
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {subOrigins.map((subOrigin) => (
                    <button
                      key={subOrigin.id}
                      onClick={() => handleSelectSubOrigin(subOrigin)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                        {subOrigin.nome.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground">{subOrigin.nome}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Pipeline Selection */}
          {step === "pipeline" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Selecione a pipeline de <strong>{selectedSubOrigin?.nome}</strong>:</p>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => handleSelectPipeline("all")}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Todos os leads</span>
                      <p className="text-xs text-muted-foreground">Enviar para todos os leads desta sub-origem</p>
                    </div>
                  </button>
                  
                  {pipelines.map((pipeline) => (
                    <button
                      key={pipeline.id}
                      onClick={() => handleSelectPipeline(pipeline)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                        {pipeline.nome.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground">{pipeline.nome}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Confirmation */}
          {step === "confirm" && (
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-foreground">Resumo do disparo</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Canal:</span>
                    <span className="font-medium text-foreground">{getChannelLabel()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Origem:</span>
                    <span className="font-medium text-foreground">{selectedOrigin?.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sub-origem:</span>
                    <span className="font-medium text-foreground">{selectedSubOrigin?.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pipeline:</span>
                    <span className="font-medium text-foreground">
                      {selectedPipeline === "all" ? "Todos os leads" : (selectedPipeline as Pipeline)?.nome}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-muted-foreground">Total de leads:</span>
                    <span className="font-bold text-primary text-lg">{leadsCount}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800">
                  <strong>Atenção:</strong> Você está prestes a enviar mensagens para {leadsCount} leads. 
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {step !== "channel" ? (
            <Button variant="ghost" onClick={handleBack} disabled={isSending}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          ) : (
            <div />
          )}
          
          {step === "confirm" && (
            <Button 
              onClick={handleSend} 
              disabled={isSending || leadsCount === 0}
              className="bg-primary hover:bg-primary/90"
            >
              {isSending ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar para {leadsCount} leads
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
