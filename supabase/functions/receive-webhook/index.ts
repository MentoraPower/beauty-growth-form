import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const handler = async (req: Request): Promise<Response> => {
  console.log("Webhook received - Method:", req.method, "URL:", req.url);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const originId = url.searchParams.get("origin_id");
    const subOriginId = url.searchParams.get("sub_origin_id");
    
    const payload = await req.json();
    
    console.log("Receive webhook called:", JSON.stringify(payload).substring(0, 500));
    console.log("Query params - origin_id:", originId, "sub_origin_id:", subOriginId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate required fields
    if (!payload.name || !payload.email) {
      console.error("Missing required fields: name and email");
      return new Response(
        JSON.stringify({ error: "Missing required fields: name and email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Find the matching webhook configuration
    let webhookQuery = supabase
      .from("crm_webhooks")
      .select("*")
      .eq("type", "receive")
      .eq("is_active", true);

    const { data: webhooks, error: webhooksError } = await webhookQuery;

    if (webhooksError) {
      console.error("Error fetching webhooks:", webhooksError);
      throw webhooksError;
    }

    // Find matching webhook based on scope and IDs
    let matchedWebhook = null;
    let targetSubOriginId = subOriginId;
    let targetPipelineId = null;

    for (const webhook of webhooks || []) {
      if (webhook.scope === "all") {
        matchedWebhook = webhook;
        break;
      } else if (webhook.scope === "origin" && originId && webhook.origin_id === originId) {
        matchedWebhook = webhook;
        // Get first sub_origin for this origin
        const { data: subOrigins } = await supabase
          .from("crm_sub_origins")
          .select("id")
          .eq("origin_id", originId)
          .order("ordem")
          .limit(1);
        if (subOrigins && subOrigins.length > 0) {
          targetSubOriginId = subOrigins[0].id;
        }
        break;
      } else if (webhook.scope === "sub_origin" && subOriginId && webhook.sub_origin_id === subOriginId) {
        matchedWebhook = webhook;
        break;
      }
    }

    if (!matchedWebhook && (!webhooks || webhooks.length === 0)) {
      console.log("No matching webhook found, but will still process lead");
    }

    // Get first pipeline for the target sub-origin
    if (targetSubOriginId) {
      const { data: pipelines } = await supabase
        .from("pipelines")
        .select("id")
        .eq("sub_origin_id", targetSubOriginId)
        .order("ordem")
        .limit(1);
      if (pipelines && pipelines.length > 0) {
        targetPipelineId = pipelines[0].id;
      }
    }

    // Fallback to default routing if no specific origin/sub-origin provided
    if (!targetSubOriginId) {
      targetSubOriginId = "00000000-0000-0000-0000-000000000002"; // Entrada
    }
    if (!targetPipelineId) {
      targetPipelineId = "b62bdfc2-cfda-4cc2-9a72-f87f9ac1f724"; // Novo
    }

    // Create lead data from payload
    const leadData = {
      name: payload.name,
      email: payload.email,
      whatsapp: payload.whatsapp || payload.phone || "",
      country_code: payload.country_code || "+55",
      instagram: payload.instagram || "",
      clinic_name: payload.clinic_name || payload.clinicName || null,
      service_area: payload.service_area || payload.serviceArea || "",
      monthly_billing: payload.monthly_billing || payload.monthlyBilling || "",
      weekly_attendance: payload.weekly_attendance || payload.weeklyAttendance || "",
      workspace_type: payload.workspace_type || payload.workspaceType || "",
      years_experience: payload.years_experience || payload.yearsExperience || "",
      average_ticket: payload.average_ticket || payload.averageTicket || null,
      estimated_revenue: payload.estimated_revenue || payload.estimatedRevenue || null,
      pipeline_id: targetPipelineId,
      sub_origin_id: targetSubOriginId,
      utm_source: payload.utm_source || null,
      utm_medium: payload.utm_medium || null,
      utm_campaign: payload.utm_campaign || null,
      utm_term: payload.utm_term || null,
      utm_content: payload.utm_content || null,
    };

    console.log("Creating lead with data:", JSON.stringify(leadData).substring(0, 500));

    // Check if lead already exists by email
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("email", payload.email)
      .single();

    let savedLead;
    if (existingLead) {
      // Update existing lead
      const { data, error } = await supabase
        .from("leads")
        .update(leadData)
        .eq("id", existingLead.id)
        .select()
        .single();
      
      if (error) {
        console.error("Error updating lead:", error);
        throw error;
      }
      savedLead = data;
      console.log("Lead updated:", savedLead.id);
    } else {
      // Create new lead
      const { data, error } = await supabase
        .from("leads")
        .insert(leadData)
        .select()
        .single();
      
      if (error) {
        console.error("Error creating lead:", error);
        throw error;
      }
      savedLead = data;
      console.log("Lead created:", savedLead.id);

      // Create tracking record
      await supabase.from("lead_tracking").insert({
        lead_id: savedLead.id,
        tipo: "webhook",
        titulo: "Lead recebido via Webhook",
        descricao: `Lead criado via webhook externo`,
        origem: matchedWebhook?.name || "webhook",
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        lead_id: savedLead.id,
        message: existingLead ? "Lead updated" : "Lead created"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in receive-webhook function:", error);
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
