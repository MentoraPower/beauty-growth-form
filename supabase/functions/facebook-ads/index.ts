import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { action, accessToken, adAccountId, campaignIds } = await req.json();
    
    const FACEBOOK_APP_ID = Deno.env.get('FACEBOOK_APP_ID');
    const FACEBOOK_APP_SECRET = Deno.env.get('FACEBOOK_APP_SECRET');

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
      console.error('Missing Facebook credentials');
      return new Response(
        JSON.stringify({ error: 'Facebook credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Get OAuth URL for login
    if (action === 'get-oauth-url') {
      const { redirectUri } = await req.json().catch(() => ({}));
      const scopes = 'ads_read,ads_management,business_management';
      const oauthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri || '')}&scope=${scopes}&response_type=code`;
      
      console.log('Generated OAuth URL');
      return new Response(
        JSON.stringify({ oauthUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Exchange code for access token
    if (action === 'exchange-token') {
      const { code, redirectUri } = await req.json().catch(() => ({}));
      
      console.log('Exchanging code for access token');
      const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${FACEBOOK_APP_SECRET}&code=${code}`;
      
      const tokenResponse = await fetch(tokenUrl);
      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        console.error('Token exchange error:', tokenData.error);
        return new Response(
          JSON.stringify({ error: tokenData.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get long-lived token
      const longLivedUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`;
      const longLivedResponse = await fetch(longLivedUrl);
      const longLivedData = await longLivedResponse.json();

      console.log('Token exchange successful');
      return new Response(
        JSON.stringify({ 
          accessToken: longLivedData.access_token || tokenData.access_token,
          expiresIn: longLivedData.expires_in || tokenData.expires_in
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Get ad accounts
    if (action === 'get-ad-accounts') {
      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'Access token required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Fetching ad accounts');
      const url = `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        console.error('Ad accounts error:', data.error);
        return new Response(
          JSON.stringify({ error: data.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Found ${data.data?.length || 0} ad accounts`);
      return new Response(
        JSON.stringify({ adAccounts: data.data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Get campaigns
    if (action === 'get-campaigns') {
      if (!accessToken || !adAccountId) {
        return new Response(
          JSON.stringify({ error: 'Access token and ad account ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Fetching campaigns for ad account: ${adAccountId}`);
      const url = `https://graph.facebook.com/v18.0/${adAccountId}/campaigns?fields=id,name,status,objective&access_token=${accessToken}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        console.error('Campaigns error:', data.error);
        return new Response(
          JSON.stringify({ error: data.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Found ${data.data?.length || 0} campaigns`);
      return new Response(
        JSON.stringify({ campaigns: data.data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Get campaign insights (spend, CPM, CPC)
    if (action === 'get-insights') {
      if (!accessToken || !campaignIds || !campaignIds.length) {
        return new Response(
          JSON.stringify({ error: 'Access token and campaign IDs required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Fetching insights for ${campaignIds.length} campaigns`);
      const insights = [];

      for (const campaignId of campaignIds) {
        const url = `https://graph.facebook.com/v18.0/${campaignId}/insights?fields=campaign_name,spend,cpm,cpc,impressions,clicks&date_preset=last_30d&access_token=${accessToken}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.data && data.data.length > 0) {
          insights.push({
            campaignId,
            ...data.data[0]
          });
        }
      }

      console.log(`Retrieved insights for ${insights.length} campaigns`);
      return new Response(
        JSON.stringify({ insights }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Facebook Ads function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
