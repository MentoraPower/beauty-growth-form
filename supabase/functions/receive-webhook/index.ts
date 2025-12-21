import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET, HEAD",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Send email automation for lead_created trigger
async function triggerEmailAutomation(
  supabase: any,
  lead: Record<string, any>,
  pipelineId: string | null,
  subOriginId: string | null
) {
  if (!pipelineId) return;

  try {
    const { data: emailAutomations, error: emailError } = await supabase
      .from("email_automations")
      .select("*")
      .eq("trigger_pipeline_id", pipelineId)
      .eq("is_active", true);

    if (emailError || !emailAutomations || emailAutomations.length === 0) {
      return;
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.log("[EmailAutomation] RESEND_API_KEY not configured");
      return;
    }

    const resend = new Resend(resendApiKey);

    for (const automation of emailAutomations) {
      // Check sub_origin scope
      if (automation.sub_origin_id && automation.sub_origin_id !== subOriginId) {
        continue;
      }

      // Check if lead has email
      if (!lead.email) {
        continue;
      }

      try {
        const leadName = lead.name || "Cliente";
        const replaceName = (value: string) =>
          value
            .replace(/\{\{name\}\}/g, leadName)
            .replace(/\{\{nome\}\}/g, leadName)
            .replace(/\{name\}/g, leadName)
            .replace(/\{nome\}/g, leadName);

        const subject = replaceName(automation.subject);
        const bodyHtml = replaceName(automation.body_html);

        // Get email settings
        const { data: settings } = await supabase
          .from("email_settings")
          .select("*")
          .limit(1)
          .single();

        const fromName = settings?.from_name || "Scale Beauty";
        const fromEmail = settings?.from_email || "contato@scalebeauty.com.br";

        const emailResponse = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [lead.email],
          subject,
          html: bodyHtml,
        });

        const resendError = (emailResponse as any)?.error;
        if (resendError) {
          throw new Error(
            typeof resendError === "string"
              ? resendError
              : resendError?.message || "Erro desconhecido ao enviar e-mail"
          );
        }

        const resendId = (emailResponse as any)?.data?.id ?? null;

        console.log(`[EmailAutomation] Sent "${automation.name}" to ${lead.email}`, {
          resend_id: resendId,
        });

        // Record sent email
        await supabase.from("sent_emails").insert({
          lead_id: lead.id,
          lead_name: lead.name,
          lead_email: lead.email,
          subject,
          body_html: bodyHtml,
          status: "sent",
          resend_id: resendId,
          sent_at: new Date().toISOString(),
        });
      } catch (emailError: any) {
        console.error(`[EmailAutomation] Failed "${automation.name}"`, emailError);

        await supabase.from("sent_emails").insert({
          lead_id: lead.id,
          lead_name: lead.name,
          lead_email: lead.email,
          subject: automation.subject,
          body_html: automation.body_html,
          status: "failed",
          error_message: emailError?.message,
        });
      }
    }
  } catch (error) {
    console.error("[EmailAutomation] Error:", error);
  }
}

// Parse request body based on content type (JSON, form-data, or URL-encoded)
async function parseRequestBody(req: Request): Promise<Record<string, any>> {
  const contentType = req.headers.get("content-type") || "";

  console.log("Content-Type:", contentType);

  // GET/HEAD usually have no body
  if (req.method === "GET" || req.method === "HEAD") {
    return {};
  }

  // Normalize field key: remove "No Label " prefix, lowercase, replace spaces/dashes with underscores
  const normalizeFieldKey = (key: string) => {
    let normalized = key;
    // Remove "No Label " prefix (case insensitive)
    normalized = normalized.replace(/^no\s*label\s+/i, "");
    // Lowercase and replace spaces/dashes with underscores
    return normalized.toLowerCase().replace(/[\s-]+/g, "_").replace(/^_+|_+$/g, "");
  };

  const setMaybeElementorField = (data: Record<string, any>, key: string, value: any) => {
    const val = value instanceof File ? value.name : value;

    // Elementor often uses: fields[field_id] or fields[field_id][value]
    const m1 = key.match(/^fields\[([^\]]+)\](?:\[value\])?$/);
    if (m1) {
      data[normalizeFieldKey(m1[1])] = val;
      return;
    }

    // Some WP plugins use: form_fields[field_id]
    const m2 = key.match(/^form_fields\[([^\]]+)\]$/);
    if (m2) {
      data[normalizeFieldKey(m2[1])] = val;
      return;
    }

    data[normalizeFieldKey(key)] = val;
  };

  // JSON: read text once and parse (prevents "body already consumed" issues)
  if (contentType.includes("application/json")) {
    const text = await req.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      console.log("Invalid JSON body (first 500):", text.substring(0, 500));
      return { raw: text };
    }
  }

  // multipart/form-data
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const data: Record<string, any> = {};
    formData.forEach((value, key) => setMaybeElementorField(data, key, value));
    return data;
  }

  // application/x-www-form-urlencoded
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const data: Record<string, any> = {};
    params.forEach((value, key) => setMaybeElementorField(data, key, value));
    return data;
  }

  // Fallback: read text once; try JSON, then URLSearchParams
  const text = await req.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    console.log("Raw body text (first 500):", text.substring(0, 500));
    const params = new URLSearchParams(text);
    const data: Record<string, any> = {};
    params.forEach((value, key) => setMaybeElementorField(data, key, value));
    return data;
  }
}

function toNumberOrNull(value: any): number | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;

  // Accept: 450, 450.50, 450,50, R$ 450,50
  const cleaned = s.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

// Helpers
function normalizeKey(input: string): string {
  let normalized = input;
  // Remove "No Label " prefix (case insensitive) - common Elementor pattern
  normalized = normalized.replace(/^no\s*label\s+/i, "");
  return normalized
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function collectStringValues(value: any, out: string[], depth = 0) {
  if (depth > 6 || out.length > 200) return;
  if (value === null || value === undefined) return;

  if (typeof value === "string") {
    const s = value.trim();
    if (s) out.push(s);
    return;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    out.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const v of value) collectStringValues(v, out, depth + 1);
    return;
  }

  if (typeof value === "object") {
    for (const v of Object.values(value)) collectStringValues(v, out, depth + 1);
  }
}

function guessEmail(raw: any, normalized: Record<string, any>): string | null {
  if (normalized.email) return String(normalized.email);
  const values: string[] = [];
  collectStringValues(raw, values);

  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  for (const v of values) {
    const m = v.match(emailRegex);
    if (m) return m[0];
  }
  return null;
}

function guessName(raw: any, normalized: Record<string, any>): string | null {
  if (normalized.name) return String(normalized.name);

  const values: string[] = [];
  collectStringValues(raw, values);

  const candidates = values
    .map((v) => v.trim())
    .filter((v) => v.length >= 2)
    .filter((v) => !v.includes("@"))
    .filter((v) => !/^\d+$/.test(v))
    .filter((v) => /[a-zA-ZÀ-ÿ]/.test(v));

  // Prefer a full name (has spaces)
  const withSpace = candidates.find((v) => v.includes(" "));
  return withSpace || candidates[0] || null;
}

// Normalize payload from different sources (Elementor WordPress, direct, etc.)
function normalizePayload(raw: any): Record<string, any> {
  // If it's already a flat object with expected fields, return as-is
  if (raw?.name && raw?.email) {
    return raw;
  }

  const normalized: Record<string, any> = {};

  // Field mapping - maps various field IDs/names/titles to our expected format
  const fieldMap: Record<string, string> = {
    // name
    [normalizeKey("name")]: "name",
    [normalizeKey("nome")]: "name",
    [normalizeKey("nome_completo")]: "name",
    [normalizeKey("full_name")]: "name",
    [normalizeKey("fullname")]: "name",
    // email
    [normalizeKey("email")]: "email",
    [normalizeKey("e_mail")]: "email",
    [normalizeKey("mail")]: "email",
    // whatsapp/phone
    [normalizeKey("whatsapp")]: "whatsapp",
    [normalizeKey("phone")]: "whatsapp",
    [normalizeKey("telefone")]: "whatsapp",
    [normalizeKey("celular")]: "whatsapp",
    [normalizeKey("tel")]: "whatsapp",
    // instagram
    [normalizeKey("instagram")]: "instagram",
    [normalizeKey("insta")]: "instagram",
    // clinic/company
    [normalizeKey("clinic_name")]: "clinic_name",
    [normalizeKey("clinicname")]: "clinic_name",
    [normalizeKey("empresa")]: "clinic_name",
    [normalizeKey("company")]: "clinic_name",
    [normalizeKey("studio")]: "clinic_name",
    // service area
    [normalizeKey("service_area")]: "service_area",
    [normalizeKey("servicearea")]: "service_area",
    [normalizeKey("area")]: "service_area",
    [normalizeKey("area_de_atuacao")]: "service_area",
    [normalizeKey("servico")]: "service_area",
    // monthly billing
    [normalizeKey("monthly_billing")]: "monthly_billing",
    [normalizeKey("monthlybilling")]: "monthly_billing",
    [normalizeKey("faturamento")]: "monthly_billing",
    [normalizeKey("faturamento_mensal")]: "monthly_billing",
    // weekly attendance
    [normalizeKey("weekly_attendance")]: "weekly_attendance",
    [normalizeKey("weeklyattendance")]: "weekly_attendance",
    [normalizeKey("atendimentos")]: "weekly_attendance",
    [normalizeKey("atendimentos_semanais")]: "weekly_attendance",
    // workspace type
    [normalizeKey("workspace_type")]: "workspace_type",
    [normalizeKey("workspacetype")]: "workspace_type",
    [normalizeKey("espaco")]: "workspace_type",
    [normalizeKey("espaco_fisico")]: "workspace_type",
    // years exp
    [normalizeKey("years_experience")]: "years_experience",
    [normalizeKey("yearsexperience")]: "years_experience",
    [normalizeKey("experiencia")]: "years_experience",
    [normalizeKey("anos_de_experiencia")]: "years_experience",
    // ticket
    [normalizeKey("average_ticket")]: "average_ticket",
    [normalizeKey("averageticket")]: "average_ticket",
    [normalizeKey("ticket")]: "average_ticket",
    [normalizeKey("ticket_medio")]: "average_ticket",
    // revenue
    [normalizeKey("estimated_revenue")]: "estimated_revenue",
    [normalizeKey("estimatedrevenue")]: "estimated_revenue",
    [normalizeKey("receita")]: "estimated_revenue",
    // country
    [normalizeKey("country_code")]: "country_code",
    [normalizeKey("countrycode")]: "country_code",
    [normalizeKey("ddi")]: "country_code",
    // difficulty
    [normalizeKey("biggest_difficulty")]: "biggest_difficulty",
    [normalizeKey("dificuldade")]: "biggest_difficulty",
    [normalizeKey("maior_dificuldade")]: "biggest_difficulty",
    // UTMs
    [normalizeKey("utm_source")]: "utm_source",
    [normalizeKey("utm_medium")]: "utm_medium",
    [normalizeKey("utm_campaign")]: "utm_campaign",
    [normalizeKey("utm_term")]: "utm_term",
    [normalizeKey("utm_content")]: "utm_content",
    // Common Elementor patterns
    [normalizeKey("field_name")]: "name",
    [normalizeKey("field_email")]: "email",
    [normalizeKey("field_phone")]: "whatsapp",
    [normalizeKey("field_whatsapp")]: "whatsapp",
    [normalizeKey("field_instagram")]: "instagram",
  };

  // Elementor JSON format: { fields: { field_id: { id, type, title, value } } }
  if (raw?.fields && typeof raw.fields === "object") {
    for (const [fieldId, fieldData] of Object.entries(raw.fields)) {
      const data = fieldData as any;
      const value = data?.value ?? data?.raw_value ?? data;

      const fieldIdKey = normalizeKey(String(fieldId));
      const titleKey = data?.title ? normalizeKey(String(data.title)) : "";

      const mapped = fieldMap[fieldIdKey] || (titleKey ? fieldMap[titleKey] : undefined);
      if (mapped) {
        normalized[mapped] = value;
      }
    }
  }

  // Flat object format
  for (const [k, v] of Object.entries(raw || {})) {
    if (k === "fields") continue;
    const key = normalizeKey(String(k));
    const mapped = fieldMap[key];
    if (mapped && normalized[mapped] === undefined) {
      normalized[mapped] = v;
    }
  }

  // form_data array format
  if (raw?.form_data && Array.isArray(raw.form_data)) {
    for (const field of raw.form_data) {
      const key = normalizeKey(String(field?.name || field?.id || ""));
      const mapped = fieldMap[key];
      if (mapped && normalized[mapped] === undefined) {
        normalized[mapped] = field?.value;
      }
    }
  }

  return normalized;
}

type ProcessLeadArgs = {
  requestId: string;
  originId: string | null;
  subOriginId: string | null;
  pipelineId: string | null;
  rawPayload: Record<string, any>;
};

async function processLead(args: ProcessLeadArgs) {
  const { requestId, originId, subOriginId, pipelineId, rawPayload } = args;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let payload = normalizePayload(rawPayload);
    payload.email = payload.email || guessEmail(rawPayload, payload) || "";
    payload.name = payload.name || guessName(rawPayload, payload) || "";

    console.log(`[${requestId}] Normalized payload:`, JSON.stringify(payload).substring(0, 800));

    if (!payload.name || !payload.email) {
      console.log(`[${requestId}] Missing required fields, skipping. Keys:`, Object.keys(rawPayload));
      return;
    }

    // Routing (prefer query params)
    let targetSubOriginId = subOriginId;
    let targetPipelineId = pipelineId;

    if (!targetSubOriginId && originId) {
      const { data: subOrigins, error } = await supabase
        .from("crm_sub_origins")
        .select("id")
        .eq("origin_id", originId)
        .order("ordem")
        .limit(1);
      if (error) throw error;
      if (subOrigins && subOrigins.length > 0) {
        targetSubOriginId = subOrigins[0].id;
      }
    }

    if (targetSubOriginId && !targetPipelineId) {
      const { data: pipelines, error } = await supabase
        .from("pipelines")
        .select("id")
        .eq("sub_origin_id", targetSubOriginId)
        .order("ordem")
        .limit(1);
      if (error) throw error;
      if (pipelines && pipelines.length > 0) {
        targetPipelineId = pipelines[0].id;
      }
    }

    // Fallbacks
    if (!targetSubOriginId) {
      targetSubOriginId = "00000000-0000-0000-0000-000000000002"; // Entrada
    }
    if (!targetPipelineId) {
      targetPipelineId = "b62bdfc2-cfda-4cc2-9a72-f87f9ac1f724"; // Base/Novo (fallback)
    }

    const leadData: Record<string, any> = {
      name: String(payload.name).trim(),
      email: String(payload.email).trim(),
      whatsapp: String(payload.whatsapp || payload.phone || ""),
      country_code: String(payload.country_code || "+55"),
      instagram: String(payload.instagram || ""),
      clinic_name: payload.clinic_name ? String(payload.clinic_name) : null,
      service_area: String(payload.service_area || ""),
      monthly_billing: String(payload.monthly_billing || ""),
      weekly_attendance: String(payload.weekly_attendance || ""),
      workspace_type: String(payload.workspace_type || ""),
      years_experience: String(payload.years_experience || ""),
      average_ticket: toNumberOrNull(payload.average_ticket),
      estimated_revenue: toNumberOrNull(payload.estimated_revenue),
      pipeline_id: targetPipelineId,
      sub_origin_id: targetSubOriginId,
      utm_source: payload.utm_source ? String(payload.utm_source) : null,
      utm_medium: payload.utm_medium ? String(payload.utm_medium) : null,
      utm_campaign: payload.utm_campaign ? String(payload.utm_campaign) : null,
      utm_term: payload.utm_term ? String(payload.utm_term) : null,
      utm_content: payload.utm_content ? String(payload.utm_content) : null,
    };

    if (payload.biggest_difficulty) {
      leadData.biggest_difficulty = String(payload.biggest_difficulty);
    }

    console.log(`[${requestId}] Upserting lead:`, JSON.stringify({
      email: leadData.email,
      sub_origin_id: leadData.sub_origin_id,
      pipeline_id: leadData.pipeline_id,
    }));

    const { data: existingLead, error: existingLeadError } = await supabase
      .from("leads")
      .select("id")
      .eq("email", leadData.email)
      .maybeSingle();
    if (existingLeadError) throw existingLeadError;

    let savedLeadId: string;

    if (existingLead) {
      const { data, error } = await supabase
        .from("leads")
        .update(leadData)
        .eq("id", existingLead.id)
        .select("id")
        .single();
      if (error) throw error;
      savedLeadId = data.id;
      console.log(`[${requestId}] Lead updated:`, savedLeadId);
      return;
    }

    const { data, error } = await supabase
      .from("leads")
      .insert(leadData)
      .select("id")
      .single();
    if (error) throw error;

    savedLeadId = data.id;
    console.log(`[${requestId}] Lead created:`, savedLeadId);

    // Tracking record (best-effort)
    const { error: trackingError } = await supabase.from("lead_tracking").insert({
      lead_id: savedLeadId,
      tipo: "webhook",
      titulo: "Lead recebido via Webhook",
      descricao: `Lead criado via webhook externo`,
      origem: "webhook",
    });
    if (trackingError) {
      console.log(`[${requestId}] Tracking insert failed:`, trackingError.message);
    }
  } catch (error: any) {
    console.error(`[${requestId}] processLead failed:`, error);
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Webhook received - Method:", req.method, "URL:", req.url);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Elementor/WordPress "test" calls sometimes hit with GET
  if (req.method === "GET" || req.method === "HEAD") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const originId = url.searchParams.get("origin_id");
    const subOriginId = url.searchParams.get("sub_origin_id");
    
    // Parse body based on content type
    const rawPayload = await parseRequestBody(req);
    
    console.log("Receive webhook called:", JSON.stringify(rawPayload).substring(0, 1000));
    console.log("Query params - origin_id:", originId, "sub_origin_id:", subOriginId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Normalize payload - handle Elementor WordPress format and other variations
    let payload = normalizePayload(rawPayload);

    // Heuristic fallback (covers Elementor IDs/titles that come in unexpected keys)
    payload.email = payload.email || guessEmail(rawPayload, payload) || "";
    payload.name = payload.name || guessName(rawPayload, payload) || "";

    console.log("Normalized payload:", JSON.stringify(payload).substring(0, 500));

    // Validate required fields
    // NOTE: Elementor shows "submissão falhou" for non-2xx responses, então mantemos 200.
    if (!payload.name || !payload.email) {
      console.error("Missing required fields: name and email. Received keys:", Object.keys(rawPayload));
      console.error("Normalized keys:", Object.keys(payload));

      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: name and email",
          received_fields: Object.keys(rawPayload),
          normalized_fields: Object.keys(payload),
          tip: "No Elementor, configure os IDs dos campos como: name, email, whatsapp",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fast-path for Elementor: when sub_origin_id is provided
    if (subOriginId) {
      const targetSubOriginId = subOriginId;
      
      // Get the pipeline_id from URL or find the first pipeline for this sub-origin
      let targetPipelineId = url.searchParams.get("pipeline_id");
      
      if (!targetPipelineId) {
        // Quick lookup for first pipeline of the sub-origin
        const { data: pipelines } = await supabase
          .from("pipelines")
          .select("id")
          .eq("sub_origin_id", targetSubOriginId)
          .order("ordem")
          .limit(1);
        
        if (pipelines && pipelines.length > 0) {
          targetPipelineId = pipelines[0].id;
        } else {
          // Fallback only if no pipeline exists for sub-origin
          targetPipelineId = "b62bdfc2-cfda-4cc2-9a72-f87f9ac1f724";
        }
      }

      const leadData: Record<string, any> = {
        name: String(payload.name).trim(),
        email: String(payload.email).trim(),
        whatsapp: String(payload.whatsapp || payload.phone || ""),
        country_code: String(payload.country_code || "+55"),
        instagram: String(payload.instagram || ""),
        clinic_name: payload.clinic_name ? String(payload.clinic_name) : null,
        service_area: String(payload.service_area || ""),
        monthly_billing: String(payload.monthly_billing || ""),
        weekly_attendance: String(payload.weekly_attendance || ""),
        workspace_type: String(payload.workspace_type || ""),
        years_experience: String(payload.years_experience || ""),
        average_ticket: toNumberOrNull(payload.average_ticket),
        estimated_revenue: toNumberOrNull(payload.estimated_revenue),
        pipeline_id: targetPipelineId,
        sub_origin_id: targetSubOriginId,
        utm_source: payload.utm_source ? String(payload.utm_source) : null,
        utm_medium: payload.utm_medium ? String(payload.utm_medium) : null,
        utm_campaign: payload.utm_campaign ? String(payload.utm_campaign) : null,
        utm_term: payload.utm_term ? String(payload.utm_term) : null,
        utm_content: payload.utm_content ? String(payload.utm_content) : null,
      };

      if (payload.biggest_difficulty) {
        leadData.biggest_difficulty = String(payload.biggest_difficulty);
      }

      // Single DB roundtrip when possible
      let savedLeadId: string | null = null;
      const { data: upserted, error: upsertError } = await supabase
        .from("leads")
        // Requires a unique constraint on email. If not present, we fall back below.
        .upsert(leadData, { onConflict: "email" })
        .select("id")
        .maybeSingle();

      if (!upsertError && upserted?.id) {
        savedLeadId = upserted.id;
      } else {
        // Fallback (slightly slower) for projects without unique(email)
        const { data: existingLead } = await supabase
          .from("leads")
          .select("id")
          .eq("email", leadData.email)
          .maybeSingle();

        if (existingLead?.id) {
          const { data, error } = await supabase
            .from("leads")
            .update(leadData)
            .eq("id", existingLead.id)
            .select("id")
            .single();
          if (error) throw error;
          savedLeadId = data.id;
        } else {
          const { data, error } = await supabase
            .from("leads")
            .insert(leadData)
            .select("id")
            .single();
          if (error) throw error;
          savedLeadId = data.id;
        }
      }

      // Save custom field responses if any exist
      if (savedLeadId && targetSubOriginId) {
        try {
          // Fetch custom fields for this sub-origin
          const { data: customFields } = await supabase
            .from("sub_origin_custom_fields")
            .select("id, field_key")
            .eq("sub_origin_id", targetSubOriginId);

          if (customFields && customFields.length > 0) {
            const customResponses: { lead_id: string; field_id: string; response_value: string }[] = [];
            
            // Check for custom_fields object in payload (new format with field IDs)
            const customFieldsPayload = payload.custom_fields || payload.customFields;
            
            for (const field of customFields) {
              let value: unknown = undefined;
              
              // First, check new format: custom_fields: { field_id: value }
              if (customFieldsPayload && typeof customFieldsPayload === 'object') {
                value = customFieldsPayload[field.id];
              }
              
              // Fallback to old format: field_key directly in payload
              if (value === undefined || value === null) {
                value = payload[field.field_key];
              }
              
              if (value !== undefined && value !== null && String(value).trim() !== "") {
                customResponses.push({
                  lead_id: savedLeadId,
                  field_id: field.id,
                  response_value: String(value),
                });
              }
            }

            if (customResponses.length > 0) {
              // Upsert custom field responses
              const { error: customError } = await supabase
                .from("lead_custom_field_responses")
                .upsert(customResponses, { onConflict: "lead_id,field_id" });
              
              if (customError) {
                console.log("[Webhook] Custom field responses upsert error:", customError.message);
              } else {
                console.log(`[Webhook] Saved ${customResponses.length} custom field responses`);
              }
            }
          }
        } catch (customError) {
          console.log("[Webhook] Error saving custom fields:", customError);
        }
      }

      // Trigger email automation (fire and forget)
      if (savedLeadId) {
        triggerEmailAutomation(supabase, { ...leadData, id: savedLeadId }, targetPipelineId, targetSubOriginId)
          .catch((e) => console.error("[EmailAutomation] Error:", e));
      }

      return new Response(
        JSON.stringify({ success: true, lead_id: savedLeadId, message: "Lead received" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ========== NON-FAST PATH ==========
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
    const leadData: Record<string, any> = {
      name: String(payload.name).trim(),
      email: String(payload.email).trim(),
      whatsapp: String(payload.whatsapp || payload.phone || ""),
      country_code: String(payload.country_code || "+55"),
      instagram: String(payload.instagram || ""),
      clinic_name: payload.clinic_name ? String(payload.clinic_name) : null,
      service_area: String(payload.service_area || ""),
      monthly_billing: String(payload.monthly_billing || ""),
      weekly_attendance: String(payload.weekly_attendance || ""),
      workspace_type: String(payload.workspace_type || ""),
      years_experience: String(payload.years_experience || ""),
      average_ticket: toNumberOrNull(payload.average_ticket),
      estimated_revenue: toNumberOrNull(payload.estimated_revenue),
      pipeline_id: targetPipelineId,
      sub_origin_id: targetSubOriginId,
      utm_source: payload.utm_source ? String(payload.utm_source) : null,
      utm_medium: payload.utm_medium ? String(payload.utm_medium) : null,
      utm_campaign: payload.utm_campaign ? String(payload.utm_campaign) : null,
      utm_term: payload.utm_term ? String(payload.utm_term) : null,
      utm_content: payload.utm_content ? String(payload.utm_content) : null,
    };

    // Optional field (only include if provided to avoid schema mismatch)
    if (payload.biggest_difficulty) {
      leadData.biggest_difficulty = String(payload.biggest_difficulty);
    }

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

    // Trigger email automation for new leads (fire and forget)
    if (savedLead && !existingLead) {
      triggerEmailAutomation(supabase, savedLead, targetPipelineId, targetSubOriginId)
        .catch((e) => console.error("[EmailAutomation] Error:", e));
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
      JSON.stringify({
        success: false,
        error: error?.message || "unknown_error",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
