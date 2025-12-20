import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();
    console.log(`Instagram API action: ${action}`, params);
    
    const INSTAGRAM_APP_ID = Deno.env.get('INSTAGRAM_APP_ID');
    const INSTAGRAM_APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Instagram App ID ou App Secret não configurados' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    switch (action) {
      case 'get-oauth-url': {
        // Generate Instagram Business Login OAuth URL
        const redirectUri = params?.redirectUri;
        const scope = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish';
        
        // Use Instagram OAuth endpoint (not Facebook)
        const oauthUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${INSTAGRAM_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code`;
        
        console.log('Generated Instagram OAuth URL:', oauthUrl);
        
        return new Response(
          JSON.stringify({ success: true, oauthUrl, appId: INSTAGRAM_APP_ID }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'exchange-code': {
        // Exchange authorization code for access token using Instagram API
        const { code, redirectUri } = params;
        
        if (!code) {
          return new Response(
            JSON.stringify({ success: false, error: 'Código de autorização não fornecido' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Exchanging code for Instagram token with redirectUri:', redirectUri);
        
        // Get short-lived token from Instagram API
        const tokenFormData = new URLSearchParams();
        tokenFormData.append('client_id', INSTAGRAM_APP_ID);
        tokenFormData.append('client_secret', INSTAGRAM_APP_SECRET);
        tokenFormData.append('grant_type', 'authorization_code');
        tokenFormData.append('redirect_uri', redirectUri);
        tokenFormData.append('code', code);
        
        console.log('Token request params:', tokenFormData.toString());
        
        const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenFormData,
        });
        
        const tokenData = await tokenResponse.json();
        console.log('Instagram token response:', JSON.stringify(tokenData));
        
        if (tokenData.error_type || tokenData.error_message) {
          return new Response(
            JSON.stringify({ success: false, error: tokenData.error_message || tokenData.error_type }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const shortLivedToken = tokenData.access_token;
        const instagramUserId = tokenData.user_id?.toString();
        
        if (!shortLivedToken) {
          return new Response(
            JSON.stringify({ success: false, error: 'Não foi possível obter token de acesso' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Exchange for long-lived token using Graph API
        const longLivedResponse = await fetch(
          `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_APP_SECRET}&access_token=${shortLivedToken}`,
          { method: 'GET' }
        );
        
        const longLivedData = await longLivedResponse.json();
        console.log('Long-lived token response:', JSON.stringify(longLivedData));
        
        const accessToken = longLivedData.access_token || shortLivedToken;
        const expiresIn = longLivedData.expires_in;
        
        // Get Instagram user info
        const userResponse = await fetch(
          `https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${accessToken}`
        );
        const userData = await userResponse.json();
        console.log('Instagram user data:', JSON.stringify(userData));
        
        const instagramUsername = userData.username;
        const finalInstagramUserId = userData.user_id || instagramUserId;
        
        // Calculate expiration
        const tokenExpiresAt = expiresIn 
          ? new Date(Date.now() + expiresIn * 1000).toISOString()
          : null;
        
        // Delete existing connections and insert new one
        await supabase
          .from('instagram_connections')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        
        const connectionData = {
          instagram_user_id: finalInstagramUserId,
          instagram_username: instagramUsername,
          access_token: accessToken,
          token_expires_at: tokenExpiresAt,
          page_id: null,
          page_access_token: null,
        };
        
        console.log('Saving connection data:', JSON.stringify(connectionData));
        
        const { error: insertError } = await supabase
          .from('instagram_connections')
          .insert(connectionData);
        
        if (insertError) {
          console.error('Error saving connection:', insertError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao salvar conexão: ' + insertError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            instagramUsername,
            instagramUserId: finalInstagramUserId,
            message: 'Conexão salva com sucesso!'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'check-connection': {
        // Check if there's a saved connection
        const { data: connection, error } = await supabase
          .from('instagram_connections')
          .select('*')
          .limit(1)
          .single();
        
        if (error || !connection) {
          return new Response(
            JSON.stringify({ success: false, connected: false, error: 'Nenhuma conexão encontrada' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Verify token is still valid using Instagram Graph API
        const testResponse = await fetch(
          `https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${connection.access_token}`
        );
        const testData = await testResponse.json();
        
        if (testData.error) {
          console.log('Token validation error:', JSON.stringify(testData));
          return new Response(
            JSON.stringify({ 
              success: false, 
              connected: false, 
              error: 'Token expirado ou inválido',
              needsReauth: true 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            connected: true,
            instagramUsername: connection.instagram_username || testData.username,
            instagramUserId: connection.instagram_user_id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-conversations': {
        // Get saved connection
        const { data: connection, error: connError } = await supabase
          .from('instagram_connections')
          .select('*')
          .limit(1)
          .single();
        
        if (connError || !connection) {
          return new Response(
            JSON.stringify({ success: false, error: 'Conexão não encontrada' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const accessToken = connection.access_token;
        const instagramId = connection.instagram_user_id;
        
        // Get conversations using Instagram Graph API with profile picture
        const convResponse = await fetch(
          `https://graph.instagram.com/v21.0/${instagramId}/conversations?fields=participants{id,username,profile_pic},messages.limit(1){message,from,created_time}&access_token=${accessToken}`
        );
        const convData = await convResponse.json();
        console.log('Conversations data:', JSON.stringify(convData));
        
        if (convData.error) {
          return new Response(
            JSON.stringify({ success: false, error: convData.error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: true, conversations: convData.data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-messages': {
        const { conversationId, limit = 50 } = params;
        
        // Get saved connection
        const { data: connection, error: connError } = await supabase
          .from('instagram_connections')
          .select('*')
          .limit(1)
          .single();
        
        if (connError || !connection) {
          return new Response(
            JSON.stringify({ success: false, error: 'Conexão não encontrada' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const accessToken = connection.access_token;
        
        // Get all messages for a specific conversation
        const msgResponse = await fetch(
          `https://graph.instagram.com/v21.0/${conversationId}?fields=messages.limit(${limit}){message,from,created_time,attachments}&access_token=${accessToken}`
        );
        const msgData = await msgResponse.json();
        console.log('Messages data for conversation:', conversationId);
        
        if (msgData.error) {
          return new Response(
            JSON.stringify({ success: false, error: msgData.error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: true, messages: msgData.messages?.data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send-message': {
        const { recipientId, message } = params;
        
        // Get saved connection
        const { data: connection, error: connError } = await supabase
          .from('instagram_connections')
          .select('*')
          .limit(1)
          .single();
        
        if (connError || !connection) {
          return new Response(
            JSON.stringify({ success: false, error: 'Conexão não encontrada' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const accessToken = connection.access_token;
        const instagramId = connection.instagram_user_id;
        
        const sendResponse = await fetch(
          `https://graph.instagram.com/v21.0/${instagramId}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: recipientId },
              message: { text: message },
              access_token: accessToken,
            }),
          }
        );
        
        const sendData = await sendResponse.json();
        console.log('Send message response:', JSON.stringify(sendData));
        
        if (sendData.error) {
          return new Response(
            JSON.stringify({ success: false, error: sendData.error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: true, messageId: sendData.message_id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'disconnect': {
        // Remove connection from database
        const { error } = await supabase
          .from('instagram_connections')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        
        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: true, message: 'Desconectado com sucesso' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Ação não reconhecida' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in instagram-api function:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
