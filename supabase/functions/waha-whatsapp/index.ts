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
const isWhatsAppLID = (phone: string): boolean => {
  const cleaned = String(phone || "").replace(/\D/g, "");
  return cleaned.length > 14;
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
      return name;
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
        console.log(`[WAHA] Chat picture error for ${chatId}:`, e.message);
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
        console.log(`[WAHA] Contact info error:`, e.message);
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

    // Sync all chats and messages using /chats/overview API
    if (action === "sync-all") {
      console.log("[WAHA Sync] Starting sync with /chats/overview");
      
      let syncedChats = 0;
      let syncedMessages = 0;

      // Use /chats/overview to get chats with picture directly
      const chatsResponse = await fetch(
        `${WAHA_API_URL}/api/default/chats/overview?limit=100&offset=0`,
        { method: "GET", headers: getHeaders() }
      );

      if (!chatsResponse.ok) {
        const errorText = await chatsResponse.text();
        console.error("[WAHA Sync] Chats overview error:", errorText);
        throw new Error(`Failed to fetch chats: ${chatsResponse.status}`);
      }

      const chatsData = await chatsResponse.json();
      console.log(`[WAHA Sync] Found ${chatsData?.length || 0} chats from overview`);

      const chats = Array.isArray(chatsData) ? chatsData : [];

      for (const chat of chats) {
        const chatId = chat.id || chat.chatId || "";
        
        // Skip groups, channels, status broadcasts
        if (chatId.includes("@g.us") || chatId.includes("@newsletter") || chatId.includes("status@broadcast")) {
          continue;
        }

        // Skip LID chats
        if (chatId.includes("@lid")) {
          console.log(`[WAHA Sync] Skipping LID: ${chatId}`);
          continue;
        }

        // Extract phone number
        const phone = chatId.split("@")[0].replace(/\D/g, "");
        if (!phone || phone === "0") continue;

        // Skip if it's a LID-style phone number
        if (isWhatsAppLID(phone)) {
          console.log(`[WAHA Sync] Skipping LID phone: ${phone}`);
          continue;
        }

        // Get name from overview response
        const chatNameRaw = chat.name || chat.pushName || chat.pushname || chat.notifyName || null;
        let chatName = normalizeName(chatNameRaw, phone);

        // Get picture directly from overview response (this is the key improvement!)
        let photoUrl = chat.picture || chat.profilePicUrl || chat.profilePictureURL || 
                       chat.profilePictureUrl || chat.imgUrl || null;

        // If name is missing, try contact endpoint
        if (!chatName) {
          chatName = await fetchContactInfo(chatId);
        }

        // If photo is missing from overview, use dedicated /chats/{chatId}/picture endpoint
        if (!photoUrl) {
          console.log(`[WAHA Sync] Fetching picture for ${phone} via dedicated endpoint`);
          photoUrl = await fetchChatPicture(chatId);
        }

        // Get last message info from overview
        const lastMessage = chat.lastMessage?.body || chat.lastMessage?.text || 
                           chat.lastMessage?.caption || chat.lastMessage?.content || "";
        const lastMessageTimestamp = chat.lastMessage?.timestamp || chat.lastMessage?.t || chat.timestamp;
        const lastMessageTime = lastMessageTimestamp 
          ? new Date(typeof lastMessageTimestamp === 'number' && lastMessageTimestamp < 10000000000 
              ? lastMessageTimestamp * 1000 : lastMessageTimestamp).toISOString()
          : new Date().toISOString();

        console.log(`[WAHA Sync] Chat: ${phone}, Name: ${chatName || 'null'}, Photo: ${photoUrl ? 'Yes' : 'No'}`);

        // Upsert chat
        const { data: chatData, error: chatError } = await supabase
          .from("whatsapp_chats")
          .upsert({
            phone,
            name: chatName,
            last_message: lastMessage,
            last_message_time: lastMessageTime,
            photo_url: photoUrl,
          }, { onConflict: "phone", ignoreDuplicates: false })
          .select()
          .single();

        if (chatError) {
          console.error("[WAHA Sync] Chat upsert error:", chatError);
          continue;
        }

        syncedChats++;

        // Fetch messages with pagination
        try {
          let offset = 0;
          const limit = 100;
          let hasMore = true;

          while (hasMore) {
            const messagesResponse = await fetch(
              `${WAHA_API_URL}/api/default/chats/${encodeURIComponent(chatId)}/messages?limit=${limit}&offset=${offset}&downloadMedia=false`,
              { method: "GET", headers: getHeaders() }
            );

            if (!messagesResponse.ok) break;

            const messagesData = await messagesResponse.json();
            const messages = Array.isArray(messagesData) ? messagesData : [];
            
            if (offset === 0) {
              console.log(`[WAHA Sync] Found ${messages.length} messages for ${phone}`);
            }

            if (messages.length === 0) {
              hasMore = false;
              break;
            }

            for (const msg of messages) {
              const messageId = msg.id || msg.key?.id || msg._id;
              if (!messageId) continue;

              const msgText = msg.body || msg.text || msg.content || 
                             msg.message?.conversation || 
                             msg.message?.extendedTextMessage?.text ||
                             msg.message?.imageMessage?.caption ||
                             msg.message?.videoMessage?.caption || "";
              
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
            if (messages.length < limit) {
              hasMore = false;
            } else {
              offset += limit;
            }
          }
        } catch (msgErr: any) {
          console.error(`[WAHA Sync] Error fetching messages for ${phone}:`, msgErr.message);
        }
      }

      // Clean up LID chats from database
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

      console.log(`[WAHA Sync] Completed. Chats: ${syncedChats}, Messages: ${syncedMessages}`);

      return new Response(JSON.stringify({ 
        success: true, 
        syncedChats, 
        syncedMessages 
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
