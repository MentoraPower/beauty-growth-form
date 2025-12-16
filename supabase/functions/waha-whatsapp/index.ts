import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const { action, phone, text, chatId } = await req.json();
    console.log(`[WAHA] Action: ${action}`, { phone, chatId });

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

    // Test connection
    if (action === "test-connection") {
      try {
        const response = await fetch(`${WAHA_API_URL}/api/sessions`, {
          method: "GET",
          headers: getHeaders(),
        });
        const data = await response.json();
        console.log("[WAHA] Sessions:", data);
        
        return new Response(JSON.stringify({ 
          success: response.ok, 
          sessions: data,
          apiUrl: WAHA_API_URL 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: e.message,
          apiUrl: WAHA_API_URL 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Send text message
    if (action === "send-text") {
      if (!phone || !text) {
        throw new Error("Phone and text are required");
      }

      // Format phone for WAHA (needs @c.us suffix)
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

    // Sync all chats and messages
    if (action === "sync-all") {
      console.log("[WAHA Sync] Starting sync");
      
      let syncedChats = 0;
      let syncedMessages = 0;

      // Get all chats
      const chatsResponse = await fetch(`${WAHA_API_URL}/api/default/chats`, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!chatsResponse.ok) {
        const errorText = await chatsResponse.text();
        console.error("[WAHA Sync] Chats error:", errorText);
        throw new Error(`Failed to fetch chats: ${chatsResponse.status}`);
      }

      const chatsData = await chatsResponse.json();
      console.log(`[WAHA Sync] Found ${chatsData?.length || 0} chats`);

      const chats = Array.isArray(chatsData) ? chatsData : [];

      for (const chat of chats) {
        const chatId = chat.id || chat.chatId || "";
        
        // Skip groups and channels
        if (chatId.includes("@g.us") || chatId.includes("@newsletter") || chatId.includes("status@broadcast")) {
          continue;
        }

        const phone = chatId.split("@")[0].replace(/\D/g, "");
        if (!phone) continue;

        const chatName = chat.name || chat.pushName || chat.notifyName || phone;
        const lastMessage = chat.lastMessage?.body || chat.lastMessage?.text || "";
        const lastMessageTime = chat.lastMessage?.timestamp 
          ? new Date(chat.lastMessage.timestamp * 1000).toISOString()
          : new Date().toISOString();

        // Upsert chat
        const { data: chatData, error: chatError } = await supabase
          .from("whatsapp_chats")
          .upsert({
            phone,
            name: chatName !== phone ? chatName : null,
            last_message: lastMessage,
            last_message_time: lastMessageTime,
            photo_url: chat.profilePicUrl || null,
          }, { onConflict: "phone", ignoreDuplicates: false })
          .select()
          .single();

        if (chatError) {
          console.error("[WAHA Sync] Chat upsert error:", chatError);
          continue;
        }

        syncedChats++;

        // Fetch messages for this chat
        try {
          const messagesResponse = await fetch(
            `${WAHA_API_URL}/api/default/chats/${encodeURIComponent(chatId)}/messages?limit=100`,
            {
              method: "GET",
              headers: getHeaders(),
            }
          );

          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            const messages = Array.isArray(messagesData) ? messagesData : [];
            console.log(`[WAHA Sync] Found ${messages.length} messages for ${phone}`);

            for (const msg of messages) {
              const messageId = msg.id || msg.key?.id;
              if (!messageId) continue;

              const msgText = msg.body || msg.text || msg.message?.conversation || 
                             msg.message?.extendedTextMessage?.text || "";
              const msgFromMe = msg.fromMe ?? msg.key?.fromMe ?? false;
              const msgTimestamp = msg.timestamp || msg.messageTimestamp;
              const createdAt = msgTimestamp 
                ? new Date(typeof msgTimestamp === 'number' && msgTimestamp < 10000000000 ? msgTimestamp * 1000 : msgTimestamp).toISOString() 
                : new Date().toISOString();

              const { error: msgError } = await supabase
                .from("whatsapp_messages")
                .upsert({
                  chat_id: chatData.id,
                  message_id: messageId,
                  phone,
                  text: msgText,
                  from_me: msgFromMe,
                  status: msg.ack === 3 ? "READ" : msg.ack === 2 ? "DELIVERED" : "SENT",
                  media_url: msg.mediaUrl || null,
                  media_type: msg.hasMedia ? (msg.type || "file") : null,
                  created_at: createdAt,
                }, { onConflict: "message_id" });

              if (!msgError) {
                syncedMessages++;
              }
            }
          }
        } catch (msgErr: any) {
          console.error(`[WAHA Sync] Error fetching messages for ${phone}:`, msgErr.message);
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
