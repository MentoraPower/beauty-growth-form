import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const INSTAGRAM_APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  // Handle GET request for webhook verification
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    console.log('[Instagram Webhook] Verification request:', { mode, token, challenge });
    
    // The verify token should match what you set in Meta Developer Console
    const VERIFY_TOKEN = Deno.env.get('INSTAGRAM_WEBHOOK_VERIFY_TOKEN') || 'instagram_webhook_verify_token_2024';
    
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Instagram Webhook] Verification successful');
      return new Response(challenge, { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    } else {
      console.error('[Instagram Webhook] Verification failed - token mismatch');
      return new Response('Verification failed', { status: 403 });
    }
  }

  // Handle POST request for incoming webhooks
  if (req.method === 'POST') {
    try {
      const body = await req.text();
      console.log('[Instagram Webhook] Received webhook:', body);
      
      // Verify signature if app secret is available
      if (INSTAGRAM_APP_SECRET) {
        const signature = req.headers.get('x-hub-signature-256');
        if (signature) {
          // In production, verify the signature using HMAC SHA256
          // For now, we'll log it
          console.log('[Instagram Webhook] Signature present:', signature.substring(0, 20) + '...');
        }
      }
      
      const data = JSON.parse(body);
      
      // Process the webhook data
      if (data.object === 'instagram') {
        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
        
        // Get connection info for user ID matching
        const { data: connection } = await supabase
          .from('instagram_connections')
          .select('instagram_user_id, access_token')
          .limit(1)
          .single();
        
        const myInstagramUserId = connection?.instagram_user_id;
        
        for (const entry of data.entry || []) {
          console.log('[Instagram Webhook] Processing entry:', JSON.stringify(entry));
          
          // Handle messaging events
          if (entry.messaging) {
            for (const messagingEvent of entry.messaging) {
              await processMessagingEvent(supabase, messagingEvent, myInstagramUserId);
            }
          }
          
          // Handle changes (alternative format)
          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.field === 'messages') {
                await processMessageChange(supabase, change.value, myInstagramUserId);
              }
            }
          }
        }
      }
      
      // Always return 200 OK to acknowledge receipt
      return new Response('EVENT_RECEIVED', { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
      
    } catch (error) {
      console.error('[Instagram Webhook] Error processing webhook:', error);
      // Still return 200 to prevent retries for parsing errors
      return new Response('EVENT_RECEIVED', { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});

async function processMessagingEvent(supabase: any, event: any, myInstagramUserId: string | null) {
  console.log('[Instagram Webhook] Processing messaging event:', JSON.stringify(event));
  
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  const timestamp = event.timestamp;
  const message = event.message;
  
  if (!message) {
    console.log('[Instagram Webhook] No message in event, skipping');
    return;
  }
  
  const messageId = message.mid || message.id || `msg_${timestamp}`;
  const text = message.text || null;
  const isFromMe = senderId === myInstagramUserId;
  
  // Determine conversation ID (use the other participant's ID)
  const conversationParticipantId = isFromMe ? recipientId : senderId;
  
  // Check for media attachments
  let mediaType = null;
  let mediaUrl = null;
  let shareLink = null;
  let shareName = null;
  
  if (message.attachments && message.attachments.length > 0) {
    const attachment = message.attachments[0];
    mediaType = attachment.type;
    mediaUrl = attachment.payload?.url;
    
    if (attachment.type === 'share') {
      shareLink = attachment.payload?.url;
      shareName = attachment.payload?.title;
    }
  }
  
  // Try to find the conversation ID from existing chats
  const { data: existingChat } = await supabase
    .from('instagram_chats')
    .select('conversation_id')
    .eq('participant_id', conversationParticipantId)
    .limit(1)
    .single();
  
  const conversationId = existingChat?.conversation_id || `conv_${conversationParticipantId}`;
  
  console.log('[Instagram Webhook] Saving message:', {
    messageId,
    conversationId,
    text: text?.substring(0, 50),
    isFromMe,
    mediaType
  });
  
  // Save message to database
  const { error: msgError } = await supabase
    .from('instagram_messages')
    .upsert({
      message_id: messageId,
      conversation_id: conversationId,
      text,
      from_me: isFromMe,
      status: isFromMe ? 'SENT' : 'RECEIVED',
      media_type: mediaType,
      media_url: mediaUrl,
      share_link: shareLink,
      share_name: shareName,
      created_at: new Date(timestamp).toISOString(),
    }, { onConflict: 'message_id' });
  
  if (msgError) {
    console.error('[Instagram Webhook] Error saving message:', msgError);
  } else {
    console.log('[Instagram Webhook] Message saved successfully');
  }
  
  // Update chat with latest message
  const { error: chatError } = await supabase
    .from('instagram_chats')
    .upsert({
      conversation_id: conversationId,
      participant_id: conversationParticipantId,
      last_message: text || (mediaType ? `[${mediaType}]` : '[mensagem]'),
      last_message_time: new Date(timestamp).toISOString(),
      unread_count: isFromMe ? 0 : 1, // Increment for incoming messages
    }, { 
      onConflict: 'conversation_id',
      ignoreDuplicates: false 
    });
  
  if (chatError) {
    console.error('[Instagram Webhook] Error updating chat:', chatError);
  } else {
    console.log('[Instagram Webhook] Chat updated successfully');
  }
}

async function processMessageChange(supabase: any, value: any, myInstagramUserId: string | null) {
  console.log('[Instagram Webhook] Processing message change:', JSON.stringify(value));
  
  // Handle different message change formats
  const senderId = value.sender?.id || value.from?.id;
  const recipientId = value.recipient?.id;
  const messageId = value.message?.mid || value.id || `msg_${Date.now()}`;
  const text = value.message?.text || value.text || null;
  const timestamp = value.timestamp || Date.now();
  const isFromMe = senderId === myInstagramUserId;
  
  // Determine conversation participant
  const conversationParticipantId = isFromMe ? recipientId : senderId;
  
  if (!conversationParticipantId) {
    console.log('[Instagram Webhook] Could not determine conversation participant, skipping');
    return;
  }
  
  // Check for media
  let mediaType = null;
  let mediaUrl = null;
  let shareLink = null;
  let shareName = null;
  
  if (value.message?.attachments) {
    const attachment = value.message.attachments[0];
    mediaType = attachment.type;
    mediaUrl = attachment.payload?.url;
    
    if (attachment.type === 'share') {
      shareLink = attachment.payload?.url;
      shareName = attachment.payload?.title;
    }
  }
  
  // Try to find existing conversation
  const { data: existingChat } = await supabase
    .from('instagram_chats')
    .select('conversation_id')
    .eq('participant_id', conversationParticipantId)
    .limit(1)
    .single();
  
  const conversationId = existingChat?.conversation_id || `conv_${conversationParticipantId}`;
  
  console.log('[Instagram Webhook] Saving message from change:', {
    messageId,
    conversationId,
    text: text?.substring(0, 50),
    isFromMe
  });
  
  // Save message
  const { error: msgError } = await supabase
    .from('instagram_messages')
    .upsert({
      message_id: messageId,
      conversation_id: conversationId,
      text,
      from_me: isFromMe,
      status: isFromMe ? 'SENT' : 'RECEIVED',
      media_type: mediaType,
      media_url: mediaUrl,
      share_link: shareLink,
      share_name: shareName,
      created_at: new Date(timestamp).toISOString(),
    }, { onConflict: 'message_id' });
  
  if (msgError) {
    console.error('[Instagram Webhook] Error saving message:', msgError);
  }
  
  // Update chat
  const { error: chatError } = await supabase
    .from('instagram_chats')
    .upsert({
      conversation_id: conversationId,
      participant_id: conversationParticipantId,
      last_message: text || (mediaType ? `[${mediaType}]` : '[mensagem]'),
      last_message_time: new Date(timestamp).toISOString(),
      unread_count: isFromMe ? 0 : 1,
    }, { 
      onConflict: 'conversation_id',
      ignoreDuplicates: false 
    });
  
  if (chatError) {
    console.error('[Instagram Webhook] Error updating chat:', chatError);
  }
}
