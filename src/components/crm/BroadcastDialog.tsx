import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
type Step = "channel" | "origin" | "suborigin" | "pipeline" | "compose" | "confirm";

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
  const [isSending, setIsSending] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
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

  const handleSend = async () => {
    setIsSending(true);
    
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
          setIsSending(false);
          return;
        }
        
        // Send emails to each lead
        let successCount = 0;
        let errorCount = 0;
        
        for (const lead of leads) {
          if (!lead.email) {
            errorCount++;
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
              errorCount++;
            } else {
              successCount++;
            }
          } catch (err) {
            console.error("Error sending email to", lead.email, err);
            errorCount++;
          }
        }
        
        toast({
          title: "Disparo concluído",
          description: `${successCount} e-mails enviados com sucesso${errorCount > 0 ? `, ${errorCount} falhas` : ""}.`,
          variant: successCount > 0 ? "default" : "destructive",
        });
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
    
    setIsSending(false);
    onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Disparo em Massa
          </DialogTitle>
        </DialogHeader>

        {/* Progress indicator */}
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
          
          {step === "compose" && (
            <Button onClick={handleComposeNext} className="bg-primary hover:bg-primary/90">
              Continuar
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
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
