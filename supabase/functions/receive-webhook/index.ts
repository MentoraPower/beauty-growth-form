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

// Schedule email automation with delay support for triggers like "registered_no_group"
async function scheduleEmailAutomation(
  supabase: any,
  lead: Record<string, any>,
  pipelineId: string | null,
  subOriginId: string | null
) {
  try {
    console.log("[ScheduleEmailAutomation] Processing for lead:", lead.id, "subOriginId:", subOriginId);

    // Fetch all active email automations
    const { data: emailAutomations, error: emailError } = await supabase
      .from("email_automations")
      .select("*")
      .eq("is_active", true);

    if (emailError) {
      console.error("[ScheduleEmailAutomation] Error fetching automations:", emailError);
      return;
    }

    if (!emailAutomations || emailAutomations.length === 0) {
      console.log("[ScheduleEmailAutomation] No active automations found");
      return;
    }

    // Filter automations that apply to this sub_origin
    const applicableAutomations = emailAutomations.filter((automation: any) => {
      // Check if automation's sub_origin matches (or is null for all)
      if (automation.sub_origin_id && automation.sub_origin_id !== subOriginId) {
        return false;
      }

      // Check if automation has flow_steps with registered_no_group trigger
      const flowSteps = automation.flow_steps as any[] | null;
      if (!flowSteps || !Array.isArray(flowSteps)) return false;

      const triggerNode = flowSteps.find((step: any) => step?.type === "trigger");
      const triggers = triggerNode?.data?.triggers as any[] | null;
      if (!triggers || !Array.isArray(triggers)) return false;

      return triggers.some((t: any) => t?.type === "registered_no_group");
    });

    if (applicableAutomations.length === 0) {
      console.log("[ScheduleEmailAutomation] No applicable automations for registered_no_group");
      return;
    }

    console.log(`[ScheduleEmailAutomation] Found ${applicableAutomations.length} applicable automation(s)`);

    const leadName = lead.name || "Cliente";
    const replaceName = (value: string) =>
      value
        .replace(/\{\{name\}\}/g, leadName)
        .replace(/\{\{nome\}\}/g, leadName)
        .replace(/\{name\}/g, leadName)
        .replace(/\{nome\}/g, leadName);

    for (const automation of applicableAutomations) {
      if (!lead.email) {
        console.log("[ScheduleEmailAutomation] Lead has no email, skipping");
        continue;
      }

      const flowSteps = automation.flow_steps as any[];
      const edgesStep = flowSteps.find((step: any) => step?.type === "_edges");
      const edges = edgesStep?.data?.edges as any[] | null;
      const triggerNode = flowSteps.find((step: any) => step?.type === "trigger");

      if (!triggerNode || !edges) {
        console.log("[ScheduleEmailAutomation] No trigger node or edges found");
        continue;
      }

      // Find the trigger that matches registered_no_group
      const triggers = triggerNode?.data?.triggers as any[];
      const matchedTriggerIndex = triggers.findIndex((t: any) => t?.type === "registered_no_group");
      
      if (matchedTriggerIndex < 0) continue;

      // Find the path from trigger to email, calculating total delay
      let totalDelayMinutes = 0;
      let emailSubject = automation.subject;
      let emailBodyHtml = automation.body_html;
      let foundEmail = false;

      const expectedHandle = `trigger-handle-${matchedTriggerIndex}`;
      const startingEdge = edges.find((edge: any) => {
        if (edge.source !== triggerNode.id) return false;
        if (edge.sourceHandle === expectedHandle) return true;
        if (matchedTriggerIndex === 0 && (!edge.sourceHandle || edge.sourceHandle === null)) return true;
        return false;
      });

      if (!startingEdge) {
        console.log("[ScheduleEmailAutomation] No starting edge found for trigger");
        continue;
      }

      // Traverse the flow to find wait nodes and email node
      let currentNodeId = startingEdge.target;
      const visitedNodes = new Set<string>();
      const maxIterations = 20;
      let iterations = 0;

      while (currentNodeId && iterations < maxIterations) {
        iterations++;
        if (visitedNodes.has(currentNodeId)) break;
        visitedNodes.add(currentNodeId);

        const currentNode = flowSteps.find((step: any) => step?.id === currentNodeId);
        if (!currentNode) break;

        console.log(`[ScheduleEmailAutomation] Visiting node: ${currentNodeId}, type: ${currentNode.type}`);

        if (currentNode.type === "wait") {
          // Add delay from wait node
          const waitTime = currentNode.data?.waitTime || 0;
          const waitUnit = currentNode.data?.waitUnit || "minutes";
          
          let delayMinutes = waitTime;
          if (waitUnit === "hours") delayMinutes = waitTime * 60;
          else if (waitUnit === "days") delayMinutes = waitTime * 60 * 24;
          
          totalDelayMinutes += delayMinutes;
          console.log(`[ScheduleEmailAutomation] Wait node: ${waitTime} ${waitUnit} = ${delayMinutes} minutes`);
        } else if (currentNode.type === "email") {
          // Found email node
          emailSubject = currentNode.data?.subject || emailSubject;
          emailBodyHtml = currentNode.data?.bodyHtml || emailBodyHtml;
          foundEmail = true;
          console.log(`[ScheduleEmailAutomation] Found email node with subject: ${emailSubject}`);
          break;
        } else if (currentNode.type === "end") {
          break;
        }

        // Find next edge
        const nextEdge = edges.find((edge: any) => edge.source === currentNodeId);
        if (nextEdge) {
          currentNodeId = nextEdge.target;
        } else {
          break;
        }
      }

      if (!foundEmail) {
        console.log("[ScheduleEmailAutomation] No email node found in path");
        continue;
      }

      // Calculate scheduled time
      const scheduledFor = new Date(Date.now() + totalDelayMinutes * 60 * 1000);

      // Replace name placeholders
      emailSubject = replaceName(emailSubject);
      emailBodyHtml = replaceName(emailBodyHtml);

      console.log(`[ScheduleEmailAutomation] Scheduling email for ${lead.email} at ${scheduledFor.toISOString()} (delay: ${totalDelayMinutes} min)`);

      // Insert scheduled email
      const { error: scheduleError } = await supabase
        .from("scheduled_emails")
        .insert({
          lead_id: lead.id,
          automation_id: automation.id,
          lead_name: leadName,
          lead_email: lead.email,
          subject: emailSubject,
          body_html: emailBodyHtml,
          scheduled_for: scheduledFor.toISOString(),
          status: "pending",
        });

      if (scheduleError) {
        console.error("[ScheduleEmailAutomation] Error scheduling email:", scheduleError);
      } else {
        console.log(`[ScheduleEmailAutomation] ✅ Email scheduled successfully for ${scheduledFor.toISOString()}`);
      }
    }
  } catch (error) {
    console.error("[ScheduleEmailAutomation] Error:", error);
  }
}

// Send email automation for lead_created trigger (legacy - immediate send)
async function triggerEmailAutomation(
  supabase: any,
  lead: Record<string, any>,
  pipelineId: string | null,
  subOriginId: string | null
) {
  // First, schedule any registered_no_group automations with delay
  await scheduleEmailAutomation(supabase, lead, pipelineId, subOriginId);

  // Then handle immediate (legacy) pipeline-based automations
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
      // Skip automations that have flow_steps with delay (they're handled by scheduleEmailAutomation)
      const flowSteps = automation.flow_steps as any[] | null;
      if (flowSteps && Array.isArray(flowSteps)) {
        const hasWaitNode = flowSteps.some((step: any) => step?.type === "wait");
        if (hasWaitNode) {
          console.log(`[EmailAutomation] Skipping "${automation.name}" - has wait node, handled by scheduler`);
          continue;
        }
      }

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

      // Check for existing lead GLOBALLY by email OR whatsapp (same contact can be in multiple origins)
      let savedLeadId: string | null = null;
      let existingLead: { id: string; name: string; email: string; whatsapp: string; sub_origin_id: string | null } | null = null;
      let isUpdate = false;

      // First, check by email globally
      if (leadData.email && leadData.email.trim() !== "") {
        const { data: leadByEmail } = await supabase
          .from("leads")
          .select("id, name, email, whatsapp, sub_origin_id")
          .eq("email", leadData.email)
          .maybeSingle();
        
        if (leadByEmail) {
          existingLead = leadByEmail;
          console.log(`[Webhook] Found existing lead by email globally: ${leadByEmail.id}`);
        }
      }

      // If not found by email, check by whatsapp globally
      if (!existingLead && leadData.whatsapp && leadData.whatsapp.trim() !== "") {
        const { data: leadByPhone } = await supabase
          .from("leads")
          .select("id, name, email, whatsapp, sub_origin_id")
          .eq("whatsapp", leadData.whatsapp)
          .maybeSingle();
        
        if (leadByPhone) {
          existingLead = leadByPhone;
          console.log(`[Webhook] Found existing lead by whatsapp globally: ${leadByPhone.id}`);
        }
      }

      if (existingLead?.id) {
        // Build update data - only update fields that have non-empty values
        const updateData: Record<string, any> = {};
        
        // Always update pipeline and sub_origin to the new destination
        updateData.pipeline_id = targetPipelineId;
        updateData.sub_origin_id = targetSubOriginId;
        
        // Only update other fields if they have values
        if (leadData.name && leadData.name.trim()) updateData.name = leadData.name;
        if (leadData.email && leadData.email.trim()) updateData.email = leadData.email;
        if (leadData.whatsapp && leadData.whatsapp.trim()) updateData.whatsapp = leadData.whatsapp;
        if (leadData.country_code && leadData.country_code.trim()) updateData.country_code = leadData.country_code;
        if (leadData.instagram && leadData.instagram.trim()) updateData.instagram = leadData.instagram;
        if (leadData.clinic_name && leadData.clinic_name.trim()) updateData.clinic_name = leadData.clinic_name;
        if (leadData.service_area && leadData.service_area.trim()) updateData.service_area = leadData.service_area;
        if (leadData.monthly_billing && leadData.monthly_billing.trim()) updateData.monthly_billing = leadData.monthly_billing;
        if (leadData.weekly_attendance && leadData.weekly_attendance.trim()) updateData.weekly_attendance = leadData.weekly_attendance;
        if (leadData.workspace_type && leadData.workspace_type.trim()) updateData.workspace_type = leadData.workspace_type;
        if (leadData.years_experience && leadData.years_experience.trim()) updateData.years_experience = leadData.years_experience;
        if (leadData.average_ticket !== null) updateData.average_ticket = leadData.average_ticket;
        if (leadData.estimated_revenue !== null) updateData.estimated_revenue = leadData.estimated_revenue;
        if (leadData.biggest_difficulty && leadData.biggest_difficulty.trim()) updateData.biggest_difficulty = leadData.biggest_difficulty;
        if (leadData.utm_source) updateData.utm_source = leadData.utm_source;
        if (leadData.utm_medium) updateData.utm_medium = leadData.utm_medium;
        if (leadData.utm_campaign) updateData.utm_campaign = leadData.utm_campaign;
        if (leadData.utm_term) updateData.utm_term = leadData.utm_term;
        if (leadData.utm_content) updateData.utm_content = leadData.utm_content;

        // Update existing lead
        const { data, error } = await supabase
          .from("leads")
          .update(updateData)
          .eq("id", existingLead.id)
          .select("id")
          .single();
        if (error) throw error;
        savedLeadId = data.id;
        isUpdate = true;
        console.log(`[Webhook] Lead updated: ${savedLeadId}`);

        // Add tracking for update
        const fromSubOrigin = existingLead.sub_origin_id !== targetSubOriginId 
          ? `Movido para nova sub-origem` 
          : `Dados atualizados`;
        
        await supabase.from("lead_tracking").insert({
          lead_id: savedLeadId,
          tipo: "atualizacao",
          titulo: "Lead atualizado via Webhook",
          descricao: fromSubOrigin,
          origem: "webhook",
        }).then(({ error }) => {
          if (error) console.log("[Webhook] Tracking insert failed:", error.message);
        });
      } else {
        // Create new lead
        const { data, error } = await supabase
          .from("leads")
          .insert(leadData)
          .select("id")
          .single();
        if (error) throw error;
        savedLeadId = data.id;
        console.log(`[Webhook] Lead created: ${savedLeadId}`);

        // Add tracking for creation
        await supabase.from("lead_tracking").insert({
          lead_id: savedLeadId,
          tipo: "webhook",
          titulo: "Lead recebido via Webhook",
          descricao: "Lead criado via webhook externo",
          origem: "webhook",
        }).then(({ error }) => {
          if (error) console.log("[Webhook] Tracking insert failed:", error.message);
        });
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
            
            // Check for custom_fields object in payload (format: { custom_fields: { field_id: value } })
            const customFieldsPayload = rawPayload.custom_fields || rawPayload.customFields || payload.custom_fields || payload.customFields;
            
            for (const field of customFields) {
              let value: unknown = undefined;
              
              // Priority 1: Check custom_fields object with field ID as key
              if (customFieldsPayload && typeof customFieldsPayload === 'object') {
                value = customFieldsPayload[field.id];
              }
              
              // Priority 2: Check root level with field ID as key (for n8n "Using Fields Below")
              if (value === undefined || value === null) {
                value = rawPayload[field.id];
              }
              
              // Priority 3: Fallback to field_key in normalized payload
              if (value === undefined || value === null) {
                value = payload[field.field_key];
              }
              
              // Priority 4: Check root level with field_key
              if (value === undefined || value === null) {
                value = rawPayload[field.field_key];
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

    // Check for existing lead in the same sub-origin by email OR whatsapp
    let existingLead: { id: string } | null = null;

    // First, check by email within the same sub-origin
    if (leadData.email && leadData.email.trim() !== "") {
      const { data: leadByEmail } = await supabase
        .from("leads")
        .select("id")
        .eq("sub_origin_id", targetSubOriginId)
        .eq("email", leadData.email)
        .maybeSingle();
      
      if (leadByEmail) {
        existingLead = leadByEmail;
        console.log(`[Webhook] Found existing lead by email in sub-origin: ${leadByEmail.id}`);
      }
    }

    // If not found by email, check by whatsapp within the same sub-origin
    if (!existingLead && leadData.whatsapp && leadData.whatsapp.trim() !== "") {
      const { data: leadByPhone } = await supabase
        .from("leads")
        .select("id")
        .eq("sub_origin_id", targetSubOriginId)
        .eq("whatsapp", leadData.whatsapp)
        .maybeSingle();
      
      if (leadByPhone) {
        existingLead = leadByPhone;
        console.log(`[Webhook] Found existing lead by whatsapp in sub-origin: ${leadByPhone.id}`);
      }
    }

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
