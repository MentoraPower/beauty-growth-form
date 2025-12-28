import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { DispatchProgressTable } from "./DispatchProgressTable";
import { supabase } from "@/integrations/supabase/client";
import disparoLogo from "@/assets/disparo-logo.png";

interface DisparoViewProps {
  subOriginId: string | null;
}

interface MessageComponentData {
  type: 'leads_preview' | 'html_editor' | 'origins_list' | 'dispatch_progress' | 'csv_preview' | 'email_choice' | 'email_generator' | 'copy_choice' | 'copy_input' | 'email_generator_streaming';
  data?: any;
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  component?: React.ReactNode;
  componentData?: MessageComponentData; // Serializable data for reconstruction
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [csvLeads, setCsvLeads] = useState<CsvLead[] | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [selectedOriginData, setSelectedOriginData] = useState<{ subOriginId: string; subOriginName: string; originName: string } | null>(null);
  const [dispatchType, setDispatchType] = useState<'email' | 'whatsapp_web' | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to reconstruct component from componentData
  const reconstructComponent = useCallback((componentData: MessageComponentData, messageId: string): React.ReactNode => {
    switch (componentData.type) {
      case 'leads_preview':
        return (
          <div className="mt-4 space-y-4 w-full">
            <LeadsPreviewComponent preview={componentData.data.preview} />
            <HtmlEditorComponent 
              onSubmit={(html) => handleHtmlSubmitFromReload(html, componentData.data.subOriginId, componentData.data.dispatchType)}
            />
          </div>
        );
      case 'dispatch_progress':
        return (
          <div className="mt-4">
            <DispatchProgressTable
              jobId={componentData.data.jobId}
              onCommand={handleCommand}
            />
          </div>
        );
      case 'origins_list':
        return (
          <div className="mt-4 space-y-4">
            <OriginsListComponent 
              origins={componentData.data.origins}
              onSelect={handleOriginSelect}
            />
          </div>
        );
      default:
        return null;
    }
  }, []);

  // Handle HTML submit from reloaded conversation
  const handleHtmlSubmitFromReload = async (html: string, subOriginId: string, type: string) => {
    handleHtmlSubmit(html, subOriginId, type);
  };

  // Load conversation from URL on mount
  useEffect(() => {
    const convId = searchParams.get('conversation') || searchParams.get('conv');
    if (convId && !initialLoadDone) {
      // Load the conversation from database
      const loadConversation = async () => {
        try {
          const { data, error } = await supabase
            .from("dispatch_conversations")
            .select("*")
            .eq("id", convId)
            .single();

          if (error) throw error;

          const loadedMessages: Message[] = ((data.messages as any[]) || []).map((m: any) => {
            const msg: Message = {
              id: m.id,
              content: m.content,
              role: m.role as "user" | "assistant",
              timestamp: new Date(m.timestamp),
              componentData: m.componentData || undefined,
            };
            return msg;
          });

          setCurrentConversationId(convId);
          setMessages(loadedMessages);
        } catch (error) {
          console.error("Error loading conversation from URL:", error);
          // Remove invalid conv param
          searchParams.delete('conversation');
          searchParams.delete('conv');
          setSearchParams(searchParams);
        } finally {
          setInitialLoadDone(true);
        }
      };
      loadConversation();
    } else if (!convId && currentConversationId && initialLoadDone) {
      // URL cleared - start new conversation
      setCurrentConversationId(null);
      setMessages([]);
      setCsvLeads(null);
    } else {
      setInitialLoadDone(true);
    }
  }, [searchParams, initialLoadDone]);

  // Reconstruct components after messages are loaded
  useEffect(() => {
    if (initialLoadDone && messages.length > 0) {
      const needsReconstruction = messages.some(m => m.componentData && !m.component);
      if (needsReconstruction) {
        setMessages(prev => prev.map(m => {
          if (m.componentData && !m.component) {
            return {
              ...m,
              component: reconstructComponent(m.componentData, m.id)
            };
          }
          return m;
        }));
      }
    }
  }, [initialLoadDone, messages, reconstructComponent]);

  // Track last saved message count for auto-save
  const lastSavedMessagesCount = useRef(0);

  // Auto-save conversation
  const saveConversation = useCallback(async (forceCreate = false) => {
    if (messages.length === 0) return null;

    try {
      // Generate title from first user message
      const firstUserMessage = messages.find(m => m.role === "user");
      const title = firstUserMessage 
        ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "")
        : "Nova conversa";

      const messagesJson = messages.map(m => {
        const msg: Record<string, any> = {
          id: m.id,
          content: m.content,
          role: m.role,
          timestamp: m.timestamp.toISOString(),
        };
        if (m.componentData) {
          msg.componentData = m.componentData;
        }
        return msg;
      });

      if (currentConversationId && !forceCreate) {
        // Update existing
        const { error } = await supabase
          .from("dispatch_conversations")
          .update({ 
            messages: messagesJson,
            updated_at: new Date().toISOString()
          })
          .eq("id", currentConversationId);

        if (error) throw error;
        lastSavedMessagesCount.current = messages.length;
        return currentConversationId;
      } else {
        // Create new
        const { data, error } = await supabase
          .from("dispatch_conversations")
          .insert({ 
            messages: messagesJson,
            title 
          })
          .select()
          .single();

        if (error) throw error;
        lastSavedMessagesCount.current = messages.length;
        return data.id;
      }
    } catch (error) {
      console.error("Error saving conversation:", error);
      return null;
    }
  }, [messages, currentConversationId]);

  // Auto-save when messages change
  useEffect(() => {
    if (!initialLoadDone) return;
    
    if (messages.length > 0 && !currentConversationId && messages.length > lastSavedMessagesCount.current) {
      // First message - create new conversation
      saveConversation(true).then((newId) => {
        if (newId) {
          setCurrentConversationId(newId);
          setSearchParams({ conversation: newId }, { replace: true });
        }
      });
    } else if (messages.length > 0 && currentConversationId && messages.length > lastSavedMessagesCount.current) {
      // Subsequent messages - update existing
      const timeout = setTimeout(() => {
        saveConversation();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [messages, currentConversationId, initialLoadDone, saveConversation]);

  // Reset counter when conversation changes
  useEffect(() => {
    lastSavedMessagesCount.current = messages.length;
  }, [currentConversationId]);

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

        // For email, show choice component instead of editor directly
        if (type === 'email') {
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            content: `Encontrei ${result.data.validLeads} leads válidos na lista "${subOriginName}". Como você quer criar o email?`,
            role: "assistant",
            timestamp: new Date(),
            componentData: {
              type: 'email_choice',
              data: { preview: result.data, subOriginId, dispatchType: type }
            },
            component: (
              <div className="mt-4 space-y-4 w-full">
                {previewComponent}
                <EmailChoiceComponent 
                  onChooseCode={() => handleEmailChoiceCode(subOriginId, type)}
                  onChooseAI={() => handleEmailChoiceAI(subOriginId, type)}
                />
              </div>
            ),
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          // For WhatsApp, show editor directly
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            content: `Encontrei ${result.data.validLeads} leads válidos na lista "${subOriginName}"`,
            role: "assistant",
            timestamp: new Date(),
            componentData: {
              type: 'leads_preview',
              data: { preview: result.data, subOriginId, dispatchType: type }
            },
            component: (
              <div className="mt-4 space-y-4 w-full">
                {previewComponent}
                <HtmlEditorComponent 
                  onSubmit={(html) => handleHtmlSubmit(html, subOriginId, type)}
                />
              </div>
            ),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
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
    
    // Start dispatch directly without showing user message

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
          componentData: {
            type: 'dispatch_progress',
            data: { jobId: result.data.jobId }
          },
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

  // Handle email choice - user has code ready
  const handleEmailChoiceCode = useCallback((subOriginId: string, type: string) => {
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      content: `Ótimo! Cole o código HTML do seu email abaixo:`,
      role: "assistant",
      timestamp: new Date(),
      componentData: {
        type: 'html_editor',
        data: { subOriginId, dispatchType: type }
      },
      component: (
        <div className="mt-4 w-full">
          <HtmlEditorComponent 
            onSubmit={(html) => handleHtmlSubmit(html, subOriginId, type)}
          />
        </div>
      ),
    };
    setMessages(prev => [...prev, assistantMessage]);
  }, []);

// Handle email choice - create with AI (show copy choice first)
  const handleEmailChoiceAI = useCallback((subOriginId: string, type: string) => {
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      content: `Você já tem a copy (texto) do email pronta?`,
      role: "assistant",
      timestamp: new Date(),
      componentData: {
        type: 'copy_choice',
        data: { subOriginId, dispatchType: type }
      },
      component: (
        <div className="mt-4 w-full">
          <CopyChoiceComponent 
            onHasCopy={() => handleHasCopy(subOriginId, type)}
            onCreateCopy={() => handleCreateCopy(subOriginId, type)}
          />
        </div>
      ),
    };
    setMessages(prev => [...prev, assistantMessage]);
  }, []);

  // Handle user has copy ready - show copy input form
  const handleHasCopy = useCallback((subOriginId: string, type: string) => {
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      content: `Ótimo! Cole sua copy abaixo e eu vou transformar em um email HTML profissional:`,
      role: "assistant",
      timestamp: new Date(),
      componentData: {
        type: 'copy_input',
        data: { subOriginId, dispatchType: type }
      },
      component: (
        <div className="mt-4 w-full">
          <CopyInputComponent 
            onGenerate={(copyText, companyName, productService) => 
              handleGenerateFromCopy(copyText, companyName, productService, subOriginId, type)
            }
          />
        </div>
      ),
    };
    setMessages(prev => [...prev, assistantMessage]);
  }, []);

  // Handle create copy from scratch - show full generator form
  const handleCreateCopy = useCallback((subOriginId: string, type: string) => {
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      content: `Perfeito! Vou criar a copy e o HTML do email para você. Me conte mais sobre o que você precisa:`,
      role: "assistant",
      timestamp: new Date(),
      componentData: {
        type: 'email_generator',
        data: { subOriginId, dispatchType: type }
      },
      component: (
        <div className="mt-4 w-full">
          <EmailGeneratorComponent 
            onGenerated={(html) => handleEmailGenerated(html, subOriginId, type)}
          />
        </div>
      ),
    };
    setMessages(prev => [...prev, assistantMessage]);
  }, []);

  // Handle generate HTML from existing copy
  const handleGenerateFromCopy = useCallback(async (
    copyText: string, 
    companyName: string, 
    productService: string,
    subOriginId: string, 
    type: string
  ) => {
    // Add loading message with streaming preview
    const loadingMessage: Message = {
      id: crypto.randomUUID(),
      content: `Gerando HTML do email...`,
      role: "assistant",
      timestamp: new Date(),
      componentData: {
        type: 'email_generator_streaming',
        data: { subOriginId, dispatchType: type }
      },
      component: (
        <div className="mt-4 w-full">
          <CopyToHtmlGenerator 
            copyText={copyText}
            companyName={companyName}
            productService={productService}
            onGenerated={(html) => handleEmailGenerated(html, subOriginId, type)}
          />
        </div>
      ),
    };
    setMessages(prev => [...prev, loadingMessage]);
  }, []);

  // Handle AI generated email
  const handleEmailGenerated = useCallback((html: string, subOriginId: string, type: string) => {
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      content: `Email criado! Você pode revisar e editar abaixo antes de enviar:`,
      role: "assistant",
      timestamp: new Date(),
      componentData: {
        type: 'html_editor',
        data: { subOriginId, dispatchType: type }
      },
      component: (
        <div className="mt-4 w-full">
          <HtmlEditorComponent 
            onSubmit={(finalHtml) => handleHtmlSubmit(finalHtml, subOriginId, type)}
            initialContent={html}
          />
        </div>
      ),
    };
    setMessages(prev => [...prev, assistantMessage]);
  }, []);

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
        let originsData: any = null;
        
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
                originsData = originsResult.data;
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
        
        // Determine componentData based on what was shown
        let componentData: MessageComponentData | undefined;
        if (originsData) {
          componentData = {
            type: 'origins_list',
            data: { origins: originsData }
          };
        }
        
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessageId 
              ? { 
                  ...m, 
                  content: cleanContent,
                  componentData,
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
                    <div className="w-full">
                      <div className="max-w-[85%]">
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-foreground">
                          {formatMessageContent(msg.content)}
                        </p>
                      </div>
                      {msg.component && (
                        <div className="w-full mt-4">
                          {msg.component}
                        </div>
                      )}
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
  return null;
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

// Simple syntax highlighting for HTML
function highlightHtml(code: string): React.ReactNode[] {
  if (!code) return [];
  
  const result: React.ReactNode[] = [];
  let remaining = code;
  let key = 0;
  
  // Regex patterns for HTML syntax with vibrant colors
  const patterns = [
    { regex: /(&lt;!--[\s\S]*?--&gt;|<!--[\s\S]*?-->)/g, className: 'text-gray-400 italic' }, // Comments
    { regex: /(&lt;\/?[a-zA-Z][a-zA-Z0-9]*|<\/?[a-zA-Z][a-zA-Z0-9]*)/g, className: 'text-rose-500' }, // Tags
    { regex: /(&gt;|>)/g, className: 'text-rose-500' }, // Closing brackets
    { regex: /(\{\{[^}]+\}\})/g, className: 'text-emerald-500 font-semibold bg-emerald-500/10 px-0.5 rounded' }, // Template variables
    { regex: /("[^"]*"|'[^']*')/g, className: 'text-sky-500' }, // Strings
    { regex: /(\s[a-zA-Z-]+)(?==)/g, className: 'text-amber-500' }, // Attributes
  ];
  
  // Simple approach: split by lines and apply highlighting
  const lines = code.split('\n');
  
  return lines.map((line, lineIndex) => {
    let processedLine = line;
    const elements: React.ReactNode[] = [];
    
    // Process the line for each pattern
    let lastIndex = 0;
    const matches: { start: number; end: number; text: string; className: string }[] = [];
    
    patterns.forEach(({ regex, className }) => {
      const lineRegex = new RegExp(regex.source, 'g');
      let match;
      while ((match = lineRegex.exec(line)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          className
        });
      }
    });
    
    // Sort matches by start position
    matches.sort((a, b) => a.start - b.start);
    
    // Remove overlapping matches
    const filteredMatches: typeof matches = [];
    for (const match of matches) {
      if (filteredMatches.length === 0 || match.start >= filteredMatches[filteredMatches.length - 1].end) {
        filteredMatches.push(match);
      }
    }
    
    // Build elements
    let currentPos = 0;
    filteredMatches.forEach((match, i) => {
      if (match.start > currentPos) {
        elements.push(<span key={`${lineIndex}-text-${i}`}>{line.slice(currentPos, match.start)}</span>);
      }
      elements.push(<span key={`${lineIndex}-match-${i}`} className={match.className}>{match.text}</span>);
      currentPos = match.end;
    });
    
    if (currentPos < line.length) {
      elements.push(<span key={`${lineIndex}-end`}>{line.slice(currentPos)}</span>);
    }
    
    if (elements.length === 0) {
      elements.push(<span key={`${lineIndex}-empty`}>{line || ' '}</span>);
    }
    
    return (
      <div key={lineIndex} className="min-h-[1.5em]">
        {elements}
      </div>
    );
  });
}

// Shared component for editing generated HTML with tabs
function EmailEditorWithTabs({
  html,
  isGenerating,
  onHtmlChange,
  onRegenerate,
  onUse
}: {
  html: string;
  isGenerating: boolean;
  onHtmlChange: (html: string) => void;
  onRegenerate?: () => void;
  onUse: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('preview');

  const getSanitizedHtml = () => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-4"
    >
      <div className="rounded-xl border border-border/40 overflow-hidden">
        {/* Header with tabs */}
        <div className="px-4 py-2.5 bg-muted/80 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {isGenerating && (
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2" />
            )}
            <button
              onClick={() => setActiveTab('code')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeTab === 'code'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              Código
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeTab === 'preview'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              Preview
            </button>
          </div>
          {!isGenerating && html && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Gerar novamente
            </button>
          )}
        </div>
        
        {/* Content area */}
        <div className="min-h-[300px] max-h-[400px] overflow-auto">
          {activeTab === 'code' ? (
            <textarea
              value={html}
              onChange={(e) => onHtmlChange(e.target.value)}
              className="w-full h-full min-h-[300px] p-4 bg-background text-sm font-mono text-foreground resize-none focus:outline-none"
              placeholder="HTML do email..."
              disabled={isGenerating}
            />
          ) : (
            <div className="bg-white p-4">
              {html ? (
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: getSanitizedHtml() }}
                />
              ) : (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Iniciando geração...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Use email button */}
      {!isGenerating && html && (
        <div className="flex justify-end">
          <button
            onClick={onUse}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
              "bg-foreground text-background hover:bg-foreground/90"
            )}
          >
            Usar este email
          </button>
        </div>
      )}
    </motion.div>
  );
}

// Component for choosing between code or AI generation
function EmailChoiceComponent({ 
  onChooseCode, 
  onChooseAI 
}: { 
  onChooseCode: () => void; 
  onChooseAI: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onChooseCode}
          className="px-4 py-2 rounded-lg border border-border/40 bg-background hover:bg-muted/50 transition-all text-sm font-medium text-foreground"
        >
          Já tenho o HTML
        </button>
        <button
          onClick={onChooseAI}
          className="px-4 py-2 rounded-lg border border-border/40 bg-background hover:bg-muted/50 transition-all text-sm font-medium text-foreground"
        >
          Criar com IA
        </button>
      </div>
    </motion.div>
  );
}

// Component for choosing if user has copy ready or needs to create
function CopyChoiceComponent({ 
  onHasCopy, 
  onCreateCopy 
}: { 
  onHasCopy: () => void; 
  onCreateCopy: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onHasCopy}
          className="px-4 py-2 rounded-lg border border-border/40 bg-background hover:bg-muted/50 transition-all text-sm font-medium text-foreground"
        >
          Já tenho a copy
        </button>
        <button
          onClick={onCreateCopy}
          className="px-4 py-2 rounded-lg border border-border/40 bg-background hover:bg-muted/50 transition-all text-sm font-medium text-foreground"
        >
          Criar copy com IA
        </button>
      </div>
    </motion.div>
  );
}

// Component for inputting existing copy text
function CopyInputComponent({ 
  onGenerate 
}: { 
  onGenerate: (copyText: string, companyName: string, productService: string) => void;
}) {
  const [copyText, setCopyText] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [productService, setProductService] = useState('');

  const handleSubmit = () => {
    if (!copyText.trim()) {
      toast.error("Por favor, cole o texto do seu email");
      return;
    }
    onGenerate(copyText, companyName, productService);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="space-y-4 p-5 rounded-xl border border-border/40 bg-muted/30">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Texto do email (copy) *
          </label>
          <textarea
            value={copyText}
            onChange={(e) => setCopyText(e.target.value)}
            placeholder="Cole aqui o texto completo do seu email...

Ex:
Olá {{name}},

Tenho uma oferta especial para você! Por tempo limitado, todos os nossos serviços estão com 30% de desconto.

Não perca essa oportunidade única...

Abraços,
Equipe XYZ"
            className="w-full min-h-[180px] p-3 rounded-lg border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Use <code className="bg-muted px-1 py-0.5 rounded">{"{{name}}"}</code> para personalizar com o nome do lead
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Nome da empresa (opcional)
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Scale Beauty"
              className="w-full p-3 rounded-lg border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Produto/Serviço (opcional)
            </label>
            <input
              type="text"
              value={productService}
              onChange={(e) => setProductService(e.target.value)}
              placeholder="Ex: Tratamentos estéticos"
              className="w-full p-3 rounded-lg border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!copyText.trim()}
          className={cn(
            "w-full px-5 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
            "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          Gerar HTML do Email
        </button>
      </div>
    </motion.div>
  );
}

// Component for generating HTML from existing copy with streaming
function CopyToHtmlGenerator({ 
  copyText,
  companyName,
  productService,
  onGenerated 
}: { 
  copyText: string;
  companyName: string;
  productService: string;
  onGenerated: (html: string) => void;
}) {
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [isGenerating, setIsGenerating] = useState(true);

  const GENERATE_EMAIL_URL = `https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/generate-email`;

  useEffect(() => {
    const generateHtml = async () => {
      try {
        const response = await fetch(GENERATE_EMAIL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hasCopy: true,
            copyText,
            companyName,
            productService
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Erro ao gerar HTML");
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                fullContent += content;
                setGeneratedHtml(fullContent);
              }
            } catch {
              // Incomplete JSON, continue
            }
          }
        }

        // Clean up the HTML
        let cleanHtml = fullContent
          .replace(/^```html\n?/i, '')
          .replace(/^```\n?/, '')
          .replace(/\n?```$/i, '')
          .trim();

        setGeneratedHtml(cleanHtml);
        setIsGenerating(false);
        toast.success("HTML do email gerado!");

      } catch (error) {
        console.error("Error generating HTML:", error);
        toast.error(error instanceof Error ? error.message : "Erro ao gerar HTML");
        setIsGenerating(false);
      }
    };

    generateHtml();
  }, [copyText, companyName, productService]);

  const handleUseEmail = () => {
    if (generatedHtml.trim()) {
      onGenerated(generatedHtml);
    }
  };

  return (
    <EmailEditorWithTabs
      html={generatedHtml}
      isGenerating={isGenerating}
      onHtmlChange={setGeneratedHtml}
      onUse={handleUseEmail}
    />
  );
}

// Component for AI email generation with streaming - simplified version
function EmailGeneratorComponent({ 
  onGenerated 
}: { 
  onGenerated: (html: string) => void;
}) {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const GENERATE_EMAIL_URL = `https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/generate-email`;

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast.error("Por favor, descreva o seu serviço/produto ou ideia");
      return;
    }

    setIsGenerating(true);
    setGeneratedHtml('');
    setShowPreview(true);

    try {
      const response = await fetch(GENERATE_EMAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: description,
          tone: 'profissional',
          companyName: '',
          productService: '',
          additionalInfo: ''
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro ao gerar email");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullContent += content;
              setGeneratedHtml(fullContent);
            }
          } catch {
            // Incomplete JSON, continue
          }
        }
      }

      // Clean up the HTML (remove markdown code blocks if present)
      let cleanHtml = fullContent
        .replace(/^```html\n?/i, '')
        .replace(/^```\n?/, '')
        .replace(/\n?```$/i, '')
        .trim();

      setGeneratedHtml(cleanHtml);
      toast.success("Email gerado com sucesso!");

    } catch (error) {
      console.error("Error generating email:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao gerar email");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseEmail = () => {
    if (generatedHtml.trim()) {
      onGenerated(generatedHtml);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-4"
    >
      {!showPreview ? (
        <div className="space-y-3">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva seu serviço, produto ou a ideia do email..."
            className="w-full min-h-[100px] p-3 rounded-lg border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
          <button
            onClick={handleGenerate}
            disabled={!description.trim() || isGenerating}
            className={cn(
              "w-full px-5 py-2.5 rounded-lg text-sm font-medium transition-all",
              "bg-foreground text-background hover:bg-foreground/90",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            Gerar Email
          </button>
        </div>
      ) : (
        <EmailEditorWithTabs
          html={generatedHtml}
          isGenerating={isGenerating}
          onHtmlChange={setGeneratedHtml}
          onRegenerate={() => setShowPreview(false)}
          onUse={handleUseEmail}
        />
      )}
    </motion.div>
  );
}

// Component for HTML/message input - Modern code editor with syntax highlighting and preview
function HtmlEditorComponent({ onSubmit, initialContent = '' }: { onSubmit: (html: string) => void; initialContent?: string }) {
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const preRef = React.useRef<HTMLPreElement>(null);

  // Update content when initialContent changes
  React.useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
    }
  }, [initialContent]);

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

  // Sync scroll between textarea and pre
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Handle keyboard shortcut to submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Basic HTML sanitization for preview (removes script tags)
  const getSanitizedHtml = () => {
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="w-full">
        <div className="text-xs text-muted-foreground mb-2 text-left">
          Template do Email · Use <code className="bg-muted px-1 py-0.5 rounded text-xs text-foreground">{"{{name}}"}</code> para personalizar
        </div>
        
        {/* Code editor container */}
        <div className="rounded-xl overflow-hidden border border-border/40 shadow-sm bg-muted/50">
          {/* Header bar with tabs */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/80 border-b border-border/40">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('code')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  activeTab === 'code'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                Código
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  activeTab === 'preview'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                Preview
              </button>
            </div>
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
          
          {/* Content area */}
          {activeTab === 'code' ? (
            /* Editor with syntax highlighting overlay */
            <div className="relative min-h-[280px]">
              {/* Highlighted code display */}
              <pre
                ref={preRef}
                className="absolute inset-0 p-5 font-mono text-sm text-foreground pointer-events-none overflow-auto whitespace-pre-wrap break-words"
                aria-hidden="true"
              >
                {content ? highlightHtml(content) : (
                  <span className="text-muted-foreground">
                    {`Cole aqui o HTML do email...

Exemplo:
<h1>Olá {{name}}!</h1>
<p>Temos uma oferta especial.</p>

Cmd/Ctrl + Enter para enviar`}
                  </span>
                )}
              </pre>
              
              {/* Actual textarea for input */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                className="relative w-full min-h-[280px] p-5 bg-transparent font-mono text-sm text-transparent caret-foreground focus:outline-none resize-y"
                spellCheck={false}
              />
            </div>
          ) : (
            /* Preview area */
            <div className="min-h-[280px] p-5 bg-white overflow-auto">
              {content.trim() ? (
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: getSanitizedHtml() }}
                />
              ) : (
                <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
                  Digite o HTML na aba "Código" para visualizar aqui
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Submit button below - aligned right */}
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim()}
            className={cn(
              "px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2",
              "bg-black text-white hover:bg-gray-800",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Iniciando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                Enviar
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
