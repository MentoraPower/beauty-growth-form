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
        // Generate Instagram OAuth URL
        const redirectUri = params?.redirectUri;
        const scope = 'instagram_basic,instagram_manage_messages,pages_messaging,pages_show_list,pages_read_engagement';
        
        const oauthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${INSTAGRAM_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;
        
        console.log('Generated OAuth URL:', oauthUrl);
        
        return new Response(
          JSON.stringify({ success: true, oauthUrl, appId: INSTAGRAM_APP_ID }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'exchange-code': {
        // Exchange authorization code for access token
        const { code, redirectUri } = params;
        
        if (!code) {
          return new Response(
            JSON.stringify({ success: false, error: 'Código de autorização não fornecido' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Exchanging code for token with redirectUri:', redirectUri);
        
        // Get short-lived token
        const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${INSTAGRAM_APP_ID}&client_secret=${INSTAGRAM_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`;
        console.log('Token URL:', tokenUrl);
        
        const tokenResponse = await fetch(tokenUrl, { method: 'GET' });
        const tokenData = await tokenResponse.json();
        console.log('Token response:', JSON.stringify(tokenData));
        
        if (tokenData.error) {
          return new Response(
            JSON.stringify({ success: false, error: tokenData.error.message || tokenData.error.type }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const shortLivedToken = tokenData.access_token;
        
        // Exchange for long-lived token
        const longLivedResponse = await fetch(
          `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${INSTAGRAM_APP_ID}&client_secret=${INSTAGRAM_APP_SECRET}&fb_exchange_token=${shortLivedToken}`,
          { method: 'GET' }
        );
        
        const longLivedData = await longLivedResponse.json();
        console.log('Long-lived token response:', JSON.stringify(longLivedData));
        
        const accessToken = longLivedData.access_token || shortLivedToken;
        const expiresIn = longLivedData.expires_in;
        
        // Get user info and pages
        const userResponse = await fetch(
          `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${accessToken}`
        );
        const userData = await userResponse.json();
        console.log('User data:', JSON.stringify(userData));
        
        // Get pages with Instagram accounts
        const pagesResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`
        );
        const pagesData = await pagesResponse.json();
        console.log('Pages data:', JSON.stringify(pagesData));
        
        let instagramUserId = null;
        let instagramUsername = null;
        let pageId = null;
        let pageAccessToken = null;
        
        if (pagesData.data && pagesData.data.length > 0) {
          for (const page of pagesData.data) {
            if (page.instagram_business_account) {
              pageId = page.id;
              pageAccessToken = page.access_token;
              instagramUserId = page.instagram_business_account.id;
              
              // Get Instagram username
              const igResponse = await fetch(
                `https://graph.facebook.com/v18.0/${instagramUserId}?fields=username&access_token=${pageAccessToken}`
              );
              const igData = await igResponse.json();
              console.log('Instagram data:', JSON.stringify(igData));
              instagramUsername = igData.username;
              break;
            }
          }
        }
        
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
          instagram_user_id: instagramUserId || userData.id,
          instagram_username: instagramUsername,
          access_token: pageAccessToken || accessToken,
          token_expires_at: tokenExpiresAt,
          page_id: pageId,
          page_access_token: pageAccessToken,
        };
        
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
            instagramUserId,
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
        
        // Verify token is still valid
        const testResponse = await fetch(
          `https://graph.facebook.com/v18.0/me?access_token=${connection.access_token}`
        );
        const testData = await testResponse.json();
        
        if (testData.error) {
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
            instagramUsername: connection.instagram_username,
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
        
        const accessToken = connection.page_access_token || connection.access_token;
        const instagramId = connection.instagram_user_id;
        
        // Get conversations
        const convResponse = await fetch(
          `https://graph.facebook.com/v18.0/${instagramId}/conversations?fields=participants,messages{message,from,created_time}&access_token=${accessToken}`
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
        
        const accessToken = connection.page_access_token || connection.access_token;
        const instagramId = connection.instagram_user_id;
        
        const sendResponse = await fetch(
          `https://graph.facebook.com/v18.0/${instagramId}/messages`,
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
