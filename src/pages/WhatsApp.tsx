import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { Search, Smile, Paperclip, Mic, Send, Check, CheckCheck, RefreshCw, Phone, Image, File, Trash2, PanelRightOpen, PanelRightClose, X, Video, MoreVertical, Pencil, Reply, Zap, ArrowUp, Plus, FileImage, FileVideo, Sticker, ShieldBan, ShieldCheck, Smartphone, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CallModal from "@/components/whatsapp/CallModal";
import LeadInfoPanel from "@/components/whatsapp/LeadInfoPanel";
import { EmojiPicker } from "@/components/whatsapp/EmojiPicker";
import { QuickMessages } from "@/components/whatsapp/QuickMessages";
import { AudioWaveform } from "@/components/whatsapp/AudioWaveform";
import { RecordingWaveform } from "@/components/whatsapp/RecordingWaveform";
import ImageLightbox from "@/components/whatsapp/ImageLightbox";
import { formatWhatsAppText, stripWhatsAppFormatting } from "@/lib/whatsapp-format";
import { AddWhatsAppAccountDialog } from "@/components/whatsapp/AddWhatsAppAccountDialog";

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
  lastMessageStatus: string | null;
  lastMessageFromMe: boolean;
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
  message_id?: string | number | null;
  quotedMessageId?: string | null;
  quotedText?: string | null;
  quotedFromMe?: boolean | null;
}

const DEFAULT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMTIgMjEyIj48cGF0aCBmaWxsPSIjREZFNUU3IiBkPSJNMCAwaDIxMnYyMTJIMHoiLz48cGF0aCBmaWxsPSIjRkZGIiBkPSJNMTA2IDEwNmMtMjUuNCAwLTQ2LTIwLjYtNDYtNDZzMjAuNi00NiA0Ni00NiA0NiAyMC42IDQ2IDQ2LTIwLjYgNDYtNDYgNDZ6bTAgMTNjMzAuNiAwIDkyIDE1LjQgOTIgNDZ2MjNIMTR2LTIzYzAtMzAuNiA2MS40LTQ2IDkyLTQ2eiIvPjwvc3ZnPg==";

type WhatsAppMessageStatus = string | null | undefined;

const isViewedStatus = (status: WhatsAppMessageStatus) => status === "READ" || status === "PLAYED";

const isOutgoingStatus = (status: WhatsAppMessageStatus) =>
  status === "SENDING" || status === "SENT" || status === "DELIVERED" || isViewedStatus(status);

const getStatusRank = (status: WhatsAppMessageStatus) => {
  switch (status) {
    case "SENDING":
      return 0;
    case "SENT":
      return 1;
    case "DELIVERED":
      return 2;
    case "READ":
      return 3;
    case "PLAYED":
      return 4;
    case "DELETED":
      return 99;
    default:
      return -1;
  }
};

const mergeStatus = (current: WhatsAppMessageStatus, incoming: WhatsAppMessageStatus) => {
  if (!incoming) return current;
  if (!current) return incoming;
  return getStatusRank(incoming) >= getStatusRank(current) ? incoming : current;
};

const WhatsApp = () => {
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showLeadPanel, setShowLeadPanel] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [contactPresence, setContactPresence] = useState<{ phone: string; type: string; timestamp: number } | null>(null);
  const [blockedContacts, setBlockedContacts] = useState<Set<string>>(new Set());
  const [blockConfirmDialog, setBlockConfirmDialog] = useState<{ open: boolean; phone: string; chatId: string; name: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [showAddAccountDialog, setShowAddAccountDialog] = useState(false);
  const [whatsappAccounts, setWhatsappAccounts] = useState<Array<{ id: string; name: string; phone_number?: string; status: string; api_key?: string }>>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [accountToConnect, setAccountToConnect] = useState<{ id: string; name: string; phone_number?: string; status: string; api_key?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const shouldScrollToBottomOnOpenRef = useRef(false);
  const lastFetchedChatIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const attachButtonRef = useRef<HTMLButtonElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const quickMsgButtonRef = useRef<HTMLButtonElement>(null);
  const quickMsgPickerRef = useRef<HTMLDivElement>(null);
  const toolbarButtonRef = useRef<HTMLButtonElement>(null);
  const toolbarMenuRef = useRef<HTMLDivElement>(null);

  // Prevent chat list scroll from jumping when realtime updates reorder items
  const chatListInteractingRef = useRef(false);
  const chatListIdleTimeoutRef = useRef<number | null>(null);
  const pendingChatUpdatesRef = useRef<Map<string, any>>(new Map());

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

  // Close menus on outside click (avoid fullscreen overlays that can block image clicks)
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const targetNode = e.target as Node | null;
      if (!targetNode) return;

      const targetEl = targetNode instanceof Element ? targetNode : null;

      if (showEmojiPicker) {
        const insideEmoji =
          (emojiPickerRef.current && emojiPickerRef.current.contains(targetNode)) ||
          (emojiButtonRef.current && emojiButtonRef.current.contains(targetNode));
        if (!insideEmoji) setShowEmojiPicker(false);
      }

      if (showAttachMenu) {
        const insideAttach =
          (attachMenuRef.current && attachMenuRef.current.contains(targetNode)) ||
          (attachButtonRef.current && attachButtonRef.current.contains(targetNode));
        if (!insideAttach) setShowAttachMenu(false);
      }

      if (showQuickMessages) {
        const insideQuickMsg =
          (quickMsgPickerRef.current && quickMsgPickerRef.current.contains(targetNode)) ||
          (quickMsgButtonRef.current && quickMsgButtonRef.current.contains(targetNode));
        if (!insideQuickMsg) setShowQuickMessages(false);
      }

      if (showToolbar) {
        const insideToolbar =
          (toolbarMenuRef.current && toolbarMenuRef.current.contains(targetNode)) ||
          (toolbarButtonRef.current && toolbarButtonRef.current.contains(targetNode));
        if (!insideToolbar) setShowToolbar(false);
      }

      if (messageMenuId) {
        const insideMessageMenu = !!targetEl?.closest("[data-message-menu], [data-message-menu-trigger]");
        if (!insideMessageMenu) setMessageMenuId(null);
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [showAttachMenu, showEmojiPicker, showQuickMessages, showToolbar, messageMenuId]);

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

  // Scroll to a quoted message by message_id
  const scrollToQuotedMessage = (quotedMessageId: string) => {
    const messageElement = document.querySelector(`[data-message-id="${quotedMessageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      // Add highlight effect
      messageElement.classList.add("ring-2", "ring-primary", "ring-offset-2");
      setTimeout(() => {
        messageElement.classList.remove("ring-2", "ring-primary", "ring-offset-2");
      }, 2000);
    }
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
      lastMessageStatus: chat.last_message_status || null,
      lastMessageFromMe: chat.last_message_from_me || false,
    };
  }, []);

  // Fetch WhatsApp accounts from WaSender
  const fetchWhatsAppAccounts = useCallback(async (): Promise<any[]> => {
    setIsLoadingAccounts(true);
    try {
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "list-sessions" },
      });

      if (error) throw error;

      if (data?.success && Array.isArray(data.data)) {
        console.log(`[WhatsApp] Fetched ${data.data.length} accounts:`, data.data.map((a: any) => ({ id: a.id, api_key: a.api_key?.substring(0, 10) + "...", name: a.name, status: a.status })));
        setWhatsappAccounts(data.data);
        // Auto-select first connected account if none selected
        if (!selectedAccountId && data.data.length > 0) {
          const connectedAccount = data.data.find((acc: any) => acc.status?.toLowerCase() === "connected");
          if (connectedAccount) {
            console.log(`[WhatsApp] Auto-selecting account: ${connectedAccount.id}`);
            setSelectedAccountId(connectedAccount.id);
          }
        }
        return data.data;
      }
      return [];
    } catch (error: any) {
      console.error("Error fetching WhatsApp accounts:", error);
      return [];
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [selectedAccountId]);

  // Initial load - fetch chats once, optionally filtered by selected account's api_key
  const fetchChats = useCallback(async (showLoading = false) => {
    if (showLoading) setIsInitialLoad(true);
    
    try {
      // Get the selected account info for filtering
      const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
      // WaSender webhook sends sessionId which is the session's api_key
      const sessionApiKey = selectedAccount?.api_key;
      
      console.log(`[WhatsApp] fetchChats - selectedAccountId: ${selectedAccountId}, api_key: ${sessionApiKey || "none"}`);
      
      let query = supabase
        .from("whatsapp_chats")
        .select("*")
        .order("last_message_time", { ascending: false });
      
      // Filter by session_id if we have a selected account
      // The session_id in DB should match the api_key from WaSender sessions
      if (sessionApiKey) {
        // Include chats that match this session OR have no session_id (legacy/migrated chats)
        query = query.or(`session_id.eq.${sessionApiKey},session_id.is.null`);
        console.log(`[WhatsApp] Filtering by session_id = ${sessionApiKey} OR null`);
      } else {
        console.log(`[WhatsApp] No api_key found, fetching all chats`);
      }
      
      const { data, error } = await query;

      if (error) throw error;
      
      console.log(`[WhatsApp] fetchChats - got ${data?.length || 0} chats`);

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
  }, [formatChatData, selectedAccountId, whatsappAccounts]);

  const flushPendingChatUpdates = useCallback(() => {
    const pending = Array.from(pendingChatUpdatesRef.current.values());
    if (pending.length === 0) return;

    pendingChatUpdatesRef.current.clear();

    const formattedUpdates = pending
      .map(formatChatData)
      .filter((chat): chat is Chat => chat !== null);

    if (formattedUpdates.length === 0) return;

    setChats((prev) => {
      const byId = new Map(prev.map((c) => [c.id, c] as const));
      for (const updated of formattedUpdates) {
        byId.set(updated.id, updated);
      }

      const next = Array.from(byId.values());
      next.sort((a, b) => {
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
      });

      chatsRef.current = next;
      return next;
    });

    setSelectedChat((prev) => {
      if (!prev) return prev;
      const updated = formattedUpdates.find((c) => c.id === prev.id);
      return updated ?? prev;
    });
  }, [formatChatData]);

  const markChatListInteracting = useCallback(() => {
    chatListInteractingRef.current = true;

    if (chatListIdleTimeoutRef.current) {
      window.clearTimeout(chatListIdleTimeoutRef.current);
    }

    chatListIdleTimeoutRef.current = window.setTimeout(() => {
      chatListInteractingRef.current = false;
      flushPendingChatUpdates();
    }, 250);
  }, [flushPendingChatUpdates]);

  useEffect(() => {
    return () => {
      if (chatListIdleTimeoutRef.current) window.clearTimeout(chatListIdleTimeoutRef.current);
    };
  }, []);

  // Update single chat in state without refetching all
  const updateChatInState = useCallback((updatedChat: any) => {
    // While the user is scrolling the chat list, defer reorder updates to avoid "jumping".
    if (chatListInteractingRef.current) {
      pendingChatUpdatesRef.current.set(updatedChat?.id ?? `${Date.now()}`, updatedChat);
      return;
    }

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
  }, [formatChatData, flushPendingChatUpdates]);

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
        sent: Boolean(msg.from_me) || isOutgoingStatus(msg.status),
        read: isViewedStatus(msg.status),
        status: msg.status,
        mediaUrl: msg.media_url,
        mediaType: msg.media_type,
        created_at: msg.created_at,
        message_id: msg.message_id,
        quotedMessageId: msg.quoted_message_id,
        quotedText: msg.quoted_text,
        quotedFromMe: msg.quoted_from_me,
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

  // Delete all messages from a chat
  const handleDeleteChatMessages = async (chatId: string) => {
    try {
      const { error } = await supabase
        .from("whatsapp_messages")
        .delete()
        .eq("chat_id", chatId);

      if (error) throw error;

      // Update chat last message
      await supabase
        .from("whatsapp_chats")
        .update({ 
          last_message: null,
          last_message_time: null,
          last_message_status: null,
          last_message_from_me: false
        })
        .eq("id", chatId);

      // Update local state
      setChats(prev => prev.map(c => 
        c.id === chatId 
          ? { ...c, lastMessage: "", lastMessageTime: null, lastMessageStatus: null, lastMessageFromMe: false }
          : c
      ));

      // Clear messages if it's the selected chat
      if (selectedChat?.id === chatId) {
        setMessages([]);
      }

      toast({ title: "Mensagens apagadas com sucesso" });
    } catch (error: any) {
      console.error("Error deleting messages:", error);
      toast({ title: "Erro ao apagar mensagens", variant: "destructive" });
    }
  };

  // Delete a chat and all its messages
  const handleDeleteChat = async (chatId: string) => {
    try {
      // First delete all messages
      await supabase
        .from("whatsapp_messages")
        .delete()
        .eq("chat_id", chatId);

      // Then delete the chat
      const { error } = await supabase
        .from("whatsapp_chats")
        .delete()
        .eq("id", chatId);

      if (error) throw error;

      // Update local state
      setChats(prev => {
        const updated = prev.filter(c => c.id !== chatId);
        chatsRef.current = updated;
        return updated;
      });

      // Clear selection if it was the selected chat
      if (selectedChat?.id === chatId) {
        setSelectedChat(null);
        setMessages([]);
      }

      toast({ title: "Contato apagado com sucesso" });
    } catch (error: any) {
      console.error("Error deleting chat:", error);
      toast({ title: "Erro ao apagar contato", variant: "destructive" });
    }
  };

  // Block a contact
  const handleBlockContact = async (phone: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "block-contact", phone },
      });

      if (error) throw error;

      setBlockedContacts(prev => new Set([...prev, phone]));
      toast({ title: "Contato bloqueado com sucesso" });
    } catch (error: any) {
      console.error("Error blocking contact:", error);
      toast({ title: "Erro ao bloquear contato", variant: "destructive" });
    }
  };

  // Unblock a contact
  const handleUnblockContact = async (phone: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "unblock-contact", phone },
      });

      if (error) throw error;

      setBlockedContacts(prev => {
        const newSet = new Set(prev);
        newSet.delete(phone);
        return newSet;
      });
      toast({ title: "Contato desbloqueado com sucesso" });
    } catch (error: any) {
      console.error("Error unblocking contact:", error);
      toast({ title: "Erro ao desbloquear contato", variant: "destructive" });
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedChat || isSending) return;

    const messageText = message.trim();
    const quotedMsg = replyToMessage;
    setMessage("");
    setReplyToMessage(null);
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
      quotedMessageId: quotedMsg?.message_id?.toString() || null,
      quotedText: quotedMsg?.text || null,
      quotedFromMe: quotedMsg?.sent || null,
    };
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom("auto");

    try {
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: {
          action: "send-text",
          phone: selectedChat.phone,
          text: messageText,
          quotedMsgId: quotedMsg?.message_id?.toString(),
        },
      });

      if (error) throw error;

      const messageId = data?.messageId || `local-${Date.now()}`;
      const whatsappKeyId = data?.whatsappKeyId || null;

      const { data: insertedMsg } = await supabase
        .from("whatsapp_messages")
        .insert({
          chat_id: selectedChat.id,
          message_id: messageId,
          whatsapp_key_id: whatsappKeyId,
          phone: selectedChat.phone,
          text: messageText,
          from_me: true,
          status: "SENT",
          quoted_message_id: quotedMsg?.message_id?.toString() || null,
          quoted_text: quotedMsg?.text || null,
          quoted_from_me: quotedMsg?.sent || null,
        })
        .select()
        .single();

      const newTimestamp = new Date().toISOString();
      
      await supabase
        .from("whatsapp_chats")
        .update({
          last_message: messageText,
          last_message_time: newTimestamp,
          last_message_status: "SENT",
          last_message_from_me: true,
        })
        .eq("id", selectedChat.id);

      // Immediately update local chat state to move to top
      setChats(prev => {
        const updatedChats = prev.map(c => 
          c.id === selectedChat.id 
            ? { ...c, lastMessage: messageText, lastMessageTime: newTimestamp, lastMessageStatus: "SENT", lastMessageFromMe: true }
            : c
        );
        // Sort by last message time (most recent first)
        updatedChats.sort((a, b) => {
          const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
          const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
          return timeB - timeA;
        });
        chatsRef.current = updatedChats;
        return updatedChats;
      });

      // Replace temp message with real one (prevent realtime duplicate)
      if (insertedMsg) {
        setMessages(prev => prev.map(m => m.id === tempId ? { 
          ...m, 
          id: insertedMsg.id, 
          message_id: messageId, // Store for deletion
          status: "SENT" 
        } : m));
      }
      
      // Auto-fetch profile picture if not already present
      if (selectedChat && !selectedChat.photo_url && !isWhatsAppInternalId(selectedChat.phone)) {
        fetchContactInfo(selectedChat);
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

  // Fetch contact info (photo + name) for a chat
  const fetchContactInfo = useCallback(async (chat: Chat) => {
    if (!chat || (chat.photo_url && chat.name)) return;
    
    try {
      console.log("[WhatsApp] Fetching contact info for:", chat.phone);
      
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: {
          action: "get-profile-picture",
          phone: chat.phone,
        },
      });

      if (error) {
        console.error("[WhatsApp] Error fetching contact info:", error);
        return;
      }

      const hasUpdates = data?.photoUrl || data?.name;
      if (hasUpdates) {
        console.log("[WhatsApp] Got contact info for:", chat.phone, "name:", data?.name, "photo:", data?.photoUrl ? "Yes" : "No");
        
        // Update local state with both photo and name
        setChats(prev => {
          const newChats = prev.map(c => {
            if (c.id === chat.id) {
              const updates: Partial<Chat> = {};
              if (data.photoUrl) {
                updates.photo_url = data.photoUrl;
                updates.avatar = data.photoUrl;
              }
              if (data.name && !c.name) {
                updates.name = data.name;
              }
              return { ...c, ...updates };
            }
            return c;
          });
          chatsRef.current = newChats;
          return newChats;
        });

        // Update selectedChat if it's the one being updated
        setSelectedChat(prev => {
          if (prev?.id === chat.id) {
            const updates: Partial<Chat> = {};
            if (data.photoUrl) {
              updates.photo_url = data.photoUrl;
              updates.avatar = data.photoUrl;
            }
            if (data.name && !prev.name) {
              updates.name = data.name;
            }
            return { ...prev, ...updates };
          }
          return prev;
        });
      }
    } catch (error) {
      console.error("[WhatsApp] Error fetching contact info:", error);
    }
  }, []);

  // Auto-fetch contact info when chat is selected and doesn't have photo
  useEffect(() => {
    if (selectedChat && !selectedChat.photo_url && !isWhatsAppInternalId(selectedChat.phone)) {
      fetchContactInfo(selectedChat);
    }
  }, [selectedChat?.id, fetchContactInfo]);

  // Send presence update (typing/recording indicator)
  const lastPresenceRef = useRef<{ phone: string; type: string; time: number } | null>(null);
  
  const sendPresenceUpdate = useCallback(async (presenceType: "composing" | "recording") => {
    if (!selectedChat) return;
    
    // Debounce: don't send if same presence was sent in last 3 seconds
    const now = Date.now();
    if (lastPresenceRef.current && 
        lastPresenceRef.current.phone === selectedChat.phone &&
        lastPresenceRef.current.type === presenceType &&
        now - lastPresenceRef.current.time < 3000) {
      return;
    }
    
    lastPresenceRef.current = { phone: selectedChat.phone, type: presenceType, time: now };
    
    try {
      await supabase.functions.invoke("wasender-whatsapp", {
        body: {
          action: "send-presence",
          phone: selectedChat.phone,
          presenceType,
          delayMs: 3000,
        },
      });
    } catch (error) {
      // Silent fail - presence is not critical
      console.log("[WhatsApp] Presence update failed:", error);
    }
  }, [selectedChat]);

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

  const syncAllChats = useCallback(async () => {
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
  }, []);

  const clearAndSync = async () => {
    await clearAllData();
    await syncAllChats();
  };

  const handleFileUpload = async (file: File, type: "image" | "file" | "video") => {
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
      const action = type === "image" ? "send-image" : type === "video" ? "send-video" : "send-file";

      // Add temp message to UI
      const tempId = `temp-${Date.now()}`;
      const tempMsg: Message = {
        id: tempId,
        text: type === "image" ? "" : type === "video" ? "" : file.name,
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

      // Insert into database with both message IDs
      const { data: insertedMsg } = await supabase.from("whatsapp_messages").insert({
        chat_id: selectedChat.id,
        phone: selectedChat.phone,
        text: type === "image" ? "" : type === "video" ? "" : file.name,
        from_me: true,
        status: "SENT",
        media_url: publicUrl,
        media_type: type,
        message_id: data?.messageId,
        whatsapp_key_id: data?.whatsappKeyId || null,
        created_at: new Date().toISOString(),
      }).select().single();

      if (insertedMsg) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: insertedMsg.id, status: "SENT" } : m));
      }

      // Update chat last message
      const newTimestamp = new Date().toISOString();
      const lastMsgText = type === "image" ? "📷 Imagem" : type === "video" ? "🎥 Vídeo" : `📄 ${file.name}`;
      
      await supabase.from("whatsapp_chats").update({
        last_message: lastMsgText,
        last_message_time: newTimestamp,
        last_message_status: "SENT",
        last_message_from_me: true,
      }).eq("id", selectedChat.id);

      // Immediately update local chat state to move to top
      setChats(prev => {
        const updatedChats = prev.map(c => 
          c.id === selectedChat.id 
            ? { ...c, lastMessage: lastMsgText, lastMessageTime: newTimestamp, lastMessageStatus: "SENT", lastMessageFromMe: true }
            : c
        );
        updatedChats.sort((a, b) => {
          const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
          const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
          return timeB - timeA;
        });
        chatsRef.current = updatedChats;
        return updatedChats;
      });

      toast({ title: type === "image" ? "Imagem enviada" : type === "video" ? "Vídeo enviado" : "Arquivo enviado" });

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
      
      // Determine best supported recording format.
      // NOTE: Wasender/WhatsApp expects AAC/MP3/OGG/AMR.
      // Browsers often record as WebM/MP4, so we'll transcode to MP3 when needed.
      let mimeType = "";

      // Best-case: OGG Opus (Firefox)
      if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        mimeType = "audio/ogg;codecs=opus";
      }
      // Common-case: WebM Opus (Chrome/Edge) -> we will transcode to MP3
      else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      }
      // Safari: MP4/AAC -> we will transcode to MP3
      else if (MediaRecorder.isTypeSupported("audio/mp4;codecs=mp4a.40.2")) {
        mimeType = "audio/mp4;codecs=mp4a.40.2";
      }

      if (!mimeType) {
        toast({
          title: "Navegador incompatível",
          description: "Seu navegador não suporta gravação de áudio.",
          variant: "destructive",
        });
        stream.getTracks().forEach((t) => t.stop());
        return;
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
      
      // Send "recording" presence immediately
      sendPresenceUpdate("recording");

      // Start timer and keep sending recording presence every 3 seconds
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
        // Send recording presence every 3 seconds to keep indicator active
        sendPresenceUpdate("recording");
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

  const floatTo16BitPCM = (input: Float32Array): Int16Array => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    }
    return output;
  };

  const transcodeToMp3 = async (inputBlob: Blob): Promise<Blob> => {
    if (!(window as any).lamejs?.Mp3Encoder) throw new Error("MP3 encoder não carregou");

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) throw new Error("AudioContext not supported");

    const ctx = new AudioContextClass();
    try {
      const arrayBuffer = await inputBlob.arrayBuffer();
      const audioBuffer: AudioBuffer = await new Promise((resolve, reject) => {
        // decodeAudioData has both Promise and callback variants depending on browser
        const p = (ctx as any).decodeAudioData(arrayBuffer, resolve, reject);
        if (p?.then) p.then(resolve).catch(reject);
      });

      const sampleRate = audioBuffer.sampleRate;
      const length = audioBuffer.length;

      // Mix down to mono for consistent WhatsApp voice-note behavior
      const ch0 = audioBuffer.getChannelData(0);
      let mono: Float32Array;
      if (audioBuffer.numberOfChannels > 1) {
        const ch1 = audioBuffer.getChannelData(1);
        mono = new Float32Array(length);
        for (let i = 0; i < length; i++) mono[i] = (ch0[i] + ch1[i]) / 2;
      } else {
        mono = ch0;
      }

      const encoder = new (window as any).lamejs.Mp3Encoder(1, sampleRate, 128);
      const mp3Chunks: Uint8Array[] = [];
      const blockSize = 1152;

      for (let i = 0; i < mono.length; i += blockSize) {
        const slice = mono.subarray(i, i + blockSize);
        const mp3buf = encoder.encodeBuffer(floatTo16BitPCM(slice)) as any;
        if (mp3buf && mp3buf.length) mp3Chunks.push(new Uint8Array(mp3buf));
      }

      const end = encoder.flush() as any;
      if (end && end.length) mp3Chunks.push(new Uint8Array(end));

      const parts = mp3Chunks as unknown as BlobPart[];
      return new Blob(parts, { type: "audio/mpeg" });
    } finally {
      try {
        await (ctx as any).close?.();
      } catch {
        // ignore
      }
    }
  };

  const sendAudioMessage = async (audioBlob: Blob, mimeType: string = 'audio/webm') => {
    if (!selectedChat) return;

    setIsSending(true);

    try {
      // Ensure a Wasender/WhatsApp-compatible format.
      // - OGG Opus is OK when the browser truly records OGG.
      // - WebM/MP4 are common recordings; we transcode them to MP3 before upload.
      let finalBlob = audioBlob;
      let finalMimeType = mimeType;

      const needsMp3Transcode = /webm|mp4/.test(mimeType);
      if (needsMp3Transcode) {
        console.log("[WhatsApp] Transcoding audio to MP3 for compatibility...", { mimeType });
        finalBlob = await transcodeToMp3(audioBlob);
        finalMimeType = "audio/mpeg";
      } else if (mimeType.includes("ogg")) {
        // Normalize to a standard content-type
        finalMimeType = "audio/ogg";
      }

      // Determine extension + upload content-type
      let ext = "ogg";
      if (finalMimeType.includes("mpeg")) ext = "mp3";
      else if (finalMimeType.includes("ogg")) ext = "ogg";
      else if (finalMimeType.includes("mp4") || finalMimeType.includes("aac")) ext = "m4a";

      const uploadContentType =
        ext === "mp3" ? "audio/mpeg" : ext === "ogg" ? "audio/ogg" : "audio/mp4";

      // Generate filename
      const timestamp = Date.now();
      const filename = `${selectedChat.phone}_${timestamp}.${ext}`;
      const filePath = `audios/${filename}`;

      console.log("[WhatsApp] Uploading audio:", filename, "mimeType:", finalMimeType, "uploadAs:", uploadContentType);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, finalBlob, {
          contentType: uploadContentType,
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

      // Insert into database with both message IDs
      const { data: insertedMsg } = await supabase.from("whatsapp_messages").insert({
        chat_id: selectedChat.id,
        phone: selectedChat.phone,
        text: "",
        from_me: true,
        status: "SENT",
        media_url: publicUrl,
        media_type: "audio",
        message_id: data?.messageId,
        whatsapp_key_id: data?.whatsappKeyId || null,
        created_at: new Date().toISOString(),
      }).select().single();

      if (insertedMsg) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: insertedMsg.id, status: "SENT" } : m));
      }

      // Update chat last message
      const newTimestamp = new Date().toISOString();
      
      await supabase.from("whatsapp_chats").update({
        last_message: "🎵 Áudio",
        last_message_time: newTimestamp,
        last_message_status: "SENT",
        last_message_from_me: true,
      }).eq("id", selectedChat.id);

      // Immediately update local chat state to move to top
      setChats(prev => {
        const updatedChats = prev.map(c => 
          c.id === selectedChat.id 
            ? { ...c, lastMessage: "🎵 Áudio", lastMessageTime: newTimestamp, lastMessageStatus: "SENT", lastMessageFromMe: true }
            : c
        );
        updatedChats.sort((a, b) => {
          const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
          const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
          return timeB - timeA;
        });
        chatsRef.current = updatedChats;
        return updatedChats;
      });

      // Audio sent successfully - no toast needed

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

  // Delete message (for both sides via WasenderAPI)
  const deleteMessage = async (msg: Message) => {
    if (!msg.sent) {
      toast({ title: "Só é possível apagar mensagens enviadas", variant: "destructive" });
      return;
    }
    
    setMessageMenuId(null);
    
    // Get the Wasender message ID (numeric ID returned from send-message)
    const messageId = msg.message_id;
    console.log("[WhatsApp] Delete message clicked, msg:", { id: msg.id, message_id: messageId, text: msg.text?.substring(0, 30) });
    
    // Only call Wasender API if we have a valid numeric message ID
    if (!messageId) {
      console.log("[WhatsApp] No message_id, only local delete");
      toast({ title: "Mensagem sem ID, apagando apenas localmente", variant: "destructive" });
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "DELETED" } : m));
      await supabase.from("whatsapp_messages").update({ status: "DELETED" }).eq("id", msg.id);
      return;
    }
    
    if (String(messageId).startsWith("local-")) {
      console.log("[WhatsApp] Local message ID, only local delete");
      toast({ title: "Mensagem local, apagando apenas localmente" });
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "DELETED" } : m));
      await supabase.from("whatsapp_messages").update({ status: "DELETED" }).eq("id", msg.id);
      return;
    }
    
    // Parse to integer as required by WasenderAPI
    const numericMsgId = parseInt(String(messageId), 10);
    
    if (isNaN(numericMsgId)) {
      console.log("[WhatsApp] message_id is not a valid integer:", messageId);
      toast({ title: "ID inválido, apagando apenas localmente", variant: "destructive" });
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "DELETED" } : m));
      await supabase.from("whatsapp_messages").update({ status: "DELETED" }).eq("id", msg.id);
      return;
    }
    
    try {
      console.log("[WhatsApp] Deleting message via WasenderAPI, msgId:", numericMsgId);
      
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "delete-message", msgId: numericMsgId },
      });
      
      console.log("[WhatsApp] Delete API response:", { data, error });
      
      if (error) {
        console.error("[WhatsApp] Wasender delete error:", error);
        throw new Error(error.message || "Erro ao apagar na API");
      }
      
      if (data?.error) {
        console.error("[WhatsApp] Wasender API returned error:", data.error);
        throw new Error(data.error);
      }
      
      // Success - mark as deleted in local state
      setMessages(prev => prev.map(m => 
        m.id === msg.id ? { ...m, status: "DELETED" } : m
      ));
      
      // Update status to DELETED in database
      await supabase.from("whatsapp_messages").update({ status: "DELETED" }).eq("id", msg.id);
      
      toast({ title: "Mensagem apagada para todos" });
    } catch (error: any) {
      console.error("[WhatsApp] Error deleting message:", error);
      
      // Still mark as deleted locally even if API fails
      setMessages(prev => prev.map(m => 
        m.id === msg.id ? { ...m, status: "DELETED" } : m
      ));
      await supabase.from("whatsapp_messages").update({ status: "DELETED" }).eq("id", msg.id);
      
      const errorMsg = error?.message || "Erro desconhecido";
      if (errorMsg.includes("422") || errorMsg.includes("time") || errorMsg.includes("expired")) {
        toast({ title: "Tempo expirado", description: "O WhatsApp só permite apagar mensagens recentes", variant: "destructive" });
      } else {
        toast({ title: "Erro ao apagar para todos", description: errorMsg, variant: "destructive" });
      }
    }
  };

  // Edit message via WasenderAPI
  const editMessage = async () => {
    if (!editingMessage || !editText.trim()) {
      setEditingMessage(null);
      setEditText("");
      return;
    }
    
    const messageId = editingMessage.message_id;
    console.log("[WhatsApp] Edit message:", { id: editingMessage.id, message_id: messageId, newText: editText.substring(0, 30) });
    
    if (!messageId || String(messageId).startsWith("local-")) {
      toast({ title: "Mensagem sem ID válido para editar", variant: "destructive" });
      setEditingMessage(null);
      setEditText("");
      return;
    }
    
    const numericMsgId = parseInt(String(messageId), 10);
    
    if (isNaN(numericMsgId)) {
      toast({ title: "ID inválido para editar", variant: "destructive" });
      setEditingMessage(null);
      setEditText("");
      return;
    }
    
    try {
      console.log("[WhatsApp] Editing message via WasenderAPI, msgId:", numericMsgId);
      
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "edit-message", msgId: numericMsgId, newText: editText.trim() },
      });
      
      console.log("[WhatsApp] Edit API response:", { data, error });
      
      if (error) {
        throw new Error(error.message || "Erro ao editar na API");
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      // Success - update local state
      setMessages(prev => prev.map(m => 
        m.id === editingMessage.id ? { ...m, text: editText.trim() } : m
      ));
      
      // Update in database
      await supabase.from("whatsapp_messages").update({ text: editText.trim() }).eq("id", editingMessage.id);
      
      toast({ title: "Mensagem editada" });
    } catch (error: any) {
      console.error("[WhatsApp] Error editing message:", error);
      
      const errorMsg = error?.message || "Erro desconhecido";
      if (errorMsg.includes("422") || errorMsg.includes("time") || errorMsg.includes("expired")) {
        toast({ title: "Tempo expirado", description: "O WhatsApp só permite editar mensagens recentes", variant: "destructive" });
      } else {
        toast({ title: "Erro ao editar", description: errorMsg, variant: "destructive" });
      }
    } finally {
      setEditingMessage(null);
      setEditText("");
    }
  };

  // Fetch missing profile photos in background
  const fetchMissingPhotos = useCallback(async () => {
    try {
      console.log("[WhatsApp] Fetching missing profile photos...");
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "fetch-missing-photos" },
      });
      
      if (error) {
        console.error("[WhatsApp] Error fetching photos:", error);
        return;
      }
      
      console.log("[WhatsApp] Photo fetch result:", data);
      
      // If we updated any photos, refresh the chats list
      if (data?.updated > 0) {
        await fetchChats(false);
      }
    } catch (error) {
      console.error("[WhatsApp] Error fetching missing photos:", error);
    }
  }, [fetchChats]);

  // Initial load and cleanup (run once)
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

      // Fetch WhatsApp accounts FIRST and wait for state to update
      const accounts = await fetchWhatsAppAccounts();
      console.log(`[WhatsApp] Init - accounts loaded: ${accounts.length}`);
      
      // Give React time to update state, then fetch chats
      // The useEffect for selectedAccountId change will handle fetching chats
      // after the account is selected
      
      // If no accounts, fetch chats immediately (legacy mode)
      if (accounts.length === 0) {
        console.log(`[WhatsApp] No accounts, fetching all chats`);
        await fetchChats(true);
      }

      // Background sync
      syncAllChats();

      // Fetch missing profile photos in background (after UI loads)
      setTimeout(() => {
        fetchMissingPhotos();
      }, 2000);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload chats when switching WhatsApp accounts (or on first account selection)
  const accountChangeCountRef = useRef(0);
  useEffect(() => {
    // Skip if no account selected yet (waiting for accounts to load)
    if (selectedAccountId === null) {
      console.log(`[WhatsApp] No account selected yet, skipping fetchChats`);
      return;
    }
    
    // Skip if whatsappAccounts is empty (still loading)
    if (whatsappAccounts.length === 0) {
      console.log(`[WhatsApp] Accounts not loaded yet, skipping fetchChats`);
      return;
    }
    
    accountChangeCountRef.current++;
    const isFirstLoad = accountChangeCountRef.current === 1;
    
    const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
    console.log(`[WhatsApp] Account ${isFirstLoad ? "selected" : "changed"} - id: ${selectedAccountId}, api_key: ${selectedAccount?.api_key?.substring(0, 15) || "none"}..., name: ${selectedAccount?.name || "unknown"}`);
    
    const reloadChatsForAccount = async () => {
      setIsInitialLoad(true);
      if (!isFirstLoad) {
        setSelectedChat(null);
        setMessages([]);
      }
      
      // Fetch chats for the selected account
      await fetchChats(true);
      
      // Sync and fetch photos in background (only on subsequent changes)
      if (!isFirstLoad) {
        syncAllChats();
        setTimeout(() => {
          fetchMissingPhotos();
        }, 1000);
      }
    };
    
    reloadChatsForAccount();
  }, [selectedAccountId, whatsappAccounts, fetchChats, syncAllChats, fetchMissingPhotos]);
  useEffect(() => {
    const phoneParam = searchParams.get("phone");
    if (!phoneParam || chats.length === 0 || selectedChat) return;

    const matchingChat = chats.find(c => c.phone === phoneParam || c.phone.includes(phoneParam) || phoneParam.includes(c.phone));
    if (matchingChat) {
      setSelectedChat(matchingChat);
      fetchMessages(matchingChat.id);
      shouldScrollToBottomOnOpenRef.current = true;
      // Clear the param after selecting
      setSearchParams({}, { replace: true });
    }
  }, [chats, searchParams, selectedChat, setSearchParams]);

  // Realtime subscription for chats - UPDATE INCREMENTALLY
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-chats-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_chats" },
        (payload) => {
          updateChatInState(payload.new);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_chats" },
        (payload) => {
          updateChatInState(payload.new);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "whatsapp_chats" },
        (payload) => {
          removeChatFromState((payload.old as any).id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [updateChatInState, removeChatFromState]);

  // Global realtime subscription for ALL messages - updates chat list sidebar
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-messages-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        async (payload) => {
          const msg = payload.new as any;
          
          // If this is for a different chat than selected, refresh that chat's data
          if (msg.chat_id && msg.chat_id !== selectedChat?.id) {
            const { data: updatedChat } = await supabase
              .from("whatsapp_chats")
              .select("*")
              .eq("id", msg.chat_id)
              .single();
            
            if (updatedChat) {
              updateChatInState(updatedChat);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat?.id, updateChatInState]);

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
              sent: Boolean(msg.from_me) || isOutgoingStatus(msg.status),
              read: isViewedStatus(msg.status),
              status: msg.status,
              mediaUrl: msg.media_url,
              mediaType: msg.media_type,
              created_at: msg.created_at,
              message_id: msg.message_id,
              quotedMessageId: msg.quoted_message_id,
              quotedText: msg.quoted_text,
              quotedFromMe: msg.quoted_from_me,
            }];
          });
          
          // Auto-scroll to bottom when new message arrives
          requestAnimationFrame(() => {
            scrollToBottom("auto");
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_messages", filter: `chat_id=eq.${selectedChat.id}` },
        (payload) => {
          const msg = payload.new as any;
          
          // Update message status and text (for DELETED, READ, edited messages, etc.)
          setMessages(prev => prev.map(m => {
            if (m.id !== msg.id) return m;

            const nextStatus = mergeStatus(m.status, msg.status);
            return {
              ...m,
              // Update text if it changed (for edited messages)
              text: msg.text !== undefined ? msg.text : m.text,
              // Preserve message_id from DB
              message_id: msg.message_id ?? m.message_id,
              status: nextStatus,
              read: isViewedStatus(nextStatus),
              sent: m.sent || isOutgoingStatus(nextStatus),
            };
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat?.id, scrollToBottom]);

  // Realtime subscription for contact presence (typing/recording indicators)
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-presence")
      .on("broadcast", { event: "presence" }, (payload) => {
        const { phone, presenceType, timestamp } = payload.payload as { phone: string; presenceType: string; timestamp: number };
        
        // Only show presence for the currently selected chat
        if (selectedChat && phone === selectedChat.phone.replace(/\D/g, "")) {
          if (presenceType === "composing" || presenceType === "recording") {
            setContactPresence({ phone, type: presenceType, timestamp });
          } else {
            // Clear presence when available/unavailable
            setContactPresence(null);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat?.phone]);

  // Auto-clear contact presence after 5 seconds of no updates
  useEffect(() => {
    if (!contactPresence) return;
    
    const timeout = setTimeout(() => {
      setContactPresence(null);
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [contactPresence?.timestamp]);

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
  // (Keep media messages visible even when text/mediaUrl is missing, so we can show a proper UI for them.)
  const visibleMessages = messages.filter(
    (m) => Boolean(m.mediaType) || Boolean(m.text?.trim()) || Boolean(m.mediaUrl)
  );

  // Format WhatsApp-style text (*bold*, _italic_, ~strikethrough~, ```monospace```, *_bold italic_*, _*bold italic*_)
  const formatWhatsAppText = (text: string): React.ReactNode => {
    if (!text) return null;
    
    // Simple string replacement approach for reliability
    const parts: React.ReactNode[] = [];
    let currentText = text;
    let keyCounter = 0;
    
    // Process the text character by character looking for patterns
    const processFormatting = (input: string): React.ReactNode[] => {
      const nodes: React.ReactNode[] = [];
      let i = 0;
      let buffer = '';
      
      while (i < input.length) {
        // Check for bold+italic: _*text*_ or *_text_*
        if (input.slice(i, i + 2) === '_*' || input.slice(i, i + 2) === '*_') {
          const startPattern = input.slice(i, i + 2);
          const endPattern = startPattern === '_*' ? '*_' : '_*';
          const endIdx = input.indexOf(endPattern, i + 2);
          
          if (endIdx > i + 2) {
            if (buffer) {
              nodes.push(buffer);
              buffer = '';
            }
            const content = input.slice(i + 2, endIdx);
            nodes.push(<strong key={keyCounter++}><em>{content}</em></strong>);
            i = endIdx + 2;
            continue;
          }
        }
        
        // Check for bold: *text*
        if (input[i] === '*') {
          const endIdx = input.indexOf('*', i + 1);
          if (endIdx > i + 1 && !input.slice(i + 1, endIdx).includes('\n')) {
            if (buffer) {
              nodes.push(buffer);
              buffer = '';
            }
            const content = input.slice(i + 1, endIdx);
            nodes.push(<strong key={keyCounter++}>{content}</strong>);
            i = endIdx + 1;
            continue;
          }
        }
        
        // Check for italic: _text_
        if (input[i] === '_') {
          const endIdx = input.indexOf('_', i + 1);
          if (endIdx > i + 1 && !input.slice(i + 1, endIdx).includes('\n')) {
            if (buffer) {
              nodes.push(buffer);
              buffer = '';
            }
            const content = input.slice(i + 1, endIdx);
            nodes.push(<em key={keyCounter++}>{content}</em>);
            i = endIdx + 1;
            continue;
          }
        }
        
        // Check for strikethrough: ~text~
        if (input[i] === '~') {
          const endIdx = input.indexOf('~', i + 1);
          if (endIdx > i + 1 && !input.slice(i + 1, endIdx).includes('\n')) {
            if (buffer) {
              nodes.push(buffer);
              buffer = '';
            }
            const content = input.slice(i + 1, endIdx);
            nodes.push(<s key={keyCounter++}>{content}</s>);
            i = endIdx + 1;
            continue;
          }
        }
        
        // Check for monospace: ```text```
        if (input.slice(i, i + 3) === '```') {
          const endIdx = input.indexOf('```', i + 3);
          if (endIdx > i + 3) {
            if (buffer) {
              nodes.push(buffer);
              buffer = '';
            }
            const content = input.slice(i + 3, endIdx);
            nodes.push(<code key={keyCounter++} className="bg-muted/50 px-1 rounded text-xs font-mono">{content}</code>);
            i = endIdx + 3;
            continue;
          }
        }
        
        buffer += input[i];
        i++;
      }
      
      if (buffer) {
        nodes.push(buffer);
      }
      
      return nodes;
    };
    
    return processFormatting(currentText);
  };

  // Get all images from messages for lightbox navigation
  const allImages = messages
    .filter(m => m.mediaType === "image" && m.mediaUrl)
    .map(m => m.mediaUrl!);

  const renderMessageContent = (msg: Message) => {
    // Show "mensagem apagada" for deleted messages
    if (msg.status === "DELETED") {
      return (
        <p className="text-sm text-muted-foreground italic">
          mensagem apagada
        </p>
      );
    }

    if (msg.mediaType === "image" && msg.mediaUrl) {
      return (
        <div className="space-y-1">
          <img 
            src={msg.mediaUrl} 
            alt="Imagem" 
            className="max-w-[280px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            loading="lazy"
            onLoad={() => scrollToBottom("auto")}
            onPointerDown={(e) => {
              // Use onPointerDown to capture before any overlay can intercept
              e.stopPropagation();
              
              // Close any open menus
              setShowAttachMenu(false);
              setMessageMenuId(null);
              setShowEmojiPicker(false);

              const index = allImages.indexOf(msg.mediaUrl!);
              console.log("[Lightbox] Opening image", { index, url: msg.mediaUrl, allImages });
              setLightboxIndex(index >= 0 ? index : 0);
            }}
          />
          {msg.text && <p className="text-sm text-foreground whitespace-pre-wrap">{formatWhatsAppText(msg.text)}</p>}
        </div>
      );
    }
    
    if (msg.mediaType === "audio") {
      return (
        <div className="min-w-[280px] max-w-[320px]">
          <AudioWaveform 
            src={msg.mediaUrl || ""} 
            sent={msg.sent}
            renderFooter={(audioDuration) => (
              <div className="flex items-center justify-between mt-1 px-1">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {audioDuration}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                  {msg.sent && msg.status !== "DELETED" && (
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
            )}
          />
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

    return <span className="text-sm text-foreground whitespace-pre-wrap">{formatWhatsAppText(msg.text)}</span>;
  };

  return (
    <>
      <div className="h-[calc(100vh-2rem)] flex rounded-2xl overflow-hidden border border-border/50 bg-card -mt-4 relative z-50">
        {/* Left Sidebar - Chat List */}
        <div className="w-[380px] flex flex-col border-r border-border/50 bg-card">
          {/* Header */}
          <div className="h-14 px-4 flex items-center justify-between bg-muted/30 border-b border-border/30">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 font-semibold text-foreground hover:bg-muted/50 px-2 py-1.5 rounded-md transition-colors">
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                  <span className="truncate max-w-[180px]">
                    {selectedAccountId 
                      ? whatsappAccounts.find(a => a.id === selectedAccountId)?.name || "Conta WhatsApp"
                      : "Selecionar conta"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {isLoadingAccounts ? (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : whatsappAccounts.length > 0 ? (
                  <>
                    {whatsappAccounts.map((account) => {
                      const isConnected = account.status?.toLowerCase() === "connected";
                      return (
                        <DropdownMenuItem
                          key={account.id}
                          className={cn(
                            "cursor-pointer flex items-center gap-2",
                            selectedAccountId === account.id && "bg-muted"
                          )}
                          onClick={() => {
                            if (isConnected) {
                              if (selectedAccountId !== account.id) {
                                // Clear current state and switch account
                                setSelectedChat(null);
                                setMessages([]);
                                setChats([]);
                                chatsRef.current = [];
                                setSelectedAccountId(account.id);
                              }
                            } else {
                              // Open dialog with QR code for not connected accounts
                              setAccountToConnect(account);
                              setShowAddAccountDialog(true);
                            }
                          }}
                        >
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            isConnected ? "bg-emerald-500" : "bg-amber-500"
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{account.name}</p>
                            {account.phone_number && (
                              <p className="text-xs text-muted-foreground truncate">{account.phone_number}</p>
                            )}
                          </div>
                          {isConnected && selectedAccountId === account.id && (
                            <Check className="w-4 h-4 text-emerald-500" />
                          )}
                          {!isConnected && (
                            <span className="text-xs text-amber-600">Conectar</span>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                    <DropdownMenuSeparator />
                  </>
                ) : (
                  <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                    Nenhuma conta conectada
                  </div>
                )}
                <DropdownMenuItem 
                  className="cursor-pointer"
                  onClick={() => {
                    setAccountToConnect(null);
                    setShowAddAccountDialog(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar conta WhatsApp
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          <ScrollArea
            className="flex-1 overscroll-contain overflow-x-hidden"
            onScrollCapture={markChatListInteracting}
            onWheelCapture={markChatListInteracting}
            onTouchMoveCapture={markChatListInteracting}
            onPointerDownCapture={markChatListInteracting}
          >
            <div className="flex flex-col">
              {isInitialLoad && chats.length === 0 ? (
                <div className="flex items-center justify-center h-full py-20">
                  <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
                </div>
              ) : filteredChats.length > 0 ? (
                filteredChats.map((chat) => (
                <div
                    key={chat.id}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-3 cursor-pointer transition-colors border-b border-border/20 overflow-hidden max-w-full",
                      selectedChat?.id === chat.id ? "bg-muted/40" : "hover:bg-muted/20"
                    )}
                    onClick={() => { 
                      setSelectedChat(chat); 
                      setReplyToMessage(null); 
                      setIsSending(false);
                      setMessage("");
                    }}
                  >
                    <div className="relative flex-shrink-0">
                      <img 
                        src={chat.photo_url || DEFAULT_AVATAR} 
                        alt={chat.name} 
                        className="w-12 h-12 rounded-full object-cover bg-neutral-200" 
                      />
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-foreground truncate flex-1 min-w-0">{chat.name}</span>
                      </div>
                      <div className="flex items-center gap-1 min-w-0 mt-0.5">
                        {chat.lastMessageFromMe && (
                          chat.lastMessageStatus === "READ" || chat.lastMessageStatus === "PLAYED" 
                            ? <CheckCheck className="w-4 h-4 text-blue-500 flex-shrink-0" /> 
                            : chat.lastMessageStatus === "DELIVERED"
                              ? <CheckCheck className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              : <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <p className="text-sm text-muted-foreground truncate flex-1 min-w-0">
                          {chat.lastMessage?.trim() ? stripWhatsAppFormatting(chat.lastMessage) : "Sem mensagens"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={cn("text-xs whitespace-nowrap", chat.unread > 0 ? "text-emerald-500" : "text-muted-foreground")}>
                        {chat.time}
                      </span>
                      <div className="flex items-center gap-1">
                        {chat.unread > 0 && (
                          <span className="min-w-[20px] h-5 rounded-full bg-emerald-500 text-white text-xs font-medium flex items-center justify-center px-1.5">
                            {chat.unread}
                          </span>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
                              className="p-1 rounded-full hover:bg-muted/60"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (blockedContacts.has(chat.phone)) {
                                  handleUnblockContact(chat.phone);
                                } else {
                                  setBlockConfirmDialog({ open: true, phone: chat.phone, chatId: chat.id, name: chat.name });
                                }
                              }}
                            >
                              {blockedContacts.has(chat.phone) ? (
                                <>
                                  <ShieldCheck className="w-4 h-4 mr-2 text-emerald-500" />
                                  Desbloquear
                                </>
                              ) : (
                                <>
                                  <ShieldBan className="w-4 h-4 mr-2" />
                                  Bloquear
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteChatMessages(chat.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Apagar mensagens
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteChat(chat.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Apagar contato
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center h-full py-20 gap-3">
                  <p className="text-sm text-muted-foreground">
                    {isSyncing ? "Sincronizando conversas..." : "Nenhuma conversa encontrada"}
                  </p>
                  {isSyncing && <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />}
                </div>
              )}
            </div>
          </ScrollArea>
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
                  {contactPresence && contactPresence.phone === selectedChat.phone.replace(/\D/g, "") ? (
                    <p className="text-xs text-emerald-500 animate-pulse">
                      {contactPresence.type === "composing" ? "digitando..." : "gravando áudio..."}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{formatPhoneDisplay(selectedChat.phone)}</p>
                  )}
                </div>
                <button
                  onClick={() => setIsCallModalOpen(true)}
                  className="p-2 hover:bg-muted/50 rounded-full transition-colors"
                  title="Fazer ligação"
                >
                  <Phone className="w-5 h-5 text-emerald-500" />
                </button>
                <button
                  onClick={() => setShowLeadPanel(!showLeadPanel)}
                  className="p-2 hover:bg-muted/50 rounded-full transition-colors"
                  title={showLeadPanel ? "Ocultar painel" : "Mostrar painel"}
                >
                  {showLeadPanel ? <PanelRightClose className="w-5 h-5 text-muted-foreground" /> : <PanelRightOpen className="w-5 h-5 text-muted-foreground" />}
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
                          <div className={cn("flex group", msg.sent ? "justify-end" : "justify-start")}>
                            {/* Menu button for sent messages - only show if not deleted and within 1 hour */}
                            {msg.sent && msg.status !== "DELETED" && msg.created_at && (Date.now() - new Date(msg.created_at).getTime() < 60 * 60 * 1000) && (
                              <div className="relative flex items-start mr-1">
                                <button
                                  data-message-menu-trigger
                                  onClick={() => setMessageMenuId(messageMenuId === msg.id ? null : msg.id)}
                                  className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50"
                                >
                                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                </button>
                                {messageMenuId === msg.id && (
                                  <div data-message-menu className="absolute right-full top-0 mr-1 bg-card rounded-lg shadow-lg border border-border overflow-hidden z-50 min-w-[120px]">
                                    <button
                                      onClick={() => {
                                        setReplyToMessage(msg);
                                        setMessageMenuId(null);
                                      }}
                                      className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 w-full text-left text-sm text-foreground"
                                    >
                                      <Reply className="w-4 h-4" />
                                      Responder
                                    </button>
                                    {/* Edit option - only for text messages without media */}
                                    {!msg.mediaType && msg.text && (
                                      <button
                                        onClick={() => {
                                          setEditingMessage(msg);
                                          setEditText(msg.text);
                                          setMessageMenuId(null);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 w-full text-left text-sm text-foreground"
                                      >
                                        <Pencil className="w-4 h-4" />
                                        Editar
                                      </button>
                                    )}
                                    <button
                                      onClick={() => deleteMessage(msg)}
                                      className="flex items-center gap-2 px-3 py-2 hover:bg-destructive/10 w-full text-left text-sm text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Apagar
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Reply button for received messages */}
                            {!msg.sent && msg.status !== "DELETED" && (
                              <button
                                onClick={() => setReplyToMessage(msg)}
                                className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50 mr-1 self-center"
                              >
                                <Reply className="w-4 h-4 text-muted-foreground" />
                              </button>
                            )}
                            <div
                              data-message-id={msg.message_id}
                              className={cn(
                                "max-w-[65%] rounded-lg px-3 py-1.5 shadow-sm relative transition-all duration-300",
                                msg.sent 
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 rounded-tr-none" 
                                  : "bg-card rounded-tl-none border border-border/30"
                              )}
                            >
                              {/* Quoted message preview - clickable to scroll */}
                              {(msg.quotedText || msg.quotedMessageId) && (() => {
                                // Find quoted message to get media info
                                const quotedMessage = messages.find(m => 
                                  m.message_id?.toString() === msg.quotedMessageId?.toString()
                                );
                                const hasQuotedImage = quotedMessage?.mediaType === "image" && quotedMessage?.mediaUrl;
                                
                                return (
                                  <div 
                                    onClick={() => msg.quotedMessageId && scrollToQuotedMessage(msg.quotedMessageId)}
                                    className={cn(
                                      "mb-1.5 px-2 py-1 rounded border-l-2 text-xs transition-colors flex gap-2",
                                      msg.quotedFromMe 
                                        ? "bg-emerald-200/50 dark:bg-emerald-800/30 border-emerald-500" 
                                        : "bg-muted/50 border-muted-foreground/50",
                                      msg.quotedMessageId && "cursor-pointer hover:bg-muted/70"
                                    )}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <span className={cn(
                                        "font-medium block",
                                        msg.quotedFromMe ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                                      )}>
                                        {msg.quotedFromMe ? "Você" : selectedChat?.name || "Contato"}
                                      </span>
                                      {hasQuotedImage ? (
                                        <span className="text-muted-foreground flex items-center gap-1">
                                          <Image className="w-3 h-3" />
                                          Foto
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground line-clamp-2">{formatWhatsAppText(msg.quotedText || "")}</span>
                                      )}
                                    </div>
                                    {hasQuotedImage && (
                                      <img 
                                        src={quotedMessage.mediaUrl!} 
                                        alt="Imagem citada" 
                                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                                      />
                                    )}
                                  </div>
                                );
                              })()}
                              {/* Inline layout for text messages, stacked for media */}
                              {msg.mediaType && msg.mediaType !== "audio" ? (
                                <>
                                  {renderMessageContent(msg)}
                                  <div className="flex items-center justify-end gap-1 mt-0.5">
                                    {msg.status === "DELETED" && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="text-[10px] text-muted-foreground/70 italic mr-1 cursor-help">mensagem apagada</span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs">
                                          <p className="text-xs">{msg.text || "Mídia apagada"}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                                    {msg.sent && msg.status !== "DELETED" && (
                                      msg.status === "READ" || msg.status === "PLAYED" 
                                        ? <CheckCheck className="w-3.5 h-3.5 text-blue-500" /> 
                                        : msg.status === "DELIVERED"
                                          ? <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
                                          : msg.status === "SENDING"
                                            ? <div className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                                            : <Check className="w-3.5 h-3.5 text-muted-foreground" />
                                    )}
                                  </div>
                                </>
                              ) : msg.mediaType === "audio" ? (
                                <>
                                  {renderMessageContent(msg)}
                                  {msg.status === "DELETED" && (
                                    <div className="flex justify-end mt-0.5">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="text-[10px] text-muted-foreground/70 italic cursor-help">mensagem apagada</span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs">
                                          <p className="text-xs">Áudio apagado</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-sm text-foreground whitespace-pre-wrap break-words">
                                  {formatWhatsAppText(msg.text)}
                                  <span className="inline-flex items-center gap-1 ml-2 text-[10px] text-muted-foreground align-middle">
                                    {msg.status === "DELETED" && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="text-muted-foreground/70 italic mr-1 cursor-help">mensagem apagada</span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs">
                                          <p className="text-xs">{msg.text || "Mensagem apagada"}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    {msg.time}
                                    {msg.sent && msg.status !== "DELETED" && (
                                      msg.status === "READ" || msg.status === "PLAYED" 
                                        ? <CheckCheck className="w-3.5 h-3.5 text-blue-500" /> 
                                        : msg.status === "DELIVERED"
                                          ? <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
                                          : msg.status === "SENDING"
                                            ? <div className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                                            : <Check className="w-3.5 h-3.5 text-muted-foreground" />
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                            {/* Reply button for sent messages (right side) */}
                            {msg.sent && msg.status !== "DELETED" && (
                              <button
                                onClick={() => setReplyToMessage(msg)}
                                className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50 ml-1 self-center"
                              >
                                <Reply className="w-4 h-4 text-muted-foreground" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Edit Message Preview */}
              {editingMessage && (
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800 flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Pencil className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Editando mensagem
                      </span>
                    </div>
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          editMessage();
                        }
                        if (e.key === "Escape") {
                          setEditingMessage(null);
                          setEditText("");
                        }
                      }}
                      placeholder="Digite o novo texto..."
                      className="text-sm bg-background"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        setEditingMessage(null);
                        setEditText("");
                      }}
                      className="p-2 hover:bg-muted/50 rounded-full text-muted-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={editMessage}
                      disabled={!editText.trim()}
                      className="p-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Reply Preview */}
              {replyToMessage && (
                <div className="px-4 py-2 bg-muted/40 border-t border-border/30 flex items-start gap-3">
                  <div className="flex-1 border-l-2 border-emerald-500 pl-3">
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {replyToMessage.sent ? "Você" : selectedChat?.name || "Contato"}
                    </span>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {replyToMessage.mediaType === "audio" ? "🎵 Áudio" : 
                       replyToMessage.mediaType === "image" ? "📷 Imagem" : 
                       replyToMessage.mediaType === "video" ? "🎥 Vídeo" : 
                       stripWhatsAppFormatting(replyToMessage.text || "Mensagem")}
                    </p>
                  </div>
                  <button 
                    onClick={() => setReplyToMessage(null)}
                    className="p-1 hover:bg-muted/50 rounded-full"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              )}

              {/* Message Input */}
              <div className="px-4 py-3 bg-muted/30 border-t border-border/30">
                {isRecording ? (
                  // Recording UI
                  <div className="flex items-center gap-2">
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
                      {isSending ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-6 h-6 text-white" />
                      )}
                    </button>
                  </div>
                ) : (
                  // Normal input UI
                  <div className="space-y-2">
                    {/* Main Input Row */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 relative">
                        <Textarea
                          placeholder="Digite uma mensagem"
                          value={message}
                          onChange={(e) => {
                            setMessage(e.target.value);
                            if (e.target.value.trim()) {
                              sendPresenceUpdate("composing");
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (message.trim()) {
                                sendMessage();
                              }
                            }
                          }}
                          disabled={isSending}
                          className="bg-card border-border/50 text-sm rounded-xl min-h-[48px] max-h-[120px] resize-none pr-12 w-full"
                          rows={1}
                        />
                        {/* Send Button inside input */}
                        <button
                          onClick={sendMessage}
                          disabled={isSending || !message.trim()}
                          className={cn(
                            "absolute right-2 bottom-2 p-1.5 rounded-full transition-all",
                            message.trim() 
                              ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                              : "bg-muted text-muted-foreground cursor-not-allowed"
                          )}
                        >
                          {isSending ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <ArrowUp className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      
                      {/* Mic Button */}
                      <button
                        onClick={startRecording}
                        disabled={isSending}
                        className="p-3 bg-muted hover:bg-muted/80 rounded-full transition-colors disabled:opacity-50 shrink-0"
                      >
                        <Mic className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </div>

                    {/* Hidden file inputs */}
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
                    <input
                      type="file"
                      ref={videoInputRef}
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "video")}
                    />

                    {/* Bottom Toolbar with Icons - Always Visible */}
                    <div className="flex items-center gap-1 relative">
                      {/* Emoji */}
                      <div className="relative">
                        <button 
                          ref={emojiButtonRef}
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className={cn(
                            "p-2 hover:bg-muted/50 rounded-full transition-all duration-200",
                            showEmojiPicker && "bg-emerald-500/10"
                          )}
                          title="Emojis"
                        >
                          <Smile className={cn("w-5 h-5 transition-colors", showEmojiPicker ? "text-emerald-500" : "text-muted-foreground")} />
                        </button>
                        
                        {showEmojiPicker && (
                          <div ref={emojiPickerRef} className="absolute bottom-full left-0 mb-2 z-50">
                            <EmojiPicker 
                              onSelect={(emoji) => {
                                setMessage(prev => prev + emoji);
                                setShowEmojiPicker(false);
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Other icons slide when emoji is open */}
                      <div className={cn(
                        "flex items-center gap-1 transition-all duration-300 ease-out",
                        showEmojiPicker ? "ml-0 opacity-100" : "ml-0 opacity-100"
                      )}>
                        {/* Images */}
                        <button 
                          onClick={() => imageInputRef.current?.click()}
                          className="p-2 hover:bg-muted/50 rounded-full transition-colors"
                          title="Enviar imagem"
                        >
                          <FileImage className="w-5 h-5 text-muted-foreground" />
                        </button>

                        {/* Video */}
                        <button 
                          onClick={() => videoInputRef.current?.click()}
                          className="p-2 hover:bg-muted/50 rounded-full transition-colors"
                          title="Enviar vídeo"
                        >
                          <FileVideo className="w-5 h-5 text-muted-foreground" />
                        </button>

                        {/* Files */}
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 hover:bg-muted/50 rounded-full transition-colors"
                          title="Enviar documento"
                        >
                          <File className="w-5 h-5 text-muted-foreground" />
                        </button>

                        {/* Quick Messages */}
                        <div className="relative">
                          <button 
                            ref={quickMsgButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowQuickMessages(!showQuickMessages);
                            }}
                            className={cn(
                              "p-2 hover:bg-muted/50 rounded-full transition-all duration-200",
                              showQuickMessages && "bg-amber-500/10"
                            )}
                            title="Mensagens rápidas"
                          >
                            <Zap className={cn("w-5 h-5 transition-colors", showQuickMessages ? "text-amber-500" : "text-muted-foreground")} />
                          </button>
                          
                          {showQuickMessages && (
                            <div 
                              ref={quickMsgPickerRef}
                              className="absolute bottom-full right-0 mb-2 z-50"
                            >
                              <QuickMessages 
                                onSelect={(text) => {
                                  setMessage(text);
                                  setShowQuickMessages(false);
                                }}
                                onSelectAudio={async (audioBase64) => {
                                  setShowQuickMessages(false);
                                  const response = await fetch(audioBase64);
                                  const blob = await response.blob();
                                  await sendAudioMessage(blob, blob.type || "audio/webm");
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
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
                {chats.length === 0 && isSyncing && (
                  <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sincronizando conversas...
                  </div>
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

      {/* Click-outside dos menus é feito via listener no document (sem overlay fullscreen) */}

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

      {/* Image Lightbox with Navigation */}
      {lightboxIndex !== null && allImages.length > 0 && (
        <ImageLightbox
          images={allImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() =>
            setLightboxIndex((i) => {
              if (i === null) return 0;
              return i > 0 ? i - 1 : allImages.length - 1;
            })
          }
          onNext={() =>
            setLightboxIndex((i) => {
              if (i === null) return 0;
              return i < allImages.length - 1 ? i + 1 : 0;
            })
          }
        />
      )}

      {/* Block Contact Confirmation Dialog */}
      <AlertDialog 
        open={blockConfirmDialog?.open ?? false} 
        onOpenChange={(open) => !open && setBlockConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear contato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja bloquear {blockConfirmDialog?.name}? 
              <br /><br />
              <span className="font-semibold text-amber-600">Isso foi aprovado por um líder/admin?</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (blockConfirmDialog?.phone) {
                  handleBlockContact(blockConfirmDialog.phone);
                }
                setBlockConfirmDialog(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add WhatsApp Account Dialog */}
      <AddWhatsAppAccountDialog 
        open={showAddAccountDialog} 
        onOpenChange={(open) => {
          setShowAddAccountDialog(open);
          if (!open) {
            setAccountToConnect(null);
          }
        }}
        existingAccount={accountToConnect}
        onSuccess={() => {
          toast({
            title: "Conta conectada",
            description: accountToConnect ? "Conta WhatsApp reconectada com sucesso" : "Nova conta WhatsApp adicionada com sucesso",
          });
          // Refresh accounts list
          fetchWhatsAppAccounts();
          setAccountToConnect(null);
        }}
      />
    </>
  );
};

export default WhatsApp;
