import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Search, Smile, Paperclip, Mic, Send, Check, CheckCheck, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  avatar: string;
  online: boolean;
  phone: string;
}

interface Message {
  id: string;
  text: string;
  time: string;
  sent: boolean;
  read: boolean;
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

  const fetchChats = async () => {
    setIsLoadingChats(true);
    try {
      const { data, error } = await supabase.functions.invoke("zapi-whatsapp", {
        body: { action: "get-chats" },
      });

      if (error) throw error;

      console.log("Chats response:", data);

      // Transform Z-API response to our Chat format
      if (Array.isArray(data)) {
        const formattedChats: Chat[] = data.slice(0, 50).map((chat: any, index: number) => ({
          id: chat.phone || chat.id || String(index),
          name: chat.name || chat.phone || "Desconhecido",
          lastMessage: chat.lastMessageText || chat.text?.message || "",
          time: chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
          unread: chat.unreadCount || 0,
          avatar: getInitials(chat.name || chat.phone || "?"),
          online: false,
          phone: chat.phone || "",
        }));
        setChats(formattedChats);
      }
    } catch (error: any) {
      console.error("Error fetching chats:", error);
      toast({
        title: "Erro ao carregar conversas",
        description: error.message || "Verifique as credenciais da Z-API",
        variant: "destructive",
      });
    } finally {
      setIsLoadingChats(false);
    }
  };

  const fetchMessages = async (chatId: string) => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase.functions.invoke("zapi-whatsapp", {
        body: { action: "get-chat-messages", chatId },
      });

      if (error) throw error;

      console.log("Messages response:", data);

      // Transform Z-API response to our Message format
      if (Array.isArray(data)) {
        const formattedMessages: Message[] = data.map((msg: any) => ({
          id: msg.messageId || msg.id || String(Math.random()),
          text: msg.text?.message || msg.body || msg.message || "",
          time: msg.momment ? new Date(msg.momment).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
          sent: msg.fromMe || false,
          read: msg.status === "READ" || msg.status === "PLAYED",
        })).filter((msg: Message) => msg.text);
        
        setMessages(formattedMessages.reverse());
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
      const { data, error } = await supabase.functions.invoke("zapi-whatsapp", {
        body: {
          action: "send-text",
          phone: selectedChat.phone,
          message: message.trim(),
        },
      });

      if (error) throw error;

      console.log("Send message response:", data);

      // Add message to local state
      const newMessage: Message = {
        id: data.messageId || String(Date.now()),
        text: message.trim(),
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        sent: true,
        read: false,
      };

      setMessages((prev) => [...prev, newMessage]);
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

  const getInitials = (name: string): string => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.phone);
    }
  }, [selectedChat]);

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
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
              onClick={fetchChats}
              disabled={isLoadingChats}
              className="p-2 hover:bg-muted/50 rounded-full transition-colors"
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
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center text-foreground font-medium">
                      {chat.avatar}
                    </div>
                    {chat.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-card" />
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
              <div className="flex-1 flex items-center justify-center h-full py-20">
                <p className="text-sm text-muted-foreground">Nenhuma conversa</p>
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
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center text-foreground font-medium">
                    {selectedChat.avatar}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">{selectedChat.name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedChat.phone}</p>
                </div>
                <button
                  onClick={() => fetchMessages(selectedChat.phone)}
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
                          {msg.sent && (msg.read ? <CheckCheck className="w-4 h-4 text-blue-500" /> : <Check className="w-4 h-4 text-muted-foreground" />)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
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
    </DashboardLayout>
  );
};

export default WhatsApp;
