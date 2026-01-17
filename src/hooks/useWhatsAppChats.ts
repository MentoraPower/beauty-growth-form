import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  DEFAULT_AVATAR, 
  getInitials, 
  isWhatsAppInternalId, 
  formatPhoneDisplay 
} from "@/lib/whatsapp-utils";

// Re-export for backward compatibility
export { DEFAULT_AVATAR, getInitials, isWhatsAppInternalId, formatPhoneDisplay };

export interface Chat {
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
  isGroup?: boolean;
  participantCount?: number;
}

export const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
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

interface UseWhatsAppChatsOptions {
  selectedAccountId: string | null;
  whatsappAccounts: Array<{ id: string; api_key?: string }>;
}

export function useWhatsAppChats({ selectedAccountId, whatsappAccounts }: UseWhatsAppChatsOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChatInternal] = useState<Chat | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const chatsRef = useRef<Chat[]>([]);
  const pendingChatUpdatesRef = useRef<Map<string, any>>(new Map());
  const chatListInteractingRef = useRef(false);
  const chatListIdleTimeoutRef = useRef<number | null>(null);
  const selectedChatRestoredRef = useRef(false);

  // Wrapper to persist selected chat in URL
  const setSelectedChat = useCallback((chatOrUpdater: Chat | null | ((prev: Chat | null) => Chat | null)) => {
    setSelectedChatInternal(prev => {
      const newChat = typeof chatOrUpdater === 'function' ? chatOrUpdater(prev) : chatOrUpdater;
      
      // Persist to URL search params
      setSearchParams(currentParams => {
        const newParams = new URLSearchParams(currentParams);
        if (newChat) {
          newParams.set('chat', newChat.id);
        } else {
          newParams.delete('chat');
        }
        return newParams;
      }, { replace: true });
      
      return newChat;
    });
  }, [setSearchParams]);

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

  const markChatListInteracting = useCallback(() => {
    chatListInteractingRef.current = true;
    if (chatListIdleTimeoutRef.current) window.clearTimeout(chatListIdleTimeoutRef.current);
    chatListIdleTimeoutRef.current = window.setTimeout(() => {
      chatListInteractingRef.current = false;
      flushPendingChatUpdates();
    }, 300);
  }, []);

  const flushPendingChatUpdates = useCallback(() => {
    const pending = Array.from(pendingChatUpdatesRef.current.values());
    if (pending.length === 0) return;

    pendingChatUpdatesRef.current.clear();

    const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
    const currentSessionId = selectedAccount?.api_key;
    
    const filteredPending = currentSessionId 
      ? pending.filter((chat: any) => chat?.session_id === currentSessionId)
      : pending;

    const formattedUpdates = filteredPending
      .map(formatChatData)
      .filter((chat): chat is Chat => chat !== null);

    if (formattedUpdates.length === 0) return;

    setChats(prev => {
      let newChats = [...prev];
      
      for (const updated of formattedUpdates) {
        const existingIndex = newChats.findIndex(c => c.id === updated.id);
        if (existingIndex >= 0) {
          newChats[existingIndex] = updated;
        } else {
          newChats.unshift(updated);
        }
      }
      
      newChats.sort((a, b) => {
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
      });
      
      chatsRef.current = newChats;
      return newChats;
    });
  }, [formatChatData, selectedAccountId, whatsappAccounts]);

  const fetchChats = useCallback(async (showLoading = false) => {
    if (showLoading) setIsInitialLoad(true);
    
    try {
      const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
      const sessionApiKey = selectedAccount?.api_key;
      
      let query = supabase
        .from("whatsapp_chats")
        .select("*")
        .order("last_message_time", { ascending: false });
      
      if (sessionApiKey) {
        query = query.eq("session_id", sessionApiKey);
      }
      
      const { data, error } = await query;

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
  }, [formatChatData, selectedAccountId, whatsappAccounts]);

  const updateChatInState = useCallback((chatData: any) => {
    const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
    const currentSessionId = selectedAccount?.api_key;

    if (currentSessionId && chatData.session_id !== currentSessionId) {
      return;
    }

    if (chatListInteractingRef.current) {
      pendingChatUpdatesRef.current.set(chatData.id, chatData);
      return;
    }

    flushPendingChatUpdates();

    const formatted = formatChatData(chatData);
    if (!formatted) return;
    
    setChats(prev => {
      const existingIndex = prev.findIndex(c => c.id === formatted.id);
      let newChats: Chat[];
      
      if (existingIndex >= 0) {
        newChats = [...prev];
        newChats[existingIndex] = formatted;
      } else {
        newChats = [formatted, ...prev];
      }
      
      newChats.sort((a, b) => {
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
      });
      
      chatsRef.current = newChats;
      return newChats;
    });

    setSelectedChat(prev => {
      if (prev?.id === formatted.id) {
        return formatted;
      }
      return prev;
    });
  }, [formatChatData, flushPendingChatUpdates, selectedAccountId, whatsappAccounts]);

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

  const updateChatName = useCallback(async (chatId: string, newName: string) => {
    setChats(prev => {
      const newChats = prev.map(c => 
        c.id === chatId ? { ...c, name: newName } : c
      );
      chatsRef.current = newChats;
      return newChats;
    });

    setSelectedChat(prev => {
      if (prev?.id === chatId) {
        return { ...prev, name: newName };
      }
      return prev;
    });

    try {
      await supabase
        .from("whatsapp_chats")
        .update({ name: newName })
        .eq("id", chatId);
    } catch (error) {
      console.error("Error updating chat name:", error);
    }
  }, []);

  const syncAllChats = useCallback(async () => {
    setIsSyncing(true);
    try {
      const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
      const sessionId = selectedAccount?.api_key || null;

      const { error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { 
          action: "sync-all",
          sessionId,
        },
      });
      
      if (!error) {
        await fetchChats();
      }
    } catch (error: any) {
      console.error("[WhatsApp] Error syncing:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [whatsappAccounts, selectedAccountId, fetchChats]);

  const markChatAsRead = useCallback(async (chatId: string) => {
    await supabase.from("whatsapp_chats").update({ unread_count: 0 }).eq("id", chatId);
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, unread: 0 } : c));
    setSelectedChat(prev => prev?.id === chatId ? { ...prev, unread: 0 } : prev);
  }, []);

  // Realtime subscription for chats
  useEffect(() => {
    const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
    const currentSessionId = selectedAccount?.api_key;
    
    // Validate sessionId before creating realtime channel
    if (!currentSessionId || currentSessionId === 'null' || currentSessionId === 'undefined') {
      return;
    }
    
    const channelName = `whatsapp-chats-${currentSessionId.substring(0, 12)}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_chats" },
        (payload) => {
          const chat = payload.new as any;
          if (chat?.session_id !== currentSessionId) return;
          updateChatInState(chat);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_chats" },
        (payload) => {
          const chat = payload.new as any;
          if (chat?.session_id !== currentSessionId) return;
          updateChatInState(chat);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "whatsapp_chats" },
        (payload) => {
          const deletedChat = payload.old as any;
          const existsInState = chatsRef.current.some(c => c.id === deletedChat?.id);
          if (existsInState) {
            removeChatFromState(deletedChat.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [updateChatInState, removeChatFromState, selectedAccountId, whatsappAccounts]);

  // Restore selected chat from URL after chats load
  useEffect(() => {
    if (isInitialLoad || selectedChatRestoredRef.current) return;
    
    const chatIdFromUrl = searchParams.get('chat');
    if (!chatIdFromUrl) {
      selectedChatRestoredRef.current = true;
      return;
    }
    
    // If there's already a selected chat matching the URL, don't restore
    // This prevents overwriting manually selected groups
    if (selectedChat?.id === chatIdFromUrl) {
      selectedChatRestoredRef.current = true;
      return;
    }
    
    // First try to find in loaded chats
    const foundChat = chats.find(c => c.id === chatIdFromUrl);
    
    if (foundChat) {
      setSelectedChatInternal(foundChat);
      selectedChatRestoredRef.current = true;
      return;
    }
    
    // Chat not in list - try to fetch directly from database (may be a group)
    const fetchChatById = async () => {
      try {
        const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
        const sessionApiKey = selectedAccount?.api_key;
        
        if (!sessionApiKey) {
          selectedChatRestoredRef.current = true;
          return;
        }
        
        const { data: chatData, error } = await supabase
          .from("whatsapp_chats")
          .select("*")
          .eq("id", chatIdFromUrl)
          .eq("session_id", sessionApiKey)
          .maybeSingle();
        
        if (error || !chatData) {
          selectedChatRestoredRef.current = true;
          return;
        }
        
        // Check if this is a group (phone ends with @g.us)
        const isGroup = chatData.phone?.endsWith("@g.us");
        
        // For groups, also fetch photo from whatsapp_groups table if chat has no photo
        let groupPhoto = chatData.photo_url;
        let participantCount = 0;
        
        if (isGroup && !groupPhoto) {
          const { data: groupData } = await supabase
            .from("whatsapp_groups")
            .select("photo_url, participant_count")
            .eq("group_jid", chatData.phone)
            .eq("session_id", sessionApiKey)
            .maybeSingle();
          
          if (groupData) {
            groupPhoto = groupData.photo_url || null;
            participantCount = groupData.participant_count || 0;
          }
        }
        
        const restoredChat: Chat = {
          id: chatData.id,
          name: chatData.name || chatData.phone || "",
          lastMessage: chatData.last_message || "",
          time: chatData.last_message_time ? formatTime(chatData.last_message_time) : "",
          lastMessageTime: chatData.last_message_time || null,
          unread: chatData.unread_count || 0,
          avatar: (chatData.name || chatData.phone || "?").substring(0, 2).toUpperCase(),
          phone: chatData.phone || "",
          photo_url: groupPhoto || chatData.photo_url || null,
          lastMessageStatus: chatData.last_message_status || null,
          lastMessageFromMe: chatData.last_message_from_me || false,
          isGroup,
          participantCount: participantCount || undefined,
        };
        
        setSelectedChatInternal(restoredChat);
        
        // Only add to chats list if not a group (groups should only appear in grupos tab)
        if (!isGroup) {
          setChats(prev => {
            if (prev.some(c => c.id === restoredChat.id)) return prev;
            return [restoredChat, ...prev];
          });
        }
      } catch (err) {
        console.error("[useWhatsAppChats] Error restoring chat from URL:", err);
      } finally {
        selectedChatRestoredRef.current = true;
      }
    };
    
    fetchChatById();
  }, [chats, isInitialLoad, searchParams, selectedAccountId, whatsappAccounts, setChats, selectedChat?.id]);

  // Reset restored flag when account changes
  useEffect(() => {
    selectedChatRestoredRef.current = false;
    setSelectedChatInternal(null);
  }, [selectedAccountId]);

  return {
    chats,
    setChats,
    selectedChat,
    setSelectedChat,
    isInitialLoad,
    isSyncing,
    chatsRef,
    fetchChats,
    updateChatInState,
    removeChatFromState,
    updateChatName,
    syncAllChats,
    markChatAsRead,
    markChatListInteracting,
    formatChatData,
  };
}
