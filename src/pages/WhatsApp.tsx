import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CallModal from "@/components/whatsapp/CallModal";
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
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [showLeadPanel, setShowLeadPanel] = useState(true);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [blockedContacts, setBlockedContacts] = useState<Set<string>>(new Set());
  const [blockConfirmDialog, setBlockConfirmDialog] = useState<{ open: boolean; phone: string; chatId: string; name: string } | null>(null);
  const [contactPresence, setContactPresence] = useState<{ phone: string; type: string; timestamp: number } | null>(null);
  
  // Groups & Sidebar
  const [whatsappGroups, setWhatsappGroups] = useState<WhatsAppGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"conversas" | "grupos">("conversas");
  
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

  // Fetch WhatsApp groups
  const fetchWhatsAppGroups = useCallback(async () => {
    const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
    const sessionApiKey = selectedAccount?.api_key;
    
    if (!sessionApiKey) {
      setWhatsappGroups([]);
      return;
    }

    setIsLoadingGroups(true);
    try {
      const { data: dbGroups } = await supabase
        .from("whatsapp_groups")
        .select("*")
        .eq("session_id", sessionApiKey)
        .order("name", { ascending: true });

      if (dbGroups && dbGroups.length > 0) {
        setWhatsappGroups(dbGroups.map(g => ({
          id: g.id,
          groupJid: g.group_jid,
          name: g.name,
          participantCount: g.participant_count || 0,
          photoUrl: g.photo_url,
        })));
        setIsLoadingGroups(false);
      }
      
      const response = await fetch("https://www.wasenderapi.com/api/groups", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${sessionApiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error(`Failed to fetch groups: ${response.status}`);

      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        const groups: WhatsAppGroup[] = result.data.map((g: any) => ({
          id: g.id || g.jid || "",
          groupJid: g.id || g.jid || "",
          name: g.subject || g.name || "Grupo",
          participantCount: g.participants?.length ?? g.size ?? 0,
          photoUrl: g.profilePicture || g.pictureUrl || g.imgUrl || null,
        }));
        setWhatsappGroups(groups);
      }
    } catch (error: any) {
      console.error("[WhatsApp] Error fetching groups:", error);
    } finally {
      setIsLoadingGroups(false);
    }
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

  // File upload handler
  const handleFileUpload = async (file: File, type: "image" | "file" | "video") => {
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

      const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
      const sessionId = selectedAccount?.api_key || null;

      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action, phone: selectedChat.phone, mediaUrl: publicUrl, filename: file.name, caption: "", sessionId },
      });

      if (error) throw error;

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

      toast({ title: type === "image" ? "Imagem enviada" : type === "video" ? "Vídeo enviado" : "Arquivo enviado" });

    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
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
      toast({ title: "Mensagem apagada localmente" });
      return;
    }
    
    const numericMsgId = parseInt(String(messageId), 10);
    
    if (isNaN(numericMsgId)) {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "DELETED" } : m));
      await supabase.from("whatsapp_messages").update({ status: "DELETED" }).eq("id", msg.id);
      return;
    }
    
    try {
      const { error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "delete-message", msgId: numericMsgId },
      });
      
      if (error) throw error;
      
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "DELETED" } : m));
      await supabase.from("whatsapp_messages").update({ status: "DELETED" }).eq("id", msg.id);
      
      toast({ title: "Mensagem apagada para todos" });
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
      const { error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "edit-message", msgId: numericMsgId, newText: editText.trim() },
      });
      
      if (error) throw error;
      
      setMessages(prev => prev.map(m => 
        m.id === editingMessage.id ? { ...m, text: editText.trim() } : m
      ));
      
      await supabase.from("whatsapp_messages").update({ text: editText.trim() }).eq("id", editingMessage.id);
      
      toast({ title: "Mensagem editada" });
    } catch (error: any) {
      console.error("[WhatsApp] Error editing message:", error);
      toast({ title: "Erro ao editar", variant: "destructive" });
    } finally {
      setEditingMessage(null);
      setEditText("");
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

  // Initiate call
  const initiateCall = async () => {
    if (!selectedChat) return;
    const { error } = await supabase.functions.invoke("infobip-call", { body: { to: selectedChat.phone } });
    if (error) throw error;
    toast({ title: "Ligação iniciada", description: `Chamando ${selectedChat.name}...` });
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
    
    const reloadChatsForAccount = async () => {
      try {
        await fetchChats(chats.length === 0);
        fetchWhatsAppGroups();
        syncAllChats();
      } finally {
        setIsAccountChanging(false);
        setIsInitializingApp(false);
      }
    };
    
    reloadChatsForAccount();
  }, [selectedAccountId, whatsappAccounts, fetchChats, syncAllChats, fetchWhatsAppGroups, chats.length, setChats, chatsRef, setSelectedChat, setMessages]);

  // Handle phone param in URL
  useEffect(() => {
    const phoneParam = searchParams.get("phone");
    if (!phoneParam || chats.length === 0 || selectedChat) return;

    const matchingChat = chats.find(c => c.phone === phoneParam || c.phone.includes(phoneParam) || phoneParam.includes(c.phone));
    if (matchingChat) {
      setSelectedChat(matchingChat);
      fetchMessages(matchingChat.id, matchingChat.isGroup);
      setSearchParams({}, { replace: true });
    }
  }, [chats, searchParams, selectedChat, setSearchParams, setSelectedChat, fetchMessages]);

  // Contact presence subscription
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-presence")
      .on("broadcast", { event: "presence" }, (payload) => {
        const { phone, presenceType, timestamp } = payload.payload as { phone: string; presenceType: string; timestamp: number };
        
        if (selectedChat && phone === selectedChat.phone.replace(/\D/g, "")) {
          if (presenceType === "composing" || presenceType === "recording") {
            setContactPresence({ phone, type: presenceType, timestamp });
          } else {
            setContactPresence(null);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChat?.phone]);

  // Auto-clear presence
  useEffect(() => {
    if (!contactPresence) return;
    const timeout = setTimeout(() => setContactPresence(null), 5000);
    return () => clearTimeout(timeout);
  }, [contactPresence?.timestamp]);

  // Fetch messages when chat selected
  useEffect(() => {
    if (selectedChat) {
      setMessages([]);
      fetchMessages(selectedChat.id, selectedChat.isGroup);
    }
  }, [selectedChat?.id, fetchMessages, setMessages]);

  // Audio from quick messages
  const handleSendAudioFromQuickMessage = async (audioBase64: string) => {
    const response = await fetch(audioBase64);
    const blob = await response.blob();
    await sendAudioMessage(blob, blob.type || "audio/webm");
  };

  const sessionApiKey = whatsappAccounts.find(acc => acc.id === selectedAccountId)?.api_key;

  return (
    <>
      <div className="h-full min-h-0 flex overflow-hidden bg-background relative">
        {/* Left Sidebar */}
        <ChatSidebar
          chats={chats}
          selectedChat={selectedChat}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectChat={(chat) => {
            setSelectedChat(chat);
            setReplyToMessage(null);
            setIsSending(false);
            setMessage("");
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

        {/* Right Panel - Chat Area */}
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col bg-muted/10 min-h-0 h-full">
            {selectedChat ? (
              <>
                <ChatHeader
                  selectedChat={selectedChat}
                  contactPresence={contactPresence}
                  showLeadPanel={showLeadPanel}
                  onToggleLeadPanel={() => setShowLeadPanel(!showLeadPanel)}
                  onOpenCallModal={() => setIsCallModalOpen(true)}
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
                  onEditMessage={(msg) => { setEditingMessage(msg); setEditText(msg.text); }}
                  onDeleteMessage={deleteMessage}
                  onScrollToQuoted={scrollToQuotedMessage}
                  onImageClick={(index) => setLightboxIndex(index)}
                  scrollToBottom={scrollToBottom}
                />

                <ChatInputArea
                  message={message}
                  onMessageChange={setMessage}
                  onSendMessage={sendMessage}
                  isSending={isSending || isSendingAudio}
                  isRecording={isRecording}
                  recordingTime={recordingTime}
                  recordingStream={recordingStream}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onCancelRecording={cancelRecording}
                  formatRecordingTime={formatRecordingTime}
                  onFileUpload={handleFileUpload}
                  onSendAudioFromQuickMessage={handleSendAudioFromQuickMessage}
                  sessionId={sessionApiKey}
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
                    setSelectedChat(existingChat);
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
    </>
  );
};

export default WhatsApp;
