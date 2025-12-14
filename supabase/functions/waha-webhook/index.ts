import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    
    console.log("WAHA Webhook received:", JSON.stringify(payload).substring(0, 1000));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // WAHA webhook event types: message, message.any, message.ack, etc.
    const eventType = payload.event || "unknown";
    const session = payload.session || "default";
    const messagePayload = payload.payload || {};

    // Extract message data based on event type
    if (eventType === "message" || eventType === "message.any") {
      const fromMe = messagePayload.fromMe || false;
      const messageId = messagePayload.id || null;
      const messageText = messagePayload.body || "";
      const timestamp = messagePayload.timestamp || null;
      const hasMedia = messagePayload.hasMedia || false;
      const mediaUrl = messagePayload.media?.url || null;
      const mediaType = hasMedia ? (messagePayload.media?.mimetype?.split("/")[0] || "file") : null;

      // Extract phone from chatId or from/to
      let phone = "";
      if (messagePayload.from) {
        phone = messagePayload.from.replace("@c.us", "").replace("@s.whatsapp.net", "");
      } else if (messagePayload.to) {
        phone = messagePayload.to.replace("@c.us", "").replace("@s.whatsapp.net", "");
      }

      // Get sender info from 'me' field if available
      const senderName = payload.me?.pushName || messagePayload._data?.notifyName || phone;
      
      console.log("Processing message:", { phone, fromMe, messageId, textLength: messageText.length });

      if (phone && (messageText || hasMedia)) {
        // Upsert chat
        const { data: chatData, error: chatError } = await supabase
          .from("whatsapp_chats")
          .upsert(
            {
              phone: phone,
              name: senderName,
              last_message: messageText || `[${mediaType}]`,
              last_message_time: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
              unread_count: fromMe ? 0 : 1,
            },
            { 
              onConflict: "phone",
              ignoreDuplicates: false 
            }
          )
          .select()
          .single();

        if (chatError) {
          console.error("Error upserting chat:", chatError);
        } else {
          console.log("Chat upserted:", chatData?.id);
        }

        // Insert message if we have a valid chat
        if (chatData?.id && messageId) {
          const { error: messageError } = await supabase
            .from("whatsapp_messages")
            .upsert(
              {
                chat_id: chatData.id,
                message_id: messageId,
                phone: phone,
                text: messageText,
                from_me: fromMe,
                status: fromMe ? "SENT" : "RECEIVED",
                media_url: mediaUrl,
                media_type: mediaType,
              },
              { 
                onConflict: "message_id",
                ignoreDuplicates: true 
              }
            );

          if (messageError) {
            console.error("Error inserting message:", messageError);
          } else {
            console.log("Message saved successfully");
          }

          // Update unread count if message is not from me
          if (!fromMe) {
            const currentUnread = chatData.unread_count || 0;
            await supabase
              .from("whatsapp_chats")
              .update({ 
                unread_count: currentUnread + 1
              })
              .eq("id", chatData.id);
          }
        }
      }
    }

    // Handle message acknowledgment updates (sent, delivered, read)
    if (eventType === "message.ack") {
      const messageId = messagePayload.id || null;
      const ack = messagePayload.ack;
      
      // WAHA ack values: 0=PENDING, 1=SENT, 2=RECEIVED, 3=READ, 4=PLAYED
      let status = "SENT";
      if (ack === 2) status = "DELIVERED";
      else if (ack === 3) status = "READ";
      else if (ack === 4) status = "PLAYED";

      if (messageId) {
        const { error: statusError } = await supabase
          .from("whatsapp_messages")
          .update({ status })
          .eq("message_id", messageId);

        if (statusError) {
          console.error("Error updating message status:", statusError);
        } else {
          console.log("Message status updated:", status);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in waha-webhook function:", error);
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
