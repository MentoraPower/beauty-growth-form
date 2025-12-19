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

// Helper: Convert mediaKey to base64 string (handles Buffer objects)
function normalizeMediaKey(mediaKey: any): string {
  if (!mediaKey) return "";
  
  // Already a string (base64)
  if (typeof mediaKey === "string") return mediaKey;
  
  // Buffer object with data array
  if (mediaKey.data && Array.isArray(mediaKey.data)) {
    const bytes = new Uint8Array(mediaKey.data);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  return "";
}

// Download and upload media to Supabase Storage
async function downloadAndUploadMedia(
  url: string,
  mediaKey: any,
  mimetype: string,
  supabase: any,
  decryptMessageData?: any
): Promise<string | null> {
  try {
    if (!url) return null;

    // If it already points to our Storage, just use it.
    if (url.includes(`${SUPABASE_URL}/storage/v1/object/public/`)) {
      return url;
    }

    const normalizedKey = normalizeMediaKey(mediaKey);
    const looksEncrypted = /mmg\.whatsapp\.net/i.test(url) || /\.enc(\?|$)/i.test(url);

    console.log(
      `[Wasender Webhook] Processing media - mimetype: ${mimetype}, key length: ${normalizedKey.length}, encrypted: ${looksEncrypted}`
    );

    // 1) Prefer decrypt-media for WhatsApp encrypted URLs
    if (looksEncrypted && normalizedKey && decryptMessageData) {
      try {
        console.log(`[Wasender Webhook] Attempting decrypt via WasenderAPI...`);

        const msgForDecrypt = JSON.parse(JSON.stringify(decryptMessageData));

        // Ensure the nested media object uses the normalized key / url / mimetype.
        const m = msgForDecrypt?.message;
        if (m && typeof m === "object") {
          const candidates = ["audioMessage", "pttMessage", "imageMessage", "videoMessage", "documentMessage"];
          for (const k of candidates) {
            if (m[k] && typeof m[k] === "object") {
              // Best-effort matching (same URL or has mediaKey)
              const sameUrl = m[k]?.url === url;
              if (sameUrl || m[k]?.mediaKey) {
                m[k].url = url;
                m[k].mediaKey = normalizedKey;
                m[k].mimetype = mimetype;
              }
            }
          }
        }

        const decryptResponse = await fetch("https://www.wasenderapi.com/api/decrypt-media", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WASENDER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: {
              messages: msgForDecrypt,
            },
          }),
        });

        const decryptText = await decryptResponse.text();
        console.log(
          `[Wasender Webhook] Decrypt response ${decryptResponse.status}: ${decryptText.substring(0, 300)}`
        );

        if (decryptResponse.ok) {
          const decryptResult = JSON.parse(decryptText);

          // Some variants return a public URL
          const publicUrl = decryptResult?.publicUrl || decryptResult?.url;
          if (publicUrl) {
            console.log(`[Wasender Webhook] Got public URL from decrypt`);

            // IMPORTANT: do NOT return the Wasender publicUrl directly to the frontend (CORS / playback issues).
            // Instead, download it server-side and upload to Supabase Storage.
            try {
              const dl = await fetch(publicUrl);
              if (dl.ok) {
                const arrayBuffer = await dl.arrayBuffer();
                const ext = mimetype.split("/")[1]?.split(";")[0] || "bin";
                const filename = `received_${Date.now()}.${ext}`;
                const filePath = `audios/${filename}`;

                const { error: uploadError } = await supabase.storage
                  .from("whatsapp-media")
                  .upload(filePath, new Uint8Array(arrayBuffer), {
                    contentType: mimetype.split(";")[0],
                    cacheControl: "31536000",
                  });

                if (!uploadError) {
                  const {
                    data: { publicUrl: uploadedUrl },
                  } = supabase.storage.from("whatsapp-media").getPublicUrl(filePath);
                  console.log(`[Wasender Webhook] Media uploaded from decrypt URL: ${uploadedUrl}`);
                  return uploadedUrl;
                }

                console.error("[Wasender Webhook] Upload error (decrypt URL):", uploadError);
              } else {
                console.error("[Wasender Webhook] Download failed (decrypt URL):", dl.status);
              }
            } catch (e) {
              console.error("[Wasender Webhook] Download/upload error (decrypt URL):", e);
            }

            // If we can't upload, better to return null than a URL the browser can't play.
            return null;
          }

          // Others return base64 data
          const base64Data = decryptResult?.data || decryptResult?.base64;
          if (base64Data) {
            const ext = mimetype.split("/")[1]?.split(";")[0] || "bin";
            const filename = `received_${Date.now()}.${ext}`;
            const filePath = `audios/${filename}`;

            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            const { error: uploadError } = await supabase.storage.from("whatsapp-media").upload(filePath, bytes, {
              contentType: mimetype.split(";")[0],
              cacheControl: "31536000",
            });

            if (!uploadError) {
              const {
                data: { publicUrl: uploadedUrl },
              } = supabase.storage.from("whatsapp-media").getPublicUrl(filePath);
              console.log(`[Wasender Webhook] Media uploaded: ${uploadedUrl}`);
              return uploadedUrl;
            }

            console.error("[Wasender Webhook] Upload error:", uploadError);
          }
        }
      } catch (decryptError) {
        console.error("[Wasender Webhook] Decrypt API error:", decryptError);
      }

      // If it's encrypted and decryption failed, don't upload the encrypted file.
      return null;
    }

    // 2) Fallback direct download for non-encrypted URLs
    try {
      console.log(`[Wasender Webhook] Trying direct download...`);
      const downloadResponse = await fetch(url, {
        headers: { "User-Agent": "WhatsApp/2.24.1.7" },
      });

      if (downloadResponse.ok) {
        const arrayBuffer = await downloadResponse.arrayBuffer();
        const ext = mimetype.split("/")[1]?.split(";")[0] || "bin";
        const filename = `received_${Date.now()}.${ext}`;
        const filePath = `audios/${filename}`;

        const { error: uploadError } = await supabase.storage
          .from("whatsapp-media")
          .upload(filePath, new Uint8Array(arrayBuffer), {
            contentType: mimetype.split(";")[0],
            cacheControl: "31536000",
          });

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from("whatsapp-media").getPublicUrl(filePath);
          console.log(`[Wasender Webhook] Direct download succeeded: ${publicUrl}`);
          return publicUrl;
        }
      }
    } catch (downloadError) {
      console.error("[Wasender Webhook] Direct download failed:", downloadError);
    }

    return null;
  } catch (error) {
    console.error("[Wasender Webhook] Error processing media:", error);
    return null;
  }
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("[Wasender Webhook] Received:", JSON.stringify(payload).substring(0, 1500));
    
    // Log full payload structure for debugging IDs
    const eventType = payload.event;
    const dataKeys = payload.data ? Object.keys(payload.data) : [];
    console.log(`[Wasender Webhook] Event: ${eventType}, Data keys: ${dataKeys.join(", ")}`);
    if (payload.data?.msgId) console.log(`[Wasender Webhook] Payload msgId: ${payload.data.msgId}`);
    if (payload.data?.key?.id) console.log(`[Wasender Webhook] Payload key.id: ${payload.data.key?.id}`);

    const event = payload.event;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Handle message status updates (read receipts, delivery status) AND edited messages
    if (event === "messages.update") {
      const updateData = payload.data;
      const messageKey = updateData?.key || updateData;
      const whatsappMsgId = messageKey?.id; // e.g. "3EB0456C612BC6D9A6C54E"
      const numericMsgId = updateData?.msgId?.toString(); // e.g. "16663681"
      
      console.log(`[Wasender Webhook] messages.update - whatsappMsgId: ${whatsappMsgId}, numericMsgId: ${numericMsgId}`);
      
      // Check if this is an edited message update
      const editedMessage = updateData?.message?.editedMessage?.message;
      if (editedMessage) {
        const newText = editedMessage.conversation || 
                       editedMessage.extendedTextMessage?.text || 
                       editedMessage.imageMessage?.caption ||
                       editedMessage.videoMessage?.caption || null;
        
        console.log(`[Wasender Webhook] Edited message detected - new text: ${newText?.substring(0, 100)}`);
        
        if (newText !== null) {
          // Update the message text in database
          // Try by numeric msgId first, then by whatsapp key id
          let updated = false;
          
          if (numericMsgId) {
            const { error, count } = await supabase
              .from("whatsapp_messages")
              .update({ text: newText })
              .eq("message_id", numericMsgId);
            
            if (!error && count && count > 0) {
              console.log(`[Wasender Webhook] Updated message text by msgId ${numericMsgId}`);
              updated = true;
            }
          }
          
          if (!updated && whatsappMsgId) {
            const { error, count } = await supabase
              .from("whatsapp_messages")
              .update({ text: newText })
              .or(`message_id.eq.${whatsappMsgId},whatsapp_key_id.eq.${whatsappMsgId}`);
            
            if (!error) {
              console.log(`[Wasender Webhook] Updated message text by whatsappMsgId ${whatsappMsgId}`);
            }
          }
        }
        
        return new Response(JSON.stringify({ ok: true }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
      
      // Status codes: 2=SENT, 3=DELIVERED, 4=READ, 5=PLAYED
      const statusCode = updateData?.update?.status || updateData?.status;
      const statusMap: Record<number, string> = {
        2: "SENT",
        3: "DELIVERED", 
        4: "READ",
        5: "PLAYED"
      };
      
      // Status progression rank (higher = more advanced)
      const statusRank: Record<string, number> = {
        "SENDING": 0,
        "SENT": 1,
        "DELIVERED": 2,
        "READ": 3,
        "PLAYED": 4,
      };
      
      if (statusMap[statusCode]) {
        const newStatus = statusMap[statusCode];
        const newRank = statusRank[newStatus] || 0;
        let updatedMessageChatId: string | null = null;
        
        // Helper to conditionally update only if new status is higher
        const updateIfHigherStatus = async (messageId: string) => {
          // First get current status - try both message_id and whatsapp_key_id
          const { data: currentMsg } = await supabase
            .from("whatsapp_messages")
            .select("id, chat_id, status")
            .or(`message_id.eq.${messageId},whatsapp_key_id.eq.${messageId}`)
            .maybeSingle();
          
          if (!currentMsg) return null;
          
          const currentRank = statusRank[currentMsg.status] || 0;
          
          // Only update if new status is higher (more progressed)
          if (newRank > currentRank) {
            console.log(`[Wasender Webhook] Updating message ${messageId} status: ${currentMsg.status} -> ${newStatus}`);
            await supabase
              .from("whatsapp_messages")
              .update({ status: newStatus })
              .eq("id", currentMsg.id);
            return currentMsg.chat_id;
          } else {
            console.log(`[Wasender Webhook] Skipping status update for ${messageId}: ${currentMsg.status} >= ${newStatus}`);
            return null;
          }
        };
        
        // Try to update by WhatsApp message ID first
        if (whatsappMsgId) {
          const chatId = await updateIfHigherStatus(whatsappMsgId);
          if (chatId) updatedMessageChatId = chatId;
        }
        
        // Also try to update by numeric msgId
        if (numericMsgId && !updatedMessageChatId) {
          const chatId = await updateIfHigherStatus(numericMsgId);
          if (chatId) updatedMessageChatId = chatId;
        }

        // Update chat's last_message_status if this is the latest message
        if (updatedMessageChatId) {
          // Get the latest message for this chat
          const { data: latestMsg } = await supabase
            .from("whatsapp_messages")
            .select("message_id, status")
            .eq("chat_id", updatedMessageChatId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          // If the updated message is the latest, update the chat status
          if (latestMsg && (latestMsg.message_id === whatsappMsgId || latestMsg.message_id === numericMsgId)) {
            await supabase
              .from("whatsapp_chats")
              .update({ last_message_status: latestMsg.status })
              .eq("id", updatedMessageChatId);
            console.log(`[Wasender Webhook] Updated chat ${updatedMessageChatId} last_message_status to ${latestMsg.status}`);
          }
        }
      }
      
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Handle message-receipt.update event (read receipts for groups)
    if (event === "message-receipt.update") {
      const messageData = payload.data?.message;
      const messageKey = messageData?.key;
      const messageId = messageKey?.id;
      const receipt = messageData?.receipt;
      
      if (messageId && receipt) {
        // If we have a receipt, it means the message was read
        console.log(`[Wasender Webhook] Receipt update for message ${messageId}`);
        
        await supabase
          .from("whatsapp_messages")
          .update({ status: "READ" })
          .eq("message_id", messageId);
      }
      
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Handle message deletion (when contact deletes a message)
    // WasenderAPI sends "messages.deleted" event
    if (event === "messages.delete" || event === "messages.deleted") {
      const deleteData = payload.data;
      const messageKey = deleteData?.key || deleteData;
      const messageId = messageKey?.id;
      const numericMsgId = deleteData?.msgId?.toString();
      
      console.log(`[Wasender Webhook] Message deleted event - messageId: ${messageId}, numericMsgId: ${numericMsgId}`);
      
      // Try both message_id formats
      if (messageId) {
        const { error } = await supabase
          .from("whatsapp_messages")
          .update({ status: "DELETED" })
          .eq("message_id", messageId);
        
        if (error) {
          console.log(`[Wasender Webhook] Error updating by messageId: ${error.message}`);
        } else {
          console.log(`[Wasender Webhook] Message ${messageId} marked as DELETED`);
        }
      }
      
      // Also try numeric msgId if different
      if (numericMsgId && numericMsgId !== messageId) {
        const { error } = await supabase
          .from("whatsapp_messages")
          .update({ status: "DELETED" })
          .eq("message_id", numericMsgId);
        
        if (error) {
          console.log(`[Wasender Webhook] Error updating by numericMsgId: ${error.message}`);
        } else {
          console.log(`[Wasender Webhook] Message ${numericMsgId} marked as DELETED`);
        }
      }
      
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    
    // Handle message reactions
    if (event === "messages.reaction") {
      const reactionData = payload.data;
      const reactionKey = reactionData?.key || reactionData?.reaction?.key || {};
      const messageId = reactionKey?.id;
      const numericMsgId = reactionData?.msgId?.toString();
      
      // Get reaction emoji - can be empty string if reaction was removed
      const reaction = reactionData?.reaction?.text || reactionData?.text || "";
      const fromMe = reactionKey?.fromMe || false;
      
      console.log(`[Wasender Webhook] Reaction event - messageId: ${messageId}, reaction: "${reaction}", fromMe: ${fromMe}`);
      
      // Update message with reaction
      if (messageId || numericMsgId) {
        const targetId = messageId || numericMsgId;
        
        // Get current message to update reactions
        const { data: currentMsg } = await supabase
          .from("whatsapp_messages")
          .select("id, reaction")
          .eq("message_id", targetId)
          .single();
        
        if (currentMsg) {
          // If reaction is empty, it means reaction was removed
          const newReaction = reaction || null;
          
          const { error } = await supabase
            .from("whatsapp_messages")
            .update({ reaction: newReaction })
            .eq("id", currentMsg.id);
          
          if (error) {
            console.log(`[Wasender Webhook] Error updating reaction: ${error.message}`);
          } else {
            console.log(`[Wasender Webhook] Message ${targetId} reaction updated to: "${newReaction || 'removed'}"`);
          }
        } else {
          console.log(`[Wasender Webhook] Message not found for reaction: ${targetId}`);
        }
      }
      
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    
    // Handle presence updates (typing/recording indicators from contacts)
    if (event === "presence.update") {
      const presenceData = payload.data;
      const remoteJid = presenceData?.id || presenceData?.remoteJid || "";
      const presences = presenceData?.presences || {};
      
      // Extract phone from remoteJid
      const phone = remoteJid.replace("@c.us", "").replace("@s.whatsapp.net", "").replace(/\D/g, "");
      
      if (phone && phone.length >= 8) {
        // Get the presence type from the presences object
        const presenceInfo = Object.values(presences)[0] as { lastKnownPresence?: string } | undefined;
        const presenceType = presenceInfo?.lastKnownPresence || "available";
        
        console.log(`[Wasender Webhook] Presence update from ${phone}: ${presenceType}`);
        
        // Broadcast presence via Supabase Realtime channel
        const broadcastChannel = supabase.channel("whatsapp-presence");
        await broadcastChannel.send({
          type: "broadcast",
          event: "presence",
          payload: {
            phone,
            presenceType,
            timestamp: Date.now(),
          },
        });
        supabase.removeChannel(broadcastChannel);
      }
      
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    
    // Only process message events
    if (event !== "messages.received" && event !== "messages.upsert") {
      console.log(`[Wasender Webhook] Ignoring event: ${event}`);
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    const messageData = payload.data?.messages || payload.data;
    
    if (!messageData) {
      console.log("[Wasender Webhook] No message data found");
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Extract key information
    const key = messageData.key || {};
    // WasenderAPI provides two types of IDs:
    // 1. msgId (numeric) - used for replyTo parameter when sending replies
    // 2. key.id (string) - WhatsApp's internal message ID, used in contextInfo.stanzaId for quoted messages
    const numericMsgId = messageData.msgId || payload.data?.msgId;
    const whatsappKeyId = key.id || messageData.id || null;
    // For message_id, prioritize numeric msgId (needed for replyTo), fallback to key.id
    const messageId = numericMsgId ? String(numericMsgId) : (whatsappKeyId || `${Date.now()}`);
    console.log(`[Wasender Webhook] Message IDs - message_id: ${messageId}, whatsapp_key_id: ${whatsappKeyId || "N/A"}, numeric: ${numericMsgId || "N/A"}`);
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
      // Only use caption if present, no fallback emoji/text
      text = message.imageMessage.caption || "";

      // Try to download and upload media
      if (message.imageMessage.mediaKey && message.imageMessage.url) {
        mediaUrl = await downloadAndUploadMedia(
          message.imageMessage.url,
          message.imageMessage.mediaKey,
          message.imageMessage.mimetype || "image/jpeg",
          supabase,
          messageData
        );
      }
    } else if (message.audioMessage || message.pttMessage) {
      mediaType = "audio";
      // Don't set placeholder text for audio - let the UI handle it

      const audioMsg = message.audioMessage || message.pttMessage;
      if (audioMsg?.mediaKey && audioMsg?.url) {
        mediaUrl = await downloadAndUploadMedia(
          audioMsg.url,
          audioMsg.mediaKey,
          audioMsg.mimetype || "audio/ogg; codecs=opus",
          supabase,
          messageData
        );
      }
    } else if (message.videoMessage) {
      mediaType = "video";
      // Only use caption if present, no fallback emoji/text
      text = message.videoMessage.caption || "";

      if (message.videoMessage.mediaKey && message.videoMessage.url) {
        mediaUrl = await downloadAndUploadMedia(
          message.videoMessage.url,
          message.videoMessage.mediaKey,
          message.videoMessage.mimetype || "video/mp4",
          supabase,
          messageData
        );
      }
    } else if (message.documentMessage) {
      mediaType = "document";
      text = text || `📄 ${message.documentMessage.fileName || "Documento"}`;

      if (message.documentMessage.mediaKey && message.documentMessage.url) {
        mediaUrl = await downloadAndUploadMedia(
          message.documentMessage.url,
          message.documentMessage.mediaKey,
          message.documentMessage.mimetype || "application/octet-stream",
          supabase,
          messageData
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

    // Extract quoted message info (contextInfo)
    // Note: stanzaId is WhatsApp's internal key.id, we need to look up the message by whatsapp_key_id
    const contextInfo = message.extendedTextMessage?.contextInfo || 
                        message.imageMessage?.contextInfo ||
                        message.videoMessage?.contextInfo ||
                        message.audioMessage?.contextInfo ||
                        message.documentMessage?.contextInfo || null;
    
    let quotedMessageId: string | null = null;
    let quotedText: string | null = null;
    let quotedFromMe: boolean | null = null;

    if (contextInfo) {
      // stanzaId is the WhatsApp key.id of the quoted message
      const stanzaId = contextInfo.stanzaId || null;
      quotedFromMe = contextInfo.participant?.includes(Deno.env.get("WASENDER_PHONE") || "") || false;
      
      // Look up the quoted message by whatsapp_key_id to get the numeric message_id
      if (stanzaId) {
        const { data: quotedMsg } = await supabase
          .from("whatsapp_messages")
          .select("message_id, whatsapp_key_id, text, media_type, from_me")
          .or(`whatsapp_key_id.eq.${stanzaId},message_id.eq.${stanzaId}`)
          .maybeSingle();
        
        if (quotedMsg) {
          // Store the message_id (numeric) which can be used for our replies
          quotedMessageId = quotedMsg.message_id;
          quotedFromMe = quotedMsg.from_me;
          console.log(`[Wasender Webhook] Found quoted message: stanzaId=${stanzaId} -> message_id=${quotedMessageId}`);
        } else {
          // If not found, store the stanzaId as fallback
          quotedMessageId = stanzaId;
          console.log(`[Wasender Webhook] Quoted message not found in DB, using stanzaId: ${stanzaId}`);
        }
      }
      
      // Extract quoted message text based on type
      const quotedMessage = contextInfo.quotedMessage;
      if (quotedMessage) {
        quotedText = quotedMessage.conversation ||
                     quotedMessage.extendedTextMessage?.text ||
                     (quotedMessage.imageMessage ? "📷 Imagem" : null) ||
                     (quotedMessage.videoMessage ? "🎥 Vídeo" : null) ||
                     (quotedMessage.audioMessage || quotedMessage.pttMessage ? "🎵 Áudio" : null) ||
                     (quotedMessage.documentMessage ? `📄 ${quotedMessage.documentMessage.fileName || "Documento"}` : null) ||
                     (quotedMessage.stickerMessage ? "🎨 Sticker" : null) ||
                     (quotedMessage.locationMessage ? "📍 Localização" : null) ||
                     (quotedMessage.contactMessage ? `👤 ${quotedMessage.contactMessage.displayName || "Contato"}` : null) ||
                     null;
      }
      
      console.log(`[Wasender Webhook] Quoted message: ${quotedMessageId}, text: ${quotedText?.substring(0, 50) || "N/A"}`);
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
        last_message_status: "RECEIVED",
        last_message_from_me: false,
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
    // Store both message_id (numeric for replyTo) and whatsapp_key_id (for quoted message matching)
    const { error: msgError } = await supabase
      .from("whatsapp_messages")
      .upsert({
        chat_id: chatData.id,
        message_id: messageId,
        whatsapp_key_id: whatsappKeyId,
        phone,
        text: text.substring(0, 2000),
        from_me: fromMe,
        status: "RECEIVED",
        media_type: mediaType,
        media_url: mediaUrl,
        created_at: timestamp,
        quoted_message_id: quotedMessageId,
        quoted_text: quotedText,
        quoted_from_me: quotedFromMe,
      }, { onConflict: "message_id" });

    if (msgError) {
      console.error("[Wasender Webhook] Error upserting message:", msgError);
    } else {
      console.log(`[Wasender Webhook] Message saved: ${messageId}`);
    }

    // Increment unread count atomically (if not from self)
    if (!fromMe) {
      await supabase.rpc("increment_unread_count", { chat_uuid: chatData.id });
      console.log(`[Wasender Webhook] Incremented unread count for chat ${chatData.id}`);
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
