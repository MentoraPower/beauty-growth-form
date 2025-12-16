import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Check if phone is a WhatsApp LID (internal ID) - not a real phone number
// LIDs are internal WhatsApp identifiers, typically 20+ digits
const isWhatsAppLID = (phone: string): boolean => {
  const cleaned = String(phone || "").replace(/\D/g, "");
  // Only filter if it's clearly a LID (20+ digits)
  if (cleaned.length >= 20) return true;
  // Check for @lid suffix
  if (phone?.includes("@lid")) return true;
  return false;
};

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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const WAHA_API_URL = Deno.env.get("WAHA_API_URL");
    const WAHA_API_KEY = Deno.env.get("WAHA_API_KEY");

    if (!WAHA_API_URL) {
      throw new Error("WAHA_API_URL not configured");
    }

    const { action, phone, text } = await req.json();
    console.log(`[WAHA] Action: ${action}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const getHeaders = () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (WAHA_API_KEY) {
        headers["X-Api-Key"] = WAHA_API_KEY;
      }
      return headers;
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

    // Get mimetype from various locations in message object
    const getMimeType = (msg: any): string | null => {
      if (msg.media?.mimetype) return msg.media.mimetype;
      if (msg.mimetype) return msg.mimetype;
      if (msg._data?.mimetype) return msg._data.mimetype;
      if (msg.message?.imageMessage?.mimetype) return msg.message.imageMessage.mimetype;
      if (msg.message?.audioMessage?.mimetype) return msg.message.audioMessage.mimetype;
      if (msg.message?.videoMessage?.mimetype) return msg.message.videoMessage.mimetype;
      if (msg.message?.documentMessage?.mimetype) return msg.message.documentMessage.mimetype;
      if (msg.message?.stickerMessage?.mimetype) return msg.message.stickerMessage.mimetype;
      return null;
    };

    // Get media placeholder based on mimetype or type
    const getMediaPlaceholder = (msg: any): string => {
      const mimetype = getMimeType(msg);
      
      // Check mimetype first (most reliable)
      if (mimetype) {
        if (mimetype.startsWith('image/')) return "📷 Imagem";
        if (mimetype.startsWith('audio/')) return "🎵 Áudio";
        if (mimetype.startsWith('video/')) return "🎬 Vídeo";
        if (mimetype === 'application/pdf') return "📄 PDF";
        if (mimetype.startsWith('application/')) return "📄 Documento";
      }
      
      // Check type field
      const msgType = msg.type || msg._data?.type || "";
      if (msgType === "image" || msgType === "sticker") return "📷 Imagem";
      if (msgType === "audio" || msgType === "ptt" || msgType === "voice") return "🎵 Áudio";
      if (msgType === "video") return "🎬 Vídeo";
      if (msgType === "document" || msgType === "file") return "📄 Documento";
      if (msgType === "location") return "📍 Localização";
      if (msgType === "contact" || msgType === "vcard") return "👤 Contato";
      if (msgType === "sticker") return "🎨 Sticker";
      
      // Check for media presence
      if (msg.hasMedia || msg.mediaUrl || msg.media?.url) return "📎 Mídia";
      
      // Check for specific message types in WAHA format
      if (msg.message?.imageMessage) return "📷 Imagem";
      if (msg.message?.audioMessage) return "🎵 Áudio";
      if (msg.message?.videoMessage) return "🎬 Vídeo";
      if (msg.message?.documentMessage) {
        const filename = msg.message.documentMessage.fileName || msg.message.documentMessage.title;
        return filename ? `📄 ${filename}` : "📄 Documento";
      }
      if (msg.message?.stickerMessage) return "🎨 Sticker";
      if (msg.message?.locationMessage) return "📍 Localização";
      if (msg.message?.contactMessage || msg.message?.contactsArrayMessage) return "👤 Contato";
      
      return "";
    };

    // Extract message text from various WAHA response formats
    const extractMessageText = (msg: any): string => {
      if (!msg) return "";
      
      // Direct text fields (highest priority)
      if (msg.body && typeof msg.body === 'string' && msg.body.trim()) return msg.body.trim();
      if (msg.text && typeof msg.text === 'string' && msg.text.trim()) return msg.text.trim();
      if (msg.content && typeof msg.content === 'string' && msg.content.trim()) return msg.content.trim();
      if (msg.caption && typeof msg.caption === 'string' && msg.caption.trim()) return msg.caption.trim();
      
      // Nested message object (common in WAHA NOWEB engine)
      if (msg.message) {
        if (msg.message.conversation) return String(msg.message.conversation);
        if (msg.message.extendedTextMessage?.text) return String(msg.message.extendedTextMessage.text);
        // Media captions
        if (msg.message.imageMessage?.caption) return String(msg.message.imageMessage.caption);
        if (msg.message.videoMessage?.caption) return String(msg.message.videoMessage.caption);
        if (msg.message.documentMessage?.caption) return String(msg.message.documentMessage.caption);
        if (msg.message.documentMessage?.fileName) return `📄 ${msg.message.documentMessage.fileName}`;
        if (msg.message.documentMessage?.title) return `📄 ${msg.message.documentMessage.title}`;
        // Button responses
        if (msg.message.buttonsResponseMessage?.selectedDisplayText) return String(msg.message.buttonsResponseMessage.selectedDisplayText);
        if (msg.message.listResponseMessage?.title) return String(msg.message.listResponseMessage.title);
        if (msg.message.templateButtonReplyMessage?.selectedDisplayText) return String(msg.message.templateButtonReplyMessage.selectedDisplayText);
      }
      
      // _data object (WEBJS engine format)
      if (msg._data) {
        if (msg._data.body && typeof msg._data.body === 'string' && msg._data.body.trim()) return msg._data.body.trim();
        if (msg._data.caption && typeof msg._data.caption === 'string' && msg._data.caption.trim()) return msg._data.caption.trim();
      }
      
      // Check for media filename in various locations
      const filename = msg.media?.filename || msg.filename || msg._data?.filename || 
                       msg.message?.documentMessage?.fileName || msg.message?.documentMessage?.title;
      if (filename) return `📄 ${filename}`;
      
      // Return media placeholder if it's a media message
      const mediaPlaceholder = getMediaPlaceholder(msg);
      if (mediaPlaceholder) return mediaPlaceholder;
      
      // Log empty messages for debugging
      const msgId = msg.id || msg.key?.id || msg._id || 'unknown';
      const msgType = msg.type || msg._data?.type || 'unknown';
      console.log(`[WAHA Debug] Empty message id=${msgId} type=${msgType}, keys: ${Object.keys(msg).join(', ')}`);
      
      return "";
    };

    // Fetch ALL contacts and build lookup map
    const fetchAllContacts = async (): Promise<Map<string, { name: string | null; picture: string | null }>> => {
      const contactsMap = new Map<string, { name: string | null; picture: string | null }>();
      
      try {
        console.log("[WAHA] Fetching all contacts...");
        const response = await fetch(
          `${WAHA_API_URL}/api/contacts/all?session=default&limit=10000`,
          { method: "GET", headers: getHeaders() }
        );

        if (!response.ok) {
          console.log(`[WAHA] Failed to fetch contacts: ${response.status}`);
          return contactsMap;
        }

        const contacts = await response.json();
        console.log(`[WAHA] Fetched ${contacts?.length || 0} contacts`);

        if (Array.isArray(contacts)) {
          for (const contact of contacts) {
            const contactId = contact.id || contact.jid || "";
            const phoneDigits = contactId.replace(/\D/g, "").replace(/@.*/, "");
            
            if (isWhatsAppLID(phoneDigits) || phoneDigits.length < 8) continue;
            
            const name = normalizeName(
              contact.name || contact.pushname || contact.pushName || 
              contact.shortName || contact.formattedName || contact.notifyName,
              phoneDigits
            );
            
            contactsMap.set(phoneDigits, {
              name,
              picture: contact.profilePictureUrl || contact.picture || contact.imgUrl || null,
            });
          }
        }
        
        console.log(`[WAHA] Built contacts map with ${contactsMap.size} entries`);
      } catch (error: any) {
        console.error("[WAHA] Error fetching contacts:", error.message);
      }
      
      return contactsMap;
    };

    // Fetch chat picture using dedicated endpoint
    const fetchChatPicture = async (chatId: string): Promise<string | null> => {
      try {
        const response = await fetch(
          `${WAHA_API_URL}/api/default/chats/${encodeURIComponent(chatId)}/picture`,
          { method: "GET", headers: getHeaders() }
        );

        if (!response.ok) return null;

        const data = await response.json().catch(() => null);
        return data?.url || data?.profilePictureURL || data?.profilePictureUrl || null;
      } catch (e: any) {
        return null;
      }
    };

    // Fetch contact profile picture as fallback
    const fetchContactPicture = async (contactId: string): Promise<string | null> => {
      try {
        const response = await fetch(
          `${WAHA_API_URL}/api/contacts/profile-picture?contactId=${encodeURIComponent(contactId)}&session=default`,
          { method: "GET", headers: getHeaders() }
        );

        if (!response.ok) return null;

        const data = await response.json().catch(() => null);
        return data?.url || data?.profilePictureUrl || null;
      } catch (e: any) {
        return null;
      }
    };

    // Fetch contact info for name
    const fetchContactInfo = async (contactId: string): Promise<string | null> => {
      const phoneDigits = contactId.split("@")[0].replace(/\D/g, "");
      try {
        const response = await fetch(
          `${WAHA_API_URL}/api/contacts?contactId=${encodeURIComponent(contactId)}&session=default`,
          { method: "GET", headers: getHeaders() }
        );

        if (!response.ok) return null;

        const data = await response.json().catch(() => null);
        return normalizeName(data?.name, phoneDigits) ||
          normalizeName(data?.pushname, phoneDigits) ||
          normalizeName(data?.pushName, phoneDigits) ||
          normalizeName(data?.notifyName, phoneDigits) ||
          normalizeName(data?.shortName, phoneDigits) ||
          null;
      } catch (e: any) {
        return null;
      }
    };

    // Send text message
    if (action === "send-text") {
      if (!phone || !text) {
        throw new Error("Phone and text are required");
      }

      const formattedPhone = phone.replace(/\D/g, "");
      const chatIdFormatted = `${formattedPhone}@c.us`;

      const response = await fetch(`${WAHA_API_URL}/api/sendText`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          chatId: chatIdFormatted,
          text: text,
          session: "default",
        }),
      });

      const data = await response.json();
      console.log("[WAHA] Send response:", data);

      if (!response.ok) {
        throw new Error(data.message || "Failed to send message");
      }

      return new Response(JSON.stringify({ 
        success: true, 
        messageId: data.id || data.key?.id 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync all chats and messages with full contact resolution
    if (action === "sync-all") {
      console.log("[WAHA Sync] Starting full sync with contacts map...");
      
      let syncedChats = 0;
      let syncedMessages = 0;
      let skippedChats = 0;

      // STEP 1: Fetch all contacts first to build lookup map
      const contactsMap = await fetchAllContacts();

      // STEP 2: Fetch ALL chats with pagination
      const allChats: any[] = [];
      let chatsOffset = 0;
      const chatsLimit = 100;
      let hasMoreChats = true;

      while (hasMoreChats) {
        console.log(`[WAHA Sync] Fetching chats with offset ${chatsOffset}...`);
        
        const chatsResponse = await fetch(
          `${WAHA_API_URL}/api/default/chats/overview?limit=${chatsLimit}&offset=${chatsOffset}`,
          { method: "GET", headers: getHeaders() }
        );

        if (!chatsResponse.ok) {
          console.error(`[WAHA Sync] Chats fetch failed: ${chatsResponse.status}`);
          break;
        }

        const chatsData = await chatsResponse.json();
        const chats = Array.isArray(chatsData) ? chatsData : [];
        
        console.log(`[WAHA Sync] Received ${chats.length} chats at offset ${chatsOffset}`);
        
        if (chats.length === 0) {
          hasMoreChats = false;
        } else {
          allChats.push(...chats);
          chatsOffset += chatsLimit;
          
          if (chats.length < chatsLimit) {
            hasMoreChats = false;
          }
        }
      }

      console.log(`[WAHA Sync] Total chats fetched: ${allChats.length}`);

      // STEP 3: Process each chat with name/photo resolution
      const processedPhones = new Set<string>();

      for (const chat of allChats) {
        const chatId = chat.id || chat.chatId || "";
        
        // Skip ONLY groups, channels, and status broadcasts
        if (chatId.includes("@g.us")) {
          console.log(`[WAHA Sync] Skipping group: ${chatId}`);
          skippedChats++;
          continue;
        }
        if (chatId.includes("@newsletter")) {
          console.log(`[WAHA Sync] Skipping newsletter: ${chatId}`);
          skippedChats++;
          continue;
        }
        if (chatId.includes("status@broadcast")) {
          console.log(`[WAHA Sync] Skipping status: ${chatId}`);
          skippedChats++;
          continue;
        }

        // Extract phone number
        const phone = chatId.split("@")[0].replace(/\D/g, "");
        if (!phone || phone === "0" || phone.length < 8) {
          console.log(`[WAHA Sync] Skipping invalid phone: ${chatId}`);
          skippedChats++;
          continue;
        }

        // Skip only true LIDs (20+ digits)
        if (isWhatsAppLID(phone)) {
          console.log(`[WAHA Sync] Skipping LID: ${phone}`);
          skippedChats++;
          continue;
        }

        // Skip duplicates
        if (processedPhones.has(phone)) {
          continue;
        }
        processedPhones.add(phone);

        // RESOLVE NAME with priority chain
        let chatName: string | null = null;
        
        // 1. Try name from chat overview
        chatName = normalizeName(
          chat.name || chat.pushName || chat.pushname || chat.notifyName,
          phone
        );
        
        // 2. Try contacts map
        if (!chatName && contactsMap.has(phone)) {
          chatName = contactsMap.get(phone)?.name || null;
        }
        
        // 3. Try fetching contact info
        if (!chatName) {
          chatName = await fetchContactInfo(chatId);
        }
        
        // 4. Fallback to formatted phone display
        if (!chatName) {
          chatName = formatPhoneDisplay(phone);
        }

        // RESOLVE PHOTO with priority chain
        let photoUrl: string | null = null;
        
        // 1. Try picture from chat overview
        photoUrl = chat.picture || chat.profilePicUrl || chat.profilePictureURL || 
                   chat.profilePictureUrl || chat.imgUrl || null;
        
        // 2. Try contacts map
        if (!photoUrl && contactsMap.has(phone)) {
          photoUrl = contactsMap.get(phone)?.picture || null;
        }
        
        // 3. Try fetching chat picture
        if (!photoUrl) {
          photoUrl = await fetchChatPicture(chatId);
        }
        
        // 4. Try fetching contact picture
        if (!photoUrl) {
          photoUrl = await fetchContactPicture(chatId);
        }

        // Get last message info from overview - improved extraction
        const lastMsgObj = chat.lastMessage || chat.last_message || chat._lastMessage || {};
        const lastMessage = extractMessageText(lastMsgObj);
        
        // Get timestamp
        const lastMessageTimestamp = lastMsgObj?.timestamp || lastMsgObj?.t || 
                                     lastMsgObj?.messageTimestamp || chat.conversationTimestamp ||
                                     chat.timestamp || chat.t;
        const lastMessageTime = lastMessageTimestamp 
          ? new Date(typeof lastMessageTimestamp === 'number' && lastMessageTimestamp < 10000000000 
              ? lastMessageTimestamp * 1000 : lastMessageTimestamp).toISOString()
          : new Date().toISOString();

        console.log(`[WAHA Sync] Chat: ${phone}, Name: ${chatName}, Photo: ${photoUrl ? 'Yes' : 'No'}, LastMsg: "${lastMessage.substring(0, 30)}..."`);

        // Upsert chat
        const { data: chatData, error: chatError } = await supabase
          .from("whatsapp_chats")
          .upsert({
            phone,
            name: chatName,
            last_message: lastMessage,
            last_message_time: lastMessageTime,
            photo_url: photoUrl,
            unread_count: chat.unreadCount || 0,
          }, { onConflict: "phone", ignoreDuplicates: false })
          .select()
          .single();

        if (chatError) {
          console.error("[WAHA Sync] Chat upsert error:", chatError);
          continue;
        }

        syncedChats++;

        // STEP 4: Fetch messages with pagination
        try {
          let msgOffset = 0;
          const msgLimit = 100;
          let hasMoreMessages = true;

          while (hasMoreMessages) {
            const messagesResponse = await fetch(
              `${WAHA_API_URL}/api/default/chats/${encodeURIComponent(chatId)}/messages?limit=${msgLimit}&offset=${msgOffset}&downloadMedia=false`,
              { method: "GET", headers: getHeaders() }
            );

            if (!messagesResponse.ok) break;

            const messagesData = await messagesResponse.json();
            const messages = Array.isArray(messagesData) ? messagesData : [];
            
            if (msgOffset === 0) {
              console.log(`[WAHA Sync] Found ${messages.length} messages for ${phone}`);
            }

            if (messages.length === 0) {
              hasMoreMessages = false;
              break;
            }

            for (const msg of messages) {
              const messageId = msg.id || msg.key?.id || msg._id;
              if (!messageId) continue;

              const msgText = extractMessageText(msg);
              const msgFromMe = msg.fromMe ?? msg.key?.fromMe ?? false;
              const msgTimestamp = msg.timestamp || msg.messageTimestamp || msg.t;
              const createdAt = msgTimestamp 
                ? new Date(typeof msgTimestamp === 'number' && msgTimestamp < 10000000000 
                    ? msgTimestamp * 1000 : msgTimestamp).toISOString() 
                : new Date().toISOString();

              let status = "SENT";
              if (msg.ack === 3 || msg.ack === "read") status = "READ";
              else if (msg.ack === 2 || msg.ack === "received") status = "DELIVERED";
              else if (!msgFromMe) status = "RECEIVED";

              const hasMedia = msg.hasMedia || msg.mediaUrl || msg.message?.imageMessage || msg.message?.audioMessage;
              const mediaUrl = msg.mediaUrl || msg.media?.url || null;
              let mediaType = null;
              if (hasMedia) {
                if (msg.message?.imageMessage || msg.type === "image") mediaType = "image";
                else if (msg.message?.audioMessage || msg.type === "audio" || msg.type === "ptt") mediaType = "audio";
                else if (msg.message?.videoMessage || msg.type === "video") mediaType = "video";
                else mediaType = msg.type || "file";
              }

              const { error: msgError } = await supabase
                .from("whatsapp_messages")
                .upsert({
                  chat_id: chatData.id,
                  message_id: messageId,
                  phone,
                  text: msgText,
                  from_me: msgFromMe,
                  status,
                  media_url: mediaUrl,
                  media_type: mediaType,
                  created_at: createdAt,
                }, { onConflict: "message_id" });

              if (!msgError) syncedMessages++;
            }

            // If we got less than limit, no more messages
            if (messages.length < msgLimit) {
              hasMoreMessages = false;
            } else {
              msgOffset += msgLimit;
            }
          }
        } catch (msgErr: any) {
          console.error(`[WAHA Sync] Error fetching messages for ${phone}:`, msgErr.message);
        }
      }

      // STEP 5: Clean up only true LID chats from database
      const { data: existingChats } = await supabase.from("whatsapp_chats").select("id, phone");
      if (existingChats) {
        const lidChatIds = existingChats
          .filter((c: any) => isWhatsAppLID(c.phone))
          .map((c: any) => c.id);
        
        if (lidChatIds.length > 0) {
          await supabase.from("whatsapp_messages").delete().in("chat_id", lidChatIds);
          await supabase.from("whatsapp_chats").delete().in("id", lidChatIds);
          console.log(`[WAHA Sync] Cleaned up ${lidChatIds.length} LID chats`);
        }
      }

      console.log(`[WAHA Sync] Completed. Chats: ${syncedChats}, Messages: ${syncedMessages}, Skipped: ${skippedChats}`);

      return new Response(JSON.stringify({ 
        success: true, 
        syncedChats, 
        syncedMessages,
        skippedChats,
        totalContactsInMap: contactsMap.size,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[WAHA] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
