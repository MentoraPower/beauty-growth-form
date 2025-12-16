import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WASENDER_API_KEY = Deno.env.get("WASENDER_API_KEY")!;

// Helper: Format phone for display (Brazilian format)
function formatPhoneDisplay(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 13) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  } else if (cleaned.length === 12) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
  } else if (cleaned.length >= 10) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
  }
  return phone;
}

// Helper: Check if phone is a WhatsApp LID
function isWhatsAppLID(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length > 14) return true;
  if (/^(120|146|180|203|234|447)\d{10,}$/.test(cleaned)) return true;
  return false;
}

// Decrypt media URL using WasenderAPI
async function decryptMedia(mediaKey: string, url: string, mimetype: string): Promise<string | null> {
  try {
    const response = await fetch("https://www.wasenderapi.com/api/decrypt-media", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WASENDER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mediaKey, url, mimetype }),
    });

    if (!response.ok) {
      console.error(`[Wasender Webhook] Decrypt media failed: ${response.status}`);
      return null;
    }

    const result = await response.json();
    return result?.publicUrl || null;
  } catch (error) {
    console.error("[Wasender Webhook] Error decrypting media:", error);
    return null;
  }
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("[Wasender Webhook] Received:", JSON.stringify(payload).substring(0, 1000));

    const event = payload.event;
    
    // Only process message events
    if (event !== "messages.received" && event !== "messages.upsert") {
      console.log(`[Wasender Webhook] Ignoring event: ${event}`);
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const messageData = payload.data?.messages || payload.data;
    
    if (!messageData) {
      console.log("[Wasender Webhook] No message data found");
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Extract key information
    const key = messageData.key || {};
    const messageId = key.id || messageData.id || `${Date.now()}`;
    const fromMe = key.fromMe || false;
    const remoteJid = key.remoteJid || "";

    // Get phone number - prefer cleanedSenderPn for private chats
    let phone = key.cleanedSenderPn || key.cleanedParticipantPn || "";
    
    // If no cleaned phone, try to extract from remoteJid
    if (!phone && remoteJid) {
      phone = remoteJid.replace("@c.us", "").replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "");
    }

    // Skip if from ourselves (sent messages we already have)
    if (fromMe) {
      console.log("[Wasender Webhook] Skipping own message");
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Skip groups and broadcasts
    if (remoteJid.includes("@g.us") || remoteJid.includes("@newsletter") || remoteJid.includes("status@broadcast")) {
      console.log("[Wasender Webhook] Skipping group/broadcast");
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Skip LIDs we can't resolve
    if (isWhatsAppLID(phone)) {
      console.log(`[Wasender Webhook] Skipping LID: ${phone}`);
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Validate phone
    if (!phone || phone.length < 8 || phone === "0") {
      console.log(`[Wasender Webhook] Invalid phone: ${phone}`);
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log(`[Wasender Webhook] Processing message from ${phone}`);

    // Extract message content
    const messageBody = messageData.messageBody || "";
    const message = messageData.message || {};
    
    let text = messageBody || message.conversation || message.extendedTextMessage?.text || "";
    let mediaType: string | null = null;
    let mediaUrl: string | null = null;

    // Handle different media types
    if (message.imageMessage) {
      mediaType = "image";
      text = text || message.imageMessage.caption || "📷 Imagem";
      
      // Try to decrypt media
      if (message.imageMessage.mediaKey && message.imageMessage.url) {
        mediaUrl = await decryptMedia(
          message.imageMessage.mediaKey,
          message.imageMessage.url,
          message.imageMessage.mimetype || "image/jpeg"
        );
      }
    } else if (message.audioMessage || message.pttMessage) {
      mediaType = "audio";
      text = text || "🎵 Áudio";
      
      const audioMsg = message.audioMessage || message.pttMessage;
      if (audioMsg?.mediaKey && audioMsg?.url) {
        mediaUrl = await decryptMedia(
          audioMsg.mediaKey,
          audioMsg.url,
          audioMsg.mimetype || "audio/ogg"
        );
      }
    } else if (message.videoMessage) {
      mediaType = "video";
      text = text || "🎥 Vídeo";
      
      if (message.videoMessage.mediaKey && message.videoMessage.url) {
        mediaUrl = await decryptMedia(
          message.videoMessage.mediaKey,
          message.videoMessage.url,
          message.videoMessage.mimetype || "video/mp4"
        );
      }
    } else if (message.documentMessage) {
      mediaType = "document";
      text = text || `📄 ${message.documentMessage.fileName || "Documento"}`;
      
      if (message.documentMessage.mediaKey && message.documentMessage.url) {
        mediaUrl = await decryptMedia(
          message.documentMessage.mediaKey,
          message.documentMessage.url,
          message.documentMessage.mimetype || "application/octet-stream"
        );
      }
    } else if (message.stickerMessage) {
      mediaType = "sticker";
      text = text || "🎨 Sticker";
    } else if (message.contactMessage) {
      text = text || `👤 ${message.contactMessage.displayName || "Contato"}`;
    } else if (message.locationMessage) {
      text = text || "📍 Localização";
    }

    // Skip empty messages
    if (!text && !mediaType) {
      console.log("[Wasender Webhook] Skipping empty message");
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Get or extract contact name
    const pushName = messageData.pushName || key.participant?.split("@")[0] || null;
    const displayName = pushName || formatPhoneDisplay(phone);

    // Timestamp
    const timestamp = messageData.messageTimestamp 
      ? new Date(messageData.messageTimestamp * 1000).toISOString()
      : new Date().toISOString();

    // Upsert chat
    const { data: chatData, error: chatError } = await supabase
      .from("whatsapp_chats")
      .upsert({
        phone,
        name: displayName,
        last_message: text.substring(0, 500),
        last_message_time: timestamp,
        unread_count: 1, // Increment will be handled by trigger or separate logic
        updated_at: new Date().toISOString(),
      }, { onConflict: "phone" })
      .select()
      .single();

    if (chatError) {
      console.error("[Wasender Webhook] Error upserting chat:", chatError);
      return new Response(JSON.stringify({ error: chatError.message }), {
        status: 200, // Return 200 to prevent retries
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Wasender Webhook] Chat upserted: ${chatData.id}`);

    // Upsert message (prevent duplicates)
    const { error: msgError } = await supabase
      .from("whatsapp_messages")
      .upsert({
        chat_id: chatData.id,
        message_id: messageId,
        phone,
        text: text.substring(0, 2000),
        from_me: fromMe,
        status: "RECEIVED",
        media_type: mediaType,
        media_url: mediaUrl,
        created_at: timestamp,
      }, { onConflict: "message_id" });

    if (msgError) {
      console.error("[Wasender Webhook] Error upserting message:", msgError);
    } else {
      console.log(`[Wasender Webhook] Message saved: ${messageId}`);
    }

    // Increment unread count (if not from self)
    if (!fromMe) {
      const currentUnread = chatData.unread_count || 0;
      await supabase
        .from("whatsapp_chats")
        .update({ unread_count: currentUnread + 1 })
        .eq("id", chatData.id);
    }

    return new Response(JSON.stringify({ ok: true, messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[Wasender Webhook] Error:", error);
    // Return 200 to prevent webhook retries
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

serve(handler);
