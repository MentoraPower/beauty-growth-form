import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Normalize payload from different sources (Elementor WordPress, direct, etc.)
function normalizePayload(raw: any): Record<string, any> {
  // If it's already a flat object with expected fields, return as-is
  if (raw.name && raw.email) {
    return raw;
  }

  const normalized: Record<string, any> = {};

  // Field mapping - maps various field IDs/names to our expected format
  const fieldMap: Record<string, string> = {
    // Name variations
    'name': 'name', 'nome': 'name', 'full_name': 'name', 'fullname': 'name',
    // Email variations
    'email': 'email', 'e-mail': 'email', 'mail': 'email',
    // WhatsApp variations
    'whatsapp': 'whatsapp', 'phone': 'whatsapp', 'telefone': 'whatsapp', 
    'celular': 'whatsapp', 'tel': 'whatsapp',
    // Instagram variations
    'instagram': 'instagram', 'insta': 'instagram',
    // Clinic name
    'clinic_name': 'clinic_name', 'clinicname': 'clinic_name', 
    'empresa': 'clinic_name', 'company': 'clinic_name', 'studio': 'clinic_name',
    // Service area
    'service_area': 'service_area', 'servicearea': 'service_area', 
    'area': 'service_area', 'servico': 'service_area',
    // Monthly billing
    'monthly_billing': 'monthly_billing', 'monthlybilling': 'monthly_billing', 
    'faturamento': 'monthly_billing', 'billing': 'monthly_billing',
    // Weekly attendance
    'weekly_attendance': 'weekly_attendance', 'weeklyattendance': 'weekly_attendance', 
    'atendimentos': 'weekly_attendance', 'attendance': 'weekly_attendance',
    // Workspace type
    'workspace_type': 'workspace_type', 'workspacetype': 'workspace_type', 
    'espaco': 'workspace_type', 'workspace': 'workspace_type',
    // Years experience
    'years_experience': 'years_experience', 'yearsexperience': 'years_experience', 
    'experiencia': 'years_experience', 'experience': 'years_experience',
    // Average ticket
    'average_ticket': 'average_ticket', 'averageticket': 'average_ticket', 
    'ticket': 'average_ticket', 'ticket_medio': 'average_ticket',
    // Country code
    'country_code': 'country_code', 'countrycode': 'country_code', 'ddi': 'country_code',
    // Biggest difficulty
    'biggest_difficulty': 'biggest_difficulty', 'dificuldade': 'biggest_difficulty',
    // UTM fields
    'utm_source': 'utm_source', 'utm_medium': 'utm_medium', 
    'utm_campaign': 'utm_campaign', 'utm_term': 'utm_term', 'utm_content': 'utm_content',
  };

  // Handle Elementor format: { fields: { field_id: { id, type, title, value } } }
  if (raw.fields && typeof raw.fields === 'object') {
    for (const [fieldId, fieldData] of Object.entries(raw.fields)) {
      const data = fieldData as any;
      const value = data.value || data.raw_value || data;
      const key = fieldId.toLowerCase().replace(/[\s-]/g, '_');
      
      if (fieldMap[key]) {
        normalized[fieldMap[key]] = value;
      } else if (data.title) {
        // Try matching by field title
        const title = data.title.toLowerCase().replace(/[\s-]/g, '_');
        if (fieldMap[title]) {
          normalized[fieldMap[title]] = value;
        }
      }
    }
  }
  
  // Handle flat object with various field names
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'fields') continue;
    
    const lowerKey = key.toLowerCase().replace(/[\s-]/g, '_');
    if (fieldMap[lowerKey] && !normalized[fieldMap[lowerKey]]) {
      normalized[fieldMap[lowerKey]] = value;
    }
  }

  // Handle form_data array format
  if (raw.form_data && Array.isArray(raw.form_data)) {
    for (const field of raw.form_data) {
      const key = (field.name || field.id || '').toLowerCase().replace(/[\s-]/g, '_');
      const value = field.value;
      if (fieldMap[key] && !normalized[fieldMap[key]]) {
        normalized[fieldMap[key]] = value;
      }
    }
  }

  return normalized;
}

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
    
    const rawPayload = await req.json();
    
    console.log("Receive webhook called:", JSON.stringify(rawPayload).substring(0, 1000));
    console.log("Query params - origin_id:", originId, "sub_origin_id:", subOriginId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Normalize payload - handle Elementor WordPress format and other variations
    const payload = normalizePayload(rawPayload);
    
    console.log("Normalized payload:", JSON.stringify(payload).substring(0, 500));

    // Validate required fields
    if (!payload.name || !payload.email) {
      console.error("Missing required fields: name and email. Received:", Object.keys(payload));
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields: name and email",
          received_fields: Object.keys(rawPayload),
          tip: "Use field IDs: name, email, whatsapp, instagram, etc."
        }),
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
      clinic_name: payload.clinic_name || null,
      service_area: payload.service_area || "",
      monthly_billing: payload.monthly_billing || "",
      weekly_attendance: payload.weekly_attendance || "",
      workspace_type: payload.workspace_type || "",
      years_experience: payload.years_experience || "",
      average_ticket: payload.average_ticket || null,
      estimated_revenue: payload.estimated_revenue || null,
      biggest_difficulty: payload.biggest_difficulty || null,
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
      .maybeSingle();

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
