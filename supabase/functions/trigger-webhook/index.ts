import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
    country_code?: string;
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

interface EmailAutomation {
  id: string;
  name: string;
  trigger_pipeline_id: string;
  sub_origin_id: string | null;
  subject: string;
  body_html: string;
  is_active: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();
    
    console.log("Trigger webhook received:", JSON.stringify(payload).substring(0, 500));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ===== WEBHOOKS PROCESSING =====
    const { data: webhooks, error: webhooksError } = await supabase
      .from("crm_webhooks")
      .select("*")
      .eq("type", "send")
      .eq("is_active", true);

    if (webhooksError) {
      console.error("Error fetching webhooks:", webhooksError);
    }

    const triggeredWebhooks: string[] = [];

    if (webhooks && webhooks.length > 0) {
      console.log(`Found ${webhooks.length} active send webhooks`);

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
            const lead = payload.lead;
            
            const webhookPayload = {
              evento: payload.trigger,
              data_envio: new Date().toISOString(),
              dados: {
                id: lead.id,
                nome: lead.name,
                email: lead.email,
                whatsapp: lead.whatsapp,
                codigo_pais: lead.country_code,
                instagram: lead.instagram,
                nome_clinica: lead.clinic_name || null,
                area_atuacao: lead.service_area,
                faturamento_mensal: lead.monthly_billing,
                atendimentos_semana: lead.weekly_attendance,
                ticket_medio: lead.average_ticket || null,
                tipo_espaco: lead.workspace_type,
                anos_experiencia: lead.years_experience,
                receita_estimada: lead.estimated_revenue || null,
                e_mql: lead.is_mql || null,
                data_cadastro: lead.created_at,
              },
              pipeline: {
                atual: payload.pipeline_id,
                anterior: payload.previous_pipeline_id || null,
              },
              origem: {
                sub_origin_id: payload.sub_origin_id,
                origin_id: payload.origin_id || null,
              },
            };

            const response = await fetch(webhook.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
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
    }

    // ===== EMAIL AUTOMATIONS PROCESSING =====
    const triggeredEmails: string[] = [];
    
    // Only process email automations for "lead_moved" trigger
    if (payload.trigger === "lead_moved" && payload.pipeline_id) {
      console.log("Checking email automations for pipeline:", payload.pipeline_id);
      
      const { data: emailAutomations, error: emailError } = await supabase
        .from("email_automations")
        .select("*")
        .eq("trigger_pipeline_id", payload.pipeline_id)
        .eq("is_active", true);

      if (emailError) {
        console.error("Error fetching email automations:", emailError);
      }

      if (emailAutomations && emailAutomations.length > 0) {
        console.log(`Found ${emailAutomations.length} active email automations for this pipeline`);
        
        // Check if we have RESEND_API_KEY
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        
        if (!resendApiKey) {
          console.error("RESEND_API_KEY not configured - cannot send automated emails");
        } else {
          const resend = new Resend(resendApiKey);
          
          for (const automation of emailAutomations as EmailAutomation[]) {
            // Check sub_origin scope if specified
            if (automation.sub_origin_id && automation.sub_origin_id !== payload.sub_origin_id) {
              console.log(`Email automation "${automation.name}" skipped - sub_origin mismatch`);
              continue;
            }
            
            // Check if lead has email
            if (!payload.lead.email) {
              console.log(`Email automation "${automation.name}" skipped - lead has no email`);
              continue;
            }
            
            console.log(`Triggering email automation "${automation.name}" to ${payload.lead.email}`);
            
            try {
              // Replace placeholders in subject and body
              const leadName = payload.lead.name || "Cliente";
              const subject = automation.subject.replace(/\{\{name\}\}/g, leadName).replace(/\{\{nome\}\}/g, leadName);
              const bodyHtml = automation.body_html.replace(/\{\{name\}\}/g, leadName).replace(/\{\{nome\}\}/g, leadName);
              
              // Get email settings for from address
              const { data: settings } = await supabase
                .from("email_settings")
                .select("*")
                .limit(1)
                .single();
              
              const fromName = settings?.from_name || "Scale Beauty";
              const fromEmail = settings?.from_email || "contato@scalebeauty.com.br";
              
              // Send email via Resend
              const emailResponse = await resend.emails.send({
                from: `${fromName} <${fromEmail}>`,
                to: [payload.lead.email],
                subject: subject,
                html: bodyHtml,
              });
              
              console.log(`Email automation "${automation.name}" sent successfully:`, emailResponse);
              triggeredEmails.push(automation.name);
              
              // Record sent email in database
              await supabase
                .from("sent_emails")
                .insert({
                  lead_id: payload.lead.id,
                  lead_name: payload.lead.name,
                  lead_email: payload.lead.email,
                  subject: subject,
                  body_html: bodyHtml,
                  status: "sent",
                  resend_id: emailResponse.data?.id || null,
                  sent_at: new Date().toISOString(),
                });
                
            } catch (emailError: any) {
              console.error(`Error sending email automation "${automation.name}":`, emailError);
              
              // Record failed email
              await supabase
                .from("sent_emails")
                .insert({
                  lead_id: payload.lead.id,
                  lead_name: payload.lead.name,
                  lead_email: payload.lead.email,
                  subject: automation.subject,
                  body_html: automation.body_html,
                  status: "failed",
                  error_message: emailError.message,
                });
            }
          }
        }
      } else {
        console.log("No active email automations found for pipeline:", payload.pipeline_id);
      }
    }

    console.log(`Triggered ${triggeredWebhooks.length} webhooks:`, triggeredWebhooks);
    console.log(`Triggered ${triggeredEmails.length} emails:`, triggeredEmails);

    return new Response(
      JSON.stringify({ 
        success: true, 
        triggered_webhooks: triggeredWebhooks.length,
        webhooks: triggeredWebhooks,
        triggered_emails: triggeredEmails.length,
        emails: triggeredEmails
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
