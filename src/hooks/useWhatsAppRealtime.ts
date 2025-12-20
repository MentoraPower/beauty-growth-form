/**
 * WhatsApp Real-time Hook
 * Integrates WhatsApp with the new centralized real-time architecture
 */

import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useRealtimeStore } from '@/stores/realtimeStore';
import { 
  useSortedConversations,
  useMessagesByChatId,
  useConversation,
  useRealtimeActions,
  useConnectionState,
} from '@/hooks/useRealtimeSelectors';
import type { WhatsAppChat, WhatsAppMessage } from '@/lib/realtime/types';
import { supabase } from '@/integrations/supabase/client';

// Format time for display
const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  
  const spOptions = { timeZone: "America/Sao_Paulo" } as const;
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

// Format phone for display
const formatPhoneDisplay = (phone: string): string => {
  if (!phone) return "";
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

// Check if phone is internal WhatsApp ID
const isWhatsAppInternalId = (phone: string): boolean => {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length > 14) return true;
  if (/^(120|146|180|203|234|447)\d{10,}$/.test(cleaned)) return true;
  return false;
};

// Get initials from name
const getInitials = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Legacy Chat interface for backward compatibility
export interface LegacyChat {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  lastMessageTime: string | null;
  unread: number;
  avatar: string;
  phone: string;
  photo_url: string | null;
  lastMessageStatus: string | null;
  lastMessageFromMe: boolean;
}

// Legacy Message interface for backward compatibility
export interface LegacyMessage {
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

// Convert store chat to legacy format
const tolegacyChat = (chat: WhatsAppChat): LegacyChat | null => {
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
};

// Status helpers
const isViewedStatus = (status: string | null | undefined) => status === "READ" || status === "PLAYED";
const isOutgoingStatus = (status: string | null | undefined) =>
  status === "SENDING" || status === "SENT" || status === "DELIVERED" || isViewedStatus(status);

// Convert store message to legacy format
const toLegacyMessage = (msg: WhatsAppMessage): LegacyMessage => ({
  id: msg.id,
  text: msg.text || "",
  time: msg.created_at ? new Date(msg.created_at).toLocaleTimeString("pt-BR", { 
    hour: "2-digit", 
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }) : "",
  sent: Boolean(msg.from_me) || isOutgoingStatus(msg.status),
  read: isViewedStatus(msg.status),
  status: msg.status || "",
  mediaUrl: msg.media_url,
  mediaType: msg.media_type,
  created_at: msg.created_at,
  message_id: msg.message_id,
  quotedMessageId: msg.quoted_message_id,
  quotedText: msg.quoted_text,
  quotedFromMe: msg.quoted_from_me,
});

interface UseWhatsAppRealtimeOptions {
  selectedChatId?: string | null;
}

export function useWhatsAppRealtime(options: UseWhatsAppRealtimeOptions = {}) {
  const { selectedChatId } = options;
  
  const connectionState = useConnectionState();
  const storeConversations = useSortedConversations();
  const storeMessages = useMessagesByChatId(selectedChatId || '');
  const selectedConversation = useConversation(selectedChatId || '');
  
  const {
    setConversations,
    upsertConversation,
    deleteConversation,
    setMessages,
    upsertMessage,
    deleteMessage,
  } = useRealtimeActions();
  
  const isInitialLoadDoneRef = useRef(false);

  // Convert store data to legacy format (memoized)
  const chats = useMemo(() => {
    return storeConversations
      .map(tolegacyChat)
      .filter((chat): chat is LegacyChat => chat !== null);
  }, [storeConversations]);

  const messages = useMemo(() => {
    return storeMessages.map(toLegacyMessage);
  }, [storeMessages]);

  const selectedChat = useMemo(() => {
    if (!selectedConversation) return null;
    return tolegacyChat(selectedConversation);
  }, [selectedConversation]);

  // Initial data fetch
  const fetchChats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_chats")
        .select("*")
        .order("last_message_time", { ascending: false });

      if (error) throw error;

      const formattedChats: WhatsAppChat[] = (data || []).map((chat: any) => ({
        id: chat.id,
        phone: chat.phone,
        name: chat.name,
        photo_url: chat.photo_url,
        last_message: chat.last_message,
        last_message_time: chat.last_message_time,
        last_message_from_me: chat.last_message_from_me,
        last_message_status: chat.last_message_status,
        unread_count: chat.unread_count,
        created_at: chat.created_at,
        updated_at: chat.updated_at,
      }));

      setConversations(formattedChats);
      isInitialLoadDoneRef.current = true;
    } catch (error) {
      console.error("[useWhatsAppRealtime] Error fetching chats:", error);
    }
  }, [setConversations]);

  // Fetch messages for selected chat
  const fetchMessages = useCallback(async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const formattedMessages: WhatsAppMessage[] = (data || []).map((msg: any) => ({
        id: msg.id,
        chat_id: msg.chat_id,
        phone: msg.phone,
        text: msg.text,
        from_me: msg.from_me,
        status: msg.status,
        media_type: msg.media_type,
        media_url: msg.media_url,
        created_at: msg.created_at,
        message_id: msg.message_id,
        quoted_text: msg.quoted_text,
        quoted_from_me: msg.quoted_from_me,
        quoted_message_id: msg.quoted_message_id,
        reaction: msg.reaction,
        whatsapp_key_id: msg.whatsapp_key_id,
      }));

      setMessages(formattedMessages);
      
      // Mark as read
      await supabase
        .from("whatsapp_chats")
        .update({ unread_count: 0 })
        .eq("id", chatId);
        
      // Update unread count in store
      if (selectedConversation) {
        upsertConversation({ ...selectedConversation, unread_count: 0 });
      }
    } catch (error) {
      console.error("[useWhatsAppRealtime] Error fetching messages:", error);
    }
  }, [setMessages, selectedConversation, upsertConversation]);

  // Initial fetch on mount
  useEffect(() => {
    if (!isInitialLoadDoneRef.current) {
      fetchChats();
    }
  }, [fetchChats]);

  // Fetch messages when chat changes
  useEffect(() => {
    if (selectedChatId) {
      fetchMessages(selectedChatId);
    }
  }, [selectedChatId, fetchMessages]);

  // Update chat in store (for optimistic updates)
  const updateChat = useCallback((chatData: Partial<WhatsAppChat> & { id: string }) => {
    const existing = storeConversations.find(c => c.id === chatData.id);
    if (existing) {
      upsertConversation({ ...existing, ...chatData });
    }
  }, [storeConversations, upsertConversation]);

  // Add message to store (for optimistic updates)
  const addMessage = useCallback((message: WhatsAppMessage) => {
    upsertMessage(message);
  }, [upsertMessage]);

  return {
    // Connection
    connectionState,
    isConnected: connectionState === 'connected',
    
    // Data (legacy format for backward compatibility)
    chats,
    messages,
    selectedChat,
    
    // Actions
    fetchChats,
    fetchMessages,
    updateChat,
    addMessage,
    upsertConversation,
    upsertMessage,
    deleteConversation,
    deleteMessage,
    
    // Raw store data (for advanced usage)
    storeConversations,
    storeMessages,
  };
}

export default useWhatsAppRealtime;
