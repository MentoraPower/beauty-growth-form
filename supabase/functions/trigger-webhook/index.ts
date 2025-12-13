import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface WebhookPayload {
  trigger: "lead_created" | "lead_moved" | "lead_updated" | "lead_deleted";
  lead: {
    id: string;
    name: string;
    email: string;
    whatsapp: string;
    instagram: string;
    service_area: string;
    monthly_billing: string;
    weekly_attendance: string;
    workspace_type: string;
    years_experience: string;
    pipeline_id: string | null;
    sub_origin_id: string | null;
    clinic_name?: string | null;
    average_ticket?: number | null;
    estimated_revenue?: number | null;
    is_mql?: boolean | null;
    created_at: string;
  };
  pipeline_id?: string | null;
  previous_pipeline_id?: string | null;
  sub_origin_id?: string | null;
  origin_id?: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();
    
    console.log("Trigger webhook received:", JSON.stringify(payload).substring(0, 500));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get active send webhooks
    const { data: webhooks, error: webhooksError } = await supabase
      .from("crm_webhooks")
      .select("*")
      .eq("type", "send")
      .eq("is_active", true);

    if (webhooksError) {
      console.error("Error fetching webhooks:", webhooksError);
      throw webhooksError;
    }

    if (!webhooks || webhooks.length === 0) {
      console.log("No active send webhooks found");
      return new Response(JSON.stringify({ success: true, triggered: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${webhooks.length} active send webhooks`);

    const triggeredWebhooks: string[] = [];

    for (const webhook of webhooks) {
      let shouldTrigger = false;

      // Check if trigger matches
      if (webhook.trigger === payload.trigger) {
        // For "lead_moved" trigger, also check specific pipeline
        if (webhook.trigger === "lead_moved") {
          if (webhook.trigger_pipeline_id) {
            // Check if lead was moved TO this specific pipeline
            shouldTrigger = payload.pipeline_id === webhook.trigger_pipeline_id;
          } else {
            // No specific pipeline, trigger on any move
            shouldTrigger = true;
          }
        } else {
          shouldTrigger = true;
        }
      }

      // Check scope filtering
      if (shouldTrigger && webhook.scope !== "all") {
        if (webhook.scope === "origin" && webhook.origin_id) {
          // Need to check if the lead's sub_origin belongs to this origin
          if (payload.sub_origin_id) {
            const { data: subOrigin } = await supabase
              .from("crm_sub_origins")
              .select("origin_id")
              .eq("id", payload.sub_origin_id)
              .single();
            
            shouldTrigger = subOrigin?.origin_id === webhook.origin_id;
          } else {
            shouldTrigger = false;
          }
        } else if (webhook.scope === "sub_origin" && webhook.sub_origin_id) {
          shouldTrigger = payload.sub_origin_id === webhook.sub_origin_id;
        }
      }

      if (shouldTrigger && webhook.url) {
        console.log(`Triggering webhook "${webhook.name}" to ${webhook.url}`);
        
        try {
          const webhookPayload = {
            event: payload.trigger,
            timestamp: new Date().toISOString(),
            lead: payload.lead,
            metadata: {
              pipeline_id: payload.pipeline_id,
              previous_pipeline_id: payload.previous_pipeline_id,
              sub_origin_id: payload.sub_origin_id,
              origin_id: payload.origin_id,
            },
          };

          const response = await fetch(webhook.url, {
            method: "POST",
            body: JSON.stringify(webhookPayload),
          });

          if (response.ok) {
            console.log(`Webhook "${webhook.name}" triggered successfully`);
            triggeredWebhooks.push(webhook.name);
          } else {
            console.error(`Webhook "${webhook.name}" failed with status ${response.status}`);
          }
        } catch (fetchError) {
          console.error(`Error calling webhook "${webhook.name}":`, fetchError);
        }
      }
    }

    console.log(`Triggered ${triggeredWebhooks.length} webhooks:`, triggeredWebhooks);

    return new Response(
      JSON.stringify({ 
        success: true, 
        triggered: triggeredWebhooks.length,
        webhooks: triggeredWebhooks 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in trigger-webhook function:", error);
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
