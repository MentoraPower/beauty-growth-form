import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Smile, Paperclip, Mic, Send, Check, CheckCheck, X, Image, File, Video, RefreshCw, Maximize2, Zap, FileImage, FileVideo, Plus, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmojiPicker } from "@/components/whatsapp/EmojiPicker";
import { QuickMessages } from "@/components/whatsapp/QuickMessages";
import { AudioWaveform } from "@/components/whatsapp/AudioWaveform";
import { RecordingWaveform } from "@/components/whatsapp/RecordingWaveform";
import { formatWhatsAppText } from "@/lib/whatsapp-format";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import WhatsAppIcon from "@/components/icons/WhatsApp";

interface Message {
  id: string;
  text: string;
  time: string;
  sent: boolean;
  status: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  created_at?: string;
  message_id?: string | number | null;
}

interface ChatItem {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  time: string;
  unread: number;
  photo_url: string | null;
}

interface WhatsAppChatDropdownProps {
  phone: string;
  countryCode: string;
  contactName: string;
  sessionId?: string; // WhatsApp account session ID for multi-account isolation
}

const DEFAULT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMTIgMjEyIj48cGF0aCBmaWxsPSIjREZFNUU3IiBkPSJNMCAwaDIxMnYyMTJIMHoiLz48cGF0aCBmaWxsPSIjRkZGIiBkPSJNMTA2IDEwNmMtMjUuNCAwLTQ2LTIwLjYtNDYtNDZzMjAuNi00NiA0Ni00NiA0NiAyMC42IDQ2IDQ2LTIwLjYgNDYtNDYgNDZ6bTAgMTNjMzAuNiAwIDkyIDE1LjQgOTIgNDZ2MjNIMTR2LTIzYzAtMzAuNiA2MS40LTQ2IDkyLTQ2eiIvPjwvc3ZnPg==";

type ViewMode = "chat" | "list";

export function WhatsAppChatDropdown({ phone, countryCode, contactName, sessionId }: WhatsAppChatDropdownProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [chatData, setChatData] = useState<{ id: string; photo_url: string | null } | null>(null);
  const [allChats, setAllChats] = useState<ChatItem[]>([]);
  const [selectedChat, setSelectedChat] = useState<{ phone: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const attachButtonRef = useRef<HTMLButtonElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const quickMsgButtonRef = useRef<HTMLButtonElement>(null);
  const quickMsgPickerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Normalize phone numbers to match our DB storage format
  const normalizeDigits = (value: string) => value.replace(/\D/g, "").replace(/^0+/, "");

  // Format phone for API/DB (always digits, prefer with country code)
  const formatPhoneForApi = (phoneNumber: string, code: string) => {
    const cleanPhone = normalizeDigits(phoneNumber);
    const cleanCode = normalizeDigits(code);
    if (!cleanPhone) return "";
    if (cleanPhone.startsWith(cleanCode)) return cleanPhone;
    return `${cleanCode}${cleanPhone}`;
  };

  const formattedPhone = formatPhoneForApi(phone, countryCode);

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, []);

  // Fetch chat and messages when opened
  const fetchChatData = useCallback(async () => {
    if (!formattedPhone) return;

    const cleanCode = normalizeDigits(countryCode);
    const cleanPhone = normalizeDigits(phone);
    const withoutCode = cleanCode && formattedPhone.startsWith(cleanCode)
      ? formattedPhone.slice(cleanCode.length)
      : cleanPhone;

    const candidates = Array.from(new Set([formattedPhone, cleanPhone, withoutCode].filter(Boolean)));

    setIsLoading(true);
    try {
      // Build query with session_id filter for account isolation
      let query = supabase
        .from("whatsapp_chats")
        .select("id, photo_url, last_message_time, session_id")
        .in("phone", candidates);
      
      // Filter by session_id if provided for account isolation
      if (sessionId) {
        query = query.eq("session_id", sessionId);
      }
      
      const { data: existingChat } = await query
        .order("last_message_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!existingChat) {
        setChatData(null);
        setMessages([]);
        return;
      }

      setChatData({ id: existingChat.id, photo_url: existingChat.photo_url });

      const { data: messagesData } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("chat_id", existingChat.id)
        .order("created_at", { ascending: true })
        .limit(100);

      if (messagesData) {
        setMessages(messagesData.map(m => ({
          id: m.id,
          text: m.text || "",
          time: formatTime(m.created_at),
          sent: m.from_me || false,
          status: m.status || "RECEIVED",
          mediaUrl: m.media_url,
          mediaType: m.media_type,
          created_at: m.created_at,
          message_id: m.message_id,
        })));
      }
    } catch (error) {
      console.error("Error fetching chat:", error);
    } finally {
      setIsLoading(false);
    }
  }, [formattedPhone, phone, countryCode, sessionId]);

  // Fetch all chats for list view - filtered by session_id for account isolation
  const fetchAllChats = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("whatsapp_chats")
        .select("*");
      
      // Filter by session_id if provided for account isolation
      if (sessionId) {
        query = query.eq("session_id", sessionId);
      }
      
      const { data } = await query
        .order("last_message_time", { ascending: false })
        .limit(50);

      if (data) {
        setAllChats(data.map(chat => ({
          id: chat.id,
          name: chat.name || chat.phone,
          phone: chat.phone,
          lastMessage: chat.last_message || "",
          time: chat.last_message_time ? formatTime(chat.last_message_time) : "",
          unread: chat.unread_count || 0,
          photo_url: chat.photo_url,
        })));
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Select a chat from list view - with session_id filter for account isolation
  const selectChatFromList = async (chatPhone: string, chatName: string) => {
    setSelectedChat({ phone: chatPhone, name: chatName });
    setViewMode("chat");
    setIsLoading(true);

    try {
      let query = supabase
        .from("whatsapp_chats")
        .select("id, photo_url")
        .eq("phone", chatPhone);
      
      // Filter by session_id if provided for account isolation
      if (sessionId) {
        query = query.eq("session_id", sessionId);
      }
      
      const { data: existingChat } = await query.maybeSingle();

      if (existingChat) {
        setChatData(existingChat);

        const { data: messagesData } = await supabase
          .from("whatsapp_messages")
          .select("*")
          .eq("chat_id", existingChat.id)
          .order("created_at", { ascending: true })
          .limit(100);

        if (messagesData) {
          setMessages(messagesData.map(m => ({
            id: m.id,
            text: m.text || "",
            time: formatTime(m.created_at),
            sent: m.from_me || false,
            status: m.status || "RECEIVED",
            mediaUrl: m.media_url,
            mediaType: m.media_type,
            created_at: m.created_at,
            message_id: m.message_id,
          })));
        }
      }
    } catch (error) {
      console.error("Error fetching selected chat:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get current chat info
  const currentChatName = selectedChat?.name || contactName;
  const currentChatPhone = selectedChat?.phone || formattedPhone;

  useEffect(() => {
    if (isOpen && viewMode === "chat" && !selectedChat) {
      fetchChatData();
    } else if (isOpen && viewMode === "list") {
      fetchAllChats();
    }
  }, [isOpen, viewMode, selectedChat, fetchChatData, fetchAllChats]);

  // Reset to initial state when opened
  useEffect(() => {
    if (isOpen) {
      setViewMode("chat");
      setSelectedChat(null);
      setSearchQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isOpen, scrollToBottom]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (!isOpen || !chatData?.id) return;

    const channel = supabase
      .channel(`whatsapp-dropdown-${chatData.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "whatsapp_messages",
        filter: `chat_id=eq.${chatData.id}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newMsg = payload.new as any;
          setMessages(prev => {
            const exists = prev.some(m => m.id === newMsg.id);
            if (exists) return prev;
            return [...prev, {
              id: newMsg.id,
              text: newMsg.text || "",
              time: formatTime(newMsg.created_at),
              sent: newMsg.from_me || false,
              status: newMsg.status || "RECEIVED",
              mediaUrl: newMsg.media_url,
              mediaType: newMsg.media_type,
              created_at: newMsg.created_at,
              message_id: newMsg.message_id,
            }];
          });
          scrollToBottom();
        } else if (payload.eventType === "UPDATE") {
          const updated = payload.new as any;
          setMessages(prev => prev.map(m => 
            m.id === updated.id ? {
              ...m,
              text: updated.text || m.text,
              status: updated.status || m.status,
            } : m
          ));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, chatData?.id, scrollToBottom]);

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (showEmojiPicker && 
          !emojiPickerRef.current?.contains(e.target as Node) &&
          !emojiButtonRef.current?.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojiPicker]);

  const sendMessage = async () => {
    if (!message.trim() || isSending) return;

    const messageText = message.trim();
    setMessage("");
    setIsSending(true);

    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      text: messageText,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
      sent: true,
      status: "SENDING",
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom();

    try {
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: {
          action: "send-text",
          phone: formattedPhone,
          text: messageText,
          sessionId, // Pass sessionId for account isolation
        },
      });

      if (error) throw error;

      const messageId = data?.messageId || `local-${Date.now()}`;
      const whatsappKeyId = data?.whatsappKeyId || null;

      // Get or create chat - with session_id for account isolation
      let chatId = chatData?.id;
      if (!chatId) {
        // Build chat data with session_id
        const chatUpsertData: any = {
          phone: formattedPhone,
          name: contactName,
          last_message: messageText,
          last_message_time: new Date().toISOString(),
          last_message_status: "SENT",
          last_message_from_me: true,
        };
        
        // Add session_id for account isolation
        if (sessionId) {
          chatUpsertData.session_id = sessionId;
        }
        
        const { data: newChat } = await supabase
          .from("whatsapp_chats")
          .upsert(chatUpsertData, { onConflict: "phone,session_id" })
          .select()
          .single();
        
        if (newChat) {
          chatId = newChat.id;
          setChatData({ id: newChat.id, photo_url: newChat.photo_url });
        }
      }

      if (chatId) {
        const { data: insertedMsg } = await supabase
          .from("whatsapp_messages")
          .insert({
            chat_id: chatId,
            message_id: messageId,
            whatsapp_key_id: whatsappKeyId,
            phone: formattedPhone,
            text: messageText,
            from_me: true,
            status: "SENT",
          })
          .select()
          .single();

        await supabase
          .from("whatsapp_chats")
          .update({
            last_message: messageText,
            last_message_time: new Date().toISOString(),
            last_message_status: "SENT",
            last_message_from_me: true,
          })
          .eq("id", chatId);

        if (insertedMsg) {
          setMessages(prev => prev.map(m => m.id === tempId ? {
            ...m,
            id: insertedMsg.id,
            message_id: messageId,
            status: "SENT",
          } : m));
        }
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingStream(stream);
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({ title: "Erro ao acessar microfone", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendAudioMessage(blob);
        recordingStream?.getTracks().forEach((t) => t.stop());
        setRecordingStream(null);
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {};
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingTime(0);
    recordingStream?.getTracks().forEach((t) => t.stop());
    setRecordingStream(null);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  };

  const sendAudioMessage = async (blob: Blob) => {
    if (isSending) return;
    setIsSending(true);

    try {
      // Convert to MP3 using lamejs
      const arrayBuffer = await blob.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const samples = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      // @ts-ignore
      const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
      const samples16 = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        samples16[i] = samples[i] < 0 ? samples[i] * 0x8000 : samples[i] * 0x7FFF;
      }
      
      const mp3Data: ArrayBuffer[] = [];
      const blockSize = 1152;
      for (let i = 0; i < samples16.length; i += blockSize) {
        const chunk = samples16.subarray(i, i + blockSize);
        const mp3buf = mp3encoder.encodeBuffer(chunk);
        if (mp3buf.length > 0) mp3Data.push(mp3buf.buffer);
      }
      const endBuf = mp3encoder.flush();
      if (endBuf.length > 0) mp3Data.push(endBuf.buffer);
      
      const mp3Blob = new Blob(mp3Data, { type: "audio/mpeg" });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        
        const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
          body: {
            action: "send-audio",
            phone: currentChatPhone,
            audioBase64: base64,
            sessionId, // Pass sessionId for account isolation
          },
        });

        if (error) throw error;
        // Audio sent successfully - no toast needed
        
        // Refresh messages
        if (chatData?.id) {
          const { data: messagesData } = await supabase
            .from("whatsapp_messages")
            .select("*")
            .eq("chat_id", chatData.id)
            .order("created_at", { ascending: true })
            .limit(100);

          if (messagesData) {
            setMessages(messagesData.map(m => ({
              id: m.id,
              text: m.text || "",
              time: formatTime(m.created_at),
              sent: m.from_me || false,
              status: m.status || "RECEIVED",
              mediaUrl: m.media_url,
              mediaType: m.media_type,
              created_at: m.created_at,
              message_id: m.message_id,
            })));
          }
        }
      };
      reader.readAsDataURL(mp3Blob);
    } catch (error: any) {
      console.error("Error sending audio:", error);
      toast({ title: "Erro ao enviar áudio", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleMediaUpload = async (file: File, type: "image" | "video" | "document") => {
    if (!file || isSending) return;
    setIsSending(true);
    setShowAttachMenu(false);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        
        const action = type === "image" ? "send-image" : type === "video" ? "send-video" : "send-document";
        
        const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
          body: {
            action,
            phone: currentChatPhone,
            [`${type}Base64`]: base64,
            filename: file.name,
            mimeType: file.type,
            sessionId, // Pass sessionId for account isolation
          },
        });

        if (error) throw error;
        toast({ title: `${type === "image" ? "Imagem" : type === "video" ? "Vídeo" : "Documento"} enviado!` });
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error(`Error sending ${type}:`, error);
      toast({ title: `Erro ao enviar ${type}`, description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickMessageSelect = (text: string) => {
    setMessage(text);
    setShowQuickMessages(false);
  };

  const handleQuickAudioSelect = async (audioBase64: string) => {
    setShowQuickMessages(false);
    setIsSending(true);

    try {
      const base64Data = audioBase64.includes(",") ? audioBase64.split(",")[1] : audioBase64;
      
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: {
          action: "send-audio",
          phone: currentChatPhone,
          audioBase64: base64Data,
          sessionId, // Pass sessionId for account isolation
        },
      });

      if (error) throw error;
      // Audio sent successfully - no toast needed
    } catch (error: any) {
      console.error("Error sending quick audio:", error);
      toast({ title: "Erro ao enviar áudio", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderStatusIcon = (status: string, sent: boolean) => {
    if (!sent) return null;
    switch (status) {
      case "SENDING":
        return <Check className="h-3 w-3 text-gray-400" />;
      case "SENT":
        return <Check className="h-3 w-3 text-gray-400" />;
      case "DELIVERED":
        return <CheckCheck className="h-3 w-3 text-gray-400" />;
      case "READ":
      case "PLAYED":
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default:
        return <Check className="h-3 w-3 text-gray-400" />;
    }
  };

  const hasWhatsApp = phone && phone.trim() !== "";

  if (!hasWhatsApp) {
    return null;
  }

  return (
    <>
      {/* Small trigger button - placed inline */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-full hover:bg-red-100/50 transition-colors"
        title="Abrir WhatsApp"
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24">
          <defs>
            <linearGradient id="whatsapp-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F40000" />
              <stop offset="100%" stopColor="#A10000" />
            </linearGradient>
          </defs>
          <path fill="url(#whatsapp-gradient)" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </button>

      {/* Fixed dropdown in bottom right corner */}
      {isOpen && (
        <div className="fixed bottom-12 right-6 z-50 w-[400px] h-[750px] bg-background border rounded-lg shadow-xl">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 p-3 border-b bg-muted/30">
              {viewMode === "list" ? (
                <>
                  <WhatsAppIcon className="h-6 w-6 text-green-600" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Conversas</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center overflow-hidden">
                    {chatData?.photo_url ? (
                      <img src={chatData.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <img src={DEFAULT_AVATAR} alt="" className="h-full w-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{currentChatName}</p>
                    <p className="text-xs text-muted-foreground">{currentChatPhone}</p>
                  </div>
                </>
              )}
              {viewMode === "chat" && (
                <button 
                  onClick={() => {
                    setIsOpen(false);
                    navigate(`/admin/whatsapp?phone=${currentChatPhone}`);
                  }}
                  className="p-1.5 rounded-full hover:bg-muted transition-colors"
                  title="Expandir conversa"
                >
                  <Maximize2 className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              <button 
                onClick={() => {
                  if (viewMode === "chat") {
                    setViewMode("list");
                    fetchAllChats();
                  } else {
                    setIsOpen(false);
                  }
                }}
                className="p-1.5 rounded-full hover:bg-muted transition-colors"
                title={viewMode === "chat" ? "Ver todas conversas" : "Fechar"}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* List View */}
            {viewMode === "list" && (
              <>
                {/* Search */}
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Pesquisar conversa..."
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Chats List */}
                <ScrollArea className="flex-1">
                  <div className="divide-y">
                    {isLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : allChats.filter(c => 
                      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      c.phone.includes(searchQuery)
                    ).map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => selectChatFromList(chat.phone, chat.name)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {chat.photo_url ? (
                            <img src={chat.photo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <img src={DEFAULT_AVATAR} alt="" className="h-full w-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm truncate">{chat.name}</p>
                            <span className="text-xs text-muted-foreground flex-shrink-0">{chat.time}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground truncate">{chat.lastMessage || "Sem mensagens"}</p>
                            {chat.unread > 0 && (
                              <span className="flex-shrink-0 bg-green-500 text-white text-xs rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                                {chat.unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}

            {/* Chat View */}
            {viewMode === "chat" && (
              <>
                {/* Messages Area */}
                <ScrollArea className="flex-1 bg-[#e5ddd5] dark:bg-zinc-900">
                  <div className="p-3 space-y-2 min-h-full">
                    {isLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                        Nenhuma mensagem ainda
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex",
                            msg.sent ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[80%] rounded-lg px-3 py-2 shadow-sm",
                              msg.sent
                                ? "bg-[#dcf8c6] dark:bg-green-900 text-foreground"
                                : "bg-white dark:bg-zinc-800 text-foreground"
                            )}
                          >
                            {/* Media */}
                            {msg.mediaType === "audio" && msg.mediaUrl && (
                              <div className="mb-1">
                                <AudioWaveform src={msg.mediaUrl} />
                              </div>
                            )}
                            {msg.mediaType === "image" && msg.mediaUrl && (
                              <img 
                                src={msg.mediaUrl} 
                                alt="" 
                                className="rounded max-w-full mb-1 cursor-pointer"
                                style={{ maxHeight: "150px" }}
                              />
                            )}
                            {msg.mediaType === "video" && msg.mediaUrl && (
                              <video 
                                src={msg.mediaUrl} 
                                controls 
                                className="rounded max-w-full mb-1"
                                style={{ maxHeight: "150px" }}
                              />
                            )}
                            {msg.mediaType === "document" && msg.mediaUrl && (
                              <a 
                                href={msg.mediaUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 bg-muted/50 rounded mb-1 text-xs hover:bg-muted"
                              >
                                <File className="h-4 w-4" />
                                <span>Documento</span>
                              </a>
                            )}
                            
                            {/* Text */}
                            {msg.text && (
                              <div className="text-sm whitespace-pre-wrap break-words">
                                {formatWhatsAppText(msg.text)}
                              </div>
                            )}
                            
                            {/* Time and status */}
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                              {renderStatusIcon(msg.status, msg.sent)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="p-2 border-t bg-muted/30">
                  {/* Hidden file inputs */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleMediaUpload(file, "image");
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleMediaUpload(file, "video");
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={documentInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleMediaUpload(file, "document");
                      e.target.value = "";
                    }}
                  />

                  {isRecording ? (
                    // Recording UI
                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 rounded-lg p-2">
                      <button
                        onClick={cancelRecording}
                        className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                      >
                        <X className="h-5 w-5 text-red-500" />
                      </button>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        <RecordingWaveform isRecording={isRecording} stream={recordingStream} />
                        <span className="text-sm font-medium text-red-600">{formatRecordingTime(recordingTime)}</span>
                      </div>
                      <button
                        onClick={stopRecording}
                        className="p-2 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors"
                      >
                        <Send className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    // Normal input UI
                    <div className="flex items-center gap-1">
                      {/* Emoji */}
                      <div className="relative">
                        <button
                          ref={emojiButtonRef}
                          onClick={() => {
                            setShowEmojiPicker(!showEmojiPicker);
                            setShowAttachMenu(false);
                            setShowQuickMessages(false);
                          }}
                          className="p-1.5 rounded-full hover:bg-muted transition-colors"
                        >
                          <Smile className="h-5 w-5 text-muted-foreground" />
                        </button>
                        {showEmojiPicker && (
                          <div ref={emojiPickerRef} className="absolute bottom-10 left-0 z-50">
                            <EmojiPicker onSelect={(emoji) => {
                              setMessage(prev => prev + emoji);
                              setShowEmojiPicker(false);
                            }} />
                          </div>
                        )}
                      </div>

                      {/* Attach */}
                      <div className="relative">
                        <button
                          ref={attachButtonRef}
                          onClick={() => {
                            setShowAttachMenu(!showAttachMenu);
                            setShowEmojiPicker(false);
                            setShowQuickMessages(false);
                          }}
                          className="p-1.5 rounded-full hover:bg-muted transition-colors"
                        >
                          <Plus className="h-5 w-5 text-muted-foreground" />
                        </button>
                        {showAttachMenu && (
                          <div ref={attachMenuRef} className="absolute bottom-10 left-0 z-50 bg-card border rounded-lg shadow-lg p-2 min-w-[140px]">
                            <button
                              onClick={() => imageInputRef.current?.click()}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors"
                            >
                              <FileImage className="h-4 w-4 text-blue-500" />
                              Imagem
                            </button>
                            <button
                              onClick={() => videoInputRef.current?.click()}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors"
                            >
                              <FileVideo className="h-4 w-4 text-purple-500" />
                              Vídeo
                            </button>
                            <button
                              onClick={() => documentInputRef.current?.click()}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors"
                            >
                              <File className="h-4 w-4 text-orange-500" />
                              Documento
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Quick Messages */}
                      <div className="relative">
                        <button
                          ref={quickMsgButtonRef}
                          onClick={() => {
                            setShowQuickMessages(!showQuickMessages);
                            setShowEmojiPicker(false);
                            setShowAttachMenu(false);
                          }}
                          className="p-1.5 rounded-full hover:bg-muted transition-colors"
                        >
                          <Zap className="h-5 w-5 text-amber-500" />
                        </button>
                        {showQuickMessages && (
                          <div ref={quickMsgPickerRef} className="absolute bottom-10 right-0 z-50 max-w-[380px]" style={{ right: '-60px' }}>
                            <QuickMessages
                              onSelect={handleQuickMessageSelect}
                              onSelectAudio={handleQuickAudioSelect}
                            />
                          </div>
                        )}
                      </div>
                      
                      <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Digite uma mensagem"
                        className="flex-1 bg-white dark:bg-zinc-800 border-0 focus-visible:ring-0 text-sm h-9"
                        disabled={isSending}
                      />
                      
                      {message.trim() ? (
                        <button
                          onClick={sendMessage}
                          disabled={isSending}
                          className="p-1.5 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
                        >
                          <Send className="h-5 w-5" />
                        </button>
                      ) : (
                        <button
                          onClick={startRecording}
                          disabled={isSending}
                          className="p-1.5 rounded-full hover:bg-muted transition-colors"
                        >
                          <Mic className="h-5 w-5 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
