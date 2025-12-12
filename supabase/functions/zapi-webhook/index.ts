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
    
    console.log("Z-API Webhook received:", JSON.stringify(payload).substring(0, 1000));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Identify the type of webhook
    const webhookType = payload.type || "unknown";
    const phone = payload.phone || payload.chatId?.replace("@c.us", "") || "";
    const fromMe = payload.fromMe || false;
    const messageId = payload.messageId || payload.id?.id || null;

    // Extract message text based on message type
    let messageText = "";
    if (payload.text?.message) {
      messageText = payload.text.message;
    } else if (payload.body) {
      messageText = payload.body;
    } else if (payload.caption) {
      messageText = payload.caption;
    }

    // Extract media info if available
    let mediaUrl = null;
    let mediaType = null;
    if (payload.image?.imageUrl) {
      mediaUrl = payload.image.imageUrl;
      mediaType = "image";
    } else if (payload.audio?.audioUrl) {
      mediaUrl = payload.audio.audioUrl;
      mediaType = "audio";
    } else if (payload.video?.videoUrl) {
      mediaUrl = payload.video.videoUrl;
      mediaType = "video";
    } else if (payload.document?.documentUrl) {
      mediaUrl = payload.document.documentUrl;
      mediaType = "document";
    }

    // Get sender name and photo
    const senderName = payload.senderName || payload.chatName || payload.name || phone;
    const senderPhoto = payload.senderPhoto || payload.photo || null;

    if (phone && (messageText || mediaUrl)) {
      // Upsert chat
      const { data: chatData, error: chatError } = await supabase
        .from("whatsapp_chats")
        .upsert(
          {
            phone: phone,
            name: senderName,
            photo_url: senderPhoto,
            last_message: messageText || `[${mediaType}]`,
            last_message_time: new Date().toISOString(),
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
              status: payload.status || "RECEIVED",
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

    // Handle message status updates (sent, delivered, read)
    if (webhookType === "MessageStatusCallback" && messageId) {
      const { error: statusError } = await supabase
        .from("whatsapp_messages")
        .update({ status: payload.status })
        .eq("message_id", messageId);

      if (statusError) {
        console.error("Error updating message status:", statusError);
      } else {
        console.log("Message status updated:", payload.status);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in zapi-webhook function:", error);
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
