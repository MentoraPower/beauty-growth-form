import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const wahaApiUrl = Deno.env.get("WAHA_API_URL")!;
const wahaApiKey = Deno.env.get("WAHA_API_KEY") || "";

interface SendMessageRequest {
  action: "send-text" | "get-chats" | "get-chat-messages";
  phone?: string;
  message?: string;
  chatId?: string;
  session?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SendMessageRequest = await req.json();
    const { action, phone, message, chatId, session = "default" } = body;

    console.log("WAHA request:", action, { phone, chatId, session });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add API key if configured
    if (wahaApiKey) {
      headers["X-Api-Key"] = wahaApiKey;
    }

    if (action === "send-text") {
      if (!phone || !message) {
        return new Response(
          JSON.stringify({ error: "Phone and message are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Format phone number to WAHA format: phone@c.us
      const formattedPhone = phone.replace(/\D/g, "");
      const chatIdFormatted = `${formattedPhone}@c.us`;

      console.log("Sending message to:", chatIdFormatted);

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
        throw new Error(data.message || "Failed to send message");
      }

      return new Response(
        JSON.stringify({ success: true, messageId: data.id || data.key?.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-chats") {
      console.log("Fetching chats overview from WAHA...");

      const response = await fetch(
        `${wahaApiUrl}/api/${session}/chats/overview?limit=100&offset=0`,
        { method: "GET", headers }
      );

      const data = await response.json();
      console.log("WAHA chats response count:", Array.isArray(data) ? data.length : 0);

      if (!response.ok) {
        throw new Error(data.message || "Failed to get chats");
      }

      // Format chats for frontend
      const formattedChats = (data || []).map((chat: any) => {
        // Extract phone from chatId (remove @c.us suffix)
        const chatIdStr = chat.id || "";
        const phoneNumber = chatIdStr.replace("@c.us", "").replace("@s.whatsapp.net", "");
        
        return {
          phone: phoneNumber,
          name: chat.name || phoneNumber,
          photo: chat.picture || null,
          lastMessage: chat.lastMessage?.body || "",
          timestamp: chat.lastMessage?.timestamp || null,
          unreadCount: chat._chat?.unreadCount || 0,
        };
      }).filter((chat: any) => chat.lastMessage);

      return new Response(
        JSON.stringify(formattedChats),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-chat-messages") {
      if (!chatId) {
        return new Response(
          JSON.stringify({ error: "ChatId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Format chatId if needed
      const formattedChatId = chatId.includes("@") ? chatId : `${chatId.replace(/\D/g, "")}@c.us`;

      console.log("Fetching messages for:", formattedChatId);

      const response = await fetch(
        `${wahaApiUrl}/api/${session}/chats/${formattedChatId}/messages?limit=50`,
        { method: "GET", headers }
      );

      const data = await response.json();
      console.log("WAHA messages response count:", Array.isArray(data) ? data.length : 0);

      if (!response.ok) {
        throw new Error(data.message || "Failed to get messages");
      }

      // Format messages for frontend
      const formattedMessages = (data || []).map((msg: any) => ({
        id: msg.id,
        text: msg.body || "",
        fromMe: msg.fromMe || false,
        timestamp: msg.timestamp,
        hasMedia: msg.hasMedia || false,
        mediaUrl: msg.media?.url || null,
        ack: msg.ack,
      }));

      return new Response(
        JSON.stringify(formattedMessages),
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
