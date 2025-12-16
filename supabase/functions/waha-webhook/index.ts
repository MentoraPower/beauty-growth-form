import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Format phone number for display when no name available
const formatPhoneDisplay = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 5)} ${digits.slice(5, 9)}-${digits.slice(9)}`;
  } else if (digits.length === 12 && digits.startsWith('55')) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
  } else if (digits.length >= 10) {
    return `+${digits}`;
  }
  return phone;
};

// Normalize name - return null if it's just a phone number
const normalizeName = (value: any, phoneDigits: string): string | null => {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name) return null;
  const nameNoSpaces = name.replace(/\s+/g, "");
  if (/^\d+$/.test(nameNoSpaces)) return null;
  if (nameNoSpaces === phoneDigits) return null;
  if (nameNoSpaces === `${phoneDigits}@c.us`) return null;
  if (/^[\d\s\-\+\(\)]+$/.test(name) && name.replace(/\D/g, '').length >= 8) return null;
  return name;
};

// Get media placeholder based on message type
const getMediaPlaceholder = (payload: any): string => {
  const mediaType = payload.body?.media?.mimetype || payload.media?.mimetype || "";
  
  if (mediaType.startsWith('image/')) return "📷 Imagem";
  if (mediaType.startsWith('audio/')) return "🎵 Áudio";
  if (mediaType.startsWith('video/')) return "🎬 Vídeo";
  if (mediaType === 'application/pdf') return "📄 PDF";
  if (mediaType.startsWith('application/')) return "📄 Documento";
  
  // Check hasMedia flag
  if (payload.body?.hasMedia || payload.hasMedia) {
    return "📎 Mídia";
  }
  
  return "";
};

// Extract message text from webhook payload
const extractMessageText = (payload: any): string => {
  const body = payload.body || payload;
  
  // Direct text fields
  if (body.body && typeof body.body === 'string' && body.body.trim()) return body.body.trim();
  if (body.text && typeof body.text === 'string' && body.text.trim()) return body.text.trim();
  if (body.content && typeof body.content === 'string' && body.content.trim()) return body.content.trim();
  if (body.caption && typeof body.caption === 'string' && body.caption.trim()) return body.caption.trim();
  
  // Nested message object
  if (body.message) {
    if (body.message.conversation) return String(body.message.conversation);
    if (body.message.extendedTextMessage?.text) return String(body.message.extendedTextMessage.text);
    if (body.message.imageMessage?.caption) return String(body.message.imageMessage.caption);
    if (body.message.videoMessage?.caption) return String(body.message.videoMessage.caption);
    if (body.message.documentMessage?.caption) return String(body.message.documentMessage.caption);
    if (body.message.documentMessage?.fileName) return `📄 ${body.message.documentMessage.fileName}`;
  }
  
  // _data object
  if (body._data) {
    if (body._data.body && typeof body._data.body === 'string') return body._data.body.trim();
    if (body._data.caption && typeof body._data.caption === 'string') return body._data.caption.trim();
  }
  
  // Media placeholder
  const mediaPlaceholder = getMediaPlaceholder(payload);
  if (mediaPlaceholder) return mediaPlaceholder;
  
  return "";
};

// Check if phone is a WhatsApp LID
const isWhatsAppLID = (phone: string): boolean => {
  const cleaned = String(phone || "").replace(/\D/g, "");
  if (cleaned.length >= 20) return true;
  if (phone?.includes("@lid")) return true;
  return false;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const event = payload.event || payload.type || "unknown";
    
    console.log(`[WAHA Webhook] Received event: ${event}`);
    
    // Skip non-message events
    const messageEvents = [
      "message", 
      "message.any", 
      "message.received", 
      "message.sent",
      "message.ack",
      "message.reaction"
    ];
    
    if (!messageEvents.includes(event)) {
      console.log(`[WAHA Webhook] Skipping event: ${event}`);
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Extract message data from payload
    const messageData = payload.body || payload.payload || payload;
    
    // Get chat ID and extract phone number
    const chatId = messageData.from || messageData.chatId || messageData.chat?.id || "";
    const rawPhone = chatId.split("@")[0];
    const phone = rawPhone.replace(/\D/g, "");
    
    // Skip invalid phones and LIDs
    if (!phone || phone.length < 8 || isWhatsAppLID(chatId)) {
      console.log(`[WAHA Webhook] Skipping invalid phone: ${phone}`);
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Skip group chats
    if (chatId.includes("@g.us") || chatId.includes("@broadcast")) {
      console.log(`[WAHA Webhook] Skipping group chat: ${chatId}`);
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Extract message details
    const messageId = messageData.id?.id || messageData.id || messageData.key?.id || "";
    const fromMe = messageData.fromMe ?? messageData.from_me ?? messageData.key?.fromMe ?? false;
    const timestamp = messageData.timestamp 
      ? new Date(messageData.timestamp * 1000).toISOString() 
      : new Date().toISOString();
    
    const messageText = extractMessageText(payload);
    
    // Get contact name
    const contactName = normalizeName(
      messageData.notifyName || 
      messageData._data?.notifyName || 
      messageData.pushName || 
      messageData.senderName ||
      messageData.contact?.name,
      phone
    );
    
    // Get profile picture
    const profilePicture = messageData.profilePicUrl || 
      messageData._data?.profilePicThumbObj?.img || 
      messageData.contact?.profilePictureUrl ||
      null;
    
    console.log(`[WAHA Webhook] Processing message from ${phone}: "${messageText.substring(0, 50)}..."`);
    
    // Upsert chat
    const { data: existingChat } = await supabase
      .from("whatsapp_chats")
      .select("id, name, photo_url")
      .eq("phone", phone)
      .maybeSingle();
    
    const chatUpsertData: any = {
      phone,
      last_message: messageText || null,
      last_message_time: timestamp,
      updated_at: new Date().toISOString(),
    };
    
    // Only update name if we have a new one and current is empty/phone-like
    if (contactName) {
      if (!existingChat?.name || existingChat.name === formatPhoneDisplay(phone)) {
        chatUpsertData.name = contactName;
      }
    } else if (!existingChat?.name) {
      chatUpsertData.name = formatPhoneDisplay(phone);
    }
    
    // Update photo if we have one
    if (profilePicture && !existingChat?.photo_url) {
      chatUpsertData.photo_url = profilePicture;
    }
    
    // Increment unread count for incoming messages
    if (!fromMe) {
      const currentUnread = existingChat ? 0 : 0; // Will be handled by trigger or manual query
      chatUpsertData.unread_count = (currentUnread || 0) + 1;
    }
    
    const { data: chatData, error: chatError } = await supabase
      .from("whatsapp_chats")
      .upsert(chatUpsertData, { 
        onConflict: "phone",
        ignoreDuplicates: false 
      })
      .select("id")
      .single();
    
    if (chatError) {
      console.error("[WAHA Webhook] Chat upsert error:", chatError);
      throw chatError;
    }
    
    const chatDbId = chatData.id;
    
    // Insert message (skip if no messageId to avoid duplicates)
    if (messageId && messageText) {
      const { error: msgError } = await supabase
        .from("whatsapp_messages")
        .upsert({
          chat_id: chatDbId,
          phone,
          message_id: messageId,
          text: messageText,
          from_me: fromMe,
          status: fromMe ? "sent" : "received",
          created_at: timestamp,
          media_type: messageData.hasMedia ? (messageData.type || "media") : null,
          media_url: messageData.media?.url || messageData.mediaUrl || null,
        }, {
          onConflict: "message_id",
          ignoreDuplicates: true
        });
      
      if (msgError) {
        console.error("[WAHA Webhook] Message insert error:", msgError);
      } else {
        console.log(`[WAHA Webhook] Message saved: ${messageId}`);
      }
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error: any) {
    console.error("[WAHA Webhook] Error:", error.message);
    
    // Always return 200 to prevent WAHA from retrying
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
