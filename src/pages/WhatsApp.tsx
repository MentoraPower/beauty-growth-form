import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Search, Smile, Paperclip, Mic, Send, Check, CheckCheck, RefreshCw, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CallModal from "@/components/whatsapp/CallModal";
interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  avatar: string;
  phone: string;
  photo_url: string | null;
}

interface Message {
  id: string;
  text: string;
  time: string;
  sent: boolean;
  read: boolean;
  status: string;
}

const WhatsApp = () => {
  const { toast } = useToast();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getInitials = (name: string): string => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Ontem";
    } else {
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    }
  };

  const fetchChats = async () => {
    setIsLoadingChats(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_chats")
        .select("*")
        .order("last_message_time", { ascending: false });

      if (error) throw error;

      const formattedChats: Chat[] = (data || []).map((chat: any) => ({
        id: chat.id,
        name: chat.name || chat.phone,
        lastMessage: chat.last_message || "",
        time: chat.last_message_time ? formatTime(chat.last_message_time) : "",
        unread: chat.unread_count || 0,
        avatar: getInitials(chat.name || chat.phone),
        phone: chat.phone,
        photo_url: chat.photo_url,
      }));

      setChats(formattedChats);
    } catch (error: any) {
      console.error("Error fetching chats:", error);
      toast({
        title: "Erro ao carregar conversas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingChats(false);
    }
  };

  const fetchMessages = async (chatId: string) => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const formattedMessages: Message[] = (data || []).map((msg: any) => ({
        id: msg.id,
        text: msg.text || (msg.media_type ? `[${msg.media_type}]` : ""),
        time: msg.created_at ? new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
        sent: msg.from_me || false,
        read: msg.status === "READ" || msg.status === "PLAYED",
        status: msg.status,
      }));

      setMessages(formattedMessages);

      // Mark as read
      if (selectedChat) {
        await supabase
          .from("whatsapp_chats")
          .update({ unread_count: 0 })
          .eq("id", chatId);
      }
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      toast({
        title: "Erro ao carregar mensagens",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedChat) return;

    setIsSending(true);
    try {
      // Send via Z-API
      const { data, error } = await supabase.functions.invoke("zapi-whatsapp", {
        body: {
          action: "send-text",
          phone: selectedChat.phone,
          message: message.trim(),
        },
      });

      if (error) throw error;

      // Save to database
      const { error: insertError } = await supabase
        .from("whatsapp_messages")
        .insert({
          chat_id: selectedChat.id,
          message_id: data?.messageId || `local-${Date.now()}`,
          phone: selectedChat.phone,
          text: message.trim(),
          from_me: true,
          status: "SENT",
        });

      if (insertError) {
        console.error("Error saving message:", insertError);
      }

      // Update chat last message
      await supabase
        .from("whatsapp_chats")
        .update({
          last_message: message.trim(),
          last_message_time: new Date().toISOString(),
        })
        .eq("id", selectedChat.id);

      setMessage("");

      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso",
      });
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const syncFromZAPI = async () => {
    setIsLoadingChats(true);
    try {
      const { data, error } = await supabase.functions.invoke("zapi-whatsapp", {
        body: { action: "get-chats" },
      });

      if (error) throw error;

      console.log("Z-API chats received:", data?.length || 0);

      if (Array.isArray(data) && data.length > 0) {
        let syncedCount = 0;
        
        for (const chat of data) {
          const phone = chat.phone || "";
          if (!phone) continue;
          
          // Convert timestamp (seconds) to ISO string
          let lastMessageTime = new Date().toISOString();
          if (chat.timestamp) {
            lastMessageTime = new Date(chat.timestamp * 1000).toISOString();
          }
          
          const chatData = {
            phone: phone,
            name: chat.name || phone,
            photo_url: chat.photo || null,
            last_message: chat.lastMessage || "",
            last_message_time: lastMessageTime,
            unread_count: chat.unreadCount || 0,
          };

          const { error: upsertError } = await supabase
            .from("whatsapp_chats")
            .upsert(chatData, { onConflict: "phone" });
            
          if (!upsertError) syncedCount++;
        }

        await fetchChats();
        toast({
          title: "Sincronizado",
          description: `${syncedCount} conversas sincronizadas com sucesso`,
        });
      } else {
        toast({
          title: "Nenhuma conversa",
          description: "Nenhuma conversa encontrada no Z-API",
        });
      }
    } catch (error: any) {
      console.error("Error syncing from Z-API:", error);
      toast({
        title: "Erro ao sincronizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingChats(false);
    }
  };

  const initiateCall = async () => {
    if (!selectedChat) return;

    const { data, error } = await supabase.functions.invoke("twilio-call", {
      body: { to: selectedChat.phone },
    });

    if (error) throw error;

    toast({
      title: "Ligação iniciada",
      description: `Chamando ${selectedChat.name}...`,
    });
  };

  const openCallModal = () => {
    if (!selectedChat) return;
    setIsCallModalOpen(true);
  };

  // Initial fetch
  useEffect(() => {
    fetchChats();
  }, []);

  // Realtime subscription for chats
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-chats-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_chats" },
        () => {
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedChat) return;

    const channel = supabase
      .channel("whatsapp-messages-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `chat_id=eq.${selectedChat.id}` },
        (payload) => {
          const msg = payload.new as any;
          const newMessage: Message = {
            id: msg.id,
            text: msg.text || "",
            time: msg.created_at ? new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
            sent: msg.from_me || false,
            read: msg.status === "READ",
            status: msg.status,
          };
          setMessages((prev) => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat]);

  // Fetch messages when chat selected
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
    }
  }, [selectedChat]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.phone.includes(searchQuery)
  );

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-2rem)] flex rounded-2xl overflow-hidden border border-border/50 bg-card -mt-4">
        {/* Left Sidebar - Chat List */}
        <div className="w-[380px] flex flex-col border-r border-border/50 bg-card">
          {/* Header */}
          <div className="h-14 px-4 flex items-center justify-between bg-muted/30 border-b border-border/30">
            <h2 className="font-medium text-foreground">Conversas</h2>
            <button
              onClick={syncFromZAPI}
              disabled={isLoadingChats}
              className="p-2 hover:bg-muted/50 rounded-full transition-colors"
              title="Sincronizar com Z-API"
            >
              <RefreshCw className={cn("w-4 h-4 text-muted-foreground", isLoadingChats && "animate-spin")} />
            </button>
          </div>

          {/* Search */}
          <div className="p-2 border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar conversa"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/30 border-0 h-9 text-sm placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingChats ? (
              <div className="flex items-center justify-center h-full py-20">
                <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
              </div>
            ) : filteredChats.length > 0 ? (
              filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/20",
                    selectedChat?.id === chat.id ? "bg-muted/40" : "hover:bg-muted/20"
                  )}
                >
                  <div className="relative">
                    {chat.photo_url ? (
                      <img src={chat.photo_url} alt={chat.name} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center text-foreground font-medium">
                        {chat.avatar}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground truncate">{chat.name}</span>
                      <span className={cn("text-xs flex-shrink-0", chat.unread > 0 ? "text-emerald-500" : "text-muted-foreground")}>
                        {chat.time}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-sm text-muted-foreground truncate pr-2">{chat.lastMessage}</p>
                      {chat.unread > 0 && (
                        <span className="min-w-[20px] h-5 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center px-1.5">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center h-full py-20 gap-2">
                <p className="text-sm text-muted-foreground">Nenhuma conversa</p>
                <button
                  onClick={syncFromZAPI}
                  className="text-xs text-emerald-500 hover:underline"
                >
                  Sincronizar do Z-API
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="h-14 px-4 flex items-center gap-3 bg-muted/30 border-b border-border/30">
                <div className="relative">
                  {selectedChat.photo_url ? (
                    <img src={selectedChat.photo_url} alt={selectedChat.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center text-foreground font-medium">
                      {selectedChat.avatar}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">{selectedChat.name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedChat.phone}</p>
                </div>
                <button
                  onClick={openCallModal}
                  className="p-2 hover:bg-emerald-500/10 rounded-full transition-colors"
                  title="Fazer ligação"
                >
                  <Phone className="w-5 h-5 text-emerald-500" />
                </button>
                <button
                  onClick={() => fetchMessages(selectedChat.id)}
                  disabled={isLoadingMessages}
                  className="p-2 hover:bg-muted/50 rounded-full transition-colors"
                >
                  <RefreshCw className={cn("w-4 h-4 text-muted-foreground", isLoadingMessages && "animate-spin")} />
                </button>
              </div>

              {/* Messages Area */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-2"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  backgroundColor: "hsl(var(--muted) / 0.15)",
                }}
              >
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">Nenhuma mensagem</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={cn("flex", msg.sent ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[65%] rounded-lg px-3 py-2 shadow-sm",
                          msg.sent ? "bg-emerald-100 dark:bg-emerald-900/30 rounded-tr-none" : "bg-card rounded-tl-none"
                        )}
                      >
                        <p className="text-sm text-foreground whitespace-pre-wrap">{msg.text}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                          {msg.sent && (
                            msg.status === "READ" || msg.status === "PLAYED" 
                              ? <CheckCheck className="w-4 h-4 text-blue-500" /> 
                              : msg.status === "RECEIVED" || msg.status === "DELIVERED"
                                ? <CheckCheck className="w-4 h-4 text-muted-foreground" />
                                : <Check className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="h-16 px-4 flex items-center gap-3 bg-muted/30 border-t border-border/30">
                <button className="p-2 hover:bg-muted/50 rounded-full transition-colors">
                  <Smile className="w-6 h-6 text-muted-foreground" />
                </button>
                <button className="p-2 hover:bg-muted/50 rounded-full transition-colors">
                  <Paperclip className="w-6 h-6 text-muted-foreground" />
                </button>
                <Input
                  placeholder="Digite uma mensagem"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={isSending}
                  className="flex-1 bg-card border-0 h-10 text-sm"
                />
                <button
                  onClick={sendMessage}
                  disabled={!message.trim() || isSending}
                  className="p-2 hover:bg-muted/50 rounded-full transition-colors disabled:opacity-50"
                >
                  {message ? <Send className={cn("w-6 h-6 text-emerald-500", isSending && "animate-pulse")} /> : <Mic className="w-6 h-6 text-muted-foreground" />}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/10">
              <div className="text-center">
                <p className="text-muted-foreground">Selecione uma conversa para começar</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Call Modal */}
      {selectedChat && (
        <CallModal
          isOpen={isCallModalOpen}
          onClose={() => setIsCallModalOpen(false)}
          contactName={selectedChat.name}
          contactPhone={selectedChat.phone}
          contactAvatar={selectedChat.photo_url}
          onInitiateCall={initiateCall}
        />
      )}
    </DashboardLayout>
  );
};

export default WhatsApp;
