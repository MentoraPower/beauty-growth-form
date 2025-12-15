import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Search, Smile, Paperclip, Mic, Send, Check, CheckCheck, RefreshCw, Phone, Image, File, Play, Trash2 } from "lucide-react";
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
  mediaUrl?: string | null;
  mediaType?: string | null;
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string): string => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Check if phone is a WhatsApp internal ID (LID) instead of a real number
  const isWhatsAppInternalId = (phone: string): boolean => {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, "");
    // WhatsApp LIDs are typically very long (15+ digits) and start with specific patterns
    if (cleaned.length > 14) return true;
    // LIDs often start with 120, 146, 180, 203, 234, 447 patterns
    if (/^(120|146|180|203|234|447)\d{10,}$/.test(cleaned)) return true;
    return false;
  };

  const formatPhoneDisplay = (phone: string): string => {
    if (!phone) return "";
    // If it's an internal WhatsApp ID, show "Contato" instead
    if (isWhatsAppInternalId(phone)) {
      return "Contato";
    }
    // Format phone for display: +55 44 9123-4567
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 13) {
      // Brazilian format: 55 + DDD (2) + number (9)
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    } else if (cleaned.length === 12) {
      // Brazilian format without 9: 55 + DDD (2) + number (8)
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    } else if (cleaned.length >= 10) {
      // Generic format
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
    }
    return phone;
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

      // Filter out only channels and groups - keep all other contacts
      const validChats = (data || []).filter((chat: any) => {
        const phone = chat.phone || "";
        // Only exclude clear non-contacts
        if (phone.includes("@newsletter")) return false; // Channels
        if (phone.includes("@g.us")) return false; // Groups
        if (phone.includes("status@broadcast")) return false;
        if (phone === "0" || phone === "") return false; // Empty
        return true;
      });

      // De-dupe chats that represent the same contact (common with WAHA LIDs)
      // If two chats share the same photo, prefer the one with a real phone number.
      const dedupedChats = Object.values(
        validChats.reduce((acc: Record<string, any>, chat: any) => {
          const photoKey = chat.photo_url ? String(chat.photo_url).split("?")[0] : "";
          const key = photoKey || chat.phone;
          const existing = acc[key];
          if (!existing) {
            acc[key] = chat;
            return acc;
          }

          const existingIsInternal = isWhatsAppInternalId(existing.phone || "");
          const currentIsInternal = isWhatsAppInternalId(chat.phone || "");

          // Prefer real phone over internal id
          if (existingIsInternal && !currentIsInternal) {
            acc[key] = chat;
            return acc;
          }
          if (!existingIsInternal && currentIsInternal) {
            return acc;
          }

          // Otherwise keep the most recent chat
          const existingTime = existing.last_message_time ? new Date(existing.last_message_time).getTime() : 0;
          const currentTime = chat.last_message_time ? new Date(chat.last_message_time).getTime() : 0;
          if (currentTime > existingTime) acc[key] = chat;
          return acc;
        }, {})
      );

      const formattedChats: Chat[] = dedupedChats.map((chat: any) => {
        const rawName = chat.name ? String(chat.name).trim() : "";
        const nameLooksLikeNumber = /^\d+$/.test(rawName);
        const displayName = !rawName || nameLooksLikeNumber || rawName === String(chat.phone)
          ? formatPhoneDisplay(chat.phone)
          : rawName;

        return {
          id: chat.id,
          name: displayName,
          lastMessage: chat.last_message || "",
          time: chat.last_message_time ? formatTime(chat.last_message_time) : "",
          unread: chat.unread_count || 0,
          avatar: getInitials(displayName || chat.phone),
          phone: chat.phone,
          photo_url: chat.photo_url,
        };
      });

      setChats(formattedChats);
    } catch (error: any) {
      console.error("Error fetching chats:", error);
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
        text: msg.text || "",
        time: msg.created_at ? new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
        sent: msg.from_me || false,
        read: msg.status === "READ" || msg.status === "PLAYED",
        status: msg.status,
        mediaUrl: msg.media_url,
        mediaType: msg.media_type,
      }));

      setMessages(formattedMessages);

      // Mark as read
      await supabase
        .from("whatsapp_chats")
        .update({ unread_count: 0 })
        .eq("id", chatId);
        
      // Update local state
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, unread: 0 } : c));
    } catch (error: any) {
      console.error("Error fetching messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedChat) return;

    const messageText = message.trim();
    setMessage("");
    setIsSending(true);
    
    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      text: messageText,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      sent: true,
      read: false,
      status: "SENDING",
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      const { data, error } = await supabase.functions.invoke("w-api-whatsapp", {
        body: {
          action: "send-text",
          phone: selectedChat.phone,
          text: messageText,
        },
      });

      if (error) throw error;

      // Save to database
      await supabase
        .from("whatsapp_messages")
        .insert({
          chat_id: selectedChat.id,
          message_id: data?.messageId || `local-${Date.now()}`,
          phone: selectedChat.phone,
          text: messageText,
          from_me: true,
          status: "SENT",
        });

      // Update chat last message
      await supabase
        .from("whatsapp_chats")
        .update({
          last_message: messageText,
          last_message_time: new Date().toISOString(),
        })
        .eq("id", selectedChat.id);

      // Update optimistic message status
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "SENT" } : m));
      
    } catch (error: any) {
      console.error("Error sending message:", error);
      // Remove failed message
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const syncAllChats = async () => {
    setIsSyncing(true);
    try {
      toast({
        title: "Sincronizando...",
        description: "Buscando todas as conversas do WhatsApp",
      });

      const { data, error } = await supabase.functions.invoke("w-api-whatsapp", {
        body: { action: "sync-all" },
      });

      if (error) throw error;

      await fetchChats();
      
      toast({
        title: "Sincronização completa",
        description: `${data?.syncedChats || 0} conversas e ${data?.syncedMessages || 0} mensagens sincronizadas`,
      });
    } catch (error: any) {
      console.error("Error syncing:", error);
      toast({
        title: "Erro ao sincronizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const clearAllChats = async () => {
    if (!confirm("Tem certeza que deseja apagar TODAS as conversas e mensagens? Esta ação não pode ser desfeita.")) {
      return;
    }

    setIsClearing(true);
    try {
      // First get all chat IDs to delete their messages
      const { data: chatsToDelete } = await supabase
        .from("whatsapp_chats")
        .select("id");

      if (chatsToDelete && chatsToDelete.length > 0) {
        const chatIds = chatsToDelete.map((c: any) => c.id);
        
        // Delete messages for these chats
        const { error: messagesError } = await supabase
          .from("whatsapp_messages")
          .delete()
          .in("chat_id", chatIds);

        if (messagesError) throw messagesError;
      }

      // Delete all chats
      const { error: chatsError } = await supabase
        .from("whatsapp_chats")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (chatsError) throw chatsError;

      setChats([]);
      setMessages([]);
      setSelectedChat(null);

      toast({
        title: "Dados limpos",
        description: "Todas as conversas e mensagens foram apagadas",
      });
    } catch (error: any) {
      console.error("Error clearing:", error);
      toast({
        title: "Erro ao limpar",
        description: error.message || "Falha ao apagar conversas",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Cleanup invalid chats (channels, duplicates, etc.)
  const cleanupInvalidChats = async () => {
    setIsClearing(true);
    try {
      // Get all chats that should be removed
      const { data: allChats } = await supabase
        .from("whatsapp_chats")
        .select("id, phone");

      if (!allChats) {
        toast({ title: "Nenhum chat encontrado" });
        setIsClearing(false);
        return;
      }

      // Only cleanup clear non-contacts
      const invalidChatIds = allChats
        .filter((chat: any) => {
          const phone = chat.phone || "";
          if (phone.includes("@newsletter")) return true;
          if (phone.includes("@g.us")) return true;
          if (phone.includes("status@broadcast")) return true;
          if (phone === "0" || phone === "") return true;
          return false;
        })
        .map((chat: any) => chat.id);

      if (invalidChatIds.length === 0) {
        toast({ title: "Nenhum contato inválido encontrado" });
        setIsClearing(false);
        return;
      }

      // Delete messages first
      const { error: messagesError } = await supabase
        .from("whatsapp_messages")
        .delete()
        .in("chat_id", invalidChatIds);

      if (messagesError) throw messagesError;

      // Delete invalid chats
      const { error: chatsError } = await supabase
        .from("whatsapp_chats")
        .delete()
        .in("id", invalidChatIds);

      if (chatsError) throw chatsError;

      await fetchChats();

      toast({
        title: "Limpeza concluída",
        description: `${invalidChatIds.length} contatos inválidos removidos (canais, grupos, duplicados)`,
      });
    } catch (error: any) {
      console.error("Error cleaning up:", error);
      toast({
        title: "Erro na limpeza",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleFileUpload = async (file: File, type: "image" | "file") => {
    if (!selectedChat) return;
    
    setShowAttachMenu(false);
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "Upload de arquivos será implementado com Supabase Storage",
    });
  };

  const initiateCall = async () => {
    if (!selectedChat) return;

    const { error } = await supabase.functions.invoke("twilio-call", {
      body: { to: selectedChat.phone },
    });

    if (error) throw error;

    toast({
      title: "Ligação iniciada",
      description: `Chamando ${selectedChat.name}...`,
    });
  };

  // Initial cleanup and fetch
  useEffect(() => {
    const init = async () => {
      // Silently cleanup invalid chats first
      try {
        const { data: allChats } = await supabase
          .from("whatsapp_chats")
          .select("id, phone");

        if (allChats) {
          // Only cleanup clear non-contacts
          const invalidChatIds = allChats
            .filter((chat: any) => {
              const phone = chat.phone || "";
              if (phone.includes("@newsletter")) return true;
              if (phone.includes("@g.us")) return true;
              if (phone.includes("status@broadcast")) return true;
              if (phone === "0" || phone === "") return true;
              return false;
            })
            .map((chat: any) => chat.id);

          if (invalidChatIds.length > 0) {
            // Delete messages first
            await supabase
              .from("whatsapp_messages")
              .delete()
              .in("chat_id", invalidChatIds);

            // Delete invalid chats
            await supabase
              .from("whatsapp_chats")
              .delete()
              .in("id", invalidChatIds);

            console.log(`Cleaned up ${invalidChatIds.length} invalid chats`);
          }
        }
      } catch (error) {
        console.error("Cleanup error:", error);
      }
      
      // Then fetch valid chats
      await fetchChats();
    };
    
    init();
  }, []);

  // Realtime subscription for chats
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-chats-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_chats" },
        () => fetchChats()
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
      .channel("whatsapp-messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `chat_id=eq.${selectedChat.id}` },
        (payload) => {
          const msg = payload.new as any;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, {
              id: msg.id,
              text: msg.text || "",
              time: msg.created_at ? new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
              sent: msg.from_me || false,
              read: msg.status === "READ",
              status: msg.status,
              mediaUrl: msg.media_url,
              mediaType: msg.media_type,
            }];
          });
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

  const renderMessageContent = (msg: Message) => {
    if (msg.mediaType === "image" && msg.mediaUrl) {
      return (
        <div className="space-y-1">
          <img 
            src={msg.mediaUrl} 
            alt="Imagem" 
            className="max-w-[280px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(msg.mediaUrl!, "_blank")}
          />
          {msg.text && <p className="text-sm text-foreground whitespace-pre-wrap">{msg.text}</p>}
        </div>
      );
    }
    
    if (msg.mediaType === "audio" && msg.mediaUrl) {
      return (
        <div className="flex items-center gap-2 min-w-[200px]">
          <button className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
            <Play className="w-4 h-4 ml-0.5" />
          </button>
          <div className="flex-1 h-1 bg-muted-foreground/30 rounded-full">
            <div className="w-0 h-full bg-emerald-500 rounded-full" />
          </div>
          <span className="text-xs text-muted-foreground">0:00</span>
        </div>
      );
    }
    
    if (msg.mediaType && msg.mediaUrl) {
      return (
        <a 
          href={msg.mediaUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <File className="w-8 h-8 text-emerald-500" />
          <span className="text-sm text-foreground">Documento</span>
        </a>
      );
    }

    return <p className="text-sm text-foreground whitespace-pre-wrap">{msg.text}</p>;
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-2rem)] flex rounded-2xl overflow-hidden border border-border/50 bg-card -mt-4">
        {/* Left Sidebar - Chat List */}
        <div className="w-[380px] flex flex-col border-r border-border/50 bg-card">
          {/* Header */}
          <div className="h-14 px-4 flex items-center justify-between bg-muted/30 border-b border-border/30">
            <h2 className="font-semibold text-foreground">Conversas</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={clearAllChats}
                disabled={isClearing}
                className="p-2 hover:bg-destructive/10 rounded-full transition-colors"
                title="Apagar todas as conversas"
              >
                <Trash2 className={cn("w-5 h-5 text-destructive", isClearing && "animate-pulse")} />
              </button>
              <button
                onClick={syncAllChats}
                disabled={isSyncing}
                className="p-2 hover:bg-muted/50 rounded-full transition-colors"
                title="Sincronizar todas as conversas"
              >
                <RefreshCw className={cn("w-5 h-5 text-muted-foreground", isSyncing && "animate-spin")} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-2 border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar ou começar nova conversa"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/30 border-0 h-9 text-sm placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingChats || isSyncing ? (
              <div className="flex items-center justify-center h-full py-20">
                <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
              </div>
            ) : filteredChats.length > 0 ? (
              filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors border-b border-border/20",
                    selectedChat?.id === chat.id ? "bg-muted/40" : "hover:bg-muted/20"
                  )}
                >
                  <div className="relative flex-shrink-0">
                    {chat.photo_url ? (
                      <img src={chat.photo_url} alt={chat.name} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-medium text-lg">
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
                        <span className="min-w-[20px] h-5 rounded-full bg-emerald-500 text-white text-xs font-medium flex items-center justify-center px-1.5">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center h-full py-20 gap-3">
                <p className="text-sm text-muted-foreground">Nenhuma conversa</p>
                <button
                  onClick={syncAllChats}
                  disabled={isSyncing}
                  className="text-sm text-emerald-500 hover:underline flex items-center gap-2"
                >
                  <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                  Sincronizar do WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Chat Area */}
        <div className="flex-1 flex flex-col bg-muted/10">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="h-14 px-4 flex items-center gap-3 bg-muted/30 border-b border-border/30">
                <div className="relative flex-shrink-0">
                  {selectedChat.photo_url ? (
                    <img src={selectedChat.photo_url} alt={selectedChat.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-medium">
                      {selectedChat.avatar}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">{selectedChat.name}</h3>
                  <p className="text-xs text-muted-foreground">{formatPhoneDisplay(selectedChat.phone)}</p>
                </div>
                <button
                  onClick={() => setIsCallModalOpen(true)}
                  className="p-2 hover:bg-muted/50 rounded-full transition-colors"
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
                className="flex-1 overflow-y-auto p-4 space-y-1"
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
                          "max-w-[65%] rounded-lg px-3 py-1.5 shadow-sm relative",
                          msg.sent 
                            ? "bg-emerald-100 dark:bg-emerald-900/30 rounded-tr-none" 
                            : "bg-card rounded-tl-none border border-border/30"
                        )}
                      >
                        {renderMessageContent(msg)}
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                          {msg.sent && (
                            msg.status === "READ" || msg.status === "PLAYED" 
                              ? <CheckCheck className="w-4 h-4 text-blue-500" /> 
                              : msg.status === "DELIVERED"
                                ? <CheckCheck className="w-4 h-4 text-muted-foreground" />
                                : msg.status === "SENDING"
                                  ? <div className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
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
              <div className="px-4 py-3 flex items-center gap-2 bg-muted/30 border-t border-border/30">
                <button className="p-2 hover:bg-muted/50 rounded-full transition-colors">
                  <Smile className="w-6 h-6 text-muted-foreground" />
                </button>
                
                <div className="relative">
                  <button 
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    className="p-2 hover:bg-muted/50 rounded-full transition-colors"
                  >
                    <Paperclip className={cn("w-6 h-6 text-muted-foreground transition-transform", showAttachMenu && "rotate-45")} />
                  </button>
                  
                  {showAttachMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-card rounded-lg shadow-lg border border-border overflow-hidden z-50">
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 w-full text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                          <Image className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-foreground">Fotos</span>
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 w-full text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                          <File className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-foreground">Documento</span>
                      </button>
                    </div>
                  )}
                </div>

                <input
                  type="file"
                  ref={imageInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "image")}
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "file")}
                />

                <div className="flex-1">
                  <Input
                    placeholder="Digite uma mensagem"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    disabled={isSending}
                    className="bg-card border-border/50 h-10 text-sm rounded-lg"
                  />
                </div>
                
                <button
                  onClick={sendMessage}
                  disabled={!message.trim() || isSending}
                  className="p-2 hover:bg-muted/50 rounded-full transition-colors disabled:opacity-50"
                >
                  {message.trim() ? (
                    <Send className={cn("w-6 h-6 text-emerald-500", isSending && "animate-pulse")} />
                  ) : (
                    <Mic className="w-6 h-6 text-muted-foreground" />
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/5">
              <div className="text-center space-y-4">
                <div className="w-48 h-48 mx-auto opacity-20">
                  <svg viewBox="0 0 303 172" className="w-full h-full text-muted-foreground">
                    <path fill="currentColor" d="M229.565 160.229c32.647-25.618 50.26-65.927 45.433-107.678C269.995 11.857 234.312-8.196 194.32 3.078c-39.99 11.273-71.282 44.109-80.022 82.752-7.266 32.13 2.066 58.476 22.937 74.907-3.027 12.476-7.045 27.15-7.045 27.15s23.628-6.457 37.757-11.883c24.527 4.616 47.617.526 61.618-15.775z"/>
                  </svg>
                </div>
                <h2 className="text-xl font-light text-foreground">WhatsApp Web</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Envie e receba mensagens diretamente do seu CRM
                </p>
                {chats.length === 0 && (
                  <button
                    onClick={syncAllChats}
                    disabled={isSyncing}
                    className="mt-4 px-6 py-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                    Sincronizar conversas
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden click outside handler for attach menu */}
      {showAttachMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />
      )}

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
