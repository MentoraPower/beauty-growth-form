// WAHA WhatsApp Integration - v3 (with LID handling)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const wahaApiUrl = Deno.env.get("WAHA_API_URL")!;
const wahaApiKey = Deno.env.get("WAHA_API_KEY") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Check if a string looks like a WhatsApp LID (internal ID) instead of a real phone
const isWhatsAppLid = (phone: string): boolean => {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, "");
  // LIDs are typically very long (15+ digits)
  if (cleaned.length > 14) return true;
  // LIDs often start with specific patterns
  if (/^(120|146|180|203|234|447)\d{10,}$/.test(cleaned)) return true;
  return false;
};

const extractPhoneFromLidResponse = (data: any): string | null => {
  if (!data) return null;
  const candidates = [
    data.phoneNumber,
    data.phone_number,
    data.pn,
    data.number,
    typeof data.chatId === "string" ? data.chatId.split("@")[0] : null,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const cleaned = String(candidate).replace(/\D/g, "");
    if (cleaned && !isWhatsAppLid(cleaned)) return cleaned;
  }
  return null;
};

const resolveLidToPhone = async (
  lid: string,
  session: string,
  headers: Record<string, string>
): Promise<string | null> => {
  try {
    const cleaned = lid.replace(/\D/g, "");
    if (!cleaned) return null;

    const res = await fetch(`${wahaApiUrl}/api/${session}/lids/${cleaned}`, {
      method: "GET",
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      console.log("WAHA lid resolve failed:", cleaned, data?.message || "unknown");
      return null;
    }

    const phone = extractPhoneFromLidResponse(data);
    if (phone) return phone;

    // Fallback: some engines may return plain string
    if (typeof data === "string") {
      const s = data.replace(/\D/g, "");
      if (s && !isWhatsAppLid(s)) return s;
    }

    return null;
  } catch (e) {
    console.log("WAHA lid resolve error:", e);
    return null;
  }
};

interface RequestBody {
  action: "send-text" | "send-image" | "send-file" | "send-voice" | "get-chats" | "get-chat-messages" | "sync-all" | "clear-all";
  phone?: string;
  message?: string;
  chatId?: string;
  session?: string;
  mediaUrl?: string;
  filename?: string;
  caption?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { action, phone, message, chatId, session = "default", mediaUrl, filename, caption } = body;

    console.log("WAHA request:", action, { phone, chatId, session });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (wahaApiKey) {
      headers["X-Api-Key"] = wahaApiKey;
    }

    // SEND TEXT MESSAGE
    if (action === "send-text") {
      if (!phone || !message) {
        return new Response(
          JSON.stringify({ error: "Phone and message are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const formattedPhone = phone.replace(/\D/g, "");
      const chatIdFormatted = `${formattedPhone}@c.us`;

      console.log("Sending text message to:", chatIdFormatted);

      const response = await fetch(`${wahaApiUrl}/api/sendText`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          session,
          chatId: chatIdFormatted,
          text: message,
        }),
      });

      const data = await response.json();
      console.log("WAHA send response:", data);

      if (!response.ok) {
        throw new Error(data.message || data.exception?.message || "Failed to send message");
      }

      return new Response(
        JSON.stringify({ success: true, messageId: data.id || data.key?.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SEND IMAGE
    if (action === "send-image") {
      if (!phone || !mediaUrl) {
        return new Response(
          JSON.stringify({ error: "Phone and mediaUrl are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const formattedPhone = phone.replace(/\D/g, "");
      const chatIdFormatted = `${formattedPhone}@c.us`;

      const response = await fetch(`${wahaApiUrl}/api/sendImage`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          session,
          chatId: chatIdFormatted,
          file: { url: mediaUrl },
          caption: caption || "",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.exception?.message || "Failed to send image");
      }

      return new Response(
        JSON.stringify({ success: true, messageId: data.id || data.key?.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SEND FILE/DOCUMENT
    if (action === "send-file") {
      if (!phone || !mediaUrl) {
        return new Response(
          JSON.stringify({ error: "Phone and mediaUrl are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const formattedPhone = phone.replace(/\D/g, "");
      const chatIdFormatted = `${formattedPhone}@c.us`;

      const response = await fetch(`${wahaApiUrl}/api/sendFile`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          session,
          chatId: chatIdFormatted,
          file: { url: mediaUrl, filename: filename || "document" },
          caption: caption || "",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.exception?.message || "Failed to send file");
      }

      return new Response(
        JSON.stringify({ success: true, messageId: data.id || data.key?.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SEND VOICE MESSAGE
    if (action === "send-voice") {
      if (!phone || !mediaUrl) {
        return new Response(
          JSON.stringify({ error: "Phone and mediaUrl are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const formattedPhone = phone.replace(/\D/g, "");
      const chatIdFormatted = `${formattedPhone}@c.us`;

      const response = await fetch(`${wahaApiUrl}/api/sendVoice`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          session,
          chatId: chatIdFormatted,
          file: { url: mediaUrl },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.exception?.message || "Failed to send voice");
      }

      return new Response(
        JSON.stringify({ success: true, messageId: data.id || data.key?.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET CHATS - Use overview endpoint
    if (action === "get-chats") {
      console.log("Fetching chats overview from WAHA...");

      const response = await fetch(
        `${wahaApiUrl}/api/${session}/chats/overview?limit=100&offset=0`,
        { method: "GET", headers }
      );

      const data = await response.json();
      console.log("WAHA chats overview response:", JSON.stringify(data).substring(0, 500));

      if (!response.ok) {
        throw new Error(data.message || "Failed to get chats");
      }

      // Format chats - only filter out channels and groups
      const formattedChats = (data || [])
        .filter((chat: any) => {
          const chatId = chat.id || "";
          // Only skip clear non-contacts
          if (chatId.includes("@newsletter")) return false;
          if (chatId.includes("@g.us")) return false;
          if (chatId.includes("status@broadcast")) return false;
          if (!chatId || chatId === "0") return false;
          // Include chats with any lastMessage content
          return chat.lastMessage;
        })
        .map((chat: any) => {
          const chatIdStr = chat.id || "";
          // Clean phone number - remove @c.us, @s.whatsapp.net, @lid, etc.
          const phoneNumber = chatIdStr.split("@")[0];
          
          return {
            phone: phoneNumber,
            chatId: chatIdStr,
            name: chat.name || phoneNumber,
            photo: chat.picture || null,
            lastMessage: chat.lastMessage?.body || (chat.lastMessage?.hasMedia ? "[Mídia]" : ""),
            timestamp: chat.lastMessage?.timestamp || null,
            unreadCount: chat._chat?.unreadCount || 0,
          };
        });

      console.log("Formatted chats count:", formattedChats.length);

      return new Response(
        JSON.stringify(formattedChats),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET CHAT MESSAGES
    if (action === "get-chat-messages") {
      if (!chatId) {
        return new Response(
          JSON.stringify({ error: "ChatId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const formattedChatId = chatId.includes("@") ? chatId : `${chatId.replace(/\D/g, "")}@c.us`;

      console.log("Fetching messages for:", formattedChatId);

      const response = await fetch(
        `${wahaApiUrl}/api/${session}/chats/${encodeURIComponent(formattedChatId)}/messages?limit=100&downloadMedia=true`,
        { method: "GET", headers }
      );

      const data = await response.json();
      console.log("WAHA messages response count:", Array.isArray(data) ? data.length : 0);

      if (!response.ok) {
        throw new Error(data.message || "Failed to get messages");
      }

      const formattedMessages = (data || []).map((msg: any) => ({
        id: msg.id || msg.key?.id,
        text: msg.body || "",
        fromMe: msg.fromMe || false,
        timestamp: msg.timestamp,
        hasMedia: msg.hasMedia || false,
        mediaUrl: msg.media?.url || null,
        mediaType: msg.hasMedia ? (msg.media?.mimetype?.split("/")[0] || "file") : null,
        mimetype: msg.media?.mimetype || null,
        ack: msg.ack,
      }));

      return new Response(
        JSON.stringify(formattedMessages),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SYNC ALL - Fetch all chats and their messages, save to database
    if (action === "sync-all") {
      console.log("Starting full sync from WAHA...");
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get all chats using overview endpoint (pagination)
      const chatsData: any[] = [];
      const chatsLimit = 100;
      let chatsOffset = 0;

      while (true) {
        const chatsResponse = await fetch(
          `${wahaApiUrl}/api/${session}/chats/overview?limit=${chatsLimit}&offset=${chatsOffset}`,
          { method: "GET", headers }
        );

        const page = await chatsResponse.json();

        if (!chatsResponse.ok) {
          throw new Error(page?.message || "Failed to get chats for sync");
        }

        if (!Array.isArray(page) || page.length === 0) break;

        chatsData.push(...page);
        console.log(`WAHA chats overview page: offset=${chatsOffset} size=${page.length}`);

        if (page.length < chatsLimit) break;
        chatsOffset += chatsLimit;
        if (chatsOffset > 5000) break; // safety cap
      }

      console.log("WAHA chats overview for sync:", chatsData.length);
      console.log("First chat sample:", JSON.stringify(chatsData?.[0] || {}).substring(0, 300));

      let syncedChats = 0;
      let syncedMessages = 0;

      for (const chat of chatsData) {
        const chatIdStr = chat.id || "";
        
        // Only skip clear non-contacts
        if (chatIdStr.includes("@newsletter")) continue;
        if (chatIdStr.includes("@g.us")) continue;
        if (chatIdStr.includes("status@broadcast")) continue;
        if (!chatIdStr || chatIdStr === "0") continue;

        // Clean phone number - remove @c.us, @s.whatsapp.net, @lid, etc.
        const rawPhone = chatIdStr.split("@")[0];
        if (!rawPhone) continue;

        const looksLikeLid = chatIdStr.includes("@lid") || isWhatsAppLid(rawPhone);
        let phoneNumber = rawPhone;

        if (looksLikeLid) {
          const resolved = await resolveLidToPhone(rawPhone, session, headers);
          if (resolved) {
            console.log(`Resolved LID ${rawPhone} -> ${resolved}`);
            phoneNumber = resolved;
          }
        }

        // Try to preserve an existing good name/photo if we're processing a LID mapped to a real phone
        let existingName: string | null = null;
        let existingPhotoUrl: string | null = null;
        if (looksLikeLid && phoneNumber !== rawPhone) {
          const { data: existing } = await supabase
            .from("whatsapp_chats")
            .select("name, photo_url")
            .eq("phone", phoneNumber)
            .maybeSingle();

          existingName = existing?.name || null;
          existingPhotoUrl = existing?.photo_url || null;
        }

        const candidateName = chat.name ? String(chat.name).trim() : "";
        const candidateIsBad =
          !candidateName || /^\d+$/.test(candidateName) || candidateName === rawPhone || candidateName === phoneNumber;

        const existingIsGood =
          !!existingName && !/^\d+$/.test(existingName) && existingName !== phoneNumber;

        const displayName = !candidateIsBad
          ? candidateName
          : (existingIsGood ? (existingName as string) : phoneNumber);

        const photoUrl = chat.picture || existingPhotoUrl || null;

        // Get last message info
        const lastMessageBody = chat.lastMessage?.body || (chat.lastMessage?.hasMedia ? "[Mídia]" : "");
        
        // Convert timestamp to ISO string
        let lastMessageTime = new Date().toISOString();
        if (chat.lastMessage?.timestamp) {
          lastMessageTime = new Date(chat.lastMessage.timestamp * 1000).toISOString();
        }

        // Upsert chat
        const { data: chatData, error: chatError } = await supabase
          .from("whatsapp_chats")
          .upsert({
            phone: phoneNumber,
            name: displayName,
            photo_url: photoUrl,
            last_message: lastMessageBody || "Conversa iniciada",
            last_message_time: lastMessageTime,
            unread_count: chat._chat?.unreadCount || 0,
          }, { onConflict: "phone" })
          .select()
          .single();

        if (chatError) {
          console.error("Error upserting chat:", phoneNumber, chatError.message);
          continue;
        }

        syncedChats++;
        console.log(`Synced chat: ${phoneNumber} (${chat.name || 'no name'})`);

        // Fetch messages for this chat (pagination)
        try {
          const messagesLimit = 200;
          let messagesOffset = 0;

          while (true) {
            const messagesResponse = await fetch(
              `${wahaApiUrl}/api/${session}/chats/${encodeURIComponent(chatIdStr)}/messages?limit=${messagesLimit}&offset=${messagesOffset}&downloadMedia=true`,
              { method: "GET", headers }
            );

            if (!messagesResponse.ok) {
              const err = await messagesResponse.json().catch(() => ({}));
              console.error("Error fetching messages page:", chatIdStr, messagesOffset, err?.message || "unknown");
              break;
            }

            const messagesData = await messagesResponse.json();
            const pageSize = Array.isArray(messagesData) ? messagesData.length : 0;
            if (!pageSize) break;

            console.log(`Messages for ${phoneNumber}: offset=${messagesOffset} size=${pageSize}`);

            for (const msg of messagesData) {
              const messageId = msg.id || msg.key?.id;
              if (!messageId) continue;

              let status = "RECEIVED";
              if (msg.fromMe) {
                if (msg.ack === 3) status = "READ";
                else if (msg.ack === 2) status = "DELIVERED";
                else status = "SENT";
              }

              const { error: msgError } = await supabase
                .from("whatsapp_messages")
                .upsert({
                  chat_id: chatData.id,
                  message_id: messageId,
                  phone: phoneNumber,
                  text: msg.body || "",
                  from_me: msg.fromMe || false,
                  status: status,
                  media_url: msg.media?.url || null,
                  media_type: msg.hasMedia ? (msg.media?.mimetype?.split("/")[0] || "file") : null,
                  created_at: msg.timestamp ? new Date(msg.timestamp * 1000).toISOString() : new Date().toISOString(),
                }, { onConflict: "message_id" });

              if (!msgError) {
                syncedMessages++;
              }
            }

            if (pageSize < messagesLimit) break;
            messagesOffset += messagesLimit;
            if (messagesOffset > 2000) break; // safety cap per chat
          }
        } catch (msgError) {
          console.error("Error fetching messages for chat:", chatIdStr, msgError);
        }
      }

      console.log(`Sync complete: ${syncedChats} chats, ${syncedMessages} messages`);

      return new Response(
        JSON.stringify({ success: true, syncedChats, syncedMessages }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CLEAR ALL - Delete all chats and messages from database
    if (action === "clear-all") {
      console.log("Clearing all WhatsApp data from database...");
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Delete messages first (foreign key constraint)
      const { error: messagesError } = await supabase
        .from("whatsapp_messages")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (messagesError) {
        console.error("Error deleting messages:", messagesError);
        throw new Error("Failed to delete messages: " + messagesError.message);
      }

      // Delete chats
      const { error: chatsError } = await supabase
        .from("whatsapp_chats")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (chatsError) {
        console.error("Error deleting chats:", chatsError);
        throw new Error("Failed to delete chats: " + chatsError.message);
      }

      console.log("All WhatsApp data cleared successfully");

      return new Response(
        JSON.stringify({ success: true, message: "All chats and messages deleted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in waha-whatsapp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
