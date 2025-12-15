import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const wahaApiUrl = Deno.env.get("WAHA_API_URL")!;
const wahaApiKey = Deno.env.get("WAHA_API_KEY") || "";

const isWhatsAppLid = (id: string): boolean => {
  if (!id) return false;
  const cleaned = id.replace(/\D/g, "");
  if (cleaned.length > 14) return true;
  if (/^(120|146|180|203|234|447)\d{10,}$/.test(cleaned)) return true;
  return false;
};

const extractPhoneFromLidResponse = (data: any): string | null => {
  if (!data) return null;
  const candidates = [
    data.phoneNumber,
    data.phone_number,
    data.pn,
    data.number,
    typeof data.chatId === "string" ? data.chatId.split("@")[0] : null,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const cleaned = String(candidate).replace(/\D/g, "");
    if (cleaned && !isWhatsAppLid(cleaned)) return cleaned;
  }

  if (typeof data === "string") {
    const cleaned = data.replace(/\D/g, "");
    if (cleaned && !isWhatsAppLid(cleaned)) return cleaned;
  }

  return null;
};

const resolveLidToPhone = async (lid: string, session: string): Promise<string | null> => {
  try {
    const cleaned = lid.replace(/\D/g, "");
    if (!cleaned) return null;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (wahaApiKey) headers["X-Api-Key"] = wahaApiKey;

    const res = await fetch(`${wahaApiUrl}/api/${session}/lids/${cleaned}`, {
      method: "GET",
      headers,
    });

    const data = await res.json();
    if (!res.ok) return null;

    return extractPhoneFromLidResponse(data);
  } catch {
    return null;
  }
};

const normalizeRawId = (raw: string): { id: string; kind: "cus" | "lid" | "other" } => {
  const s = String(raw || "");
  if (!s) return { id: "", kind: "other" };
  if (s.includes("@g.us") || s.includes("@newsletter") || s.includes("status@broadcast")) {
    return { id: "", kind: "other" };
  }
  if (s.includes("@lid")) return { id: s.split("@")[0], kind: "lid" };
  if (s.includes("@c.us") || s.includes("@s.whatsapp.net")) return { id: s.split("@")[0], kind: "cus" };
  return { id: s.replace(/\D/g, ""), kind: isWhatsAppLid(s) ? "lid" : "other" };
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const eventType = payload.event || "unknown";
    const session = payload.session || "default";
    const messagePayload = payload.payload || {};

    if (eventType === "message" || eventType === "message.any") {
      const fromMe = messagePayload.fromMe || false;
      const messageId = messagePayload.id || null;
      const messageText = messagePayload.body || "";
      const timestamp = messagePayload.timestamp || null;
      const hasMedia = messagePayload.hasMedia || false;
      const mediaUrl = messagePayload.media?.url || null;
      const mediaType = hasMedia ? (messagePayload.media?.mimetype?.split("/")[0] || "file") : null;

      // Choose the other party id
      const rawContact = fromMe ? messagePayload.to : messagePayload.from;
      const fallbackContact = messagePayload.from || messagePayload.to || "";
      const { id: rawId, kind } = normalizeRawId(rawContact || fallbackContact);

      if (!rawId) {
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let phone = rawId;
      if (kind === "lid" || isWhatsAppLid(rawId)) {
        const resolved = await resolveLidToPhone(rawId, session);
        if (resolved) {
          console.log(`Resolved webhook LID ${rawId} -> ${resolved}`);
          phone = resolved;
        }
      }

      const senderNameRaw = payload.me?.pushName || messagePayload._data?.notifyName || messagePayload.notifyName || null;
      const senderName = senderNameRaw ? String(senderNameRaw).trim() : "";
      const senderNameIsBad = !senderName || /^\d+$/.test(senderName) || senderName === phone;

      // Preserve existing good name if this event comes from a LID
      let existingName: string | null = null;
      const { data: existingChat } = await supabase
        .from("whatsapp_chats")
        .select("name")
        .eq("phone", phone)
        .maybeSingle();
      existingName = existingChat?.name || null;
      const existingIsGood = !!existingName && !/^\d+$/.test(existingName) && existingName !== phone;

      const displayName = !senderNameIsBad ? senderName : (existingIsGood ? (existingName as string) : phone);

      if (phone && (messageText || hasMedia)) {
        const { data: chatData, error: chatError } = await supabase
          .from("whatsapp_chats")
          .upsert(
            {
              phone,
              name: displayName,
              last_message: messageText || `[${mediaType}]`,
              last_message_time: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
              unread_count: fromMe ? 0 : 1,
            },
            { onConflict: "phone", ignoreDuplicates: false }
          )
          .select()
          .single();

        if (chatError) {
          console.error("Error upserting chat:", chatError);
        }

        if (chatData?.id && messageId) {
          const { error: messageError } = await supabase
            .from("whatsapp_messages")
            .upsert(
              {
                chat_id: chatData.id,
                message_id: messageId,
                phone,
                text: messageText,
                from_me: fromMe,
                status: fromMe ? "SENT" : "RECEIVED",
                media_url: mediaUrl,
                media_type: mediaType,
              },
              {
                onConflict: "message_id",
                ignoreDuplicates: false,
              }
            );

          if (messageError) {
            console.error("Error inserting/updating message:", messageError);
          }

          if (!fromMe) {
            const currentUnread = chatData.unread_count || 0;
            await supabase
              .from("whatsapp_chats")
              .update({ unread_count: currentUnread + 1 })
              .eq("id", chatData.id);
          }
        }
      }
    }

    if (eventType === "message.ack") {
      const messageId = messagePayload.id || null;
      const ack = messagePayload.ack;

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
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in waha-webhook function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
