import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { 
  Send, 
  Mic, 
  Image as ImageIcon,
  Search,
  MoreVertical,
  Phone,
  Check,
  CheckCheck,
  AlertCircle,
  Loader2,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import Instagram from "@/components/icons/Instagram";

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  avatar: string | null;
  username: string;
}

interface Message {
  id: string;
  text: string | null;
  time: string;
  fromMe: boolean;
  status: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
}

const DEFAULT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiNlMGUwZTAiLz48Y2lyY2xlIGN4PSIyMCIgY3k9IjE1IiByPSI4IiBmaWxsPSIjYjBiMGIwIi8+PHBhdGggZD0iTTggMzVjMC04IDUtMTIgMTItMTJzMTIgNCAxMiAxMiIgZmlsbD0iI2IwYjBiMCIvPjwvc3ZnPg==";

export default function InstagramPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<{ id: string; name: string; username: string } | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setIsCheckingConnection(true);
    setConnectionError(null);
    
    try {
      const response = await fetch('https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/instagram-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-connection' })
      });

      const data = await response.json();
      console.log('Instagram connection check:', data);

      if (data.connected) {
        setIsConnected(true);
        setAccountInfo(data.account);
        fetchConversations();
      } else {
        setIsConnected(false);
        if (data.error) {
          setConnectionError(data.error);
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setConnectionError('Erro ao verificar conexão');
    } finally {
      setIsLoading(false);
      setIsCheckingConnection(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch('https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/instagram-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-conversations' })
      });

      const data = await response.json();
      console.log('Instagram conversations:', data);

      if (data.conversations) {
        const formattedChats: Chat[] = data.conversations.map((conv: any) => ({
          id: conv.id,
          name: conv.participants?.data?.[0]?.name || 'Usuário',
          lastMessage: conv.messages?.data?.[0]?.message || '',
          lastMessageTime: conv.updated_time || new Date().toISOString(),
          unreadCount: 0,
          avatar: null,
          username: conv.participants?.data?.[0]?.username || ''
        }));
        setChats(formattedChats);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChat || isSending) return;

    setIsSending(true);
    const text = messageInput.trim();
    setMessageInput("");

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      text,
      time: new Date().toISOString(),
      fromMe: true,
      status: "PENDING",
    };

    setMessages(prev => [...prev, tempMessage]);

    try {
      const response = await fetch('https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/instagram-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'send-message',
          recipientId: selectedChat.id,
          message: text
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessages(prev => prev.map(m => 
          m.id === tempMessage.id ? { ...m, status: 'SENT' } : m
        ));
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
    } finally {
      setIsSending(false);
    }
  };

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case "SENT":
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case "DELIVERED":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "READ":
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-1.5rem)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Verificando conexão com Instagram...</p>
        </div>
      </div>
    );
  }

  // Not connected screen
  if (!isConnected) {
    return (
      <div className="h-[calc(100vh-1.5rem)] flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
              <Instagram className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Instagram Direct</h1>
            <p className="text-muted-foreground">
              {connectionError 
                ? "Não foi possível conectar ao Instagram." 
                : "Verificando configuração do Instagram..."}
            </p>
          </div>

          {connectionError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Erro de conexão</p>
                  <p className="text-sm text-destructive/80 mt-1">{connectionError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <h3 className="font-medium text-foreground text-sm">Verifique se:</h3>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>O Access Token está válido e não expirado</li>
              <li>O App ID e App Secret estão corretos</li>
              <li>O app tem permissões de Instagram Messenger</li>
              <li>A conta Instagram está conectada a uma página do Facebook</li>
            </ul>
          </div>

          <Button 
            className="w-full"
            onClick={checkConnection}
            disabled={isCheckingConnection}
          >
            {isCheckingConnection ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Connected - Main chat interface
  return (
    <div className="h-[calc(100vh-1.5rem)] flex bg-card rounded-2xl overflow-hidden">
      {/* Chat List Sidebar */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="h-14 px-4 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-500" />
            <div>
              <h2 className="font-semibold text-foreground text-sm">Instagram Direct</h2>
              {accountInfo && (
                <p className="text-xs text-muted-foreground">@{accountInfo.username || accountInfo.name}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchConversations}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {chats.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Instagram className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhuma conversa ainda</p>
                <p className="text-xs mt-1">As conversas do Instagram Direct aparecerão aqui</p>
              </div>
            ) : (
              chats
                .filter(chat => 
                  chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  chat.username.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                      selectedChat?.id === chat.id ? "bg-primary/10" : "hover:bg-muted"
                    )}
                  >
                    <div className="relative">
                      <img
                        src={chat.avatar || DEFAULT_AVATAR}
                        alt={chat.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      {chat.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 rounded-full text-xs text-white flex items-center justify-center">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground truncate">{chat.name}</span>
                        <span className="text-xs text-muted-foreground">{formatTime(chat.lastMessageTime)}</span>
                      </div>
                      {chat.username && (
                        <p className="text-xs text-muted-foreground">@{chat.username}</p>
                      )}
                      <p className="text-sm text-muted-foreground truncate">{chat.lastMessage}</p>
                    </div>
                  </button>
                ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            <div className="h-14 px-4 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-3">
                <img
                  src={selectedChat.avatar || DEFAULT_AVATAR}
                  alt={selectedChat.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <h3 className="font-semibold text-foreground">{selectedChat.name}</h3>
                  {selectedChat.username && (
                    <p className="text-xs text-muted-foreground">@{selectedChat.username}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Phone className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn("flex", message.fromMe ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[70%] rounded-2xl px-4 py-2",
                        message.fromMe
                          ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {message.text && <p className="text-sm">{message.text}</p>}
                      <div className={cn(
                        "flex items-center justify-end gap-1 mt-1",
                        message.fromMe ? "text-white/70" : "text-muted-foreground"
                      )}>
                        <span className="text-[10px]">{formatTime(message.time)}</span>
                        {message.fromMe && renderStatusIcon(message.status)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <ImageIcon className="h-5 w-5" />
                </Button>
                <Input
                  placeholder="Mensagem..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  className="flex-1"
                />
                {messageInput.trim() ? (
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={isSending}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon">
                    <Mic className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
                <Instagram className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">Instagram Direct</h3>
              <p>Selecione uma conversa para começar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
