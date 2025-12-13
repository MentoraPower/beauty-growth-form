import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Send, RefreshCw, ExternalLink } from "lucide-react";
import Instagram from "@/components/icons/Instagram";
import WhatsApp from "@/components/icons/WhatsApp";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  id: string;
  text: string;
  time: string;
  sent: boolean;
}

interface LeadContactPanelProps {
  lead: {
    name: string;
    instagram: string;
    whatsapp: string;
    country_code: string;
  };
}

export function LeadContactPanel({ lead }: LeadContactPanelProps) {
  const [activeTab, setActiveTab] = useState<"instagram" | "whatsapp">("instagram");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getInstagramHandle = () => {
    let handle = lead.instagram || "";
    handle = handle.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "");
    return handle.split("/")[0].split("?")[0];
  };

  const getWhatsAppNumber = () => {
    const countryCode = (lead.country_code || "+55").replace(/\D/g, "");
    const phone = (lead.whatsapp || "").replace(/\D/g, "");
    return `${countryCode}${phone}`;
  };

  const fetchOrCreateChat = async () => {
    if (!lead.whatsapp) return;
    
    setIsLoading(true);
    try {
      const phone = getWhatsAppNumber();
      
      // Try to find existing chat
      const { data: existingChat } = await supabase
        .from("whatsapp_chats")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();

      if (existingChat) {
        setChatId(existingChat.id);
        // Fetch messages
        const { data: messagesData } = await supabase
          .from("whatsapp_messages")
          .select("*")
          .eq("chat_id", existingChat.id)
          .order("created_at", { ascending: true });

        if (messagesData) {
          setMessages(messagesData.map((msg: any) => ({
            id: msg.id,
            text: msg.text || "",
            time: msg.created_at ? new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
            sent: msg.from_me || false,
          })));
        }
      } else {
        // Create new chat
        const { data: newChat, error } = await supabase
          .from("whatsapp_chats")
          .insert({
            phone: phone,
            name: lead.name,
          })
          .select()
          .single();

        if (newChat) {
          setChatId(newChat.id);
        }
      }
    } catch (error) {
      console.error("Error fetching chat:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !chatId) return;

    setIsSending(true);
    try {
      const phone = getWhatsAppNumber();
      
      // Send via Z-API
      const { data, error } = await supabase.functions.invoke("zapi-whatsapp", {
        body: {
          action: "send-text",
          phone: phone,
          message: message.trim(),
        },
      });

      if (error) throw error;

      // Save to database
      await supabase
        .from("whatsapp_messages")
        .insert({
          chat_id: chatId,
          message_id: data?.messageId || `local-${Date.now()}`,
          phone: phone,
          text: message.trim(),
          from_me: true,
          status: "SENT",
        });

      // Update chat last message
      await supabase
        .from("whatsapp_chats")
        .update({
          last_message: message.trim(),
          last_message_time: new Date().toISOString(),
        })
        .eq("id", chatId);

      // Add to local messages
      setMessages(prev => [...prev, {
        id: `local-${Date.now()}`,
        text: message.trim(),
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        sent: true,
      }]);

      setMessage("");
      toast.success("Mensagem enviada!");
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (activeTab === "whatsapp" && lead.whatsapp) {
      fetchOrCreateChat();
    }
  }, [activeTab, lead.whatsapp]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`lead-whatsapp-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const msg = payload.new as any;
          if (!msg.from_me) {
            setMessages(prev => [...prev, {
              id: msg.id,
              text: msg.text || "",
              time: msg.created_at ? new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
              sent: false,
            }]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
      className="h-full"
    >
      <Card className="border-[#00000010] shadow-none overflow-hidden h-full min-h-[calc(100vh-12rem)] flex flex-col">
        <CardContent className="p-0 h-full flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-border pt-4 px-4">
            <button
              onClick={() => setActiveTab("instagram")}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === "instagram" 
                  ? "text-primary border-b-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Instagram className="w-4 h-4" />
              Instagram
            </button>
            <button
              onClick={() => setActiveTab("whatsapp")}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === "whatsapp" 
                  ? "text-primary border-b-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <WhatsApp className="w-4 h-4" />
              WhatsApp
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === "instagram" ? (
              lead.instagram ? (
                <div className="flex-1 flex flex-col">
                  {/* Instagram Header */}
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                        <Instagram className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold">@{getInstagramHandle()}</p>
                        <p className="text-xs text-muted-foreground">Perfil do Instagram</p>
                      </div>
                    </div>
                    <a
                      href={`https://www.instagram.com/${getInstagramHandle()}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-muted rounded-full transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                  </div>
                  {/* Instagram Embed */}
                  <div className="flex-1 overflow-hidden">
                    <iframe
                      src={`https://www.instagram.com/${getInstagramHandle()}/embed`}
                      className="w-full h-full border-0"
                      title={`Instagram de ${lead.name}`}
                      scrolling="yes"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                  <Instagram className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <p className="text-sm text-muted-foreground">Instagram não informado</p>
                </div>
              )
            ) : (
              lead.whatsapp ? (
                <div className="flex-1 flex flex-col">
                  {/* WhatsApp Header */}
                  <div className="p-4 border-b border-border flex items-center justify-between bg-emerald-500/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                        <WhatsApp className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.country_code} {lead.whatsapp}</p>
                      </div>
                    </div>
                    {isLoading && <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />}
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
                    {messages.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center h-full text-center">
                        <WhatsApp className="w-12 h-12 text-muted-foreground/20 mb-4" />
                        <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
                        <p className="text-xs text-muted-foreground mt-1">Envie uma mensagem para iniciar a conversa</p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sent ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] px-3 py-2 rounded-lg ${
                              msg.sent
                                ? "bg-emerald-500 text-white rounded-br-none"
                                : "bg-card border border-border rounded-bl-none"
                            }`}
                          >
                            <p className="text-sm">{msg.text}</p>
                            <p className={`text-[10px] mt-1 ${msg.sent ? "text-emerald-100" : "text-muted-foreground"}`}>
                              {msg.time}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-border bg-card">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Digite sua mensagem..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isSending || !chatId}
                        className="flex-1"
                      />
                      <button
                        onClick={sendMessage}
                        disabled={isSending || !message.trim() || !chatId}
                        className="p-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSending ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                  <WhatsApp className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <p className="text-sm text-muted-foreground">WhatsApp não informado</p>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
