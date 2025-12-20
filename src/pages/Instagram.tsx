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
import { supabase } from "@/integrations/supabase/client";

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
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<{ username?: string; userId?: string } | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const REDIRECT_URI = `${window.location.origin}/admin/instagram`;

  // Check for OAuth callback code in URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    // Prevent processing the same code twice
    const processedCode = sessionStorage.getItem('instagram_processed_code');
    
    if (code && code !== processedCode) {
      // Mark code as processed before attempting exchange
      sessionStorage.setItem('instagram_processed_code', code);
      // Clear URL immediately to prevent re-processing on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
      handleOAuthCallback(code);
    } else if (code) {
      // Code already processed, just clear URL and check connection
      window.history.replaceState({}, document.title, window.location.pathname);
      checkConnection();
    } else {
      checkConnection();
    }
  }, []);

  const handleOAuthCallback = async (code: string) => {
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      console.log('Processing OAuth callback with code...');

      const redirectUri = sessionStorage.getItem('instagram_oauth_redirect_uri') || REDIRECT_URI;
      console.log('Using redirectUri for token exchange:', redirectUri);

      const { data, error } = await supabase.functions.invoke('instagram-api', {
        body: {
          action: 'exchange-code',
          params: { code, redirectUri },
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Instagram conectado!",
          description: data.instagramUsername ? `@${data.instagramUsername}` : "Conexão estabelecida com sucesso",
        });
        setIsConnected(true);
        setAccountInfo({ 
          username: data.instagramUsername,
          userId: data.instagramUserId 
        });
        // Clear URL params
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchConversations();
      } else {
        throw new Error(data.error || 'Erro ao conectar');
      }
    } catch (error: any) {
      console.error('OAuth callback error:', error);
      setConnectionError(error.message || 'Erro desconhecido');
      toast({
        title: "Erro ao conectar",
        description: error.message || 'Erro desconhecido',
        variant: "destructive",
      });
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
      setIsLoading(false);
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
      // Cleanup stored redirectUri/code markers
      sessionStorage.removeItem('instagram_oauth_redirect_uri');
      sessionStorage.removeItem('instagram_processed_code');
    }
  };

  const checkConnection = async () => {
    setConnectionError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('instagram-api', {
        body: { action: 'check-connection', params: {} }
      });

      if (error) throw error;

      if (data.success && data.connected) {
        setIsConnected(true);
        setAccountInfo({ 
          username: data.instagramUsername,
          userId: data.instagramUserId 
        });
        fetchConversations();
      } else {
        setIsConnected(false);
        if (data.needsReauth) {
          setConnectionError('Token expirado. Por favor, reconecte sua conta.');
        }
      }
    } catch (error: any) {
      console.error('Error checking connection:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      // Persist the exact redirectUri used to generate the OAuth URL.
      // This prevents redirect_uri mismatch when the app enforces canonical domain redirects (www/non-www).
      sessionStorage.setItem('instagram_oauth_redirect_uri', REDIRECT_URI);

      const { data, error } = await supabase.functions.invoke('instagram-api', {
        body: { action: 'get-oauth-url', params: { redirectUri: REDIRECT_URI } }
      });

      if (error) throw error;

      if (data.success && data.oauthUrl) {
        // Redirect to Instagram OAuth
        window.location.href = data.oauthUrl;
      } else {
        throw new Error(data.error || 'Erro ao gerar URL de autenticação');
      }
    } catch (error: any) {
      console.error('Error getting OAuth URL:', error);
      setConnectionError(error.message || 'Erro desconhecido');
      toast({
        title: "Erro",
        description: error.message || 'Erro desconhecido',
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('instagram-api', {
        body: { action: 'disconnect', params: {} }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Desconectado",
          description: "Instagram desconectado com sucesso",
        });
        setIsConnected(false);
        setAccountInfo(null);
        setChats([]);
        setSelectedChat(null);
        setMessages([]);
      }
    } catch (error: any) {
      console.error('Error disconnecting:', error);
      toast({
        title: "Erro ao desconectar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('instagram-api', {
        body: { action: 'get-conversations', params: {} }
      });

      if (error) throw error;

      if (data.success && data.conversations) {
        const formattedChats: Chat[] = data.conversations.map((conv: any) => {
          const participant = conv.participants?.data?.find((p: any) => p.id !== accountInfo?.userId);
          const lastMsg = conv.messages?.data?.[0];
          
          return {
            id: conv.id,
            name: participant?.username || participant?.name || 'Usuário',
            lastMessage: lastMsg?.message || '',
            lastMessageTime: lastMsg?.created_time || new Date().toISOString(),
            unreadCount: 0,
            avatar: participant?.profile_pic || null,
            username: participant?.username || '',
          };
        });
        setChats(formattedChats);
      }
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('instagram-api', {
        body: { action: 'get-messages', params: { conversationId, limit: 100 } }
      });

      if (error) throw error;

      if (data.success && data.messages) {
        const formattedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id,
          text: msg.message || null,
          time: msg.created_time,
          fromMe: msg.from?.id === accountInfo?.userId,
          status: 'SENT',
          mediaType: msg.attachments?.data?.[0]?.type || null,
          mediaUrl: msg.attachments?.data?.[0]?.url || null,
        })).reverse(); // Reverse to show oldest first
        
        setMessages(formattedMessages);
      }
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Fetch messages when a chat is selected
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
    }
  }, [selectedChat?.id]);

  // Real-time polling for conversations (every 10 seconds)
  useEffect(() => {
    if (!isConnected) return;
    
    const interval = setInterval(() => {
      fetchConversations();
    }, 10000);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Real-time polling for messages when chat is selected (every 5 seconds)
  useEffect(() => {
    if (!selectedChat) return;
    
    const interval = setInterval(() => {
      fetchMessages(selectedChat.id);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedChat?.id]);

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
      const { data, error } = await supabase.functions.invoke('instagram-api', {
        body: { 
          action: 'send-message',
          params: {
            recipientId: selectedChat.id,
            message: text
          }
        }
      });

      if (error) throw error;
      
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

  // Loading state
  if (isLoading || isConnecting) {
    return (
      <div className="h-[calc(100vh-1.5rem)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto" />
          <p className="text-muted-foreground">
            {isConnecting ? 'Conectando ao Instagram...' : 'Verificando conexão...'}
          </p>
        </div>
      </div>
    );
  }

  // Not connected - Login screen
  if (!isConnected) {
    return (
      <div className="h-[calc(100vh-1.5rem)] flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
              <Instagram className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Conectar Instagram</h1>
            <p className="text-muted-foreground">
              Conecte sua conta do Instagram Business para gerenciar mensagens diretas.
            </p>
          </div>

          {connectionError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Erro</p>
                  <p className="text-sm text-destructive/80 mt-1">{connectionError}</p>
                </div>
              </div>
            </div>
          )}

          <Button 
            className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:opacity-90 text-white font-medium py-6"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <Instagram className="h-5 w-5 mr-2" />
                Conectar com Instagram
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Você será redirecionado para o Instagram para autorizar o acesso à sua conta.
          </p>
        </div>
      </div>
    );
  }

  // Connected - Main chat interface
  return (
    <div className="h-[calc(100vh-1.5rem)] flex bg-card rounded-2xl overflow-hidden">
      {/* Chat List Sidebar */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="h-14 px-4 flex items-center border-b border-border">
          <div className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-500" />
            <div>
              <h2 className="font-semibold text-foreground text-sm">Instagram Direct</h2>
              {accountInfo?.username && (
                <p className="text-xs text-muted-foreground">@{accountInfo.username}</p>
              )}
            </div>
          </div>
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
                    <div className="relative flex-shrink-0">
                      <img
                        src={chat.avatar || DEFAULT_AVATAR}
                        alt={chat.name}
                        className="w-11 h-11 rounded-full object-cover border border-border"
                      />
                      {chat.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 rounded-full text-xs text-white flex items-center justify-center">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground text-sm truncate">
                          {chat.username ? `@${chat.username}` : chat.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatTime(chat.lastMessageTime)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate leading-tight">{chat.lastMessage}</p>
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
                  className="w-10 h-10 rounded-full object-cover border border-border"
                />
                <div>
                  <h3 className="font-semibold text-foreground text-sm">
                    {selectedChat.username ? `@${selectedChat.username}` : selectedChat.name}
                  </h3>
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
