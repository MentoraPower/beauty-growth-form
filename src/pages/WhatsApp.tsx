import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import LeadInfoPanel from "@/components/whatsapp/LeadInfoPanel";
import ImageLightbox from "@/components/whatsapp/ImageLightbox";
import { AddWhatsAppAccountDialog } from "@/components/whatsapp/AddWhatsAppAccountDialog";
import { GroupsList, WhatsAppGroup } from "@/components/whatsapp/GroupsList";
import { GroupParticipantsPanel } from "@/components/whatsapp/GroupParticipantsPanel";

// New refactored components and hooks
import { useWhatsAppChats, Chat, formatTime, isWhatsAppInternalId } from "@/hooks/useWhatsAppChats";
import { useWhatsAppMessages, Message } from "@/hooks/useWhatsAppMessages";
import { useWhatsAppRecording } from "@/hooks/useWhatsAppRecording";
import { ChatSidebar } from "@/components/whatsapp/ChatSidebar";
import { ChatHeader } from "@/components/whatsapp/ChatHeader";
import { MessageArea } from "@/components/whatsapp/MessageArea";
import { ChatInputArea } from "@/components/whatsapp/ChatInputArea";
import { MediaPreviewDialog } from "@/components/whatsapp/MediaPreviewDialog";

interface WhatsAppProps {
  selectedAccountId?: string | null;
  setSelectedAccountId?: React.Dispatch<React.SetStateAction<string | null>>;
  whatsappAccounts?: Array<{ id: string; name: string; phone_number?: string; status: string; api_key?: string }>;
  setWhatsappAccounts?: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; phone_number?: string; status: string; api_key?: string }>>>;
  showAddAccountDialog?: boolean;
  setShowAddAccountDialog?: React.Dispatch<React.SetStateAction<boolean>>;
  accountToConnect?: { id: string; name: string; phone_number?: string; status: string; api_key?: string } | null;
  setAccountToConnect?: React.Dispatch<React.SetStateAction<{ id: string; name: string; phone_number?: string; status: string; api_key?: string } | null>>;
  fetchWhatsAppAccounts?: () => Promise<void>;
  sidebarTab?: "conversas" | "grupos";
  setSidebarTab?: (tab: "conversas" | "grupos") => void;
}

const WhatsApp = (props: WhatsAppProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  
  // Local state for accounts (fallback when not provided by parent)
  const [localShowAddAccountDialog, setLocalShowAddAccountDialog] = useState(false);
  const [localWhatsappAccounts, setLocalWhatsappAccounts] = useState<Array<{ id: string; name: string; phone_number?: string; status: string; api_key?: string }>>([]);
  const [localSelectedAccountId, setLocalSelectedAccountId] = useState<string | null>(() => {
    const saved = localStorage.getItem('whatsapp_selected_account_id');
    return saved ? saved : null;
  });
  const [localAccountToConnect, setLocalAccountToConnect] = useState<{ id: string; name: string; phone_number?: string; status: string; api_key?: string } | null>(null);
  
  // Use props or fallback to local state
  const showAddAccountDialog = props.showAddAccountDialog ?? localShowAddAccountDialog;
  const setShowAddAccountDialog = props.setShowAddAccountDialog ?? setLocalShowAddAccountDialog;
  const whatsappAccounts = props.whatsappAccounts ?? localWhatsappAccounts;
  const setWhatsappAccounts = props.setWhatsappAccounts ?? setLocalWhatsappAccounts;
  const selectedAccountId = props.selectedAccountId ?? localSelectedAccountId;
  const setSelectedAccountId = props.setSelectedAccountId ?? setLocalSelectedAccountId;
  const accountToConnect = props.accountToConnect ?? localAccountToConnect;
  const setAccountToConnect = props.setAccountToConnect ?? setLocalAccountToConnect;

  // UI State
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showLeadPanel, setShowLeadPanel] = useState(true);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [blockedContacts, setBlockedContacts] = useState<Set<string>>(new Set());
  const [blockConfirmDialog, setBlockConfirmDialog] = useState<{ open: boolean; phone: string; chatId: string; name: string } | null>(null);
  const [contactPresence, setContactPresence] = useState<{ phone: string; type: string; timestamp: number } | null>(null);
  const [pendingMedia, setPendingMedia] = useState<{ file: File; type: "image" | "video" } | null>(null);
  
  // Groups & Sidebar
  const [whatsappGroups, setWhatsappGroups] = useState<WhatsAppGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  
  // Use props or fallback to local state for sidebar tab
  const [localSidebarTab, setLocalSidebarTabInternal] = useState<"conversas" | "grupos">(() => {
    const tabFromUrl = searchParams.get('tab');
    return tabFromUrl === 'grupos' ? 'grupos' : 'conversas';
  });
  
  const sidebarTab = props.sidebarTab ?? localSidebarTab;
  
  const setSidebarTab = useCallback((tab: "conversas" | "grupos") => {
    if (props.setSidebarTab) {
      props.setSidebarTab(tab);
    } else {
      setLocalSidebarTabInternal(tab);
      setSearchParams(currentParams => {
        const newParams = new URLSearchParams(currentParams);
        if (tab === 'grupos') {
          newParams.set('tab', 'grupos');
        } else {
          newParams.delete('tab');
        }
        return newParams;
      }, { replace: true });
    }
  }, [props.setSidebarTab, setSearchParams]);
  
  // Account loading state
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isAccountChanging, setIsAccountChanging] = useState(false);
  const [isInitializingApp, setIsInitializingApp] = useState(true);

  // Use refactored hooks
  const {
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
  } = useWhatsAppChats({ selectedAccountId, whatsappAccounts });

  const {
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
    messagesContainerRef,
    fetchMessages,
    scrollToBottom,
    scrollToQuotedMessage,
  } = useWhatsAppMessages({ selectedChat, onMarkAsRead: markChatAsRead });

  const handleAudioMessageSent = useCallback((tempId: string, insertedMsg: any, publicUrl: string) => {
    setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: insertedMsg.id, status: "SENT" } : m));
  }, [setMessages]);

  const handleUpdateChatAfterAudio = useCallback((chatId: string, lastMessage: string, timestamp: string) => {
    setChats(prev => {
      const updatedChats = prev.map(c => 
        c.id === chatId 
          ? { ...c, lastMessage, lastMessageTime: timestamp, lastMessageStatus: "SENT", lastMessageFromMe: true }
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
  }, [setChats, chatsRef]);

  const {
    isRecording,
    recordingTime,
    recordingStream,
    isSendingAudio,
    startRecording,
    stopRecording,
    cancelRecording,
    formatRecordingTime,
    sendAudioMessage,
    sendPresenceUpdate,
  } = useWhatsAppRecording({
    selectedChat,
    selectedAccountId,
    whatsappAccounts,
    onMessageSent: handleAudioMessageSent,
    onUpdateChat: handleUpdateChatAfterAudio,
  });

  // Fetch WhatsApp accounts
  const fetchWhatsAppAccountsLocal = useCallback(async (): Promise<any[]> => {
    setIsLoadingAccounts(true);
    try {
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "list-sessions" },
      });

      if (error) throw error;

      if (data?.success && Array.isArray(data.data)) {
        setWhatsappAccounts(data.data);
        
        const savedAccountId = localStorage.getItem('whatsapp_selected_account_id');
        const savedAccount = savedAccountId ? data.data.find((acc: any) => String(acc.id) === savedAccountId) : null;
        
        if (savedAccount && savedAccount.status?.toLowerCase() === "connected") {
          if (selectedAccountId !== savedAccount.id) {
            setSelectedAccountId(savedAccount.id);
          }
        } else if (!selectedAccountId && data.data.length > 0) {
          const connectedAccount = data.data.find((acc: any) => acc.status?.toLowerCase() === "connected");
          if (connectedAccount) {
            setSelectedAccountId(connectedAccount.id);
            localStorage.setItem('whatsapp_selected_account_id', String(connectedAccount.id));
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
  }, [selectedAccountId, setSelectedAccountId, setWhatsappAccounts]);

  // Fetch WhatsApp groups from database only (realtime handles updates)
  const fetchWhatsAppGroups = useCallback(async (forceRefresh = false) => {
    const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
    const sessionApiKey = selectedAccount?.api_key;
    
    if (!sessionApiKey) {
      setWhatsappGroups([]);
      return;
    }

    setIsLoadingGroups(true);
    try {
      // Load groups from database
      const { data: dbGroups } = await supabase
        .from("whatsapp_groups")
        .select("*")
        .eq("session_id", sessionApiKey)
        .order("name", { ascending: true });

      if (dbGroups && dbGroups.length > 0) {
        // Fetch unread counts and recent system events for each group
        const groupJids = dbGroups.map(g => g.group_jid);
        
        // Get unread message counts and last message from whatsapp_chats (groups are stored there too)
        const { data: groupChats } = await supabase
          .from("whatsapp_chats")
          .select("phone, unread_count, last_message, last_message_time")
          .eq("session_id", sessionApiKey)
          .in("phone", groupJids);
        
        // Get recent system events (last 24h) for "entrou/saiu" indicator
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentSystemEvents } = await supabase
          .from("whatsapp_messages")
          .select("phone, text")
          .eq("session_id", sessionApiKey)
          .eq("media_type", "system")
          .in("phone", groupJids)
          .gte("created_at", oneDayAgo)
          .order("created_at", { ascending: false });
        
        const chatDataMap = new Map(groupChats?.map(c => [c.phone, c]) || []);
        const latestSystemEventMap = new Map<string, string>();
        recentSystemEvents?.forEach(e => {
          if (!latestSystemEventMap.has(e.phone)) {
            latestSystemEventMap.set(e.phone, e.text || "");
          }
        });
        const groupsWithEvents = new Set(recentSystemEvents?.map(e => e.phone) || []);
        
        setWhatsappGroups(dbGroups.map(g => {
          const chatData = chatDataMap.get(g.group_jid);
          const systemEvent = latestSystemEventMap.get(g.group_jid);
          // Prioritize system event text if exists, otherwise use last message
          const lastMessage = systemEvent || chatData?.last_message || null;
          
          return {
            id: g.id,
            groupJid: g.group_jid,
            name: g.name,
            participantCount: g.participant_count ?? 0,
            photoUrl: g.photo_url,
            unreadCount: chatData?.unread_count ?? 0,
            hasNewEvent: groupsWithEvents.has(g.group_jid),
            lastMessage,
            lastMessageTime: chatData?.last_message_time || null,
          };
        }));
        
        // If we have cached groups and not forcing refresh, skip API call
        if (!forceRefresh) {
          setIsLoadingGroups(false);
          return;
        }
      }
      
      // Fetch fresh data from WasenderAPI via Edge Function only on first load or manual refresh
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "fetch-groups", sessionId: sessionApiKey },
      });

      if (error) {
        console.error("[WhatsApp] Edge function error:", error);
        return;
      }

      if (data?.success && Array.isArray(data.groups)) {
        const groups: WhatsAppGroup[] = data.groups.map((g: any) => ({
          id: g.id || g.groupJid,
          groupJid: g.groupJid,
          name: g.name,
          participantCount: g.participantCount ?? 0,
          photoUrl: g.photoUrl,
          unreadCount: 0,
          hasNewEvent: false,
        }));
        setWhatsappGroups(groups);
      }
    } catch (error: any) {
      console.error("[WhatsApp] Error fetching groups:", error);
    } finally {
      setIsLoadingGroups(false);
    }
  }, [selectedAccountId, whatsappAccounts]);

  // Realtime subscription for group updates (participant count changes)
  useEffect(() => {
    const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
    const sessionApiKey = selectedAccount?.api_key;
    
    if (!sessionApiKey) return;
    
    console.log("[WhatsApp] Setting up realtime subscription for groups");
    
    const channel = supabase
      .channel(`whatsapp-groups-${sessionApiKey.substring(0, 12)}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_groups',
          filter: `session_id=eq.${sessionApiKey}`,
        },
        (payload) => {
          console.log("[WhatsApp] Group updated via realtime:", payload.new);
          const updatedGroup = payload.new as any;
          
          setWhatsappGroups(prev => {
            const updated = prev.map(g => 
              g.groupJid === updatedGroup.group_jid 
                ? {
                    ...g,
                    name: updatedGroup.name || g.name,
                    participantCount: updatedGroup.participant_count ?? g.participantCount,
                    photoUrl: updatedGroup.photo_url || g.photoUrl,
                  }
                : g
            );
            // Re-sort by name to maintain consistent order
            return updated.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_groups',
          filter: `session_id=eq.${sessionApiKey}`,
        },
        (payload) => {
          console.log("[WhatsApp] New group via realtime:", payload.new);
          const newGroup = payload.new as any;
          
          setWhatsappGroups(prev => {
            // Avoid duplicates
            if (prev.some(g => g.groupJid === newGroup.group_jid)) return prev;
            
            const newList = [...prev, {
              id: newGroup.id,
              groupJid: newGroup.group_jid,
              name: newGroup.name,
              participantCount: newGroup.participant_count ?? 0,
              photoUrl: newGroup.photo_url,
              unreadCount: 0,
              hasNewEvent: false,
            }];
            // Sort by name to maintain consistent order
            return newList.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
          });
        }
      )
      .subscribe();
    
    return () => {
      console.log("[WhatsApp] Cleaning up groups realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [selectedAccountId, whatsappAccounts]);

  // Handle selecting a group
  const handleSelectGroup = useCallback(async (group: WhatsAppGroup) => {
    const selectedAccount = whatsappAccounts.find((acc) => acc.id === selectedAccountId);
    const sessionApiKey = selectedAccount?.api_key;

    if (!sessionApiKey) {
      toast({ title: "Selecione uma conta WhatsApp conectada", variant: "destructive" });
      return;
    }

    try {
      const { data: existingChat } = await supabase
        .from("whatsapp_chats")
        .select("*")
        .eq("phone", group.groupJid)
        .eq("session_id", sessionApiKey)
        .maybeSingle();

      let chatRow = existingChat;

      if (!chatRow) {
        const { data: createdChat, error: createError } = await supabase
          .from("whatsapp_chats")
          .upsert({
            phone: group.groupJid,
            name: group.name,
            photo_url: group.photoUrl || null,
            session_id: sessionApiKey,
            last_message: null,
            last_message_time: null,
            unread_count: 0,
          }, { onConflict: "phone,session_id" })
          .select("*")
          .single();

        if (createError) throw createError;
        chatRow = createdChat;
      }

      const groupChat: Chat = {
        id: chatRow.id,
        name: group.name,
        lastMessage: chatRow.last_message || "",
        time: chatRow.last_message_time ? formatTime(chatRow.last_message_time) : "",
        lastMessageTime: chatRow.last_message_time || null,
        unread: chatRow.unread_count || 0,
        avatar: group.name.substring(0, 2).toUpperCase(),
        phone: group.groupJid,
        photo_url: group.photoUrl || chatRow?.photo_url || null,
        lastMessageStatus: chatRow.last_message_status || null,
        lastMessageFromMe: chatRow.last_message_from_me || false,
        isGroup: true,
        participantCount: group.participantCount,
      };

      setSelectedChat(groupChat);
      setReplyToMessage(null);
      setIsSending(false);
      setMessage("");
    } catch (error: any) {
      console.error("[WhatsApp] Error opening group chat:", error);
      toast({ title: "Erro ao abrir grupo", description: error?.message, variant: "destructive" });
    }
  }, [selectedAccountId, whatsappAccounts, toast, setSelectedChat, setReplyToMessage]);

  // Send text message
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
      const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
      const sessionId = selectedAccount?.api_key || null;

      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: {
          action: "send-text",
          phone: selectedChat.phone,
          text: messageText,
          quotedMsgId: quotedMsg?.message_id?.toString(),
          sessionId,
        },
      });

      if (error) throw error;

      const messageId = data?.messageId || `local-${Date.now()}`;

      const { data: insertedMsg } = await supabase
        .from("whatsapp_messages")
        .insert({
          chat_id: selectedChat.id,
          message_id: messageId,
          whatsapp_key_id: data?.whatsappKeyId || null,
          phone: selectedChat.phone,
          text: messageText,
          from_me: true,
          status: "SENT",
          quoted_message_id: quotedMsg?.message_id?.toString() || null,
          quoted_text: quotedMsg?.text || null,
          quoted_from_me: quotedMsg?.sent || null,
          session_id: sessionId,
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

      handleUpdateChatAfterAudio(selectedChat.id, messageText, newTimestamp);

      if (insertedMsg) {
        setMessages(prev => prev.map(m => m.id === tempId ? { 
          ...m, 
          id: insertedMsg.id, 
          message_id: messageId,
          status: "SENT" 
        } : m));
      }
      
    } catch (error: any) {
      console.error("Error sending message:", error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  // File upload handler - for images/videos, show preview; for files, send directly
  const handleFileUpload = async (file: File, type: "image" | "file" | "video") => {
    if (!selectedChat || isSending) return;
    
    // For images and videos, show preview dialog
    if (type === "image" || type === "video") {
      setPendingMedia({ file, type });
      return;
    }
    
    // For files, send directly
    await sendMediaWithCaption(file, type, "");
  };

  // Send media with caption (used by preview dialog and direct file upload)
  const sendMediaWithCaption = async (file: File, type: "image" | "file" | "video", caption: string) => {
    if (!selectedChat || isSending) return;
    
    setIsSending(true);

    try {
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'bin';
      const filename = `${selectedChat.phone}_${timestamp}.${ext}`;
      const filePath = `${type}s/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, file, { contentType: file.type, cacheControl: '3600' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      const action = type === "image" ? "send-image" : type === "video" ? "send-video" : "send-file";

      const tempId = `temp-${Date.now()}`;
      const tempMsg: Message = {
        id: tempId,
        text: caption || (type === "file" ? file.name : ""),
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

      const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
      const sessionId = selectedAccount?.api_key || null;

      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action, phone: selectedChat.phone, mediaUrl: publicUrl, filename: file.name, caption, sessionId },
      });

      if (error) throw error;

      const { data: insertedMsg } = await supabase.from("whatsapp_messages").insert({
        chat_id: selectedChat.id,
        phone: selectedChat.phone,
        text: caption || (type === "file" ? file.name : ""),
        from_me: true,
        status: "SENT",
        media_url: publicUrl,
        media_type: type,
        message_id: data?.messageId,
        whatsapp_key_id: data?.whatsappKeyId || null,
        session_id: sessionId,
      }).select().single();

      if (insertedMsg) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: insertedMsg.id, status: "SENT" } : m));
      }

      const newTimestamp = new Date().toISOString();
      const lastMsgText = type === "image" ? "📷 Imagem" : type === "video" ? "🎥 Vídeo" : `📄 ${file.name}`;
      
      await supabase.from("whatsapp_chats").update({
        last_message: lastMsgText,
        last_message_time: newTimestamp,
        last_message_status: "SENT",
        last_message_from_me: true,
      }).eq("id", selectedChat.id);

      handleUpdateChatAfterAudio(selectedChat.id, lastMsgText, newTimestamp);

    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
      setPendingMedia(null);
    }
  };

  // Delete message
  const deleteMessage = async (msg: Message) => {
    if (!msg.sent) {
      toast({ title: "Só é possível apagar mensagens enviadas", variant: "destructive" });
      return;
    }
    
    setMessageMenuId(null);
    
    const messageId = msg.message_id;
    
    if (!messageId || String(messageId).startsWith("local-")) {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "DELETED" } : m));
      await supabase.from("whatsapp_messages").update({ status: "DELETED" }).eq("id", msg.id);
      // Success notification removed per user request
      return;
    }
    
    const numericMsgId = parseInt(String(messageId), 10);
    
    if (isNaN(numericMsgId)) {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "DELETED" } : m));
      await supabase.from("whatsapp_messages").update({ status: "DELETED" }).eq("id", msg.id);
      return;
    }
    
    try {
      const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
      const sessionId = selectedAccount?.api_key;
      
      if (!sessionId) {
        throw new Error("Sessão não encontrada");
      }
      
      const { error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "delete-message", msgId: numericMsgId, sessionId },
      });
      
      if (error) throw error;
      
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "DELETED" } : m));
      await supabase.from("whatsapp_messages").update({ status: "DELETED" }).eq("id", msg.id);
      
      // Success notification removed per user request
    } catch (error: any) {
      console.error("[WhatsApp] Error deleting message:", error);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "DELETED" } : m));
      await supabase.from("whatsapp_messages").update({ status: "DELETED" }).eq("id", msg.id);
      toast({ title: "Erro ao apagar", variant: "destructive" });
    }
  };

  // Edit message
  const editMessageHandler = async () => {
    if (!editingMessage || !editText.trim()) {
      setEditingMessage(null);
      setEditText("");
      return;
    }
    
    const messageId = editingMessage.message_id;
    
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
      const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
      const sessionId = selectedAccount?.api_key;
      
      if (!sessionId) {
        throw new Error("Sessão não encontrada");
      }
      
      const { error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "edit-message", msgId: numericMsgId, newText: editText.trim(), sessionId },
      });
      
      if (error) throw error;
      
      setMessages(prev => prev.map(m => 
        m.id === editingMessage.id ? { ...m, text: editText.trim(), isEdited: true } : m
      ));
      
      await supabase.from("whatsapp_messages").update({ text: editText.trim(), is_edited: true }).eq("id", editingMessage.id);
      
      // Success notification removed per user request
    } catch (error: any) {
      console.error("[WhatsApp] Error editing message:", error);
      toast({ title: "Erro ao editar", variant: "destructive" });
    } finally {
      setEditingMessage(null);
      setEditText("");
    }
  };

  // Send reaction to message
  const sendReaction = async (msg: Message, emoji: string) => {
    if (!selectedChat || !msg.message_id) return;
    
    const messageId = String(msg.message_id);
    
    // Only numeric message IDs can receive reactions via API
    if (!/^\d+$/.test(messageId)) {
      console.log("[WhatsApp] Cannot react to message with non-numeric ID:", messageId);
      return;
    }
    
    try {
      const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
      const sessionId = selectedAccount?.api_key;
      
      if (!sessionId) {
        throw new Error("Sessão não encontrada");
      }
      
      // Optimistic update
      setMessages(prev => prev.map(m => 
        m.id === msg.id ? { ...m, reaction: emoji } : m
      ));
      
      const { error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { 
          action: "send-reaction", 
          phone: selectedChat.phone,
          targetMsgId: messageId, 
          reaction: emoji,
          sessionId 
        },
      });
      
      if (error) throw error;
      
      // Update database
      await supabase.from("whatsapp_messages").update({ reaction: emoji }).eq("id", msg.id);
      
    } catch (error: any) {
      console.error("[WhatsApp] Error sending reaction:", error);
      // Revert optimistic update
      setMessages(prev => prev.map(m => 
        m.id === msg.id ? { ...m, reaction: msg.reaction } : m
      ));
    }
  };

  // Delete chat messages
  const handleDeleteChatMessages = async (chatId: string) => {
    try {
      await supabase.from("whatsapp_messages").delete().eq("chat_id", chatId);
      await supabase.from("whatsapp_chats").update({ 
        last_message: null, last_message_time: null, last_message_status: null, last_message_from_me: false 
      }).eq("id", chatId);

      setChats(prev => prev.map(c => 
        c.id === chatId ? { ...c, lastMessage: "", lastMessageTime: null } : c
      ));

      if (selectedChat?.id === chatId) setMessages([]);
      toast({ title: "Mensagens apagadas com sucesso" });
    } catch (error) {
      toast({ title: "Erro ao apagar mensagens", variant: "destructive" });
    }
  };

  // Delete chat
  const handleDeleteChat = async (chatId: string) => {
    try {
      await supabase.from("whatsapp_messages").delete().eq("chat_id", chatId);
      await supabase.from("whatsapp_chats").delete().eq("id", chatId);

      removeChatFromState(chatId);
      if (selectedChat?.id === chatId) {
        setSelectedChat(null);
        setMessages([]);
      }
      toast({ title: "Contato apagado com sucesso" });
    } catch (error) {
      toast({ title: "Erro ao apagar contato", variant: "destructive" });
    }
  };

  // Block/Unblock contact
  const handleBlockContact = async (phone: string) => {
    try {
      await supabase.functions.invoke("wasender-whatsapp", { body: { action: "block-contact", phone } });
      setBlockedContacts(prev => new Set([...prev, phone]));
      toast({ title: "Contato bloqueado com sucesso" });
    } catch (error) {
      toast({ title: "Erro ao bloquear contato", variant: "destructive" });
    }
  };

  const handleUnblockContact = async (phone: string) => {
    try {
      await supabase.functions.invoke("wasender-whatsapp", { body: { action: "unblock-contact", phone } });
      setBlockedContacts(prev => {
        const newSet = new Set(prev);
        newSet.delete(phone);
        return newSet;
      });
      toast({ title: "Contato desbloqueado com sucesso" });
    } catch (error) {
      toast({ title: "Erro ao desbloquear contato", variant: "destructive" });
    }
  };

  // Initialize app
  const hasParentAccounts = props.whatsappAccounts && props.whatsappAccounts.length > 0;
  const hasParentSelectedAccount = props.selectedAccountId !== undefined && props.selectedAccountId !== null;
  
  useEffect(() => {
    if (hasParentAccounts && hasParentSelectedAccount) {
      setIsInitializingApp(false);
      return;
    }
    
    const init = async () => {
      await fetchWhatsAppAccountsLocal();
      setIsInitializingApp(false);
    };

    init();
  }, [hasParentAccounts, hasParentSelectedAccount, fetchWhatsAppAccountsLocal]);

  // Reload chats when account changes
  const prevAccountIdRef = useRef<string | null>(hasParentSelectedAccount ? selectedAccountId : null);
  const hasLoadedOnceRef = useRef(false);
  
  useEffect(() => {
    if (selectedAccountId === null || whatsappAccounts.length === 0) return;
    
    const isAccountChange = prevAccountIdRef.current !== null && prevAccountIdRef.current !== selectedAccountId;
    const isFirstLoad = !hasLoadedOnceRef.current;
    prevAccountIdRef.current = selectedAccountId;
    
    if (isAccountChange) {
      setIsAccountChanging(true);
      setChats([]);
      chatsRef.current = [];
      setSelectedChat(null);
      setMessages([]);
    }
    
    if (!isFirstLoad && !isAccountChange && chats.length > 0) {
      setIsInitializingApp(false);
      return;
    }
    
    hasLoadedOnceRef.current = true;
    
    const loadChatsForAccount = async () => {
      await fetchChats();
      setIsAccountChanging(false);
      setIsInitializingApp(false);
    };
    
    loadChatsForAccount();
  }, [selectedAccountId, whatsappAccounts, fetchChats, setChats, chatsRef, setSelectedChat, setMessages, chats.length]);

  // Load groups when sidebar tab changes
  useEffect(() => {
    if (sidebarTab === "grupos" && whatsappGroups.length === 0 && !isLoadingGroups) {
      fetchWhatsAppGroups();
    }
  }, [sidebarTab, fetchWhatsAppGroups, whatsappGroups.length, isLoadingGroups]);

  // Handle phone parameter from URL
  useEffect(() => {
    const phoneParam = searchParams.get("phone");
    if (phoneParam && chats.length > 0) {
      const cleanParam = phoneParam.replace(/\D/g, "");
      const existingChat = chats.find(c => c.phone.replace(/\D/g, "") === cleanParam);
      
      if (existingChat) {
        setSelectedChat(existingChat);
      } else {
        const tempChat: Chat = {
          id: `temp-${cleanParam}`,
          name: phoneParam,
          lastMessage: "",
          time: "",
          lastMessageTime: null,
          unread: 0,
          avatar: "?",
          phone: cleanParam,
          photo_url: null,
          lastMessageStatus: null,
          lastMessageFromMe: false,
        };
        setSelectedChat(tempChat);
      }
      
      setSearchParams({});
    }
  }, [searchParams, chats, setSelectedChat, setSearchParams]);

  // Setup realtime presence subscription
  useEffect(() => {
    const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
    const sessionApiKey = selectedAccount?.api_key;
    
    if (!sessionApiKey) return;

    const channelId = `presence-${sessionApiKey.substring(0, 12)}`;
    const channel = supabase.channel(channelId);

    channel
      .on("broadcast", { event: "presence" }, (payload) => {
        const { phone, type } = payload.payload || {};
        if (phone && type) {
          setContactPresence({ phone, type, timestamp: Date.now() });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedAccountId, whatsappAccounts]);

  // Auto-clear presence after 5 seconds
  useEffect(() => {
    if (!contactPresence) return;
    
    const timeout = setTimeout(() => {
      if (Date.now() - contactPresence.timestamp > 4500) {
        setContactPresence(null);
      }
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [contactPresence]);

  // Fetch messages when chat is selected
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
    }
  }, [selectedChat?.id, fetchMessages]);

  const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
  const sessionApiKey = selectedAccount?.api_key || null;

  // Loading state
  if (isInitializingApp || isAccountChanging) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">
            {isAccountChanging ? "Trocando de conta..." : "Carregando WhatsApp..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full bg-background overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <ChatSidebar
            chats={chats}
            selectedChat={selectedChat}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectChat={async (chat) => {
              setSelectedChat(chat);
              setReplyToMessage(null);
              setMessage("");
              
              // Fetch profile picture if not available (and not a group)
              if (!chat.photo_url && !chat.isGroup && !chat.phone.includes("@g.us")) {
                const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
                const sessionId = selectedAccount?.api_key;
                
                if (sessionId) {
                  // Fetch in background without blocking selection
                  supabase.functions.invoke("wasender-whatsapp", {
                    body: { 
                      action: "get-profile-picture", 
                      phone: chat.phone,
                      sessionId,
                    },
                  }).then(({ data }) => {
                    if (data?.photoUrl) {
                      console.log("[WhatsApp] Profile picture fetched:", data.photoUrl.substring(0, 50) + "...");
                      // Update selectedChat only if still the same chat
                      setSelectedChat(prev => {
                        if (prev?.id === chat.id) {
                          return { ...prev, photo_url: data.photoUrl };
                        }
                        return prev;
                      });
                      // Update chats list
                      setChats(prev => prev.map(c => 
                        c.id === chat.id ? { ...c, photo_url: data.photoUrl } : c
                      ));
                    }
                  }).catch(error => {
                    console.error("[WhatsApp] Error fetching profile picture:", error);
                  });
                }
              }
            }}
            isInitialLoad={isInitialLoad}
            isSyncing={isSyncing}
            sidebarTab={sidebarTab}
            onSidebarTabChange={setSidebarTab}
            whatsappGroups={whatsappGroups}
            isLoadingGroups={isLoadingGroups}
            onSelectGroup={handleSelectGroup}
            onFetchGroups={fetchWhatsAppGroups}
            onMarkChatListInteracting={markChatListInteracting}
            blockedContacts={blockedContacts}
            onDeleteChatMessages={handleDeleteChatMessages}
            onDeleteChat={handleDeleteChat}
            onBlockContact={(phone, chatId, name) => setBlockConfirmDialog({ open: true, phone, chatId, name })}
            onUnblockContact={handleUnblockContact}
          />

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-muted/10 dark:bg-zinc-950">
            {selectedChat ? (
              <>
                <ChatHeader
                  selectedChat={selectedChat}
                  contactPresence={contactPresence}
                  showLeadPanel={showLeadPanel}
                  onToggleLeadPanel={() => setShowLeadPanel(prev => !prev)}
                />

                <MessageArea
                  messages={messages}
                  visibleMessages={visibleMessages}
                  allImages={allImages}
                  isLoadingMessages={isLoadingMessages}
                  messagesContainerRef={messagesContainerRef}
                  messageMenuId={messageMenuId}
                  onMessageMenuChange={setMessageMenuId}
                  onReplyMessage={(msg) => setReplyToMessage(msg)}
                  onEditMessage={(msg) => {
                    setEditingMessage(msg);
                    setEditText(msg.text || "");
                  }}
                  onDeleteMessage={deleteMessage}
                  onReactMessage={sendReaction}
                  onScrollToQuoted={scrollToQuotedMessage}
                  onImageClick={(idx) => setLightboxIndex(idx)}
                  scrollToBottom={scrollToBottom}
                  isGroupChat={selectedChat.isGroup}
                />

                <ChatInputArea
                  message={editingMessage ? editText : message}
                  onMessageChange={editingMessage ? setEditText : setMessage}
                  onSendMessage={editingMessage ? editMessageHandler : sendMessage}
                  isSending={isSending}
                  isRecording={isRecording}
                  recordingTime={recordingTime}
                  recordingStream={recordingStream}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onCancelRecording={cancelRecording}
                  formatRecordingTime={formatRecordingTime}
                  onFileUpload={handleFileUpload}
                  isEditing={!!editingMessage}
                  onCancelEdit={() => {
                    setEditingMessage(null);
                    setEditText("");
                  }}
                  onSendAudioFromQuickMessage={async (audioBase64: string) => {
                    // Convert base64 to blob and send
                    const response = await fetch(audioBase64);
                    const blob = await response.blob();
                    await sendAudioMessage(blob);
                  }}
                  sessionId={sessionApiKey || undefined}
                  replyToMessage={replyToMessage}
                  onCancelReply={() => setReplyToMessage(null)}
                  onSendPresence={sendPresenceUpdate}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-muted/5">
                <p className="text-sm text-muted-foreground">Abra uma conversa</p>
              </div>
            )}
          </div>

          {/* Lead Info Panel or Group Participants Panel */}
          {selectedChat && showLeadPanel && (
            selectedChat.isGroup ? (
              <GroupParticipantsPanel
                groupJid={selectedChat.phone}
                groupName={selectedChat.name}
                groupPhoto={selectedChat.photo_url}
                participantCount={selectedChat.participantCount || 0}
                apiKey={sessionApiKey || ""}
                onSelectParticipant={(phone, name) => {
                  const cleanPhone = phone.replace(/@s\.whatsapp\.net$/, "");
                  const existingChat = chats.find(c => c.phone.replace(/\D/g, "") === cleanPhone.replace(/\D/g, ""));
                  if (existingChat) {
                    setSelectedChat(existingChat as Chat);
                    setSidebarTab("conversas");
                  } else {
                    const tempChat: Chat = {
                      id: `temp-${cleanPhone}`,
                      name: name || cleanPhone,
                      lastMessage: "",
                      time: "",
                      lastMessageTime: null,
                      unread: 0,
                      avatar: name ? name.substring(0, 2).toUpperCase() : "?",
                      phone: cleanPhone,
                      photo_url: null,
                      lastMessageStatus: null,
                      lastMessageFromMe: false,
                    };
                    setSelectedChat(tempChat);
                    setSidebarTab("conversas");
                  }
                }}
              />
            ) : (
              <LeadInfoPanel 
                phone={selectedChat.phone} 
                photoUrl={selectedChat.photo_url}
                contactName={selectedChat.name}
                onNameUpdate={(newName) => updateChatName(selectedChat.id, newName)}
              />
            )
          )}
        </div>
      </div>

      {/* Modals & Dialogs */}
      {lightboxIndex !== null && allImages.length > 0 && (
        <ImageLightbox
          images={allImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => i !== null && i > 0 ? i - 1 : allImages.length - 1)}
          onNext={() => setLightboxIndex((i) => i !== null && i < allImages.length - 1 ? i + 1 : 0)}
        />
      )}

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
                if (blockConfirmDialog?.phone) handleBlockContact(blockConfirmDialog.phone);
                setBlockConfirmDialog(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddWhatsAppAccountDialog 
        open={showAddAccountDialog} 
        onOpenChange={(open) => {
          setShowAddAccountDialog(open);
          if (!open) setAccountToConnect(null);
        }}
        existingAccount={accountToConnect}
        onSuccess={() => {
          toast({
            title: "Conta conectada",
            description: accountToConnect ? "Conta WhatsApp reconectada" : "Nova conta WhatsApp adicionada",
          });
          fetchWhatsAppAccountsLocal();
          setAccountToConnect(null);
        }}
      />

      {/* Media Preview Dialog */}
      <MediaPreviewDialog
        file={pendingMedia?.file || null}
        type={pendingMedia?.type || "image"}
        onSend={(caption) => {
          if (pendingMedia) {
            sendMediaWithCaption(pendingMedia.file, pendingMedia.type, caption);
          }
        }}
        onCancel={() => setPendingMedia(null)}
        isSending={isSending}
      />
    </>
  );
};

export default WhatsApp;
