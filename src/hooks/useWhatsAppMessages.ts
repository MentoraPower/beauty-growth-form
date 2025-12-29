import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Chat } from "./useWhatsAppChats";

export interface Message {
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

type WhatsAppMessageStatus = string | null | undefined;

export const isViewedStatus = (status: WhatsAppMessageStatus) => 
  status === "READ" || status === "PLAYED";

export const isOutgoingStatus = (status: WhatsAppMessageStatus) =>
  status === "SENDING" || status === "SENT" || status === "DELIVERED" || isViewedStatus(status);

export const getStatusRank = (status: WhatsAppMessageStatus) => {
  switch (status) {
    case "SENDING": return 0;
    case "SENT": return 1;
    case "DELIVERED": return 2;
    case "READ": return 3;
    case "PLAYED": return 4;
    case "DELETED": return 99;
    default: return -1;
  }
};

export const mergeStatus = (current: WhatsAppMessageStatus, incoming: WhatsAppMessageStatus) => {
  if (!incoming) return current;
  if (!current) return incoming;
  return getStatusRank(incoming) >= getStatusRank(current) ? incoming : current;
};

export const getDateLabel = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const spOptions = { timeZone: "America/Sao_Paulo" };
  const dateInSP = new Date(date.toLocaleString("en-US", spOptions));
  const nowInSP = new Date(now.toLocaleString("en-US", spOptions));
  
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

export const getMessageDateKey = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" });
};

interface UseWhatsAppMessagesOptions {
  selectedChat: Chat | null;
  onMarkAsRead: (chatId: string) => Promise<void>;
}

export function useWhatsAppMessages({ selectedChat, onMarkAsRead }: UseWhatsAppMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastFetchedChatIdRef = useRef<string | null>(null);
  const shouldScrollToBottomOnOpenRef = useRef(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const scrollToQuotedMessage = useCallback((quotedMessageId: string) => {
    const messageElement = document.querySelector(`[data-message-id="${quotedMessageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      messageElement.classList.add("ring-2", "ring-primary", "ring-offset-2");
      setTimeout(() => {
        messageElement.classList.remove("ring-2", "ring-primary", "ring-offset-2");
      }, 2000);
    }
  }, []);

  const fetchMessages = useCallback(async (chatId: string, isGroup: boolean = false) => {
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
        time: msg.created_at
          ? new Date(msg.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Sao_Paulo",
            })
          : "",
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
      await onMarkAsRead(chatId);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [onMarkAsRead]);

  // Hide empty records
  const visibleMessages = messages.filter(
    (m) => Boolean(m.mediaType) || Boolean(m.text?.trim()) || Boolean(m.mediaUrl)
  );

  // Get all images for lightbox
  const allImages = messages
    .filter(m => m.mediaType === "image" && m.mediaUrl)
    .map(m => m.mediaUrl!);

  // Realtime subscription for messages
  useEffect(() => {
    // Validate selectedChat.id before creating realtime channel
    if (!selectedChat?.id || selectedChat.id === 'null' || selectedChat.id === 'undefined') {
      return;
    }

    const channel = supabase
      .channel(`whatsapp-messages-${selectedChat.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `chat_id=eq.${selectedChat.id}` },
        (payload) => {
          const msg = payload.new as any;
          
          setMessages(prev => {
            const isDuplicate = prev.some(m => 
              m.id === msg.id || 
              (msg.message_id && m.message_id === msg.message_id) ||
              m.id.startsWith("temp-")
            );
            
            if (isDuplicate) return prev;

            const newMessage: Message = {
              id: msg.id,
              text: msg.text || "",
              time: msg.created_at
                ? new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Sao_Paulo",
                  })
                : "",
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
            };

            return [...prev, newMessage];
          });

          scrollToBottom("smooth");
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_messages", filter: `chat_id=eq.${selectedChat.id}` },
        (payload) => {
          const msg = payload.new as any;
          
          setMessages(prev => prev.map(m => {
            const matchById = m.id === msg.id;
            const matchByMessageId = msg.message_id && m.message_id === msg.message_id;
            
            if (matchById || matchByMessageId) {
              const newStatus = mergeStatus(m.status, msg.status);
              return {
                ...m,
                status: newStatus,
                read: isViewedStatus(newStatus),
                text: msg.text ?? m.text,
                mediaUrl: msg.media_url ?? m.mediaUrl,
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
  }, [selectedChat?.id, scrollToBottom]);

  // Scroll to bottom when messages loaded
  useEffect(() => {
    if (!selectedChat || isLoadingMessages || messages.length === 0) return;
    
    let attempts = 0;
    const maxAttempts = 30;
    
    const intervalId = setInterval(() => {
      const el = messagesContainerRef.current;
      attempts++;
      
      if (!el) {
        if (attempts >= maxAttempts) clearInterval(intervalId);
        return;
      }
      
      el.scrollTop = el.scrollHeight;
      
      const hasScrollableContent = el.scrollHeight > el.clientHeight;
      const isAtBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 10;
      
      if ((hasScrollableContent && isAtBottom) || (!hasScrollableContent && el.scrollHeight > 0) || attempts >= maxAttempts) {
        clearInterval(intervalId);
        shouldScrollToBottomOnOpenRef.current = false;
      }
    }, 50);
    
    return () => clearInterval(intervalId);
  }, [selectedChat?.id, isLoadingMessages, messages.length]);

  return {
    messages,
    setMessages,
    visibleMessages,
    allImages,
    isLoadingMessages,
    replyToMessage,
    setReplyToMessage,
    editingMessage,
    setEditingMessage,
    editText,
    setEditText,
    messagesEndRef,
    messagesContainerRef,
    shouldScrollToBottomOnOpenRef,
    fetchMessages,
    scrollToBottom,
    scrollToQuotedMessage,
  };
}
