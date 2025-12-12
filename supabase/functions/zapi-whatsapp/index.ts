import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;

interface SendMessageRequest {
  action: "send-text" | "get-chats" | "get-chat-messages";
  phone?: string;
  message?: string;
  chatId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, phone, message, chatId }: SendMessageRequest = await req.json();

    console.log(`Z-API action: ${action}`);

    let response;

    switch (action) {
      case "send-text":
        if (!phone || !message) {
          throw new Error("Phone and message are required for send-text");
        }
        
        // Format phone number (remove non-digits)
        const formattedPhone = phone.replace(/\D/g, "");
        
        console.log(`Sending message to ${formattedPhone}`);
        
        response = await fetch(`${ZAPI_BASE_URL}/send-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": ZAPI_CLIENT_TOKEN || "",
          },
          body: JSON.stringify({
            phone: formattedPhone,
            message: message,
          }),
        });
        break;

      case "get-chats":
        console.log("Fetching all chats from Z-API");
        
        // Get chats with page parameter to get more
        response = await fetch(`${ZAPI_BASE_URL}/chats?page=1&pageSize=100`, {
          method: "GET",
          headers: {
            "Client-Token": ZAPI_CLIENT_TOKEN || "",
          },
        });
        
        const chatsData = await response.json();
        console.log(`Z-API chats response:`, JSON.stringify(chatsData).substring(0, 1000));
        
        // Filter only personal chats (not groups)
        const personalChats = Array.isArray(chatsData) 
          ? chatsData.filter((chat: any) => !chat.isGroup && chat.phone)
          : [];
        
        console.log(`Personal chats count: ${personalChats.length}`);
        
        return new Response(JSON.stringify(personalChats), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      case "get-chat-messages":
        if (!chatId) {
          throw new Error("chatId is required for get-chat-messages");
        }
        
        console.log(`Fetching messages for chat ${chatId}`);
        
        // Format phone for messages endpoint
        const chatPhone = chatId.replace(/\D/g, "");
        
        response = await fetch(`${ZAPI_BASE_URL}/chat-messages/${chatPhone}`, {
          method: "GET",
          headers: {
            "Client-Token": ZAPI_CLIENT_TOKEN || "",
          },
        });
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const data = await response.json();
    
    console.log(`Z-API response status: ${response.status}`);
    console.log(`Z-API response:`, JSON.stringify(data).substring(0, 500));

    if (!response.ok) {
      console.error("Z-API error:", data);
      throw new Error(data.message || data.error || "Z-API request failed");
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in zapi-whatsapp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
