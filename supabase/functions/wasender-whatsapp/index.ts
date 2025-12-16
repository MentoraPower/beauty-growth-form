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
const WASENDER_BASE_URL = "https://www.wasenderapi.com/api";

// Helper: Format phone for WasenderAPI (E.164 without @c.us)
function formatPhoneForApi(phone: string): string {
  return phone.replace(/\D/g, "");
}

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

// Helper: Check if phone is a WhatsApp LID (internal ID)
function isWhatsAppLID(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length > 14) return true;
  if (/^(120|146|180|203|234|447)\d{10,}$/.test(cleaned)) return true;
  return false;
}

// Helper: Normalize contact name
function normalizeName(value: any, phoneDigits: string): string | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str || str.length < 2) return null;
  const digitsInName = str.replace(/\D/g, "");
  if (digitsInName.length >= 8 && phoneDigits.includes(digitsInName.slice(-8))) return null;
  if (/^\+?\d[\d\s\-()]+$/.test(str)) return null;
  return str;
}

// WasenderAPI request helper
async function wasenderRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${WASENDER_BASE_URL}${endpoint}`;
  console.log(`[Wasender] Request: ${options.method || "GET"} ${url}`);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${WASENDER_API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const text = await response.text();
  console.log(`[Wasender] Response ${response.status}: ${text.substring(0, 500)}`);

  if (!response.ok) {
    throw new Error(`WasenderAPI error ${response.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Resolve LID to phone number
async function resolveLidToPhone(lid: string): Promise<string | null> {
  try {
    const lidClean = lid.replace("@lid", "").replace(/\D/g, "");
    console.log(`[Wasender] Resolving LID: ${lidClean}`);
    
    const result = await wasenderRequest(`/pn-from-lid/${lidClean}`);
    if (result?.phoneNumber) {
      const phone = result.phoneNumber.replace(/\D/g, "");
      console.log(`[Wasender] Resolved LID ${lidClean} -> ${phone}`);
      return phone;
    }
    return null;
  } catch (error) {
    console.error(`[Wasender] Failed to resolve LID:`, error);
    return null;
  }
}

// Fetch contact info (name, photo) using WasenderAPI
async function fetchContactInfo(phone: string): Promise<{ name: string | null; imgUrl: string | null }> {
  try {
    // WasenderAPI endpoint: GET /api/contacts/{contactPhoneNumber}
    const formattedPhone = phone.replace(/\D/g, "");
    
    console.log(`[Wasender] Fetching contact info for: ${formattedPhone}`);
    
    const result = await wasenderRequest(`/contacts/${formattedPhone}`);
    
    console.log(`[Wasender] Contact info result:`, JSON.stringify(result));
    
    // WasenderAPI returns { success: true, data: { id, name, notify, verifiedName, imgUrl, status } }
    const data = result?.data || {};
    const name = data.name || data.notify || data.verifiedName || null;
    const imgUrl = data.imgUrl || null;
    
    console.log(`[Wasender] Contact ${formattedPhone}: name=${name}, photo=${imgUrl ? "Yes" : "No"}`);
    
    return { name, imgUrl };
  } catch (error) {
    console.error(`[Wasender] Failed to fetch contact info for ${phone}:`, error);
    return { name: null, imgUrl: null };
  }
}

// Fetch contact profile picture using WasenderAPI (dedicated endpoint)
async function fetchContactPicture(phone: string): Promise<string | null> {
  try {
    // WasenderAPI endpoint: GET /api/contacts/{contactPhoneNumber}/picture
    const formattedPhone = phone.replace(/\D/g, "");
    
    console.log(`[Wasender] Fetching profile picture for: ${formattedPhone}`);
    
    const result = await wasenderRequest(`/contacts/${formattedPhone}/picture`);
    
    console.log(`[Wasender] Profile picture result:`, JSON.stringify(result));
    
    // WasenderAPI returns { success: true, data: { imgUrl: "..." } }
    const imgUrl = result?.data?.imgUrl || result?.imgUrl || null;
    
    return imgUrl;
  } catch (error) {
    console.error(`[Wasender] Failed to fetch picture for ${phone}:`, error);
    return null;
  }
}

// Get all contacts with photos
async function fetchAllContacts(): Promise<Map<string, { name: string; imgUrl: string | null }>> {
  const contactsMap = new Map<string, { name: string; imgUrl: string | null }>();
  
  try {
    const result = await wasenderRequest("/contacts");
    // WasenderAPI returns { success: true, data: [...] }
    const contacts = result?.data || [];
    
    console.log(`[Wasender] Fetched ${contacts?.length || 0} contacts`);
    
    if (!Array.isArray(contacts)) {
      console.error("[Wasender] Contacts is not an array:", typeof contacts);
      return contactsMap;
    }
    
    for (const contact of contacts) {
      const jid = contact.id || contact.jid || "";
      const phone = jid.replace("@c.us", "").replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "");
      
      if (phone && phone.length >= 8) {
        const name = contact.name || contact.notify || contact.pushname || contact.verifiedName || null;
        const imgUrl = contact.imgUrl || contact.profilePictureUrl || null;
        contactsMap.set(phone, { name, imgUrl });
      }
    }
    
    console.log(`[Wasender] Built contacts map with ${contactsMap.size} entries`);
  } catch (error) {
    console.error("[Wasender] Error fetching contacts:", error);
  }
  
  return contactsMap;
}

// WasenderAPI does NOT support fetching existing chats/messages via API
// Only new messages come through webhooks
// Return empty arrays for sync functions
async function fetchAllChats(): Promise<any[]> {
  console.log("[Wasender] Note: WasenderAPI does not have /api/chats endpoint. Returning empty array.");
  return [];
}

async function fetchChatMessages(chatId: string, limit = 100): Promise<any[]> {
  console.log("[Wasender] Note: WasenderAPI does not support fetching chat messages via API. Returning empty array.");
  return [];
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, phone, text, mediaUrl, filename, caption, presenceType, delayMs, msgId, newText, base64, mimetype } = body;
    console.log(`[Wasender] Action: ${action}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // =========================
    // ACTION: send-presence
    // =========================
    if (action === "send-presence") {
      const formattedPhone = formatPhoneForApi(phone);
      const jid = `${formattedPhone}@s.whatsapp.net`;
      
      console.log(`[Wasender] Sending presence ${presenceType} to ${jid}`);
      
      const body: any = { jid, type: presenceType };
      if (delayMs) body.delayMs = delayMs;
      
      const result = await wasenderRequest("/send-presence-update", {
        method: "POST",
        body: JSON.stringify(body),
      });

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================
    // ACTION: clear-all
    // =========================
    if (action === "clear-all") {
      console.log("[Wasender] Clearing all data...");
      await supabase.from("whatsapp_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("whatsapp_chats").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =========================
    // ACTION: send-text
    // =========================
    if (action === "send-text") {
      const to = formatPhoneForApi(phone);
      console.log(`[Wasender] Sending text to ${to}: ${text?.substring(0, 50)}...`);
      
      const result = await wasenderRequest("/send-message", {
        method: "POST",
        body: JSON.stringify({ to, text }),
      });

      return new Response(JSON.stringify({ success: true, messageId: result?.messageId || result?.key?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================
    // ACTION: send-image
    // =========================
    if (action === "send-image") {
      const to = formatPhoneForApi(phone);
      console.log(`[Wasender] Sending image to ${to}: ${mediaUrl}`);
      
      const payload: any = { to, imageUrl: mediaUrl };
      if (caption && typeof caption === "string" && caption.trim()) {
        payload.text = caption;
      }
      
      const result = await wasenderRequest("/send-message", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return new Response(JSON.stringify({ success: true, messageId: result?.messageId || result?.key?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================
    // ACTION: send-audio
    // =========================
    if (action === "send-audio") {
      const to = formatPhoneForApi(phone);
      console.log(`[Wasender] Sending audio to ${to}: ${mediaUrl}`);
      
      // Use /send-message with audioUrl parameter
      const result = await wasenderRequest("/send-message", {
        method: "POST",
        body: JSON.stringify({ 
          to, 
          audioUrl: mediaUrl,
        }),
      });

      return new Response(JSON.stringify({ success: true, messageId: result?.data?.msgId || result?.messageId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================
    // ACTION: get-profile-picture (also fetches name)
    // =========================
    if (action === "get-profile-picture") {
      const formattedPhone = formatPhoneForApi(phone);
      console.log(`[Wasender] Getting contact info for ${formattedPhone}`);
      
      // Use fetchContactInfo to get both name and photo in one call
      const contactInfo = await fetchContactInfo(formattedPhone);
      
      // If no photo from contact info, try dedicated picture endpoint
      let photoUrl = contactInfo.imgUrl;
      if (!photoUrl) {
        photoUrl = await fetchContactPicture(formattedPhone);
      }
      
      // Update the chat record in database with both name and photo
      const updateData: any = { updated_at: new Date().toISOString() };
      if (photoUrl) updateData.photo_url = photoUrl;
      if (contactInfo.name) updateData.name = contactInfo.name;
      
      if (photoUrl || contactInfo.name) {
        const { error } = await supabase
          .from("whatsapp_chats")
          .update(updateData)
          .eq("phone", formattedPhone);
        
        if (error) {
          console.error(`[Wasender] Error updating chat:`, error);
        } else {
          console.log(`[Wasender] Updated chat for ${formattedPhone}: name=${contactInfo.name}, photo=${photoUrl ? "Yes" : "No"}`);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        photoUrl,
        name: contactInfo.name,
        phone: formattedPhone 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================
    // ACTION: get-contact-info
    // =========================
    if (action === "get-contact-info") {
      const formattedPhone = formatPhoneForApi(phone);
      console.log(`[Wasender] Getting contact info for ${formattedPhone}`);
      
      const contactInfo = await fetchContactInfo(formattedPhone);
      
      // Also try to get photo from dedicated endpoint if not available
      let photoUrl = contactInfo.imgUrl;
      if (!photoUrl) {
        photoUrl = await fetchContactPicture(formattedPhone);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        name: contactInfo.name,
        photoUrl,
        phone: formattedPhone 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================
    // ACTION: send-file
    // =========================
    if (action === "send-file") {
      const to = formatPhoneForApi(phone);
      console.log(`[Wasender] Sending file to ${to}: ${mediaUrl}`);
      
      const result = await wasenderRequest("/send-message", {
        method: "POST",
        body: JSON.stringify({ 
          to, 
          documentUrl: mediaUrl,
          text: filename || "",
        }),
      });

      return new Response(JSON.stringify({ success: true, messageId: result?.messageId || result?.key?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================
    // ACTION: send-video
    // =========================
    if (action === "send-video") {
      const to = formatPhoneForApi(phone);
      console.log(`[Wasender] Sending video to ${to}: ${mediaUrl}`);
      
      const payload: any = { to, videoUrl: mediaUrl };
      if (caption && typeof caption === "string" && caption.trim()) {
        payload.text = caption;
      }
      
      const result = await wasenderRequest("/send-message", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return new Response(JSON.stringify({ success: true, messageId: result?.data?.msgId || result?.messageId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================
    // ACTION: upload-media (base64 upload to get temp URL)
    // =========================
    if (action === "upload-media") {
      console.log(`[Wasender] Uploading media, mimetype: ${mimetype}`);
      
      const result = await wasenderRequest("/upload", {
        method: "POST",
        body: JSON.stringify({ base64, mimetype }),
      });

      return new Response(JSON.stringify({ success: true, url: result?.data?.url || result?.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================
    // ACTION: edit-message
    // =========================
    if (action === "edit-message") {
      console.log(`[Wasender] Editing message ${msgId}`);
      
      const result = await wasenderRequest(`/messages/${msgId}`, {
        method: "PUT",
        body: JSON.stringify({ text: newText }),
      });

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================
    // ACTION: delete-message
    // =========================
    if (action === "delete-message") {
      console.log(`[Wasender] Deleting message ${msgId}`);
      
      if (!msgId) {
        return new Response(JSON.stringify({ error: "msgId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const result = await wasenderRequest(`/messages/${msgId}`, {
        method: "DELETE",
      });

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================
    // ACTION: get-message-info
    // =========================
    if (action === "get-message-info") {
      console.log(`[Wasender] Getting info for message ${msgId}`);
      
      const result = await wasenderRequest(`/messages/${msgId}`, {
        method: "GET",
      });

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================
    // ACTION: resend-message
    // =========================
    if (action === "resend-message") {
      console.log(`[Wasender] Resending message ${msgId}`);
      
      const result = await wasenderRequest(`/messages/${msgId}/resend`, {
        method: "POST",
      });

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================
    // ACTION: sync-all
    // =========================
    if (action === "sync-all") {
      console.log("[Wasender] Starting full sync...");
      
      // 1. Fetch all contacts first for name/photo lookup
      const contactsMap = await fetchAllContacts();
      
      // 2. Fetch all chats
      const chats = await fetchAllChats();
      console.log(`[Wasender] Found ${chats.length} chats`);

      let syncedChats = 0;
      let syncedMessages = 0;
      let skippedChats = 0;

      for (const chat of chats) {
        try {
          const chatId = chat.id || chat.jid || "";
          
          // Skip groups and broadcasts
          if (chatId.includes("@g.us") || chatId.includes("@newsletter") || chatId.includes("status@broadcast")) {
            skippedChats++;
            continue;
          }

          // Extract phone number
          let phone = chatId.replace("@c.us", "").replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "");
          
          // Resolve LID if needed
          if (isWhatsAppLID(phone) || chatId.includes("@lid")) {
            const resolvedPhone = await resolveLidToPhone(phone);
            if (resolvedPhone) {
              phone = resolvedPhone;
            } else {
              console.log(`[Wasender] Skipping unresolvable LID: ${chatId}`);
              skippedChats++;
              continue;
            }
          }

          // Skip invalid phones
          if (!phone || phone.length < 8 || phone === "0") {
            skippedChats++;
            continue;
          }

          // Get contact info from map
          const contactInfo = contactsMap.get(phone);
          let name = contactInfo?.name || chat.name || chat.pushname || chat.notify || null;
          let photoUrl = contactInfo?.imgUrl || chat.imgUrl || chat.profilePictureUrl || null;

          // Normalize name
          name = normalizeName(name, phone);
          if (!name) {
            name = formatPhoneDisplay(phone);
          }

          // Fetch photo if not available
          if (!photoUrl) {
            photoUrl = await fetchContactPicture(phone);
          }

          // Get last message info
          const lastMessage = chat.lastMessage?.body || chat.lastMessage?.text || chat.lastMsg || "";
          const lastMessageTime = chat.lastMessage?.timestamp 
            ? new Date(chat.lastMessage.timestamp * 1000).toISOString()
            : chat.conversationTimestamp 
              ? new Date(chat.conversationTimestamp * 1000).toISOString()
              : new Date().toISOString();

          console.log(`[Wasender] Chat: ${phone}, Name: ${name}, Photo: ${photoUrl ? "Yes" : "No"}`);

          // Upsert chat
          const { data: chatData, error: chatError } = await supabase
            .from("whatsapp_chats")
            .upsert({
              phone,
              name,
              photo_url: photoUrl,
              last_message: lastMessage.substring(0, 500),
              last_message_time: lastMessageTime,
              updated_at: new Date().toISOString(),
            }, { onConflict: "phone" })
            .select()
            .single();

          if (chatError) {
            console.error(`[Wasender] Error upserting chat ${phone}:`, chatError);
            continue;
          }

          syncedChats++;

          // 3. Fetch messages for this chat
          const messages = await fetchChatMessages(chatId);
          console.log(`[Wasender] Found ${messages.length} messages for ${phone}`);

          for (const msg of messages) {
            try {
              const messageId = msg.key?.id || msg.id || `${Date.now()}-${Math.random()}`;
              const fromMe = msg.key?.fromMe || msg.fromMe || false;
              const timestamp = msg.messageTimestamp 
                ? new Date(msg.messageTimestamp * 1000).toISOString()
                : new Date().toISOString();

              // Extract text from various message structures
              let text = msg.message?.conversation 
                || msg.message?.extendedTextMessage?.text
                || msg.body
                || msg.text
                || "";

              // Handle media
              let mediaType: string | null = null;
              let mediaUrl: string | null = null;

              if (msg.message?.imageMessage) {
                mediaType = "image";
                text = text || msg.message.imageMessage.caption || "📷 Imagem";
              } else if (msg.message?.audioMessage || msg.message?.pttMessage) {
                mediaType = "audio";
                text = text || "🎵 Áudio";
              } else if (msg.message?.videoMessage) {
                mediaType = "video";
                text = text || "🎥 Vídeo";
              } else if (msg.message?.documentMessage) {
                mediaType = "document";
                text = text || `📄 ${msg.message.documentMessage.fileName || "Documento"}`;
              } else if (msg.message?.stickerMessage) {
                mediaType = "sticker";
                text = text || "🎨 Sticker";
              }

              // Skip empty messages
              if (!text && !mediaType) continue;

              // Upsert message
              const { error: msgError } = await supabase
                .from("whatsapp_messages")
                .upsert({
                  chat_id: chatData.id,
                  message_id: messageId,
                  phone,
                  text: text.substring(0, 2000),
                  from_me: fromMe,
                  status: fromMe ? "SENT" : "RECEIVED",
                  media_type: mediaType,
                  media_url: mediaUrl,
                  created_at: timestamp,
                }, { onConflict: "message_id" });

              if (!msgError) syncedMessages++;

            } catch (msgError) {
              console.error(`[Wasender] Error processing message:`, msgError);
            }
          }

        } catch (chatError) {
          console.error(`[Wasender] Error processing chat:`, chatError);
          skippedChats++;
        }
      }

      console.log(`[Wasender] Sync complete. Chats: ${syncedChats}, Messages: ${syncedMessages}, Skipped: ${skippedChats}`);

      return new Response(JSON.stringify({ 
        success: true, 
        chats: syncedChats, 
        messages: syncedMessages,
        skipped: skippedChats 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[Wasender] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

serve(handler);
