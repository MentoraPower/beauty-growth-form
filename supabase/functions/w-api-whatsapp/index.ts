import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET, HEAD",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const W_API_BASE_URL = "https://api.w-api.app/v1";
const W_API_INSTANCE_ID = Deno.env.get("W_API_INSTANCE_ID")!;
const W_API_TOKEN = Deno.env.get("W_API_TOKEN")!;

interface RequestBody {
  action: string;
  phone?: string;
  text?: string;
  chatId?: string;
  limit?: number;
  page?: number;
}

const getHeaders = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${W_API_TOKEN}`,
});

const formatPhoneForWAPI = (phone: string): string => {
  // W-API expects phone in format: 5527998474152
  const cleaned = phone.replace(/\D/g, "");
  return cleaned;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { action } = body;

    console.log(`[W-API] Action: ${action}`, JSON.stringify(body));

    // Send text message
    if (action === "send-text") {
      const { phone, text } = body;
      if (!phone || !text) {
        return new Response(
          JSON.stringify({ error: "phone and text are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const formattedPhone = formatPhoneForWAPI(phone);
      const url = `${W_API_BASE_URL}/message/send-text?instanceId=${W_API_INSTANCE_ID}`;
      
      console.log(`[W-API] Sending text to ${formattedPhone}`);
      
      const response = await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          phone: formattedPhone,
          message: text,
        }),
      });

      const data = await response.json();
      console.log(`[W-API] Send response:`, JSON.stringify(data));

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: data.message || "Failed to send message", details: data }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all chats
    if (action === "get-chats") {
      const allChats: any[] = [];
      let page = 1;
      const perPage = 20;
      let hasMore = true;

      while (hasMore) {
        const url = `${W_API_BASE_URL}/chats/fetch-chats?instanceId=${W_API_INSTANCE_ID}&perPage=${perPage}&page=${page}`;
        console.log(`[W-API] Fetching chats page ${page}`);

        const response = await fetch(url, {
          method: "GET",
          headers: getHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error(`[W-API] Error fetching chats:`, data);
          break;
        }

        const chats = data.chats || data.data || data || [];
        
        if (Array.isArray(chats) && chats.length > 0) {
          allChats.push(...chats);
          if (chats.length < perPage) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }

        // Safety limit
        if (page > 100) break;
      }

      console.log(`[W-API] Total chats fetched: ${allChats.length}`);

      // Filter only personal chats (not groups or channels)
      const personalChats = allChats.filter((chat: any) => {
        const id = chat.id || chat.chatId || "";
        return !id.includes("@g.us") && 
               !id.includes("@newsletter") && 
               !id.includes("status@broadcast");
      });

      // Format chats for our app
      const formattedChats = personalChats.map((chat: any) => {
        const id = chat.id || chat.chatId || "";
        const phone = id.split("@")[0] || chat.phone || "";
        
        return {
          id: chat.id || chat.chatId,
          phone: phone,
          name: chat.name || chat.pushName || chat.notifyName || phone,
          photoUrl: chat.profilePicUrl || chat.profilePic || chat.imgUrl || null,
          lastMessage: chat.lastMessage?.body || chat.lastMessage?.text || chat.lastMessageContent || "",
          lastMessageTime: chat.lastMessage?.timestamp || chat.lastMessageTime || chat.timestamp || null,
          unreadCount: chat.unreadCount || 0,
        };
      });

      return new Response(
        JSON.stringify({ success: true, chats: formattedChats }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get messages for a specific chat
    if (action === "get-chat-messages") {
      const { chatId, phone, limit = 100 } = body;
      const targetPhone = chatId || phone;
      
      if (!targetPhone) {
        return new Response(
          JSON.stringify({ error: "chatId or phone is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const formattedPhone = formatPhoneForWAPI(targetPhone);
      const url = `${W_API_BASE_URL}/chats/fetch-messages/${formattedPhone}?instanceId=${W_API_INSTANCE_ID}&limit=${limit}`;
      
      console.log(`[W-API] Fetching messages for ${formattedPhone}`);

      const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(`[W-API] Error fetching messages:`, data);
        return new Response(
          JSON.stringify({ error: data.message || "Failed to fetch messages", details: data }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const messages = data.messages || data.data || data || [];
      
      // Format messages for our app
      const formattedMessages = Array.isArray(messages) ? messages.map((msg: any) => ({
        id: msg.id || msg.messageId || msg._id,
        text: msg.body || msg.text || msg.content || "",
        fromMe: msg.fromMe ?? false,
        timestamp: msg.timestamp || msg.time || null,
        status: msg.ack === 3 ? "READ" : msg.ack === 2 ? "DELIVERED" : "SENT",
        mediaUrl: msg.mediaUrl || msg.media?.url || null,
        mediaType: msg.mediaType || msg.type || null,
      })) : [];

      return new Response(
        JSON.stringify({ success: true, messages: formattedMessages }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sync all chats and messages to database
    if (action === "sync-all") {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // First get all chats
      const allChats: any[] = [];
      let page = 1;
      const perPage = 20;
      let hasMore = true;

      while (hasMore) {
        const url = `${W_API_BASE_URL}/chats/fetch-chats?instanceId=${W_API_INSTANCE_ID}&perPage=${perPage}&page=${page}`;
        console.log(`[W-API Sync] Fetching chats page ${page}`);

        const response = await fetch(url, {
          method: "GET",
          headers: getHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error(`[W-API Sync] Error fetching chats:`, data);
          break;
        }

        const chats = data.chats || data.data || data || [];
        
        if (Array.isArray(chats) && chats.length > 0) {
          allChats.push(...chats);
          if (chats.length < perPage) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }

        if (page > 100) break;
      }

      console.log(`[W-API Sync] Total chats to sync: ${allChats.length}`);

      let syncedChats = 0;
      let syncedMessages = 0;

      for (const chat of allChats) {
        const id = chat.id || chat.chatId || "";
        
        // Skip groups, newsletters, and status
        if (id.includes("@g.us") || id.includes("@newsletter") || id.includes("status@broadcast")) {
          continue;
        }

        const phone = id.split("@")[0] || chat.phone || "";
        if (!phone || phone === "0") continue;

        const name = chat.name || chat.pushName || chat.notifyName || phone;
        const photoUrl = chat.profilePicUrl || chat.profilePic || chat.imgUrl || null;
        const lastMessage = chat.lastMessage?.body || chat.lastMessage?.text || chat.lastMessageContent || "Conversa iniciada";
        const lastMessageTime = chat.lastMessage?.timestamp 
          ? new Date(chat.lastMessage.timestamp * 1000).toISOString() 
          : chat.lastMessageTime 
            ? new Date(chat.lastMessageTime).toISOString()
            : new Date().toISOString();

        // Upsert chat
        const { data: chatData, error: chatError } = await supabase
          .from("whatsapp_chats")
          .upsert({
            phone,
            name,
            photo_url: photoUrl,
            last_message: lastMessage,
            last_message_time: lastMessageTime,
            unread_count: chat.unreadCount || 0,
          }, { onConflict: "phone" })
          .select()
          .single();

        if (chatError) {
          console.error(`[W-API Sync] Error upserting chat ${phone}:`, chatError);
          continue;
        }

        syncedChats++;

        // Fetch and sync messages for this chat
        try {
          const messagesUrl = `${W_API_BASE_URL}/chats/fetch-messages/${phone}?instanceId=${W_API_INSTANCE_ID}&limit=100`;
          const messagesResponse = await fetch(messagesUrl, {
            method: "GET",
            headers: getHeaders(),
          });

          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            const messages = messagesData.messages || messagesData.data || messagesData || [];

            if (Array.isArray(messages)) {
              for (const msg of messages) {
                const messageId = msg.id || msg.messageId || msg._id;
                if (!messageId) continue;

                const { error: msgError } = await supabase
                  .from("whatsapp_messages")
                  .upsert({
                    chat_id: chatData.id,
                    message_id: messageId,
                    phone,
                    text: msg.body || msg.text || msg.content || "",
                    from_me: msg.fromMe ?? false,
                    status: msg.ack === 3 ? "READ" : msg.ack === 2 ? "DELIVERED" : "SENT",
                    media_url: msg.mediaUrl || msg.media?.url || null,
                    media_type: msg.mediaType || msg.type || null,
                  }, { onConflict: "message_id" });

                if (!msgError) {
                  syncedMessages++;
                }
              }
            }
          }
        } catch (msgErr) {
          console.error(`[W-API Sync] Error syncing messages for ${phone}:`, msgErr);
        }
      }

      console.log(`[W-API Sync] Completed. Chats: ${syncedChats}, Messages: ${syncedMessages}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          syncedChats, 
          syncedMessages,
          message: `Sincronizados ${syncedChats} chats e ${syncedMessages} mensagens` 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clear all data
    if (action === "clear-all") {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase.from("whatsapp_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("whatsapp_chats").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      return new Response(
        JSON.stringify({ success: true, message: "Todos os dados foram limpos" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[W-API] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
