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
        
        // Get conversations using Instagram Graph API
        const convResponse = await fetch(
          `https://graph.instagram.com/v21.0/${instagramId}/conversations?fields=participants{id,username},messages.limit(1){message,from,created_time}&access_token=${accessToken}`
        );
        const convData = await convResponse.json();
        console.log('Conversations data:', JSON.stringify(convData));
        
        if (convData.error) {
          return new Response(
            JSON.stringify({ success: false, error: convData.error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch profile pictures and names for each participant
        const conversationsWithPics = await Promise.all(
          (convData.data || []).map(async (conv: any) => {
            const participantsWithPics = await Promise.all(
              (conv.participants?.data || []).map(async (participant: any) => {
                // Skip if it's the connected account
                if (participant.id === instagramId) {
                  return participant;
                }
                
                try {
                  // Get profile picture and name using the user's ID
                  const profileResponse = await fetch(
                    `https://graph.instagram.com/v21.0/${participant.id}?fields=profile_pic,name,username&access_token=${accessToken}`
                  );
                  const profileData = await profileResponse.json();
                  
                  // Check for consent error - log but don't fail
                  if (profileData.error) {
                    console.log('Profile API error for', participant.id, ':', profileData.error.message);
                    // Return participant with username as fallback
                    return {
                      ...participant,
                      profile_pic: null,
                      name: null,
                      username: participant.username,
                      profile_error: profileData.error.message
                    };
                  }
                  
                  console.log('Profile data for', participant.id, JSON.stringify(profileData));
                  
                  return {
                    ...participant,
                    profile_pic: profileData.profile_pic || null,
                    name: profileData.name || null,
                    username: profileData.username || participant.username
                  };
                } catch (e) {
                  console.log('Error fetching profile for', participant.id, e);
                  return {
                    ...participant,
                    profile_pic: null,
                    name: null
                  };
                }
              })
            );
            
            return {
              ...conv,
              participants: { data: participantsWithPics }
            };
          })
        );
        
        return new Response(
          JSON.stringify({ success: true, conversations: conversationsWithPics }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-messages': {
        const { conversationId, limit = 100 } = params;
        
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
        
        // Get all messages for a specific conversation with attachments (for reels, images, videos)
        const msgResponse = await fetch(
          `https://graph.instagram.com/v21.0/${conversationId}?fields=messages.limit(${limit}){message,from,created_time,attachments{id,mime_type,name,size,video_data,image_data,file_url},story,shares{link,id,name,description}}&access_token=${accessToken}`
        );
        const msgData = await msgResponse.json();
        console.log('Messages data for conversation:', conversationId, JSON.stringify(msgData).substring(0, 1000));
        
        if (msgData.error) {
          return new Response(
            JSON.stringify({ success: false, error: msgData.error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Process messages to extract media from attachments and shares
        const processedMessages = (msgData.messages?.data || []).map((msg: any) => {
          let mediaType = null;
          let mediaUrl = null;
          let shareLink = null;
          let shareName = null;
          
          // Debug log for each message to understand structure
          if (msg.shares || msg.attachments || msg.story) {
            console.log('Message with media/share:', JSON.stringify({
              id: msg.id,
              hasShares: !!msg.shares,
              sharesData: msg.shares,
              hasAttachments: !!msg.attachments,
              attachmentsData: msg.attachments,
              hasStory: !!msg.story,
              storyData: msg.story,
              message: msg.message?.substring(0, 50)
            }));
          }
          
          // Check for shares (reels, posts shared) - handle both formats
          if (msg.shares?.data && msg.shares.data.length > 0) {
            const share = msg.shares.data[0];
            shareLink = share.link;
            shareName = share.name || share.description;
            console.log('Found share in shares.data:', JSON.stringify(share));
          } else if (msg.shares && !msg.shares.data) {
            // Alternative format: shares might be direct object
            shareLink = msg.shares.link;
            shareName = msg.shares.name || msg.shares.description;
            console.log('Found share as direct object:', JSON.stringify(msg.shares));
          }
          
          // Check for attachments (images, videos, audio, reels)
          if (msg.attachments?.data && msg.attachments.data.length > 0) {
            const attachment = msg.attachments.data[0];
            console.log('Found attachment:', JSON.stringify(attachment));
            
            // Check for reel/video in attachment
            if (attachment.video_data?.url) {
              mediaType = 'video';
              mediaUrl = attachment.video_data.url;
            } else if (attachment.image_data?.url) {
              mediaType = 'image';
              mediaUrl = attachment.image_data.url;
            } else if (attachment.file_url) {
              // Generic file - check mime type
              if (attachment.mime_type?.startsWith('video/')) {
                mediaType = 'video';
              } else if (attachment.mime_type?.startsWith('image/')) {
                mediaType = 'image';
              } else if (attachment.mime_type?.startsWith('audio/')) {
                mediaType = 'audio';
              } else {
                mediaType = 'file';
              }
              mediaUrl = attachment.file_url;
            }
            
            // Check if attachment contains a share/reel link
            if (attachment.target?.url && !shareLink) {
              shareLink = attachment.target.url;
              shareName = attachment.name || attachment.title;
              console.log('Found share in attachment.target:', shareLink);
            }
          }
          
          // Check for story mentions - handle multiple formats
          if (msg.story) {
            mediaType = 'story';
            mediaUrl = msg.story.url || msg.story.mention?.link || null;
            console.log('Found story:', JSON.stringify(msg.story));
          }
          
          // Check if message text contains Instagram URL as fallback
          if (!shareLink && msg.message) {
            const igUrlRegex = /https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\/[\w-]+/gi;
            const match = msg.message.match(igUrlRegex);
            if (match) {
              shareLink = match[0];
              console.log('Found Instagram URL in message text:', shareLink);
            }
          }
          
          return {
            ...msg,
            mediaType,
            mediaUrl,
            shareLink,
            shareName
          };
        });
        
        return new Response(
          JSON.stringify({ success: true, messages: processedMessages }),
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

      case 'send-media': {
        const { recipientId, mediaUrl, mediaType } = params;
        
        console.log('Send media request:', { recipientId, mediaUrl, mediaType });
        
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
        
        // Map mediaType to Instagram attachment type
        let attachmentType = 'image';
        if (mediaType === 'video' || mediaType?.startsWith('video/')) {
          attachmentType = 'video';
        } else if (mediaType === 'audio' || mediaType?.startsWith('audio/')) {
          attachmentType = 'audio';
        } else if (mediaType === 'image' || mediaType?.startsWith('image/')) {
          attachmentType = 'image';
        }
        
        console.log('Sending media with type:', attachmentType, 'to recipient:', recipientId);
        
        // Send media using Instagram Graph API
        const sendResponse = await fetch(
          `https://graph.instagram.com/v21.0/${instagramId}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: recipientId },
              message: {
                attachment: {
                  type: attachmentType,
                  payload: {
                    url: mediaUrl,
                    is_reusable: false
                  }
                }
              },
              access_token: accessToken,
            }),
          }
        );
        
        const sendData = await sendResponse.json();
        console.log('Send media response:', JSON.stringify(sendData));
        
        if (sendData.error) {
          console.error('Instagram API error:', sendData.error);
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
