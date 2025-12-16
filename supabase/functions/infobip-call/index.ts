import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CallRequest {
  to: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const INFOBIP_API_KEY = Deno.env.get("INFOBIP_API_KEY");
    const INFOBIP_BASE_URL = Deno.env.get("INFOBIP_BASE_URL");
    const INFOBIP_FROM_NUMBER = Deno.env.get("INFOBIP_FROM_NUMBER");
    const INFOBIP_AGENT_NUMBER = Deno.env.get("INFOBIP_AGENT_NUMBER");

    if (!INFOBIP_API_KEY || !INFOBIP_BASE_URL || !INFOBIP_FROM_NUMBER || !INFOBIP_AGENT_NUMBER) {
      throw new Error("Missing Infobip configuration. Check secrets.");
    }

    const { to }: CallRequest = await req.json();

    if (!to) {
      throw new Error("Phone number is required");
    }

    // Format phone number - ensure it starts with country code
    let formattedTo = to.replace(/\D/g, "");
    if (!formattedTo.startsWith("+")) {
      formattedTo = "+" + formattedTo;
    }

    // Format agent number
    let formattedAgent = INFOBIP_AGENT_NUMBER.replace(/\D/g, "");
    if (!formattedAgent.startsWith("+")) {
      formattedAgent = "+" + formattedAgent;
    }

    console.log(`Initiating Click-to-Call: Agent ${formattedAgent} -> Lead ${formattedTo}`);

    // Infobip Click-to-Call API
    // First calls destinationA (agent), then connects to destinationB (lead)
    const infobipUrl = `${INFOBIP_BASE_URL}/voice/ctc/1/send`;

    const response = await fetch(infobipUrl, {
      method: "POST",
      headers: {
        "Authorization": `App ${INFOBIP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: INFOBIP_FROM_NUMBER,
        destinationA: formattedAgent,
        destinationB: formattedTo,
      }),
    });

    const data = await response.json();

    console.log(`Infobip response status: ${response.status}`);
    console.log(`Infobip response:`, JSON.stringify(data).substring(0, 500));

    if (!response.ok) {
      console.error("Infobip error:", data);
      throw new Error(data.requestError?.serviceException?.text || data.message || "Infobip request failed");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      callId: data.callId || data.bulkId 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in infobip-call function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
