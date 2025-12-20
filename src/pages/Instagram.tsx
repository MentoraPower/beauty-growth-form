import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { 
  Send, 
  Mic, 
  Image as ImageIcon,
  Search,
  Check,
  CheckCheck,
  AlertCircle,
  Loader2,
  RefreshCw,
  Play,
  X,
  Paperclip,
  Video,
  StopCircle,
  Trash2
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
  participantId: string; // Instagram user ID for sending messages
}

interface Message {
  id: string;
  text: string | null;
  time: string;
  fromMe: boolean;
  status: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  shareLink?: string | null;
  shareName?: string | null;
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
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [openReelUrl, setOpenReelUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const REDIRECT_URI = `${window.location.origin}/admin/instagram`;
  const myInstagramUserId = accountInfo?.userId;

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
        // Conversations are fetched via effect once accountInfo is available
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

  const fetchConversations = useCallback(async (showLoading = false) => {
    if (!myInstagramUserId) return;

    if (showLoading) setIsLoadingChats(true);

    try {
      const { data, error } = await supabase.functions.invoke('instagram-api', {
        body: { action: 'get-conversations', params: {} }
      });

      if (error) throw error;

      if (data.success && data.conversations) {
        const formattedChats: Chat[] = data.conversations.map((conv: any) => {
          const participant =
            conv.participants?.data?.find((p: any) => p.id !== myInstagramUserId) ??
            conv.participants?.data?.[0];
          const lastMsg = conv.messages?.data?.[0];

          return {
            id: conv.id,
            name: participant?.name || participant?.username || 'Usuário',
            lastMessage: lastMsg?.message || '',
            lastMessageTime: lastMsg?.created_time || new Date().toISOString(),
            unreadCount: 0,
            avatar: participant?.profile_pic || null,
            username: participant?.username || '',
            participantId: participant?.id || '',
          };
        });
        setChats(formattedChats);
      }
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoadingChats(false);
    }
  }, [myInstagramUserId]);

  useEffect(() => {
    if (!isConnected || !myInstagramUserId) return;
    fetchConversations(true); // Show loading on initial fetch
  }, [isConnected, myInstagramUserId, fetchConversations]);

  const fetchMessages = useCallback(async (conversationId: string, showLoading = false) => {
    if (!myInstagramUserId) return;

    if (showLoading) setIsLoadingMessages(true);

    try {
      const { data, error } = await supabase.functions.invoke('instagram-api', {
        body: { action: 'get-messages', params: { conversationId, limit: 100 } }
      });

      if (error) throw error;

      if (data.success && data.messages) {
        // API returns newest first; reverse to show oldest first
        const ordered = [...data.messages].reverse();

        const formattedMessages: Message[] = ordered.map((msg: any, index: number) => {
          const isFromMe = msg.from?.id === myInstagramUserId;

          // Instagram API doesn't provide delivery/read receipts.
          // Heuristic:
          // - Once the message is present in the API list, show DELIVERED
          // - If the other person sends any message AFTER it, consider it READ
          let status = 'RECEIVED';
          if (isFromMe) {
            const hasLaterOther = ordered.slice(index + 1).some((m: any) => m.from?.id !== myInstagramUserId);
            status = hasLaterOther ? 'READ' : 'DELIVERED';
          }

          return {
            id: msg.id,
            text: msg.message || null,
            time: msg.created_time,
            fromMe: isFromMe,
            status,
            mediaType: msg.mediaType || null,
            mediaUrl: msg.mediaUrl || null,
            shareLink: msg.shareLink || null,
            shareName: msg.shareName || null,
          };
        });

        // Merge with any pending temp messages that haven't synced yet
        setMessages(prev => {
          // Get temp messages that are still pending/sent (not yet in API)
          const tempMessages = prev.filter(m => m.id.startsWith('temp-'));
          
          // Check if temp messages are now in the API response (by matching text and approximate time)
          const remainingTempMessages = tempMessages.filter(tempMsg => {
            // Check if this temp message exists in the API response
            const matchFound = formattedMessages.some(apiMsg => 
              apiMsg.fromMe && 
              apiMsg.text === tempMsg.text &&
              Math.abs(new Date(apiMsg.time).getTime() - new Date(tempMsg.time).getTime()) < 60000 // within 1 minute
            );
            return !matchFound; // Keep temp message if NOT found in API
          });

          // Return API messages + any remaining temp messages
          return [...formattedMessages, ...remainingTempMessages];
        });
      }
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingMessages(false);
    }
  }, [myInstagramUserId]);

  // Fetch messages when a chat is selected - clear old messages immediately
  useEffect(() => {
    if (selectedChat && myInstagramUserId) {
      setMessages([]); // Clear messages immediately when switching chats
      fetchMessages(selectedChat.id, true); // Show loading
    }
  }, [selectedChat?.id, myInstagramUserId, fetchMessages]);

  // Real-time polling for conversations (every 10 seconds)
  useEffect(() => {
    if (!isConnected || !myInstagramUserId) return;

    const interval = setInterval(() => {
      fetchConversations();
    }, 10000);

    return () => clearInterval(interval);
  }, [isConnected, myInstagramUserId, fetchConversations]);

  // Real-time polling for messages when chat is selected (every 5 seconds)
  useEffect(() => {
    if (!selectedChat || !myInstagramUserId) return;

    const interval = setInterval(() => {
      fetchMessages(selectedChat.id);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedChat?.id, myInstagramUserId, fetchMessages]);

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
            recipientId: selectedChat.participantId, // Use the participant's Instagram user ID
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

  // Handle media upload (image/video)
  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedChat) return;

    setIsUploadingMedia(true);

    try {
      // Validate file type
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      if (!isImage && !isVideo) {
        toast({
          title: "Formato não suportado",
          description: "Envie apenas imagens ou vídeos.",
          variant: "destructive",
        });
        return;
      }

      // Upload to Supabase storage
      const fileName = `instagram/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) {
        throw new Error('Erro ao fazer upload: ' + uploadError.message);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(fileName);

      const mediaUrl = publicUrlData.publicUrl;
      const mediaType = isImage ? 'image' : 'video';

      // Add temp message
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        text: null,
        time: new Date().toISOString(),
        fromMe: true,
        status: 'sending',
        mediaType,
        mediaUrl,
      };
      setMessages(prev => [...prev, tempMessage]);
      scrollToBottom();

      // Send via Instagram API
      const { data, error } = await supabase.functions.invoke('instagram-api', {
        body: {
          action: 'send-media',
          params: {
            recipientId: selectedChat.participantId,
            mediaUrl,
            mediaType: file.type,
          },
        },
      });

      if (error) throw error;

      if (data.success) {
        setMessages(prev => prev.map(m => 
          m.id === tempMessage.id ? { ...m, status: 'SENT' } : m
        ));
        toast({
          title: "Mídia enviada",
          description: isImage ? "Imagem enviada com sucesso." : "Vídeo enviado com sucesso.",
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Error uploading media:", error);
      toast({
        title: "Erro ao enviar mídia",
        description: error.message || "Não foi possível enviar a mídia.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Start audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Erro ao iniciar gravação",
        description: "Não foi possível acessar o microfone.",
        variant: "destructive",
      });
    }
  };

  // Cancel recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  // Stop and send audio recording
  const stopAndSendRecording = async () => {
    if (!mediaRecorderRef.current || !selectedChat) return;

    return new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
        
        mediaRecorderRef.current!.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setRecordingTime(0);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          setIsUploadingMedia(true);
          
          // Upload to Supabase storage
          const fileName = `instagram/audio_${Date.now()}.webm`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('whatsapp-media')
            .upload(fileName, audioBlob, { contentType: 'audio/webm' });

          if (uploadError) {
            throw new Error('Erro ao fazer upload: ' + uploadError.message);
          }

          // Get public URL
          const { data: publicUrlData } = supabase.storage
            .from('whatsapp-media')
            .getPublicUrl(fileName);

          const mediaUrl = publicUrlData.publicUrl;

          // Add temp message
          const tempMessage: Message = {
            id: `temp-${Date.now()}`,
            text: null,
            time: new Date().toISOString(),
            fromMe: true,
            status: 'sending',
            mediaType: 'audio',
            mediaUrl,
          };
          setMessages(prev => [...prev, tempMessage]);
          scrollToBottom();

          // Send via Instagram API
          const { data, error } = await supabase.functions.invoke('instagram-api', {
            body: {
              action: 'send-media',
              params: {
                recipientId: selectedChat.participantId,
                mediaUrl,
                mediaType: 'audio/webm',
              },
            },
          });

          if (error) throw error;

          if (data.success) {
            setMessages(prev => prev.map(m => 
              m.id === tempMessage.id ? { ...m, status: 'SENT' } : m
            ));
            toast({
              title: "Áudio enviado",
              description: "Mensagem de voz enviada com sucesso.",
            });
          } else {
            throw new Error(data.error);
          }
        } catch (error: any) {
          console.error("Error sending audio:", error);
          toast({
            title: "Erro ao enviar áudio",
            description: error.message || "Não foi possível enviar o áudio.",
            variant: "destructive",
          });
        } finally {
          setIsUploadingMedia(false);
          audioChunksRef.current = [];
        }
        
        resolve();
      };

      mediaRecorderRef.current!.stop();
    });
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case "SENT":
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case "DELIVERED":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "READ":
      case "seen":
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default:
        return <Check className="h-3 w-3 text-muted-foreground" />;
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
    <div className="h-[calc(100vh-2rem)] flex rounded-2xl overflow-hidden border border-border/50 bg-card -mt-4 relative z-50">
      {/* Chat List Sidebar */}
      <div className="w-72 border-r border-border flex flex-col flex-shrink-0">
        <div className="h-14 pl-2 pr-4 flex items-center border-b border-border">
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

        <div className="px-2 py-3">
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
          <div className="px-1 space-y-1">
            {isLoadingChats ? (
              <div className="p-8 text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-pink-500" />
                <p className="text-sm text-muted-foreground">Carregando conversas...</p>
              </div>
            ) : chats.length === 0 ? (
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
                    <div className="flex-1 text-left overflow-hidden space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground text-sm truncate max-w-[140px]">
                          {chat.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatTime(chat.lastMessageTime)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px] leading-tight">{chat.lastMessage}</p>
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
                    {selectedChat.name}
                  </h3>
                  {selectedChat.username && (
                    <p className="text-xs text-muted-foreground">@{selectedChat.username}</p>
                  )}
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {isLoadingMessages ? (
                <div className="space-y-3">
                  {/* Skeleton mensagens recebidas */}
                  <div className="flex items-start">
                    <div className="bg-muted rounded-2xl px-4 py-3 max-w-[60%] animate-pulse">
                      <div className="h-4 bg-muted-foreground/20 rounded w-32 mb-2" />
                      <div className="h-4 bg-muted-foreground/20 rounded w-20" />
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="bg-muted rounded-2xl px-4 py-3 max-w-[60%] animate-pulse">
                      <div className="h-4 bg-muted-foreground/20 rounded w-48" />
                    </div>
                  </div>
                  {/* Skeleton mensagens enviadas */}
                  <div className="flex items-end justify-end">
                    <div className="bg-[#3797f0]/50 rounded-2xl px-4 py-3 max-w-[60%] animate-pulse">
                      <div className="h-4 bg-white/30 rounded w-40 mb-2" />
                      <div className="h-4 bg-white/30 rounded w-24" />
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="bg-muted rounded-2xl px-4 py-3 max-w-[60%] animate-pulse">
                      <div className="h-4 bg-muted-foreground/20 rounded w-36" />
                    </div>
                  </div>
                  <div className="flex items-end justify-end">
                    <div className="bg-[#3797f0]/50 rounded-2xl px-4 py-3 max-w-[60%] animate-pulse">
                      <div className="h-4 bg-white/30 rounded w-28" />
                    </div>
                  </div>
                </div>
              ) : (
              <div className="space-y-3">
                {messages.map((message) => {
                  // Check for shared reel/post from API
                  const hasShare = message.shareLink && message.shareLink.includes('instagram.com');
                  
                  // Also detect Instagram reel/video links in text as fallback
                  const reelRegex = /https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\/[\w-]+/gi;
                  const reelMatch = message.text?.match(reelRegex);
                  const isReelInText = reelMatch && reelMatch.length > 0;
                  
                  // Get the reel URL (prefer shareLink from API)
                  const reelUrl = hasShare ? message.shareLink : (isReelInText ? reelMatch![0] : null);
                  
                  // Remove the reel URL from text if it's only the URL
                  const textWithoutReel = message.text?.replace(reelRegex, '').trim();
                  
                  // Check if this is a media-only message (no text, just share or media)
                  const isMediaOnly = !message.text && (hasShare || message.mediaType);
                  
                  return (
                    <div
                      key={message.id}
                      className={cn("flex flex-col", message.fromMe ? "items-end" : "items-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl overflow-hidden",
                          message.fromMe
                            ? "bg-[#3797f0] text-white"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {/* Show shared reel/post as clickable card */}
                        {reelUrl && (
                          <button
                            onClick={() => setOpenReelUrl(reelUrl)}
                            className="relative bg-black/90 w-[220px] h-[300px] flex flex-col items-center justify-center hover:bg-black/80 transition-colors group"
                          >
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                                <Play className="w-8 h-8 text-white ml-1" fill="white" />
                              </div>
                            </div>
                            <div className="absolute top-3 left-3 flex items-center gap-2">
                              <Instagram className="w-5 h-5 text-white" />
                              <span className="text-white text-xs font-medium">Reel</span>
                            </div>
                            {message.shareName && (
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3">
                                <p className="text-white text-xs truncate">{message.shareName}</p>
                              </div>
                            )}
                          </button>
                        )}
                        
                        {/* Show story mention */}
                        {message.mediaType === 'story' && (
                          <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-4 flex items-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                              <Instagram className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <p className="text-white text-sm font-medium">Mencionou você em um story</p>
                              {message.mediaUrl && (
                                <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-white/80 text-xs underline">
                                  Ver story
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Show video if present */}
                        {message.mediaType === 'video' && message.mediaUrl && !reelUrl && (
                          <video 
                            src={message.mediaUrl} 
                            controls 
                            className="max-w-[280px] rounded-t-2xl"
                            preload="metadata"
                          />
                        )}
                        
                        {/* Show image if present */}
                        {message.mediaType === 'image' && message.mediaUrl && (
                          <img 
                            src={message.mediaUrl} 
                            alt="Imagem" 
                            className="max-w-[280px] rounded-t-2xl"
                            loading="lazy"
                          />
                        )}
                        
                        {/* Show audio if present */}
                        {message.mediaType === 'audio' && message.mediaUrl && (
                          <div className="p-3">
                            <audio src={message.mediaUrl} controls className="w-full" />
                          </div>
                        )}
                        
                        {/* Show text (without reel URL if it was only the URL) */}
                        {(textWithoutReel || (!reelUrl && message.text)) && (
                          <p className="text-sm px-4 py-2">{textWithoutReel || message.text}</p>
                        )}
                      </div>
                      
                      {/* Timestamp outside bubble */}
                      <div className="flex items-center gap-1 mt-1 px-1">
                        <span className="text-[10px] text-muted-foreground">{formatTime(message.time)}</span>
                        {message.fromMe && (
                          <span className="flex items-center">
                            {renderStatusIcon(message.status)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t border-border">
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleMediaUpload}
                accept="image/*,video/*"
                className="hidden"
              />
              
              {isRecording ? (
                // Recording UI
                <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      {formatRecordingTime(recordingTime)}
                    </span>
                    <span className="text-muted-foreground text-sm">Gravando...</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={cancelRecording}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                  <Button 
                    size="icon"
                    onClick={stopAndSendRecording}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                // Normal input UI
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingMedia}
                  >
                    {isUploadingMedia ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ImageIcon className="h-5 w-5" />
                    )}
                  </Button>
                  <Input
                    placeholder="Mensagem..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    className="flex-1"
                    disabled={isUploadingMedia}
                  />
                  {messageInput.trim() ? (
                    <Button 
                      onClick={handleSendMessage} 
                      disabled={isSending || isUploadingMedia}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={startRecording}
                      disabled={isUploadingMedia}
                    >
                      <Mic className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              )}
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

      {/* Reel Modal */}
      {openReelUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setOpenReelUrl(null)}
        >
          <button
            onClick={() => setOpenReelUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <div 
            className="w-full max-w-[400px] h-[90vh] max-h-[700px]"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={`${openReelUrl}/embed`}
              className="w-full h-full border-0 rounded-lg"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}
