import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface InstagramChat {
  id: string;
  conversation_id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  avatar: string | null;
  username: string;
  participantId: string;
}

interface InstagramMessage {
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

export function useInstagramCache() {
  const [chats, setChats] = useState<InstagramChat[]>([]);
  const [messages, setMessages] = useState<InstagramMessage[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const isFetchingFromApiRef = useRef(false);

  // Load chats from database cache (instant)
  const loadChatsFromCache = useCallback(async (): Promise<InstagramChat[]> => {
    try {
      const { data, error } = await supabase
        .from('instagram_chats')
        .select('*')
        .order('last_message_time', { ascending: false });

      if (error) throw error;

      return (data || []).map(chat => ({
        id: chat.id,
        conversation_id: chat.conversation_id,
        name: chat.participant_name || chat.participant_username || 'Usuário',
        lastMessage: chat.last_message || '',
        lastMessageTime: chat.last_message_time || new Date().toISOString(),
        unreadCount: chat.unread_count || 0,
        avatar: chat.participant_avatar,
        username: chat.participant_username || '',
        participantId: chat.participant_id,
      }));
    } catch (error) {
      console.error('[InstagramCache] Error loading chats from cache:', error);
      return [];
    }
  }, []);

  // Save chats to database cache
  const saveChatsToCache = useCallback(async (chatsToSave: InstagramChat[]) => {
    try {
      const records = chatsToSave.map(chat => ({
        conversation_id: chat.conversation_id,
        participant_id: chat.participantId,
        participant_name: chat.name,
        participant_username: chat.username,
        participant_avatar: chat.avatar,
        last_message: chat.lastMessage,
        last_message_time: chat.lastMessageTime,
        unread_count: chat.unreadCount,
      }));

      const { error } = await supabase
        .from('instagram_chats')
        .upsert(records, { onConflict: 'conversation_id' });

      if (error) throw error;
    } catch (error) {
      console.error('[InstagramCache] Error saving chats to cache:', error);
    }
  }, []);

  // Load messages from database cache (instant)
  const loadMessagesFromCache = useCallback(async (conversationId: string): Promise<InstagramMessage[]> => {
    try {
      const { data, error } = await supabase
        .from('instagram_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map(msg => ({
        id: msg.id,
        message_id: msg.message_id,
        text: msg.text,
        time: msg.created_at,
        fromMe: msg.from_me || false,
        status: msg.status || 'RECEIVED',
        mediaType: msg.media_type,
        mediaUrl: msg.media_url,
        shareLink: msg.share_link,
        shareName: msg.share_name,
      }));
    } catch (error) {
      console.error('[InstagramCache] Error loading messages from cache:', error);
      return [];
    }
  }, []);

  // Save messages to database cache
  const saveMessagesToCache = useCallback(async (conversationId: string, messagesToSave: InstagramMessage[]) => {
    try {
      const records = messagesToSave.map(msg => ({
        message_id: msg.message_id || msg.id,
        conversation_id: conversationId,
        text: msg.text,
        from_me: msg.fromMe,
        status: msg.status,
        media_type: msg.mediaType,
        media_url: msg.mediaUrl,
        share_link: msg.shareLink,
        share_name: msg.shareName,
        created_at: msg.time,
      }));

      const { error } = await supabase
        .from('instagram_messages')
        .upsert(records, { onConflict: 'message_id' });

      if (error) throw error;
    } catch (error) {
      console.error('[InstagramCache] Error saving messages to cache:', error);
    }
  }, []);

  // Fetch chats: load from cache first, then update from API in background
  const fetchChats = useCallback(async (myInstagramUserId: string, forceRefresh = false) => {
    // Step 1: Load from cache instantly (don't show loading)
    if (!forceRefresh) {
      const cachedChats = await loadChatsFromCache();
      if (cachedChats.length > 0) {
        setChats(cachedChats);
      } else {
        setIsLoadingChats(true);
      }
    } else {
      setIsLoadingChats(true);
    }

    // Step 2: Fetch from API in background
    if (isFetchingFromApiRef.current) return;
    isFetchingFromApiRef.current = true;

    try {
      const { data, error } = await supabase.functions.invoke('instagram-api', {
        body: { action: 'get-conversations', params: {} }
      });

      if (error) throw error;

      if (data?.success && data.conversations) {
        const formattedChats: InstagramChat[] = data.conversations.map((conv: any) => {
          const participant =
            conv.participants?.data?.find((p: any) => p.id !== myInstagramUserId) ??
            conv.participants?.data?.[0];
          const lastMsg = conv.messages?.data?.[0];

          return {
            id: conv.id, // Use conversation ID as id for selection
            conversation_id: conv.id,
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
        // Save to cache in background
        saveChatsToCache(formattedChats);
      }
    } catch (error) {
      console.error('[InstagramCache] Error fetching from API:', error);
    } finally {
      setIsLoadingChats(false);
      isFetchingFromApiRef.current = false;
    }
  }, [loadChatsFromCache, saveChatsToCache]);

  // Fetch messages: load from cache first, then update from API
  const fetchMessages = useCallback(async (conversationId: string, myInstagramUserId: string, forceRefresh = false) => {
    // Step 1: Load from cache instantly
    if (!forceRefresh) {
      const cachedMessages = await loadMessagesFromCache(conversationId);
      if (cachedMessages.length > 0) {
        setMessages(cachedMessages);
      } else {
        setIsLoadingMessages(true);
      }
    } else {
      setIsLoadingMessages(true);
    }

    // Step 2: Fetch from API
    try {
      const { data, error } = await supabase.functions.invoke('instagram-api', {
        body: { action: 'get-messages', params: { conversationId, limit: 100 } }
      });

      if (error) throw error;

      if (data?.success && data.messages) {
        const ordered = [...data.messages].reverse();

        const formattedMessages: InstagramMessage[] = ordered.map((msg: any, index: number) => {
          const isFromMe = msg.from?.id === myInstagramUserId;
          const hasLaterOther = ordered.slice(index + 1).some((m: any) => m.from?.id !== myInstagramUserId);
          const status = isFromMe ? (hasLaterOther ? 'READ' : 'DELIVERED') : 'RECEIVED';

          return {
            id: msg.id,
            message_id: msg.id,
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

        setMessages(formattedMessages);
        // Save to cache in background
        saveMessagesToCache(conversationId, formattedMessages);
      }
    } catch (error) {
      console.error('[InstagramCache] Error fetching messages from API:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [loadMessagesFromCache, saveMessagesToCache]);

  // Add optimistic message (for sending)
  const addOptimisticMessage = useCallback((message: InstagramMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  // Update message status
  const updateMessageStatus = useCallback((messageId: string, status: string) => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, status } : m
    ));
  }, []);

  // Remove optimistic message (on failure)
  const removeOptimisticMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  // Clear messages (when switching chats)
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    chats,
    messages,
    isLoadingChats,
    isLoadingMessages,
    fetchChats,
    fetchMessages,
    addOptimisticMessage,
    updateMessageStatus,
    removeOptimisticMessage,
    clearMessages,
    setChats,
    setMessages,
    // Expose a wrapper for temp messages
    addTempMessage: (message: InstagramMessage) => {
      setMessages(prev => [...prev, message]);
    },
    updateTempMessageStatus: (messageId: string, updates: Partial<InstagramMessage>) => {
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, ...updates } : m
      ));
    },
    removeTempMessage: (messageId: string) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    },
  };
}
