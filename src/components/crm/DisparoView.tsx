import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { DispatchProgressTable } from "./DispatchProgressTable";
import { DisparoConversationsMenu } from "./DisparoConversationsMenu";
import { supabase } from "@/integrations/supabase/client";
import disparoLogo from "@/assets/disparo-logo.png";

interface DisparoViewProps {
  subOriginId: string | null;
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  component?: React.ReactNode;
}

interface Origin {
  id: string;
  nome: string;
  crm_sub_origins: { id: string; nome: string }[];
}

interface LeadsPreview {
  subOriginId: string;
  originName: string;
  subOriginName: string;
  dispatchType: string;
  totalLeads: number;
  validLeads: number;
  invalidLeads: number;
  intervalSeconds: number;
  estimatedMinutes: number;
  leads: { name: string; contact: string }[];
}

interface CsvLead {
  name: string;
  email?: string;
  whatsapp?: string;
}

const CHAT_URL = `https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/grok-chat`;

// Parse CSV file
const parseCSV = (content: string): CsvLead[] => {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].toLowerCase().split(/[,;]/).map(h => h.trim().replace(/"/g, ''));
  const nameIdx = headers.findIndex(h => h === 'nome' || h === 'name');
  const emailIdx = headers.findIndex(h => h === 'email' || h === 'e-mail');
  const whatsappIdx = headers.findIndex(h => h === 'whatsapp' || h === 'telefone' || h === 'phone' || h === 'celular');
  
  if (nameIdx === -1) return [];
  
  return lines.slice(1).map(line => {
    const values = line.split(/[,;]/).map(v => v.trim().replace(/"/g, ''));
    return {
      name: values[nameIdx] || '',
      email: emailIdx >= 0 ? values[emailIdx] : undefined,
      whatsapp: whatsappIdx >= 0 ? values[whatsappIdx]?.replace(/\D/g, '') : undefined,
    };
  }).filter(l => l.name);
};

// Parse markdown-like formatting: **bold** and _italic_
const formatMessageContent = (content: string): React.ReactNode => {
  // Split by markdown patterns while preserving the delimiters
  const parts = content.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  
  return parts.map((part, index) => {
    // Bold: **text**
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    // Italic: _text_
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

export function DisparoView({ subOriginId }: DisparoViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [csvLeads, setCsvLeads] = useState<CsvLead[] | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [selectedOriginData, setSelectedOriginData] = useState<{ subOriginId: string; subOriginName: string; originName: string } | null>(null);
  const [dispatchType, setDispatchType] = useState<'email' | 'whatsapp_web' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle origin selection from table
  const handleOriginSelect = useCallback(async (subOriginId: string, subOriginName: string, originName: string) => {
    setSelectedOriginData({ subOriginId, subOriginName, originName });
    
    // Determine dispatch type from conversation context
    const lastMessages = messages.slice(-10);
    const hasEmail = lastMessages.some(m => m.content.toLowerCase().includes('email'));
    const type = hasEmail ? 'email' : 'whatsapp_web';
    setDispatchType(type);
    
    // Auto-send message to fetch leads
    const autoMessage = `Usar a lista "${subOriginName}" da origem "${originName}"`;
    
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: autoMessage,
      role: "user",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Fetch leads for this sub-origin
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: `FETCH_LEADS:${type}:${subOriginId}` }),
      });

      if (!response.ok) throw new Error("Erro ao buscar leads");
      const result = await response.json();

      if (result.type === 'leads_preview') {
        const previewComponent = (
          <LeadsPreviewComponent 
            key={`preview-${Date.now()}`}
            preview={result.data} 
          />
        );

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          content: `Encontrei ${result.data.validLeads} leads válidos na lista "${subOriginName}"`,
          role: "assistant",
          timestamp: new Date(),
          component: (
            <div className="mt-4 space-y-4">
              {previewComponent}
              <HtmlEditorComponent 
                onSubmit={(html) => handleHtmlSubmit(html, subOriginId, type)}
              />
            </div>
          ),
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Erro ao buscar leads");
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  // Handle HTML submission
  const handleHtmlSubmit = async (html: string, subOriginId: string, type: string) => {
    setIsLoading(true);
    
    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: "Iniciar disparo com o template fornecido",
      role: "user",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const templateType = html.includes('<') ? 'html' : 'simple';
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          command: `START_DISPATCH:${type}:${subOriginId}:${templateType}:${html}` 
        }),
      });

      if (!response.ok) throw new Error("Erro ao iniciar disparo");
      const result = await response.json();

      if (result.type === 'dispatch_started') {
        setActiveJobId(result.data.jobId);
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          content: `Disparo iniciado. Enviando para ${result.data.validLeads} leads...`,
          role: "assistant",
          timestamp: new Date(),
          component: (
            <div className="mt-4">
              <DispatchProgressTable
                jobId={result.data.jobId}
                onCommand={handleCommand}
              />
            </div>
          ),
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Error starting dispatch:", error);
      toast.error("Erro ao iniciar disparo");
    } finally {
      setIsLoading(false);
    }
  };

  // Process commands from Grok's response
  const processCommands = async (content: string): Promise<{ cleanContent: string; components: React.ReactNode[] }> => {
    const commandPattern = /\[COMMAND:([^\]]+)\]/g;
    const commands: string[] = [];
    let match;
    
    while ((match = commandPattern.exec(content)) !== null) {
      commands.push(match[1]);
    }

    const components: React.ReactNode[] = [];
    let cleanContent = content;

    for (const command of commands) {
      try {
        const response = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ command }),
        });

        if (!response.ok) throw new Error("Command failed");

        const result = await response.json();
        console.log("Command result:", result);

        // Remove command from content
        cleanContent = cleanContent.replace(`[COMMAND:${command}]`, '');

        if (result.type === 'origins') {
          // Add origins list component with selection handler
          const originsComponent = (
            <OriginsListComponent 
              key={`origins-${Date.now()}`}
              origins={result.data}
              onSelect={handleOriginSelect}
            />
          );
          components.push(originsComponent);
        }

        if (result.type === 'leads_preview') {
          const previewComponent = (
            <LeadsPreviewComponent 
              key={`preview-${Date.now()}`}
              preview={result.data} 
            />
          );
          components.push(previewComponent);
        }

        if (result.type === 'dispatch_started') {
          setActiveJobId(result.data.jobId);
          const progressComponent = (
            <DispatchProgressTable
              key={`dispatch-${result.data.jobId}`}
              jobId={result.data.jobId}
              onCommand={handleCommand}
            />
          );
          components.push(progressComponent);
        }

        if (result.type === 'dispatch_updated') {
          // Job was updated (paused/resumed/cancelled)
          toast.success(`Disparo ${result.data.status === 'paused' ? 'pausado' : result.data.status === 'running' ? 'retomado' : 'cancelado'}`);
        }

      } catch (error) {
        console.error("Error processing command:", command, error);
      }
    }

    return { cleanContent: cleanContent.trim(), components };
  };

  const handleCommand = async (command: string) => {
    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) throw new Error("Command failed");
      
      const result = await response.json();
      console.log("Command result:", result);

      if (result.type === 'dispatch_updated') {
        toast.success(`Disparo ${result.data.status === 'paused' ? 'pausado' : result.data.status === 'running' ? 'retomado' : 'cancelado'}`);
      }
    } catch (error) {
      console.error("Error executing command:", error);
      toast.error("Erro ao executar comando");
    }
  };

  const handleSend = async (message: string, files?: File[]) => {
    if (!message.trim() && (!files || files.length === 0)) return;
    
    // Check if there's a CSV file
    let csvContent = '';
    let csvFileName = '';
    if (files && files.length > 0) {
      const csvFile = files.find(f => f.name.endsWith('.csv'));
      if (csvFile) {
        csvFileName = csvFile.name;
        csvContent = await csvFile.text();
        const parsedLeads = parseCSV(csvContent);
        if (parsedLeads.length > 0) {
          setCsvLeads(parsedLeads);
          toast.success(`${parsedLeads.length} leads encontrados no arquivo`);
        }
      }
    }
    
    // Build message content
    const messageContent = csvFileName 
      ? `${message}\n\n[Arquivo enviado: ${csvFileName} com ${csvLeads?.length || parseCSV(csvContent).length} leads]`
      : message;
    
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: messageContent,
      role: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao conectar com o Grok");
      }

      if (!response.body) {
        throw new Error("Resposta sem corpo");
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      let assistantMessageId = crypto.randomUUID();

      // Create initial assistant message
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        content: "",
        role: "assistant",
        timestamp: new Date(),
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        // Process line-by-line
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => 
                prev.map(m => 
                  m.id === assistantMessageId 
                    ? { ...m, content: assistantContent }
                    : m
                )
              );
            }
          } catch {
            // Incomplete JSON, put it back
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => 
                prev.map(m => 
                  m.id === assistantMessageId 
                    ? { ...m, content: assistantContent }
                    : m
                )
              );
            }
          } catch { /* ignore */ }
        }
      }

      // Process commands after streaming is complete
      if (assistantContent) {
        const { cleanContent, components } = await processCommands(assistantContent);
        
        // Check if user chose "Lista do CRM" - auto-show origins table
        const userChoseCRM = messageContent.toLowerCase().includes('lista') && 
          (messageContent.toLowerCase().includes('crm') || 
           messageContent.toLowerCase().includes('cadastrada') ||
           messageContent.toLowerCase().includes('sistema'));
        
        let finalComponents = components;
        
        if (userChoseCRM && components.length === 0) {
          // Auto-fetch origins and show table
          try {
            const originsResponse = await fetch(CHAT_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ command: 'LIST_ORIGINS' }),
            });
            
            if (originsResponse.ok) {
              const originsResult = await originsResponse.json();
              if (originsResult.type === 'origins') {
                finalComponents = [
                  <OriginsListComponent 
                    key={`origins-${Date.now()}`}
                    origins={originsResult.data}
                    onSelect={handleOriginSelect}
                  />
                ];
              }
            }
          } catch (error) {
            console.error("Error auto-fetching origins:", error);
          }
        }
        
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessageId 
              ? { 
                  ...m, 
                  content: cleanContent,
                  component: finalComponents.length > 0 ? (
                    <div className="mt-4 space-y-4">
                      {finalComponents}
                    </div>
                  ) : undefined
                }
              : m
          )
        );
      }

    } catch (error) {
      console.error("Error calling Grok:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao conectar com o Grok");
      // Remove the empty assistant message if there was an error
      setMessages(prev => prev.filter(m => m.content.trim() !== ""));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle selecting a conversation from menu
  const handleSelectConversation = useCallback((id: string, loadedMessages: Message[]) => {
    setCurrentConversationId(id);
    setMessages(loadedMessages);
  }, []);

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
    setCsvLeads(null);
    setActiveJobId(null);
  }, []);

  // Handle conversation created (auto-save)
  const handleConversationCreated = useCallback((id: string) => {
    setCurrentConversationId(id);
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header with conversations menu */}
      <div className="px-6 pt-4 pb-2">
        <DisparoConversationsMenu
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onConversationCreated={handleConversationCreated}
          messages={messages}
        />
      </div>

      {/* When no messages, center the input */}
      {!hasMessages ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3">
                <img src={disparoLogo} alt="Logo" className="w-6 h-6" />
                <h2 className="text-2xl font-semibold text-foreground">
                  Eai, o que vamos disparar hoje?
                </h2>
              </div>
            </div>
            <PromptInputBox
              onSend={handleSend}
              isLoading={isLoading}
              placeholder="Digite sua mensagem aqui..."
            />
            <p className="text-xs text-muted-foreground text-center mt-3">
              A Scale pode cometer erros. Confira informações importantes.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Chat messages area */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col",
                    msg.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  {msg.role === "user" ? (
                    <div className="bg-[#E8E8E8] text-foreground px-5 py-4 rounded-2xl max-w-[70%]">
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="text-foreground max-w-[85%]">
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                        {formatMessageContent(msg.content)}
                      </p>
                      {msg.component}
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-pulse" />
                  <span>pensando...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* AI Chat Input - fixed at bottom */}
          <div className="p-6 pt-0">
            <div className="max-w-3xl mx-auto">
              <PromptInputBox
                onSend={handleSend}
                isLoading={isLoading}
                placeholder="Digite sua mensagem aqui..."
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Component to display origins list with grouped selection
function OriginsListComponent({ origins, onSelect }: { origins: Origin[]; onSelect?: (subOriginId: string, subOriginName: string, originName: string) => void }) {
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [selectedSubOriginId, setSelectedSubOriginId] = useState<string | null>(null);

  const selectedOrigin = origins.find(o => o.id === selectedOriginId);

  const handleOriginSelect = (originId: string) => {
    setSelectedOriginId(originId);
    setSelectedSubOriginId(null);
  };

  const handleSubOriginSelect = (subOrigin: { id: string; nome: string }, originName: string) => {
    setSelectedSubOriginId(subOrigin.id);
    onSelect?.(subOrigin.id, subOrigin.nome, originName);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-4 space-y-3"
    >
      {/* Step 1: Select Origin */}
      <div className="text-sm text-muted-foreground mb-2">Selecione a origem:</div>
      <div className="flex flex-wrap gap-2">
        {origins.map(origin => (
          <button
            key={origin.id}
            onClick={() => handleOriginSelect(origin.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm transition-colors",
              selectedOriginId === origin.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-foreground"
            )}
          >
            {origin.nome}
          </button>
        ))}
      </div>

      {/* Step 2: Select Sub-Origin */}
      {selectedOrigin && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3"
        >
          <div className="text-sm text-muted-foreground mb-2">Selecione a lista:</div>
          <div className="flex flex-wrap gap-2">
            {selectedOrigin.crm_sub_origins.map(sub => (
              <button
                key={sub.id}
                onClick={() => handleSubOriginSelect(sub, selectedOrigin.nome)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm transition-colors",
                  selectedSubOriginId === sub.id
                    ? "bg-green-500 text-white"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                )}
              >
                {sub.nome}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// Component to display leads preview - Clean compact format
function LeadsPreviewComponent({ preview }: { preview: LeadsPreview }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-3 text-sm text-muted-foreground"
    >
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>{preview.validLeads} leads válidos</span>
        <span>•</span>
        <span>{preview.originName} → {preview.subOriginName}</span>
        <span>•</span>
        <span>~{preview.estimatedMinutes} min</span>
      </div>
    </motion.div>
  );
}

// Component to display CSV leads preview
function CsvLeadsPreviewComponent({ leads, type }: { leads: CsvLead[]; type: 'email' | 'whatsapp' }) {
  const validLeads = leads.filter(l => 
    type === 'email' ? l.email && l.email.includes('@') : l.whatsapp && l.whatsapp.length >= 8
  );
  const invalidLeads = leads.length - validLeads.length;
  const intervalSeconds = 5;
  const estimatedMinutes = Math.ceil((validLeads.length * intervalSeconds) / 60);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-4 my-4"
    >
      <h3 className="font-medium text-foreground mb-3">
        📄 Preview do Arquivo CSV
      </h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{leads.length}</div>
          <div className="text-xs text-muted-foreground">Total de leads</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-500">{validLeads.length}</div>
          <div className="text-xs text-muted-foreground">Leads válidos</div>
        </div>
      </div>

      {invalidLeads > 0 && (
        <div className="text-sm text-yellow-600 mb-3">
          ⚠️ {invalidLeads} leads sem {type === 'email' ? 'email válido' : 'WhatsApp válido'}
        </div>
      )}

      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fonte:</span>
          <span className="text-foreground">Arquivo CSV</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Intervalo:</span>
          <span className="text-foreground">{intervalSeconds}s entre envios</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tempo estimado:</span>
          <span className="text-foreground">~{estimatedMinutes} minutos</span>
        </div>
      </div>

      {validLeads.length > 0 && (
        <div className="border-t border-border pt-3">
          <div className="text-xs text-muted-foreground mb-2">Primeiros leads:</div>
          <div className="space-y-1">
            {validLeads.slice(0, 5).map((lead, i) => (
              <div key={i} className="text-sm text-foreground flex justify-between">
                <span>{lead.name}</span>
                <span className="text-muted-foreground text-xs">
                  {type === 'email' ? lead.email : lead.whatsapp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        Confirme para iniciar o disparo
      </p>
    </motion.div>
  );
}

// Component for HTML/message input - Modern light theme editor
function HtmlEditorComponent({ onSubmit }: { onSubmit: (html: string) => void }) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!content.trim()) {
      toast.error("Por favor, insira o conteúdo do email");
      return;
    }
    setIsSubmitting(true);
    onSubmit(content);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast.success("Copiado!");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-4"
    >
      <div className="text-sm text-muted-foreground mb-2">
        Template do Email · Use <code className="bg-muted px-1.5 py-0.5 rounded text-xs text-foreground">{"{{name}}"}</code> para personalizar
      </div>
      
      {/* Modern light editor container */}
      <div className="rounded-xl overflow-hidden border border-border/60 bg-muted/30 shadow-sm">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b border-border/40">
          <span className="text-xs text-muted-foreground font-medium">
            {content.includes('<') ? 'HTML' : 'Texto'}
          </span>
          <button 
            onClick={handleCopy}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copiar
          </button>
        </div>
        
        {/* Editor textarea - larger with light background */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Cole aqui o HTML do email ou mensagem simples...

Exemplo:
<h1>Olá {{name}}!</h1>
<p>Temos uma oferta especial para você.</p>

Ou texto simples:
Olá {{name}}, temos uma oferta especial!`}
          className="w-full min-h-[320px] p-5 bg-background font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-y"
          spellCheck={false}
        />
      </div>

      <div className="flex items-center justify-end mt-4">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !content.trim()}
          className={cn(
            "px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isSubmitting ? "Iniciando..." : "Iniciar Disparo"}
        </button>
      </div>
    </motion.div>
  );
}
