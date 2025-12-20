import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INSTAGRAM_ACCESS_TOKEN = Deno.env.get('INSTAGRAM_ACCESS_TOKEN');
const INSTAGRAM_APP_ID = Deno.env.get('INSTAGRAM_APP_ID');
const INSTAGRAM_APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    console.log(`Instagram API action: ${action}`, params);

    // Check if credentials are configured
    if (!INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_APP_ID) {
      console.error('Instagram credentials not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Instagram credentials not configured',
          configured: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    switch (action) {
      case 'check-connection': {
        // Verify the access token is valid by getting the Instagram account info
        try {
          const response = await fetch(
            `${GRAPH_API_URL}/me?fields=id,name,username&access_token=${INSTAGRAM_ACCESS_TOKEN}`
          );
          
          const data = await response.json();
          console.log('Instagram connection check response:', data);

          if (data.error) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                connected: false,
                error: data.error.message,
                configured: true
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              connected: true,
              configured: true,
              account: {
                id: data.id,
                name: data.name,
                username: data.username
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Error checking Instagram connection:', error);
          return new Response(
            JSON.stringify({ 
              success: false, 
              connected: false,
              configured: true,
              error: errorMessage 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'get-conversations': {
        // Get Instagram conversations
        try {
          // First get the Instagram Business Account ID
          const pagesResponse = await fetch(
            `${GRAPH_API_URL}/me/accounts?access_token=${INSTAGRAM_ACCESS_TOKEN}`
          );
          const pagesData = await pagesResponse.json();
          console.log('Pages data:', pagesData);

          if (pagesData.error) {
            throw new Error(pagesData.error.message);
          }

          if (!pagesData.data || pagesData.data.length === 0) {
            return new Response(
              JSON.stringify({ 
                success: true, 
                conversations: [],
                message: 'No Facebook pages connected'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const pageId = pagesData.data[0].id;
          const pageAccessToken = pagesData.data[0].access_token;

          // Get Instagram Business Account
          const igAccountResponse = await fetch(
            `${GRAPH_API_URL}/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
          );
          const igAccountData = await igAccountResponse.json();
          console.log('IG Account data:', igAccountData);

          if (!igAccountData.instagram_business_account) {
            return new Response(
              JSON.stringify({ 
                success: true, 
                conversations: [],
                message: 'No Instagram Business Account connected to Facebook page'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const igAccountId = igAccountData.instagram_business_account.id;

          // Get conversations
          const conversationsResponse = await fetch(
            `${GRAPH_API_URL}/${igAccountId}/conversations?fields=id,participants,updated_time,messages{id,created_time,from,to,message}&access_token=${pageAccessToken}`
          );
          const conversationsData = await conversationsResponse.json();
          console.log('Conversations data:', conversationsData);

          return new Response(
            JSON.stringify({ 
              success: true, 
              conversations: conversationsData.data || [],
              igAccountId,
              pageAccessToken
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Error getting conversations:', error);
          return new Response(
            JSON.stringify({ success: false, error: errorMessage }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'send-message': {
        const { recipientId, message, pageAccessToken } = params;

        if (!recipientId || !message) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing recipientId or message' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          const response = await fetch(
            `${GRAPH_API_URL}/me/messages?access_token=${pageAccessToken || INSTAGRAM_ACCESS_TOKEN}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipient: { id: recipientId },
                message: { text: message }
              })
            }
          );

          const data = await response.json();
          console.log('Send message response:', data);

          if (data.error) {
            throw new Error(data.error.message);
          }

          return new Response(
            JSON.stringify({ success: true, messageId: data.message_id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Error sending message:', error);
          return new Response(
            JSON.stringify({ success: false, error: errorMessage }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Instagram API error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

serve(handler);
