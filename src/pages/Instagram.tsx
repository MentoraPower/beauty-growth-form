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
import { useInstagramCache } from "@/hooks/useInstagramCache";

interface Chat {
  id: string; // This is the conversation_id from Instagram
  conversation_id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  avatar: string | null;
  username: string;
  participantId: string;
}

interface Message {
  id: string;
  message_id: string;
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
  const [isConnected, setIsConnected] = useState<boolean | null>(null); // null = checking from cache
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<{ username?: string; userId?: string } | null>(null);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [openReelUrl, setOpenReelUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use the cache hook for instant loading
  const {
    chats,
    messages,
    isLoadingChats,
    isLoadingMessages,
    fetchChats,
    fetchMessages,
    clearMessages,
    addTempMessage,
    updateTempMessageStatus,
    removeTempMessage,
    saveSentMessageToCache,
  } = useInstagramCache();

  const REDIRECT_URI = `${window.location.origin}/admin/instagram`;
  const myInstagramUserId = accountInfo?.userId;

  // Check for cached connection FIRST (instant load)
  useEffect(() => {
    const checkCachedConnection = async () => {
      // First check if we have cached connection info in the database
      const { data: connection } = await supabase
        .from('instagram_connections')
        .select('instagram_user_id, instagram_username')
        .limit(1)
        .maybeSingle();

      if (connection) {
        // Instant connection from cache
        setIsConnected(true);
        setAccountInfo({
          username: connection.instagram_username || undefined,
          userId: connection.instagram_user_id
        });
        // Background API check to validate token
        checkConnectionInBackground();
      } else {
        // No cached connection, check URL for OAuth callback
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const processedCode = sessionStorage.getItem('instagram_processed_code');

        if (code && code !== processedCode) {
          sessionStorage.setItem('instagram_processed_code', code);
          window.history.replaceState({}, document.title, window.location.pathname);
          handleOAuthCallback(code);
        } else if (code) {
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsConnected(false);
        } else {
          setIsConnected(false);
        }
      }
    };

    checkCachedConnection();
  }, []);

  // Background check to validate token (doesn't block UI)
  const checkConnectionInBackground = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('instagram-api', {
        body: { action: 'check-connection', params: {} }
      });

      if (error || !data.success || !data.connected) {
        // Token expired or invalid
        if (data?.needsReauth) {
          setConnectionError('Token expirado. Por favor, reconecte sua conta.');
        }
        setIsConnected(false);
        setAccountInfo(null);
      }
    } catch (error) {
      console.error('Background connection check error:', error);
      // Keep the cached state, don't disrupt UX
    }
  };

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
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
      // Cleanup stored redirectUri/code markers
      sessionStorage.removeItem('instagram_oauth_redirect_uri');
      sessionStorage.removeItem('instagram_processed_code');
    }
  };

  // Legacy checkConnection - now only used as fallback
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
        setSelectedChat(null);
        clearMessages();
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

  // Fetch chats when connected
  useEffect(() => {
    if (!isConnected || !myInstagramUserId) return;
    fetchChats(myInstagramUserId);
  }, [isConnected, myInstagramUserId, fetchChats]);

  // Fetch messages when a chat is selected - use conversation_id
  useEffect(() => {
    if (selectedChat && myInstagramUserId) {
      clearMessages();
      // Use conversation_id (which equals id in our unified structure)
      fetchMessages(selectedChat.conversation_id, myInstagramUserId);
    }
  }, [selectedChat?.conversation_id, myInstagramUserId, fetchMessages, clearMessages]);

  // Background polling for conversations (every 30 seconds)
  useEffect(() => {
    if (!isConnected || !myInstagramUserId) return;

    const interval = setInterval(() => {
      fetchChats(myInstagramUserId);
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected, myInstagramUserId, fetchChats]);

  // Background polling for messages when chat is selected (every 5 seconds for faster updates)
  useEffect(() => {
    if (!selectedChat || !myInstagramUserId) return;

    const interval = setInterval(() => {
      fetchMessages(selectedChat.conversation_id, myInstagramUserId);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedChat?.conversation_id, myInstagramUserId, fetchMessages]);

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

    const currentChat = selectedChat; // Capture reference
    setIsSending(true);
    const text = messageInput.trim();
    setMessageInput("");

    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      message_id: tempId,
      text,
      time: new Date().toISOString(),
      fromMe: true,
      status: "PENDING",
    };

    addTempMessage(tempMessage);
    scrollToBottom();

    try {
      console.log('[Instagram] Sending message to:', currentChat.participantId);
      
      const { data, error } = await supabase.functions.invoke('instagram-api', {
        body: { 
          action: 'send-message',
          params: {
            recipientId: currentChat.participantId,
            message: text
          }
        }
      });

      console.log('[Instagram] Send response:', data, error);

      if (error) throw error;
      
      if (data?.success) {
        // Update temp message to sent status
        updateTempMessageStatus(tempId, { status: 'SENT' });
        
        // Save to cache for persistence
        const sentMessage: Message = {
          ...tempMessage,
          status: 'SENT',
        };
        saveSentMessageToCache(currentChat.conversation_id, sentMessage);
        
        // Refresh messages after short delay to get server confirmation
        setTimeout(() => {
          if (myInstagramUserId) {
            fetchMessages(currentChat.conversation_id, myInstagramUserId);
          }
        }, 1500);
      } else {
        throw new Error(data?.error || 'Erro ao enviar mensagem');
      }
    } catch (error: any) {
      console.error("[Instagram] Error sending message:", error);
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
      removeTempMessage(tempId);
    } finally {
      setIsSending(false);
    }
  };

  // Handle media upload (image/video)
  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedChat) return;

    setIsUploadingMedia(true);
    const tempId = `temp-${Date.now()}`;

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
        setIsUploadingMedia(false);
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
        id: tempId,
        message_id: tempId,
        text: null,
        time: new Date().toISOString(),
        fromMe: true,
        status: 'PENDING',
        mediaType,
        mediaUrl,
      };
      addTempMessage(tempMessage);
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
        const sentMessage: Message = {
          ...tempMessage,
          id: data.messageId || tempId,
          message_id: data.messageId || tempId,
          status: 'SENT',
        };
        updateTempMessageStatus(tempId, { 
          status: 'SENT',
          id: sentMessage.id,
          message_id: sentMessage.message_id 
        });
        
        // Save to cache
        saveSentMessageToCache(selectedChat.conversation_id, sentMessage);
        
        toast({
          title: "Mídia enviada",
          description: isImage ? "Imagem enviada com sucesso." : "Vídeo enviado com sucesso.",
        });
        
        // Refresh messages
        setTimeout(() => {
          if (myInstagramUserId) {
            fetchMessages(selectedChat.conversation_id, myInstagramUserId);
          }
        }, 1500);
      } else {
        throw new Error(data.error || 'Erro ao enviar mídia');
      }
    } catch (error: any) {
      console.error("Error uploading media:", error);
      toast({
        title: "Erro ao enviar mídia",
        description: error.message || "Não foi possível enviar a mídia.",
        variant: "destructive",
      });
      removeTempMessage(tempId);
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

    const currentChat = selectedChat;
    const tempId = `temp-${Date.now()}`;

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
            id: tempId,
            message_id: tempId,
            text: null,
            time: new Date().toISOString(),
            fromMe: true,
            status: 'PENDING',
            mediaType: 'audio',
            mediaUrl,
          };
          addTempMessage(tempMessage);
          scrollToBottom();

          // Send via Instagram API
          const { data, error } = await supabase.functions.invoke('instagram-api', {
            body: {
              action: 'send-media',
              params: {
                recipientId: currentChat.participantId,
                mediaUrl,
                mediaType: 'audio/webm',
              },
            },
          });

          if (error) throw error;

          if (data.success) {
            const sentMessage: Message = {
              ...tempMessage,
              id: data.messageId || tempId,
              message_id: data.messageId || tempId,
              status: 'SENT',
            };
            updateTempMessageStatus(tempId, { 
              status: 'SENT',
              id: sentMessage.id,
              message_id: sentMessage.message_id 
            });
            
            // Save to cache
            saveSentMessageToCache(currentChat.conversation_id, sentMessage);
            
            toast({
              title: "Áudio enviado",
              description: "Mensagem de voz enviada com sucesso.",
            });
            
            // Refresh messages
            setTimeout(() => {
              if (myInstagramUserId) {
                fetchMessages(currentChat.conversation_id, myInstagramUserId);
              }
            }, 1500);
          } else {
            throw new Error(data.error || 'Erro ao enviar áudio');
          }
        } catch (error: any) {
          console.error("Error sending audio:", error);
          toast({
            title: "Erro ao enviar áudio",
            description: error.message || "Não foi possível enviar o áudio.",
            variant: "destructive",
          });
          removeTempMessage(tempId);
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

  // Initial loading state (only while checking cache, very fast)
  if (isConnected === null || isConnecting) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto" />
          <p className="text-muted-foreground">
            {isConnecting ? 'Conectando ao Instagram...' : 'Carregando...'}
          </p>
        </div>
      </div>
    );
  }

  // Not connected - Login screen
  if (!isConnected) {
    return (
      <div className="h-full flex items-center justify-center p-4">
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
    <div className="h-full min-h-0 flex overflow-hidden bg-background relative">
      {/* Chat List Sidebar */}
      <div className="w-[300px] border-r border-border flex flex-col flex-shrink-0 bg-background">
        <div className="h-14 px-4 flex items-center border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
              <Instagram className="h-4 w-4 text-white" />
            </div>
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
                      "w-full flex items-center gap-3 p-3 rounded-lg",
                      selectedChat?.id === chat.id ? "bg-muted" : "hover:bg-muted/50"
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
                    <div className="bg-muted/80 rounded-2xl px-4 py-3 max-w-[60%] animate-pulse">
                      <div className="h-4 bg-muted-foreground/20 rounded w-40 mb-2" />
                      <div className="h-4 bg-muted-foreground/20 rounded w-24" />
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="bg-muted rounded-2xl px-4 py-3 max-w-[60%] animate-pulse">
                      <div className="h-4 bg-muted-foreground/20 rounded w-36" />
                    </div>
                  </div>
                  <div className="flex items-end justify-end">
                    <div className="bg-muted/80 rounded-2xl px-4 py-3 max-w-[60%] animate-pulse">
                      <div className="h-4 bg-muted-foreground/20 rounded w-28" />
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
                      key={message.message_id || message.id}
                      className={cn("flex flex-col", message.fromMe ? "items-end" : "items-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl overflow-hidden",
                          message.fromMe
                            ? "bg-muted/80 text-foreground"
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
