import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Send, Mail, ArrowRight, ArrowLeft, Clock, Check, X } from "lucide-react";
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
type Step = "channel" | "origin" | "suborigin" | "pipeline" | "compose" | "confirm" | "sending";

// Error detail interface
interface ErrorDetail {
  lead: string;
  email: string;
  reason: string;
}

// Broadcast state interface for background sending
interface BroadcastState {
  isActive: boolean;
  channel: ChannelType | null;
  totalLeads: number;
  sentCount: number;
  errorCount: number;
  currentLead: string;
  errors: ErrorDetail[];
}

// Global broadcast state (persists across dialog open/close)
let globalBroadcastState: BroadcastState = {
  isActive: false,
  channel: null,
  totalLeads: 0,
  sentCount: 0,
  errorCount: 0,
  currentLead: "",
  errors: [],
};

// Subscribers for broadcast state updates
const subscribers: Set<() => void> = new Set();

function notifySubscribers() {
  subscribers.forEach(fn => fn());
}

function updateBroadcastState(update: Partial<BroadcastState>) {
  globalBroadcastState = { ...globalBroadcastState, ...update };
  notifySubscribers();
}

export function BroadcastDialog({ open, onOpenChange }: BroadcastDialogProps) {
  const [step, setStep] = useState<Step>("channel");
  const [selectedChannel, setSelectedChannel] = useState<ChannelType | null>(null);
  const [selectedOrigin, setSelectedOrigin] = useState<Origin | null>(null);
  const [selectedSubOrigin, setSelectedSubOrigin] = useState<SubOrigin | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | "all" | null>(null);
  
  // Message content
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("");
  
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [subOrigins, setSubOrigins] = useState<SubOrigin[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [leadsCount, setLeadsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Broadcast progress state
  const [broadcastState, setBroadcastState] = useState<BroadcastState>(globalBroadcastState);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Subscribe to global broadcast state updates
  useEffect(() => {
    const updateState = () => setBroadcastState({ ...globalBroadcastState });
    subscribers.add(updateState);
    return () => { subscribers.delete(updateState); };
  }, []);

  // Show sending step if broadcast is active when dialog opens
  useEffect(() => {
    if (open && globalBroadcastState.isActive) {
      setStep("sending");
    }
  }, [open]);

  // Reset state when dialog closes (only if not sending)
  useEffect(() => {
    if (!open && !globalBroadcastState.isActive) {
      setStep("channel");
      setSelectedChannel(null);
      setSelectedOrigin(null);
      setSelectedSubOrigin(null);
      setSelectedPipeline(null);
      setEmailSubject("");
      setEmailBody("");
      setWhatsappMessage("");
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
    setStep("compose");
  };

  const handleComposeNext = () => {
    if (selectedChannel === "email") {
      if (!emailSubject.trim() || !emailBody.trim()) {
        toast({
          title: "Campos obrigatórios",
          description: "Preencha o assunto e o conteúdo do e-mail.",
          variant: "destructive",
        });
        return;
      }
    } else if (selectedChannel === "whatsapp_web") {
      if (!whatsappMessage.trim()) {
        toast({
          title: "Campo obrigatório",
          description: "Preencha a mensagem do WhatsApp.",
          variant: "destructive",
        });
        return;
      }
    }
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
    } else if (step === "compose") {
      setStep("pipeline");
      setSelectedPipeline(null);
    } else if (step === "confirm") {
      setStep("compose");
    }
  };

  const startBackgroundSend = async () => {
    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    
    // Close dialog and start background sending
    setStep("sending");
    onOpenChange(false);
    
    // Show initial toast
    toast({
      title: "Disparo iniciado",
      description: `Enviando e-mails em segundo plano. Você pode continuar trabalhando.`,
    });
    
    try {
      if (selectedChannel === "email") {
        // Fetch leads for the broadcast
        let query = supabase
          .from("leads")
          .select("id, name, email")
          .eq("sub_origin_id", selectedSubOrigin?.id);
        
        if (selectedPipeline !== "all" && selectedPipeline) {
          query = query.eq("pipeline_id", selectedPipeline.id);
        }
        
        const { data: leads, error: leadsError } = await query;
        
        if (leadsError) {
          throw new Error("Erro ao buscar leads: " + leadsError.message);
        }
        
        if (!leads || leads.length === 0) {
          toast({
            title: "Nenhum lead encontrado",
            description: "Não há leads para enviar o e-mail.",
            variant: "destructive",
          });
          updateBroadcastState({ isActive: false });
          return;
        }
        
        // Initialize broadcast state
        updateBroadcastState({
          isActive: true,
          channel: "email",
          totalLeads: leads.length,
          sentCount: 0,
          errorCount: 0,
          currentLead: "",
          errors: [],
        });
        
        // Send emails to each lead with 7 second delay
        for (let i = 0; i < leads.length; i++) {
          // Check if cancelled
          if (abortControllerRef.current?.signal.aborted) {
            toast({
              title: "Disparo cancelado",
              description: `Enviados ${globalBroadcastState.sentCount} de ${globalBroadcastState.totalLeads} e-mails antes do cancelamento.`,
            });
            break;
          }
          
          const lead = leads[i];
          
          updateBroadcastState({ currentLead: lead.name || lead.email || "Lead" });
          
          if (!lead.email) {
            updateBroadcastState({ 
              errorCount: globalBroadcastState.errorCount + 1,
              errors: [...globalBroadcastState.errors, {
                lead: lead.name || "Lead sem nome",
                email: "N/A",
                reason: "Lead sem e-mail cadastrado"
              }]
            });
            continue;
          }
          
          // Replace variables in subject and body
          const personalizedSubject = emailSubject
            .replace(/\{nome\}/gi, lead.name || "")
            .replace(/\{name\}/gi, lead.name || "")
            .replace(/\{email\}/gi, lead.email || "");
          
          const personalizedBody = emailBody
            .replace(/\{nome\}/gi, lead.name || "")
            .replace(/\{name\}/gi, lead.name || "")
            .replace(/\{email\}/gi, lead.email || "");
          
          try {
            const { error } = await supabase.functions.invoke("send-email", {
              body: {
                leadId: lead.id,
                leadName: lead.name,
                leadEmail: lead.email,
                subject: personalizedSubject,
                bodyHtml: personalizedBody,
              },
            });
            
            if (error) {
              console.error("Error sending email to", lead.email, error);
              const errorMessage = typeof error === 'object' && error !== null 
                ? (error as any).message || JSON.stringify(error)
                : String(error);
              updateBroadcastState({ 
                errorCount: globalBroadcastState.errorCount + 1,
                errors: [...globalBroadcastState.errors, {
                  lead: lead.name || "Lead",
                  email: lead.email,
                  reason: errorMessage
                }]
              });
            } else {
              updateBroadcastState({ sentCount: globalBroadcastState.sentCount + 1 });
            }
          } catch (err: any) {
            console.error("Error sending email to", lead.email, err);
            updateBroadcastState({ 
              errorCount: globalBroadcastState.errorCount + 1,
              errors: [...globalBroadcastState.errors, {
                lead: lead.name || "Lead",
                email: lead.email,
                reason: err?.message || "Erro desconhecido"
              }]
            });
          }
          
          // Wait 7 seconds before sending the next email (except for the last one)
          if (i < leads.length - 1 && !abortControllerRef.current?.signal.aborted) {
            await new Promise(resolve => setTimeout(resolve, 7000));
          }
        }
        
        // Show completion toast
        if (!abortControllerRef.current?.signal.aborted) {
          toast({
            title: "Disparo concluído! ✓",
            description: `${globalBroadcastState.sentCount} e-mails enviados com sucesso${globalBroadcastState.errorCount > 0 ? `, ${globalBroadcastState.errorCount} falhas` : ""}.`,
            variant: globalBroadcastState.sentCount > 0 ? "default" : "destructive",
          });
        }
        
      } else if (selectedChannel === "whatsapp_web") {
        // WhatsApp Web - just show message for now
        toast({
          title: "Disparo iniciado",
          description: `Enviando para ${leadsCount} leads via WhatsApp Web.`,
        });
      }
    } catch (error: any) {
      console.error("Broadcast error:", error);
      toast({
        title: "Erro no disparo",
        description: error.message || "Ocorreu um erro ao enviar as mensagens.",
        variant: "destructive",
      });
    }
    
    // Reset broadcast state
    updateBroadcastState({
      isActive: false,
      channel: null,
      totalLeads: 0,
      sentCount: 0,
      errorCount: 0,
      currentLead: "",
      errors: [],
    });
  };

  const cancelBroadcast = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const getChannelLabel = () => {
    if (selectedChannel === "whatsapp_web") return "WhatsApp Web";
    if (selectedChannel === "email") return "E-mail";
    return "";
  };

  const isComposeComplete = () => {
    if (selectedChannel === "email") {
      return emailSubject.trim() && emailBody.trim();
    }
    if (selectedChannel === "whatsapp_web") {
      return whatsappMessage.trim();
    }
    return false;
  };

  const progressPercentage = broadcastState.totalLeads > 0 
    ? Math.round(((broadcastState.sentCount + broadcastState.errorCount) / broadcastState.totalLeads) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Disparo em Massa
          </DialogTitle>
        </DialogHeader>

        {/* Sending Step - Progress View */}
        {step === "sending" && broadcastState.isActive && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-6">
            <div className="w-full max-w-md space-y-4">
              <div className="text-center space-y-2">
                <Mail className="w-12 h-12 text-primary mx-auto animate-pulse" />
                <h3 className="text-lg font-semibold text-foreground">Enviando e-mails...</h3>
                <p className="text-sm text-muted-foreground">
                  Enviando para: <span className="font-medium text-foreground">{broadcastState.currentLead}</span>
                </p>
              </div>
              
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium text-foreground">{progressPercentage}%</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{broadcastState.sentCount + broadcastState.errorCount} de {broadcastState.totalLeads}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-green-600">✓ {broadcastState.sentCount} enviados</span>
                    {broadcastState.errorCount > 0 && (
                      <span className="text-red-500">✗ {broadcastState.errorCount} erros</span>
                    )}
                  </span>
                </div>
              </div>
              
              {/* Error Details */}
              {broadcastState.errors.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-destructive">Erros encontrados:</h4>
                  <div className="max-h-32 overflow-y-auto space-y-1 bg-destructive/5 rounded-lg p-3">
                    {broadcastState.errors.map((error, index) => (
                      <div key={index} className="text-xs p-2 bg-background rounded border border-destructive/20">
                        <div className="font-medium text-foreground">{error.lead} ({error.email})</div>
                        <div className="text-destructive mt-0.5">{error.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Cancel button */}
              <div className="pt-4 flex justify-center">
                <Button 
                  variant="outline" 
                  onClick={cancelBroadcast}
                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar disparo
                </Button>
              </div>
              
              <p className="text-xs text-center text-muted-foreground">
                Você pode fechar esta janela. O disparo continuará em segundo plano.
              </p>
            </div>
          </div>
        )}

        {/* Progress indicator */}
        {step !== "sending" && (
          <div className="flex items-center gap-1.5 px-2 py-3 border-b border-border overflow-x-auto">
            <div className={`flex items-center gap-1 ${step === "channel" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${step === "channel" ? "bg-primary text-primary-foreground" : selectedChannel ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {selectedChannel ? <Check className="w-3 h-3" /> : "1"}
              </div>
              <span className="text-[10px] whitespace-nowrap">Canal</span>
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <div className={`flex items-center gap-1 ${step === "origin" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${step === "origin" ? "bg-primary text-primary-foreground" : selectedOrigin ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {selectedOrigin ? <Check className="w-3 h-3" /> : "2"}
              </div>
              <span className="text-[10px] whitespace-nowrap">Origem</span>
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <div className={`flex items-center gap-1 ${step === "suborigin" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${step === "suborigin" ? "bg-primary text-primary-foreground" : selectedSubOrigin ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {selectedSubOrigin ? <Check className="w-3 h-3" /> : "3"}
              </div>
              <span className="text-[10px] whitespace-nowrap">Sub-origem</span>
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <div className={`flex items-center gap-1 ${step === "pipeline" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${step === "pipeline" ? "bg-primary text-primary-foreground" : selectedPipeline ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {selectedPipeline ? <Check className="w-3 h-3" /> : "4"}
              </div>
              <span className="text-[10px] whitespace-nowrap">Pipeline</span>
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <div className={`flex items-center gap-1 ${step === "compose" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${step === "compose" ? "bg-primary text-primary-foreground" : isComposeComplete() ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {isComposeComplete() ? <Check className="w-3 h-3" /> : "5"}
              </div>
              <span className="text-[10px] whitespace-nowrap">Mensagem</span>
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <div className={`flex items-center gap-1 ${step === "confirm" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${step === "confirm" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                6
              </div>
              <span className="text-[10px] whitespace-nowrap">Confirmar</span>
            </div>
          </div>
        )}

        {/* Content */}
        {step !== "sending" && (
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

            {/* Step 5: Compose Message */}
            {step === "compose" && (
              <div className="space-y-4">
                {selectedChannel === "email" ? (
                  <>
                    <p className="text-sm text-muted-foreground">Compose o e-mail que será enviado:</p>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">Assunto</label>
                        <Input
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          placeholder="Digite o assunto do e-mail..."
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">Conteúdo do E-mail (HTML)</label>
                        <Textarea
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                          placeholder="Digite o conteúdo do e-mail em HTML..."
                          className="w-full min-h-[200px] font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Você pode usar variáveis como {"{nome}"}, {"{email}"} que serão substituídas pelos dados do lead.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Escreva a mensagem do WhatsApp:</p>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">Mensagem</label>
                        <Textarea
                          value={whatsappMessage}
                          onChange={(e) => setWhatsappMessage(e.target.value)}
                          placeholder="Digite a mensagem que será enviada..."
                          className="w-full min-h-[200px]"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Você pode usar variáveis como {"{nome}"}, {"{email}"} que serão substituídas pelos dados do lead.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 6: Confirmation */}
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
                    {selectedChannel === "email" && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Assunto:</span>
                        <span className="font-medium text-foreground truncate max-w-[200px]">{emailSubject}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span className="text-muted-foreground">Total de leads:</span>
                      <span className="font-bold text-primary text-lg">{leadsCount}</span>
                    </div>
                  </div>
                </div>
                
                {/* Preview */}
                <div className="bg-muted/30 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Preview da mensagem:</h4>
                  {selectedChannel === "email" ? (
                    <div className="bg-white rounded-lg border border-border p-4 text-sm">
                      <div className="text-xs text-muted-foreground mb-2">Assunto: <span className="text-foreground">{emailSubject}</span></div>
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: emailBody || "<p class='text-muted-foreground'>Sem conteúdo</p>" }} />
                    </div>
                  ) : (
                    <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-sm whitespace-pre-wrap">
                      {whatsappMessage || "Sem mensagem"}
                    </div>
                  )}
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
        )}

        {/* Footer */}
        {step !== "sending" && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            {step !== "channel" ? (
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            ) : (
              <div />
            )}
            
            {step === "compose" && (
              <Button onClick={handleComposeNext} className="bg-primary hover:bg-primary/90">
                Continuar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            
            {step === "confirm" && (
              <Button 
                onClick={startBackgroundSend} 
                disabled={leadsCount === 0}
                className="bg-primary hover:bg-primary/90"
              >
                <Send className="w-4 h-4 mr-2" />
                Enviar para {leadsCount} leads
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
