import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  // WebSocket upgrade request
  if (upgradeHeader.toLowerCase() === "websocket") {
    const url = new URL(req.url);
    const systemPrompt = url.searchParams.get("systemPrompt") || "Você é a Scale, uma assistente de IA amigável e profissional. Responda em português brasileiro de forma natural e conversacional.";
    const voice = url.searchParams.get("voice") || "Cove";

    const XAI_API_KEY = Deno.env.get("XAI_API_KEY");
    if (!XAI_API_KEY) {
      return new Response("XAI_API_KEY not configured", { status: 500 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    let xaiSocket: WebSocket | null = null;
    let isConnected = false;

    socket.onopen = () => {
      console.log("[grok-voice] Client connected");
      
      // Connect to xAI Realtime API
      xaiSocket = new WebSocket("wss://api.x.ai/v1/realtime?model=grok-3-fast");

      xaiSocket.onopen = () => {
        console.log("[grok-voice] Connected to xAI");
        isConnected = true;

        // Send session configuration
        const sessionConfig = {
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: systemPrompt,
            voice: voice,
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: {
              model: "whisper-large-v3-turbo"
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 800
            },
            temperature: 0.8,
            max_response_output_tokens: "inf"
          }
        };

        xaiSocket!.send(JSON.stringify(sessionConfig));
        console.log("[grok-voice] Session config sent");
      };

      xaiSocket.onmessage = (event) => {
        // Forward xAI messages to client
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
        }
      };

      xaiSocket.onerror = (error) => {
        console.error("[grok-voice] xAI error:", error);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "error", message: "xAI connection error" }));
        }
      };

      xaiSocket.onclose = (event) => {
        console.log("[grok-voice] xAI connection closed:", event.code, event.reason);
        isConnected = false;
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "xai_disconnected" }));
        }
      };
    };

    socket.onmessage = (event) => {
      // Forward client messages to xAI
      if (xaiSocket && xaiSocket.readyState === WebSocket.OPEN) {
        xaiSocket.send(event.data);
      }
    };

    socket.onerror = (error) => {
      console.error("[grok-voice] Client error:", error);
    };

    socket.onclose = () => {
      console.log("[grok-voice] Client disconnected");
      if (xaiSocket) {
        xaiSocket.close();
        xaiSocket = null;
      }
    };

    return response;
  }

  // Regular HTTP request - return info
  return new Response(
    JSON.stringify({ 
      status: "ok", 
      message: "Grok Voice Realtime WebSocket endpoint. Connect via WebSocket.",
      voices: ["Cove", "Alloy", "Ash", "Ballad", "Coral", "Echo", "Fable", "Onyx", "Nova", "Sage", "Shimmer"]
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
