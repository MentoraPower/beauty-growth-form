import { useState, useEffect, useRef, useCallback } from "react";

import { Search, Smile, Paperclip, Mic, Send, Check, CheckCheck, RefreshCw, Phone, Image, File, Trash2, PanelRightOpen, PanelRightClose, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CallModal from "@/components/whatsapp/CallModal";
import LeadInfoPanel from "@/components/whatsapp/LeadInfoPanel";
import { AudioWaveform } from "@/components/whatsapp/AudioWaveform";
import { RecordingWaveform } from "@/components/whatsapp/RecordingWaveform";

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  lastMessageTime: string | null; // Raw ISO timestamp for sorting
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
  created_at?: string;
}

const DEFAULT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMTIgMjEyIj48cGF0aCBmaWxsPSIjREZFNUU3IiBkPSJNMCAwaDIxMnYyMTJIMHoiLz48cGF0aCBmaWxsPSIjRkZGIiBkPSJNMTA2IDEwNmMtMjUuNCAwLTQ2LTIwLjYtNDYtNDZzMjAuNi00NiA0Ni00NiA0NiAyMC42IDQ2IDQ2LTIwLjYgNDYtNDYgNDZ6bTAgMTNjMzAuNiAwIDkyIDE1LjQgOTIgNDZ2MjNIMTR2LTIzYzAtMzAuNiA2MS40LTQ2IDkyLTQ2eiIvPjwvc3ZnPg==";

const WhatsApp = () => {
  const { toast } = useToast();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showLeadPanel, setShowLeadPanel] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldScrollToBottomOnOpenRef = useRef(false);
  const lastFetchedChatIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to bottom of the messages container (reliable even on long threads)
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);


  // Observe DOM changes and scroll to bottom (simple backup)
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el || !selectedChat) return;

    const observer = new MutationObserver(() => {
      if (shouldScrollToBottomOnOpenRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });

    observer.observe(el, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [selectedChat?.id]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const chatsRef = useRef<Chat[]>([]);

  const getInitials = (name: string): string => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const isWhatsAppInternalId = (phone: string): boolean => {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length > 14) return true;
    if (/^(120|146|180|203|234|447)\d{10,}$/.test(cleaned)) return true;
    return false;
  };

  const formatPhoneDisplay = (phone: string): string => {
    if (!phone) return "";
    if (isWhatsAppInternalId(phone)) return phone;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    } else if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    } else if (cleaned.length >= 10) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
    }
    return phone;
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    
    // Get São Paulo time for comparison
    const spOptions = { timeZone: "America/Sao_Paulo" };
    const dateInSP = new Date(date.toLocaleString("en-US", spOptions));
    const nowInSP = new Date(now.toLocaleString("en-US", spOptions));
    
    const diffDays = Math.floor((nowInSP.getTime() - dateInSP.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    } else if (diffDays === 1) {
      return "Ontem";
    } else {
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    }
  };

  const getDateLabel = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    
    const spOptions = { timeZone: "America/Sao_Paulo" };
    const dateInSP = new Date(date.toLocaleString("en-US", spOptions));
    const nowInSP = new Date(now.toLocaleString("en-US", spOptions));
    
    // Reset hours to compare just dates
    const dateOnly = new Date(dateInSP.getFullYear(), dateInSP.getMonth(), dateInSP.getDate());
    const nowOnly = new Date(nowInSP.getFullYear(), nowInSP.getMonth(), nowInSP.getDate());
    
    const diffDays = Math.floor((nowOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) {
      const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
      return dayNames[dateInSP.getDay()];
    }
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  };

  const getMessageDateKey = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" });
  };

  const formatChatData = useCallback((chat: any): Chat | null => {
    const phone = chat.phone || "";
    if (phone.includes("@newsletter") || phone.includes("@g.us") || 
        phone.includes("status@broadcast") || phone === "0" || phone === "" ||
        isWhatsAppInternalId(phone)) {
      return null;
    }

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
      lastMessageTime: chat.last_message_time || null,
      unread: chat.unread_count || 0,
      avatar: getInitials(displayName || chat.phone),
      phone: chat.phone,
      photo_url: chat.photo_url,
    };
  }, []);

  // Initial load - fetch chats once
  const fetchChats = useCallback(async (showLoading = false) => {
    if (showLoading) setIsInitialLoad(true);
    
    try {
      const { data, error } = await supabase
        .from("whatsapp_chats")
        .select("*")
        .order("last_message_time", { ascending: false });

      if (error) throw error;

      const formattedChats = (data || [])
        .map(formatChatData)
        .filter((chat): chat is Chat => chat !== null);

      chatsRef.current = formattedChats;
      setChats(formattedChats);
    } catch (error: any) {
      console.error("Error fetching chats:", error);
    } finally {
      setIsInitialLoad(false);
    }
  }, [formatChatData]);

  // Update single chat in state without refetching all
  const updateChatInState = useCallback((updatedChat: any) => {
    const formatted = formatChatData(updatedChat);
    if (!formatted) return;

    setChats(prev => {
      const existingIndex = prev.findIndex(c => c.id === formatted.id);
      let newChats: Chat[];
      
      if (existingIndex >= 0) {
        // Update existing chat
        newChats = [...prev];
        newChats[existingIndex] = formatted;
      } else {
        // Add new chat at beginning
        newChats = [formatted, ...prev];
      }
      
      // Sort by last message time (most recent first) using raw timestamp
      newChats.sort((a, b) => {
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
      });
      
      chatsRef.current = newChats;
      return newChats;
    });

    // Update selectedChat if it's the one being updated
    setSelectedChat(prev => {
      if (prev?.id === formatted.id) {
        return formatted;
      }
      return prev;
    });
  }, [formatChatData]);

  // Remove chat from state
  const removeChatFromState = useCallback((chatId: string) => {
    setChats(prev => {
      const newChats = prev.filter(c => c.id !== chatId);
      chatsRef.current = newChats;
      return newChats;
    });
    
    setSelectedChat(prev => {
      if (prev?.id === chatId) return null;
      return prev;
    });
  }, []);

  // Update chat name when lead is found/created in CRM
  const updateChatName = useCallback(async (chatId: string, newName: string) => {
    // Update local state
    setChats(prev => {
      const newChats = prev.map(c => 
        c.id === chatId ? { ...c, name: newName } : c
      );
      chatsRef.current = newChats;
      return newChats;
    });

    // Update selected chat if it's the one being updated
    setSelectedChat(prev => {
      if (prev?.id === chatId) {
        return { ...prev, name: newName };
      }
      return prev;
    });

    // Update in Supabase
    try {
      await supabase
        .from("whatsapp_chats")
        .update({ name: newName })
        .eq("id", chatId);
      console.log("[WhatsApp] Chat name updated to:", newName);
    } catch (error) {
      console.error("Error updating chat name:", error);
    }
  }, []);

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
        time: msg.created_at ? new Date(msg.created_at).toLocaleTimeString("pt-BR", { 
          hour: "2-digit", 
          minute: "2-digit",
          timeZone: "America/Sao_Paulo"
        }) : "",
        sent: msg.from_me || false,
        read: msg.status === "READ" || msg.status === "PLAYED",
        status: msg.status,
        mediaUrl: msg.media_url,
        mediaType: msg.media_type,
        created_at: msg.created_at,
      }));

      setMessages(formattedMessages);
      lastFetchedChatIdRef.current = chatId;

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
    if (!message.trim() || !selectedChat || isSending) return;

    const messageText = message.trim();
    setMessage("");
    setIsSending(true);
    
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      text: messageText,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
      sent: true,
      read: false,
      status: "SENDING",
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom("auto");

    try {
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: {
          action: "send-text",
          phone: selectedChat.phone,
          text: messageText,
        },
      });

      if (error) throw error;

      const messageId = data?.messageId || `local-${Date.now()}`;

      const { data: insertedMsg } = await supabase
        .from("whatsapp_messages")
        .insert({
          chat_id: selectedChat.id,
          message_id: messageId,
          phone: selectedChat.phone,
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
        })
        .eq("id", selectedChat.id);

      // Replace temp message with real one (prevent realtime duplicate)
      if (insertedMsg) {
        setMessages(prev => prev.map(m => m.id === tempId ? { 
          ...m, 
          id: insertedMsg.id, 
          status: "SENT" 
        } : m));
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

  const clearAllData = async () => {
    try {
      console.log("[WhatsApp] Clearing all data...");
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "clear-all" },
      });
      console.log("[WhatsApp] Clear response:", data, error);
      setChats([]);
      setMessages([]);
      setSelectedChat(null);
    } catch (error: any) {
      console.error("[WhatsApp] Error clearing:", error);
    }
  };

  const syncAllChats = async () => {
    setIsSyncing(true);
    try {
      console.log("[WhatsApp] Syncing Wasender...");
      
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "sync-all" },
      });

      console.log("[WhatsApp] Sync response:", data, error);
      // Chats will update via realtime subscription
      
    } catch (error: any) {
      console.error("[WhatsApp] Error syncing:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const clearAndSync = async () => {
    await clearAllData();
    await syncAllChats();
  };

  const handleFileUpload = async (file: File, type: "image" | "file") => {
    if (!selectedChat || isSending) return;
    
    setShowAttachMenu(false);
    setIsSending(true);

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'bin';
      const filename = `${selectedChat.phone}_${timestamp}.${ext}`;
      const filePath = `${type}s/${filename}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      // Determine action based on type
      const action = type === "image" ? "send-image" : "send-file";

      // Add temp message to UI
      const tempId = `temp-${Date.now()}`;
      const tempMsg: Message = {
        id: tempId,
        text: type === "image" ? "" : file.name,
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
        sent: true,
        read: false,
        status: "SENDING",
        mediaUrl: publicUrl,
        mediaType: type,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempMsg]);
      scrollToBottom("smooth");

      // Send via WAHA
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { 
          action,
          phone: selectedChat.phone, 
          mediaUrl: publicUrl,
          filename: file.name,
          caption: "",
        },
      });

      if (error) throw error;

      // Insert into database
      const { data: insertedMsg } = await supabase.from("whatsapp_messages").insert({
        chat_id: selectedChat.id,
        phone: selectedChat.phone,
        text: type === "image" ? "" : file.name,
        from_me: true,
        status: "SENT",
        media_url: publicUrl,
        media_type: type,
        message_id: data?.messageId,
        created_at: new Date().toISOString(),
      }).select().single();

      if (insertedMsg) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: insertedMsg.id, status: "SENT" } : m));
      }

      // Update chat last message
      await supabase.from("whatsapp_chats").update({
        last_message: type === "image" ? "📷 Imagem" : `📄 ${file.name}`,
        last_message_time: new Date().toISOString(),
      }).eq("id", selectedChat.id);

      toast({ title: type === "image" ? "Imagem enviada" : "Arquivo enviado" });

    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Audio recording functions - use OGG or MP4 for WasenderAPI compatibility
  const startRecording = async () => {
    if (!selectedChat) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingStream(stream);
      
      // Determine best supported audio format for WasenderAPI (prefers OGG Opus)
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')) {
        mimeType = 'audio/ogg; codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) {
        mimeType = 'audio/webm; codecs=opus';
      }
      
      console.log("[WhatsApp] Recording with mimeType:", mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setRecordingStream(null);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await sendAudioMessage(audioBlob, mimeType);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error: any) {
      console.error("Error starting recording:", error);
      toast({
        title: "Erro ao gravar",
        description: "Permita o acesso ao microfone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
    setRecordingStream(null);
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const sendAudioMessage = async (audioBlob: Blob, mimeType: string = 'audio/webm') => {
    if (!selectedChat) return;

    setIsSending(true);

    try {
      // Determine file extension based on mimeType
      let ext = 'webm';
      if (mimeType.includes('ogg')) ext = 'ogg';
      else if (mimeType.includes('mp4')) ext = 'mp4';
      else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) ext = 'mp3';
      
      // Generate filename
      const timestamp = Date.now();
      const filename = `${selectedChat.phone}_${timestamp}.${ext}`;
      const filePath = `audios/${filename}`;

      console.log("[WhatsApp] Uploading audio:", filename, "mimeType:", mimeType);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, audioBlob, {
          contentType: mimeType,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      console.log("[WhatsApp] Audio uploaded, URL:", publicUrl);

      // Add temp message to UI
      const tempId = `temp-${Date.now()}`;
      const tempMsg: Message = {
        id: tempId,
        text: "",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
        sent: true,
        read: false,
        status: "SENDING",
        mediaUrl: publicUrl,
        mediaType: "audio",
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempMsg]);
      scrollToBottom("smooth");

      // Send via WasenderAPI
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { 
          action: "send-audio",
          phone: selectedChat.phone, 
          mediaUrl: publicUrl,
        },
      });

      if (error) throw error;

      console.log("[WhatsApp] Audio sent via WasenderAPI:", data);

      // Insert into database
      const { data: insertedMsg } = await supabase.from("whatsapp_messages").insert({
        chat_id: selectedChat.id,
        phone: selectedChat.phone,
        text: "",
        from_me: true,
        status: "SENT",
        media_url: publicUrl,
        media_type: "audio",
        message_id: data?.messageId,
        created_at: new Date().toISOString(),
      }).select().single();

      if (insertedMsg) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: insertedMsg.id, status: "SENT" } : m));
      }

      // Update chat last message
      await supabase.from("whatsapp_chats").update({
        last_message: "🎵 Áudio",
        last_message_time: new Date().toISOString(),
      }).eq("id", selectedChat.id);

      toast({ title: "Áudio enviado" });

    } catch (error: any) {
      console.error("Error sending audio:", error);
      toast({
        title: "Erro ao enviar áudio",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
      setRecordingTime(0);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const initiateCall = async () => {
    if (!selectedChat) return;

    const { error } = await supabase.functions.invoke("infobip-call", {
      body: { to: selectedChat.phone },
    });

    if (error) throw error;

    toast({
      title: "Ligação iniciada",
      description: `Chamando ${selectedChat.name}...`,
    });
  };

  // Initial load and cleanup
  useEffect(() => {
    const init = async () => {
      // Cleanup invalid chats
      try {
        const { data: allChats } = await supabase
          .from("whatsapp_chats")
          .select("id, phone");

        if (allChats) {
          const invalidChatIds = allChats
            .filter((chat: any) => {
              const phone = chat.phone || "";
              return phone.includes("@newsletter") || phone.includes("@g.us") ||
                     phone.includes("status@broadcast") || phone === "0" || 
                     phone === "" || isWhatsAppInternalId(phone);
            })
            .map((chat: any) => chat.id);

          if (invalidChatIds.length > 0) {
            await supabase.from("whatsapp_messages").delete().in("chat_id", invalidChatIds);
            await supabase.from("whatsapp_chats").delete().in("id", invalidChatIds);
          }
        }
      } catch (error) {
        console.error("Cleanup error:", error);
      }
      
      // Fetch chats
      await fetchChats(true);
      
      // Background sync
      syncAllChats();
    };
    
    init();
  }, [fetchChats]);

  // Realtime subscription for chats - UPDATE INCREMENTALLY
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-chats-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_chats" },
        (payload) => {
          console.log("[WhatsApp] Chat inserted:", payload.new);
          updateChatInState(payload.new);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_chats" },
        (payload) => {
          console.log("[WhatsApp] Chat updated:", payload.new);
          updateChatInState(payload.new);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "whatsapp_chats" },
        (payload) => {
          console.log("[WhatsApp] Chat deleted:", payload.old);
          removeChatFromState((payload.old as any).id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [updateChatInState, removeChatFromState]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedChat) return;

    const channel = supabase
      .channel(`whatsapp-messages-${selectedChat.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `chat_id=eq.${selectedChat.id}` },
        (payload) => {
          const msg = payload.new as any;
          console.log("[WhatsApp] Realtime message received:", msg.id);
          
          setMessages(prev => {
            // Skip if already exists by id, message_id, or same text+from_me combo
            const isDuplicate = prev.some(m => 
              m.id === msg.id || 
              m.id === msg.message_id ||
              (msg.from_me && m.sent && m.text === msg.text && m.status === "SENT")
            );
            if (isDuplicate) return prev;
            return [...prev, {
              id: msg.id,
              text: msg.text || "",
              time: msg.created_at ? new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "",
              sent: msg.from_me || false,
              read: msg.status === "READ",
              status: msg.status,
              mediaUrl: msg.media_url,
              mediaType: msg.media_type,
              created_at: msg.created_at,
            }];
          });
          
          // Auto-scroll to bottom when new message arrives
          requestAnimationFrame(() => {
            scrollToBottom("auto");
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat?.id, scrollToBottom]);

  // Fetch messages when chat selected
  useEffect(() => {
    if (selectedChat) {
      shouldScrollToBottomOnOpenRef.current = true;
      lastFetchedChatIdRef.current = null;
      setMessages([]);
      fetchMessages(selectedChat.id);
    }
  }, [selectedChat?.id]);

  // Always open a chat at the latest message - retry loop until scroll succeeds
  useEffect(() => {
    if (!selectedChat || isLoadingMessages || messages.length === 0) return;
    
    let attempts = 0;
    const maxAttempts = 30; // 30 * 50ms = 1.5s max
    
    const intervalId = setInterval(() => {
      const el = messagesContainerRef.current;
      attempts++;
      
      if (!el) {
        if (attempts >= maxAttempts) clearInterval(intervalId);
        return;
      }
      
      // Force scroll to bottom
      el.scrollTop = el.scrollHeight;
      
      // Check if content exists and we're at bottom
      const hasScrollableContent = el.scrollHeight > el.clientHeight;
      const isAtBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 10;
      
      // Stop if: at bottom with content, OR no scrollable content but has height, OR max attempts
      if ((hasScrollableContent && isAtBottom) || (!hasScrollableContent && el.scrollHeight > 0) || attempts >= maxAttempts) {
        clearInterval(intervalId);
        shouldScrollToBottomOnOpenRef.current = false;
      }
    }, 50);
    
    return () => clearInterval(intervalId);
  }, [selectedChat?.id, isLoadingMessages, messages.length]);

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

  // Hide empty records (no text and no media)
  const visibleMessages = messages.filter(
    (m) => Boolean(m.text?.trim()) || Boolean(m.mediaUrl)
  );

  // Format WhatsApp-style text (*bold*, _italic_, ~strikethrough~, ```monospace```, *_bold italic_*)
  const formatWhatsAppText = (text: string) => {
    if (!text) return null;
    
    // Combined regex - bold+italic first (non-greedy), then individual patterns
    const regex = /(\*_.+?_\*)|(_\*.+?\*_)|(\*[^*]+\*)|(_[^_]+_)|(~[^~]+~)|(```[^`]+```)/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;
    let keyIndex = 0;
    
    while ((match = regex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      const matchedText = match[0];
      
      // Bold + Italic (*_text_* or _*text*_)
      if ((matchedText.startsWith('*_') && matchedText.endsWith('_*')) ||
          (matchedText.startsWith('_*') && matchedText.endsWith('*_'))) {
        parts.push(<strong key={keyIndex++}><em>{matchedText.slice(2, -2)}</em></strong>);
      } else if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
        parts.push(<strong key={keyIndex++}>{matchedText.slice(1, -1)}</strong>);
      } else if (matchedText.startsWith('_') && matchedText.endsWith('_')) {
        parts.push(<em key={keyIndex++}>{matchedText.slice(1, -1)}</em>);
      } else if (matchedText.startsWith('~') && matchedText.endsWith('~')) {
        parts.push(<s key={keyIndex++}>{matchedText.slice(1, -1)}</s>);
      } else if (matchedText.startsWith('```') && matchedText.endsWith('```')) {
        parts.push(<code key={keyIndex++} className="bg-muted/50 px-1 rounded text-xs font-mono">{matchedText.slice(3, -3)}</code>);
      }
      
      lastIndex = match.index + matchedText.length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  const renderMessageContent = (msg: Message) => {
    if (msg.mediaType === "image" && msg.mediaUrl) {
      return (
        <div className="space-y-1">
          <img 
            src={msg.mediaUrl} 
            alt="Imagem" 
            className="max-w-[280px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            loading="lazy"
            onLoad={() => scrollToBottom("auto")}
            onClick={() => window.open(msg.mediaUrl!, "_blank")}
          />
          {msg.text && <p className="text-sm text-foreground whitespace-pre-wrap">{formatWhatsAppText(msg.text)}</p>}
        </div>
      );
    }
    
    if (msg.mediaType === "audio" && msg.mediaUrl) {
      return (
        <div className="min-w-[220px] max-w-[300px]">
          <AudioWaveform src={msg.mediaUrl} sent={msg.sent} />
          {msg.text && <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{formatWhatsAppText(msg.text)}</p>}
        </div>
      );
    }

    // Sticker rendering
    if ((msg.mediaType === "sticker" || msg.text?.includes("🎨 Sticker")) && msg.mediaUrl) {
      return (
        <img 
          src={msg.mediaUrl} 
          alt="Sticker" 
          className="max-w-[150px] max-h-[150px]"
          loading="lazy"
          onLoad={() => scrollToBottom("auto")}
        />
      );
    }

    // Video rendering  
    if (msg.mediaType === "video" && msg.mediaUrl) {
      return (
        <div className="space-y-1">
          <video 
            src={msg.mediaUrl} 
            controls 
            className="max-w-[280px] rounded-lg"
            preload="metadata"
          />
          {msg.text && <p className="text-sm text-foreground whitespace-pre-wrap">{formatWhatsAppText(msg.text)}</p>}
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

    return <p className="text-sm text-foreground whitespace-pre-wrap">{formatWhatsAppText(msg.text)}</p>;
  };

  return (
    <>
      <div className="h-[calc(100vh-2rem)] flex rounded-2xl overflow-hidden border border-border/50 bg-card -mt-4">
        {/* Left Sidebar - Chat List */}
        <div className="w-[380px] flex flex-col border-r border-border/50 bg-card">
          {/* Header */}
          <div className="h-14 px-4 flex items-center justify-between bg-muted/30 border-b border-border/30">
            <h2 className="font-semibold text-foreground">Conversas</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={clearAndSync}
                disabled={isSyncing}
                className="p-1.5 hover:bg-muted/50 rounded-full transition-colors"
                title="Limpar e Sincronizar"
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={syncAllChats}
                disabled={isSyncing}
                className="p-1.5 hover:bg-muted/50 rounded-full transition-colors"
                title="Sincronizar"
              >
                <RefreshCw className={cn("w-4 h-4 text-muted-foreground", isSyncing && "animate-spin")} />
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

          {/* Chat List - Always visible, no loading spinner */}
          <div className="flex-1 overflow-y-auto">
            {isInitialLoad && chats.length === 0 ? (
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
                    <img 
                      src={chat.photo_url || DEFAULT_AVATAR} 
                      alt={chat.name} 
                      className="w-12 h-12 rounded-full object-cover bg-neutral-200" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground truncate">{chat.name}</span>
                      <span className={cn("text-xs flex-shrink-0", chat.unread > 0 ? "text-emerald-500" : "text-muted-foreground")}>
                        {chat.time}
                      </span>
                    </div>
                    {(chat.lastMessage?.trim() || chat.unread > 0) && (
                      <div className="flex items-center justify-between mt-0.5">
                        {chat.lastMessage?.trim() && (
                          <p className="text-sm text-muted-foreground truncate pr-2">{chat.lastMessage}</p>
                        )}
                        {chat.unread > 0 && (
                          <span className="min-w-[20px] h-5 rounded-full bg-emerald-500 text-white text-xs font-medium flex items-center justify-center px-1.5">
                            {chat.unread}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center h-full py-20 gap-3">
                <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
                <button
                  onClick={syncAllChats}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors flex items-center gap-2 text-sm"
                >
                  <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                  Sincronizar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Chat Area */}
        <div className="flex-1 flex">
          <div className="flex-1 flex flex-col bg-muted/10">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="h-14 px-4 flex items-center gap-3 bg-muted/30 border-b border-border/30">
                <div className="relative flex-shrink-0">
                  <img 
                    src={selectedChat.photo_url || DEFAULT_AVATAR} 
                    alt={selectedChat.name} 
                    className="w-10 h-10 rounded-full object-cover bg-neutral-200" 
                  />
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
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-1"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  backgroundColor: "hsl(var(--muted) / 0.15)",
                }}
              >
                {isLoadingMessages ? (
                  <div className="flex flex-col justify-end h-full gap-2 pb-2">
                    {/* Skeleton messages - alternating left/right to simulate chat */}
                    <div className="flex justify-start">
                      <div className="w-[45%] h-12 bg-card rounded-lg rounded-tl-none animate-pulse border border-border/30" />
                    </div>
                    <div className="flex justify-end">
                      <div className="w-[55%] h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg rounded-tr-none animate-pulse" />
                    </div>
                    <div className="flex justify-start">
                      <div className="w-[40%] h-10 bg-card rounded-lg rounded-tl-none animate-pulse border border-border/30" />
                    </div>
                    <div className="flex justify-end">
                      <div className="w-[50%] h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg rounded-tr-none animate-pulse" />
                    </div>
                    <div className="flex justify-start">
                      <div className="w-[60%] h-12 bg-card rounded-lg rounded-tl-none animate-pulse border border-border/30" />
                    </div>
                    <div className="flex justify-end">
                      <div className="w-[35%] h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg rounded-tr-none animate-pulse" />
                    </div>
                  </div>
                ) : visibleMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">Nenhuma mensagem</p>
                  </div>
                ) : (
                  (() => {
                    let lastDateKey = "";
                    return visibleMessages.map((msg, index) => {
                      const currentDateKey = msg.created_at ? getMessageDateKey(msg.created_at) : "";
                      const showDateSeparator = currentDateKey && currentDateKey !== lastDateKey;
                      if (currentDateKey) lastDateKey = currentDateKey;
                      
                      return (
                        <div key={msg.id}>
                          {showDateSeparator && msg.created_at && (
                            <div className="flex items-center justify-center my-4">
                              <div className="flex items-center gap-3 w-full max-w-[280px]">
                                <div className="flex-1 h-px bg-muted-foreground/20" />
                                <span className="text-xs text-muted-foreground bg-muted/40 px-3 py-1 rounded-full font-medium">
                                  {getDateLabel(msg.created_at)}
                                </span>
                                <div className="flex-1 h-px bg-muted-foreground/20" />
                              </div>
                            </div>
                          )}
                          <div className={cn("flex", msg.sent ? "justify-end" : "justify-start")}>
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
                        </div>
                      );
                    });
                  })()
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="px-4 py-3 flex items-center gap-2 bg-muted/30 border-t border-border/30">
                {isRecording ? (
                  // Recording UI
                  <>
                    <button 
                      onClick={cancelRecording}
                      className="p-2 hover:bg-muted/50 rounded-full transition-colors"
                    >
                      <X className="w-6 h-6 text-red-500" />
                    </button>
                    
                    <div className="flex-1 flex items-center gap-3 px-4">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium text-foreground min-w-[40px]">
                        {formatRecordingTime(recordingTime)}
                      </span>
                      <RecordingWaveform stream={recordingStream} isRecording={isRecording} />
                    </div>
                    
                    <button 
                      onClick={stopRecording}
                      disabled={isSending}
                      className="p-2 bg-emerald-500 hover:bg-emerald-600 rounded-full transition-colors disabled:opacity-50"
                    >
                      <Send className={cn("w-6 h-6 text-white", isSending && "animate-pulse")} />
                    </button>
                  </>
                ) : (
                  // Normal input UI
                  <>
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
                    
                    {message.trim() ? (
                      <button
                        onClick={sendMessage}
                        disabled={isSending}
                        className="p-2 hover:bg-muted/50 rounded-full transition-colors disabled:opacity-50"
                      >
                        <Send className={cn("w-6 h-6 text-emerald-500", isSending && "animate-pulse")} />
                      </button>
                    ) : (
                      <button
                        onClick={startRecording}
                        disabled={isSending}
                        className="p-2 hover:bg-muted/50 rounded-full transition-colors disabled:opacity-50"
                      >
                        <Mic className="w-6 h-6 text-muted-foreground" />
                      </button>
                    )}
                  </>
                )}
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

          {/* Lead Info Panel */}
          {selectedChat && showLeadPanel && (
            <LeadInfoPanel 
              phone={selectedChat.phone} 
              photoUrl={selectedChat.photo_url}
              contactName={selectedChat.name}
              onNameUpdate={(newName) => updateChatName(selectedChat.id, newName)}
            />
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
    </>
  );
};

export default WhatsApp;
