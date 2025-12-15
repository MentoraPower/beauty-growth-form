import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("[W-API Webhook] Received:", JSON.stringify(payload));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // W-API webhook structure can vary, handle different event types
    const event = payload.event || payload.type || "message";
    
    // Handle message events
    if (event === "message" || event === "messages.upsert" || event === "onMessage" || payload.message) {
      const message = payload.message || payload.data || payload;
      
      // Extract message details
      const messageId = message.id || message.messageId || message._id || null;
      const fromMe = message.fromMe ?? false;
      const messageText = message.body || message.text || message.content || "";
      const timestamp = message.timestamp || message.time || Math.floor(Date.now() / 1000);
      const hasMedia = message.hasMedia || message.mediaUrl || message.media;
      const mediaUrl = message.mediaUrl || message.media?.url || null;
      const mediaType = hasMedia ? (message.mediaType || message.type || "file") : null;

      // Get phone number - handle different payload structures
      let phone = "";
      if (fromMe) {
        // Outgoing message - get recipient
        phone = message.to || message.chatId || message.remoteJid || "";
      } else {
        // Incoming message - get sender
        phone = message.from || message.sender || message.chatId || message.remoteJid || "";
      }

      // Clean phone number (remove @c.us, @s.whatsapp.net, etc)
      phone = phone.split("@")[0].replace(/\D/g, "");

      // Skip if no phone or if it's a group/channel
      if (!phone || phone.includes("g.us") || phone.includes("newsletter") || phone.includes("status")) {
        console.log("[W-API Webhook] Skipping non-personal message");
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get sender name
      const senderName = message.pushName || message.notifyName || message.senderName || message.name || phone;

      console.log(`[W-API Webhook] Processing message - Phone: ${phone}, FromMe: ${fromMe}, Text: ${messageText.substring(0, 50)}`);

      // Upsert chat
      const { data: chatData, error: chatError } = await supabase
        .from("whatsapp_chats")
        .upsert({
          phone,
          name: senderName !== phone ? senderName : phone,
          last_message: messageText || (hasMedia ? `[${mediaType}]` : ""),
          last_message_time: new Date(timestamp * 1000).toISOString(),
          unread_count: fromMe ? 0 : 1,
        }, { onConflict: "phone", ignoreDuplicates: false })
        .select()
        .single();

      if (chatError) {
        console.error("[W-API Webhook] Error upserting chat:", chatError);
      }

      // Insert message if we have a message ID
      if (chatData?.id && messageId) {
        const { error: messageError } = await supabase
          .from("whatsapp_messages")
          .upsert({
            chat_id: chatData.id,
            message_id: messageId,
            phone,
            text: messageText,
            from_me: fromMe,
            status: fromMe ? "SENT" : "RECEIVED",
            media_url: mediaUrl,
            media_type: mediaType,
          }, { onConflict: "message_id", ignoreDuplicates: false });

        if (messageError) {
          console.error("[W-API Webhook] Error inserting message:", messageError);
        }

        // Increment unread count for incoming messages
        if (!fromMe) {
          const currentUnread = chatData.unread_count || 0;
          await supabase
            .from("whatsapp_chats")
            .update({ unread_count: currentUnread + 1 })
            .eq("id", chatData.id);
        }
      }
    }

    // Handle message status updates (ack)
    if (event === "message.ack" || event === "messages.update" || payload.ack !== undefined) {
      const messageId = payload.messageId || payload.id || payload.message?.id;
      const ack = payload.ack ?? payload.status ?? 1;

      let status = "SENT";
      if (ack === 2 || ack === "delivered") status = "DELIVERED";
      else if (ack === 3 || ack === "read") status = "READ";
      else if (ack === 4 || ack === "played") status = "PLAYED";

      if (messageId) {
        const { error: statusError } = await supabase
          .from("whatsapp_messages")
          .update({ status })
          .eq("message_id", messageId);

        if (statusError) {
          console.error("[W-API Webhook] Error updating message status:", statusError);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[W-API Webhook] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
