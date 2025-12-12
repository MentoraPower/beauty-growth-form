import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = "+16365386720";

interface CallRequest {
  to: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to }: CallRequest = await req.json();

    if (!to) {
      throw new Error("Phone number is required");
    }

    // Format phone number
    let formattedTo = to.replace(/\D/g, "");
    if (!formattedTo.startsWith("+")) {
      formattedTo = "+" + formattedTo;
    }

    console.log(`Initiating call to ${formattedTo}`);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
    
    const authString = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const formData = new URLSearchParams();
    formData.append("Url", "http://demo.twilio.com/docs/voice.xml");
    formData.append("To", formattedTo);
    formData.append("From", TWILIO_FROM_NUMBER);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await response.json();
    
    console.log(`Twilio response status: ${response.status}`);
    console.log(`Twilio response:`, JSON.stringify(data).substring(0, 500));

    if (!response.ok) {
      console.error("Twilio error:", data);
      throw new Error(data.message || data.error_message || "Twilio request failed");
    }

    return new Response(JSON.stringify({ success: true, callSid: data.sid }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in twilio-call function:", error);
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
