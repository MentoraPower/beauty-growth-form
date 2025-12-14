import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Search, Smile, Paperclip, Mic, Send, Check, CheckCheck, RefreshCw, Phone, Image, File, X, Play, Pause } from "lucide-react";
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
        .not("last_message", "is", null)
        .neq("last_message", "")
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
      const { data, error } = await supabase.functions.invoke("waha-whatsapp", {
        body: {
          action: "send-text",
          phone: selectedChat.phone,
          message: messageText,
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

      const { data, error } = await supabase.functions.invoke("waha-whatsapp", {
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

  const handleFileUpload = async (file: File, type: "image" | "file") => {
    if (!selectedChat) return;
    
    setShowAttachMenu(false);
    setIsSending(true);

    try {
      // Convert file to base64 data URL (for demo - in production, upload to storage first)
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        
        // For production, you would upload to Supabase Storage and get a public URL
        // For now, we show that the feature is available
        toast({
          title: "Funcionalidade em desenvolvimento",
          description: "Upload de arquivos será implementado com Supabase Storage",
        });
        
        setIsSending(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast({
        title: "Erro ao enviar arquivo",
        description: error.message,
        variant: "destructive",
      });
      setIsSending(false);
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

  // Initial fetch
  useEffect(() => {
    fetchChats();
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
          // Avoid duplicates
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id || (msg.message_id && prev.some(m => m.id.includes(msg.message_id))))) {
              return prev;
            }
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
        <div className="w-[380px] flex flex-col border-r border-border/50 bg-[#111b21]">
          {/* Header */}
          <div className="h-14 px-4 flex items-center justify-between bg-[#202c33]">
            <h2 className="font-medium text-white">Conversas</h2>
            <button
              onClick={syncAllChats}
              disabled={isSyncing}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              title="Sincronizar todas as conversas"
            >
              <RefreshCw className={cn("w-5 h-5 text-[#aebac1]", isSyncing && "animate-spin")} />
            </button>
          </div>

          {/* Search */}
          <div className="p-2 bg-[#111b21]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#aebac1]" />
              <Input
                placeholder="Pesquisar ou começar nova conversa"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#202c33] border-0 h-9 text-sm text-white placeholder:text-[#8696a0]"
              />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingChats || isSyncing ? (
              <div className="flex items-center justify-center h-full py-20">
                <RefreshCw className="w-6 h-6 text-[#aebac1] animate-spin" />
              </div>
            ) : filteredChats.length > 0 ? (
              filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors border-b border-[#222d34]",
                    selectedChat?.id === chat.id ? "bg-[#2a3942]" : "hover:bg-[#202c33]"
                  )}
                >
                  <div className="relative flex-shrink-0">
                    {chat.photo_url ? (
                      <img src={chat.photo_url} alt={chat.name} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#6b7b8a] flex items-center justify-center text-white font-medium text-lg">
                        {chat.avatar}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white truncate">{chat.name}</span>
                      <span className={cn("text-xs flex-shrink-0", chat.unread > 0 ? "text-[#00a884]" : "text-[#8696a0]")}>
                        {chat.time}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-sm text-[#8696a0] truncate pr-2">{chat.lastMessage}</p>
                      {chat.unread > 0 && (
                        <span className="min-w-[20px] h-5 rounded-full bg-[#00a884] text-[#111b21] text-xs font-medium flex items-center justify-center px-1.5">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center h-full py-20 gap-3">
                <p className="text-sm text-[#8696a0]">Nenhuma conversa</p>
                <button
                  onClick={syncAllChats}
                  disabled={isSyncing}
                  className="text-sm text-[#00a884] hover:underline flex items-center gap-2"
                >
                  <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                  Sincronizar do WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Chat Area */}
        <div className="flex-1 flex flex-col bg-[#0b141a]">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="h-14 px-4 flex items-center gap-3 bg-[#202c33] border-b border-[#222d34]">
                <div className="relative flex-shrink-0">
                  {selectedChat.photo_url ? (
                    <img src={selectedChat.photo_url} alt={selectedChat.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#6b7b8a] flex items-center justify-center text-white font-medium">
                      {selectedChat.avatar}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-white">{selectedChat.name}</h3>
                  <p className="text-xs text-[#8696a0]">{selectedChat.phone}</p>
                </div>
                <button
                  onClick={() => setIsCallModalOpen(true)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  title="Fazer ligação"
                >
                  <Phone className="w-5 h-5 text-[#aebac1]" />
                </button>
                <button
                  onClick={() => fetchMessages(selectedChat.id)}
                  disabled={isLoadingMessages}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <RefreshCw className={cn("w-4 h-4 text-[#aebac1]", isLoadingMessages && "animate-spin")} />
                </button>
              </div>

              {/* Messages Area */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-1"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='417' height='417' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='pattern' width='8.33' height='8.33' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 0 4.165 L 4.165 0 L 8.33 4.165 L 4.165 8.33 Z' fill='%23182229' fill-opacity='0.4'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='%230b141a'/%3E%3Crect width='100%25' height='100%25' fill='url(%23pattern)'/%3E%3C/svg%3E")`,
                }}
              >
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="w-6 h-6 text-[#aebac1] animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-[#8696a0]">Nenhuma mensagem</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={cn("flex", msg.sent ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[65%] rounded-lg px-3 py-1.5 shadow-sm relative",
                          msg.sent 
                            ? "bg-[#005c4b] rounded-tr-none" 
                            : "bg-[#202c33] rounded-tl-none"
                        )}
                      >
                        {renderMessageContent(msg)}
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <span className="text-[10px] text-[#8696a0]">{msg.time}</span>
                          {msg.sent && (
                            msg.status === "READ" || msg.status === "PLAYED" 
                              ? <CheckCheck className="w-4 h-4 text-[#53bdeb]" /> 
                              : msg.status === "DELIVERED"
                                ? <CheckCheck className="w-4 h-4 text-[#8696a0]" />
                                : msg.status === "SENDING"
                                  ? <div className="w-3 h-3 border-2 border-[#8696a0] border-t-transparent rounded-full animate-spin" />
                                  : <Check className="w-4 h-4 text-[#8696a0]" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="px-4 py-3 flex items-center gap-2 bg-[#202c33]">
                <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <Smile className="w-6 h-6 text-[#aebac1]" />
                </button>
                
                <div className="relative">
                  <button 
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <Paperclip className={cn("w-6 h-6 text-[#aebac1] transition-transform", showAttachMenu && "rotate-45")} />
                  </button>
                  
                  {showAttachMenu && (
                    <div className="absolute bottom-full left-0 mb-2 bg-[#233138] rounded-lg shadow-lg overflow-hidden">
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 w-full text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                          <Image className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-white">Fotos</span>
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 w-full text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                          <File className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-white">Documento</span>
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
                    className="bg-[#2a3942] border-0 h-10 text-sm text-white placeholder:text-[#8696a0] rounded-lg"
                  />
                </div>
                
                <button
                  onClick={sendMessage}
                  disabled={!message.trim() || isSending}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                >
                  {message.trim() ? (
                    <Send className={cn("w-6 h-6 text-[#aebac1]", isSending && "animate-pulse")} />
                  ) : (
                    <Mic className="w-6 h-6 text-[#aebac1]" />
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[#222e35]">
              <div className="text-center space-y-4">
                <div className="w-64 h-64 mx-auto opacity-30">
                  <svg viewBox="0 0 303 172" className="w-full h-full text-[#8696a0]">
                    <path fill="currentColor" d="M229.565 160.229c32.647-25.618 50.26-65.927 45.433-107.678C269.995 11.857 234.312-8.196 194.32 3.078c-39.99 11.273-71.282 44.109-80.022 82.752-7.266 32.13 2.066 58.476 22.937 74.907-3.027 12.476-7.045 27.15-7.045 27.15s23.628-6.457 37.757-11.883c24.527 4.616 47.617.526 61.618-15.775z"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-light text-[#e9edef]">WhatsApp Web</h2>
                <p className="text-sm text-[#8696a0] max-w-md">
                  Envie e receba mensagens diretamente do seu CRM
                </p>
                {chats.length === 0 && (
                  <button
                    onClick={syncAllChats}
                    disabled={isSyncing}
                    className="mt-4 px-6 py-2 bg-[#00a884] text-white rounded-full hover:bg-[#06cf9c] transition-colors flex items-center gap-2 mx-auto"
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
