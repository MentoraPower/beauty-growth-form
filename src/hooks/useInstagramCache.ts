import { useState, useCallback, useRef, useEffect } from 'react';
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
  const currentConversationIdRef = useRef<string | null>(null);

  // Real-time subscription for chats
  useEffect(() => {
    const channel = supabase
      .channel('instagram-chats-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'instagram_chats'
        },
        (payload) => {
          console.log('[InstagramRealtime] Chat change:', payload.eventType);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newChat = payload.new as any;
            const formattedChat: InstagramChat = {
              id: newChat.conversation_id,
              conversation_id: newChat.conversation_id,
              name: newChat.participant_name || newChat.participant_username || 'Usuário',
              lastMessage: newChat.last_message || '',
              lastMessageTime: newChat.last_message_time || new Date().toISOString(),
              unreadCount: newChat.unread_count || 0,
              avatar: newChat.participant_avatar,
              username: newChat.participant_username || '',
              participantId: newChat.participant_id,
            };
            
            setChats(prev => {
              const existingIndex = prev.findIndex(c => c.conversation_id === formattedChat.conversation_id);
              let updated: InstagramChat[];
              if (existingIndex >= 0) {
                // Update existing chat
                updated = [...prev];
                updated[existingIndex] = formattedChat;
              } else {
                // Add new chat
                updated = [formattedChat, ...prev];
              }
              // Always sort by last message time (most recent first)
              return updated.sort((a, b) => {
                const timeA = new Date(a.lastMessageTime).getTime();
                const timeB = new Date(b.lastMessageTime).getTime();
                return timeB - timeA;
              });
            });
          } else if (payload.eventType === 'DELETE') {
            const oldChat = payload.old as any;
            setChats(prev => prev.filter(c => c.conversation_id !== oldChat.conversation_id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Real-time subscription for messages (filtered by current conversation)
  // Using a separate state to track conversation to avoid stale closures
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  
  useEffect(() => {
    if (!activeConversationId) return;

    const conversationId = activeConversationId;
    
    const channel = supabase
      .channel(`instagram-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'instagram_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('[InstagramRealtime] New message received:', payload.new);
          const newMsg = payload.new as any;
          
          setMessages(prev => {
            // Check if message already exists by message_id
            const existsByMessageId = prev.some(m => 
              m.message_id === newMsg.message_id && !m.id.startsWith('temp-')
            );
            if (existsByMessageId) {
              console.log('[InstagramRealtime] Message already exists, skipping:', newMsg.message_id);
              return prev;
            }
            
            // Find matching temp message (same text, fromMe, within time window)
            const newMsgTime = new Date(newMsg.created_at).getTime();
            const tempMatch = prev.find(m => {
              if (!m.id.startsWith('temp-')) return false;
              if (m.fromMe !== newMsg.from_me) return false;
              // For text messages, match by text
              if (newMsg.text && m.text === newMsg.text) {
                const tempTime = new Date(m.time).getTime();
                return Math.abs(newMsgTime - tempTime) < 120000; // 2 min window
              }
              // For media messages, match by media type
              if (newMsg.media_type && m.mediaType === newMsg.media_type) {
                const tempTime = new Date(m.time).getTime();
                return Math.abs(newMsgTime - tempTime) < 120000;
              }
              return false;
            });
            
            const formattedMessage: InstagramMessage = {
              id: newMsg.message_id,
              message_id: newMsg.message_id,
              text: newMsg.text,
              time: newMsg.created_at,
              fromMe: newMsg.from_me || false,
              status: newMsg.status || 'RECEIVED',
              mediaType: newMsg.media_type,
              mediaUrl: newMsg.media_url,
              shareLink: newMsg.share_link,
              shareName: newMsg.share_name,
            };
            
            if (tempMatch) {
              // Replace temp message with real one
              console.log('[InstagramRealtime] Replacing temp message:', tempMatch.id, 'with:', newMsg.message_id);
              return prev.map(m => m.id === tempMatch.id ? formattedMessage : m);
            }
            
            // Add new message
            return [...prev, formattedMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'instagram_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('[InstagramRealtime] Message updated:', payload.new);
          const updatedMsg = payload.new as any;
          
          setMessages(prev => prev.map(m => {
            if (m.message_id === updatedMsg.message_id) {
              return {
                ...m,
                status: updatedMsg.status || m.status,
                text: updatedMsg.text ?? m.text,
              };
            }
            return m;
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationId]);

  // Load chats from database cache (instant)
  const loadChatsFromCache = useCallback(async (): Promise<InstagramChat[]> => {
    try {
      const { data, error } = await supabase
        .from('instagram_chats')
        .select('*')
        .order('last_message_time', { ascending: false });

      if (error) throw error;

      return (data || []).map(chat => ({
        id: chat.conversation_id, // Use conversation_id as the main id
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
        id: msg.message_id, // Use message_id as the main id
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
      // Filter out temp messages
      const validMessages = messagesToSave.filter(msg => !msg.id.startsWith('temp-'));
      if (validMessages.length === 0) return;

      const records = validMessages.map(msg => ({
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

  // Save a single sent message to cache - skip temp messages
  const saveSentMessageToCache = useCallback(async (conversationId: string, message: InstagramMessage) => {
    try {
      // Don't save temp messages to cache - they will be replaced by real messages from API
      if (message.id.startsWith('temp-') || message.message_id.startsWith('temp-')) {
        console.log('[InstagramCache] Skipping temp message save:', message.id);
        return;
      }
      
      const { error } = await supabase
        .from('instagram_messages')
        .upsert({
          message_id: message.message_id || message.id,
          conversation_id: conversationId,
          text: message.text,
          from_me: message.fromMe,
          status: message.status,
          media_type: message.mediaType,
          media_url: message.mediaUrl,
          share_link: message.shareLink,
          share_name: message.shareName,
          created_at: message.time,
        }, { onConflict: 'message_id' });

      if (error) throw error;
    } catch (error) {
      console.error('[InstagramCache] Error saving sent message to cache:', error);
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
    // Track current conversation to avoid race conditions
    currentConversationIdRef.current = conversationId;
    setActiveConversationId(conversationId);

    // Step 1: Load from cache instantly
    if (!forceRefresh) {
      const cachedMessages = await loadMessagesFromCache(conversationId);
      // Check if we're still on the same conversation
      if (currentConversationIdRef.current !== conversationId) return;
      
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

      // Check if we're still on the same conversation
      if (currentConversationIdRef.current !== conversationId) return;

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

        // Replace temp messages with real ones, deduplicate by text+fromMe
        setMessages(prev => {
          // Get all temp messages
          const tempMessages = prev.filter(m => m.id.startsWith('temp-'));
          
          // For each formatted message, check if there's a matching temp
          const finalMessages = formattedMessages.map(fm => fm);
          
          // Find temp messages that have no corresponding real message yet
          // (match by text and fromMe flag within a small time window)
          const unmatchedTemps = tempMessages.filter(temp => {
            const tempTime = new Date(temp.time).getTime();
            const hasMatch = formattedMessages.some(fm => {
              const fmTime = new Date(fm.time).getTime();
              const timeDiff = Math.abs(fmTime - tempTime);
              // Match if same text, same sender, within 2 minutes
              return fm.text === temp.text && fm.fromMe === temp.fromMe && timeDiff < 120000;
            });
            return !hasMatch;
          });
          
          // Return formatted messages + any unmatched temp messages (still pending)
          return [...finalMessages, ...unmatchedTemps];
        });
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
    saveSentMessageToCache,
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
