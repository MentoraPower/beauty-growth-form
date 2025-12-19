import { useState, useEffect, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Smile, Paperclip, Mic, Send, Check, CheckCheck, X, Image, File, Video, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmojiPicker } from "@/components/whatsapp/EmojiPicker";
import { AudioWaveform } from "@/components/whatsapp/AudioWaveform";
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

interface WhatsAppChatDropdownProps {
  phone: string;
  countryCode: string;
  contactName: string;
}

const DEFAULT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMTIgMjEyIj48cGF0aCBmaWxsPSIjREZFNUU3IiBkPSJNMCAwaDIxMnYyMTJIMHoiLz48cGF0aCBmaWxsPSIjRkZGIiBkPSJNMTA2IDEwNmMtMjUuNCAwLTQ2LTIwLjYtNDYtNDZzMjAuNi00NiA0Ni00NiA0NiAyMC42IDQ2IDQ2LTIwLjYgNDYtNDYgNDZ6bTAgMTNjMzAuNiAwIDkyIDE1LjQgOTIgNDZ2MjNIMTR2LTIzYzAtMzAuNiA2MS40LTQ2IDkyLTQ2eiIvPjwvc3ZnPg==";

export function WhatsAppChatDropdown({ phone, countryCode, contactName }: WhatsAppChatDropdownProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [chatData, setChatData] = useState<{ id: string; photo_url: string | null } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const { data: existingChat } = await supabase
        .from("whatsapp_chats")
        .select("id, photo_url, last_message_time")
        .in("phone", candidates)
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
  }, [formattedPhone, phone, countryCode]);

  useEffect(() => {
    if (isOpen) {
      fetchChatData();
    }
  }, [isOpen, fetchChatData]);

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
        },
      });

      if (error) throw error;

      const messageId = data?.messageId || `local-${Date.now()}`;
      const whatsappKeyId = data?.whatsappKeyId || null;

      // Get or create chat
      let chatId = chatData?.id;
      if (!chatId) {
        const { data: newChat } = await supabase
          .from("whatsapp_chats")
          .upsert({
            phone: formattedPhone,
            name: contactName,
            last_message: messageText,
            last_message_time: new Date().toISOString(),
            last_message_status: "SENT",
            last_message_from_me: true,
          }, { onConflict: "phone" })
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
        className="p-1 rounded-full hover:bg-green-100 transition-colors"
        title="Abrir WhatsApp"
      >
        <WhatsAppIcon className="h-4 w-4 text-green-600" />
      </button>

      {/* Fixed dropdown in bottom right corner */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[650px] bg-background border rounded-lg shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-3 p-3 border-b bg-muted/30">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center overflow-hidden">
              {chatData?.photo_url ? (
                <img src={chatData.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <img src={DEFAULT_AVATAR} alt="" className="h-full w-full" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{contactName}</p>
              <p className="text-xs text-muted-foreground">{countryCode} {phone}</p>
            </div>
          </div>

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
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  ref={emojiButtonRef}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <Smile className="h-5 w-5 text-muted-foreground" />
                </button>
                {showEmojiPicker && (
                  <div ref={emojiPickerRef} className="absolute bottom-12 left-0 z-50">
                    <EmojiPicker onSelect={(emoji) => {
                      setMessage(prev => prev + emoji);
                      setShowEmojiPicker(false);
                    }} />
                  </div>
                )}
              </div>
              
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite uma mensagem"
                className="flex-1 bg-white dark:bg-zinc-800 border-0 focus-visible:ring-0 text-sm"
                disabled={isSending}
              />
              
              <button
                onClick={sendMessage}
                disabled={!message.trim() || isSending}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  message.trim() 
                    ? "bg-green-500 text-white hover:bg-green-600" 
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        </div>
      )}
    </>
  );
}
