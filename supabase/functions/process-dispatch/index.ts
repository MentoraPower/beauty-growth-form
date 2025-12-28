import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Resend
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Helper function for retrying operations
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`${operationName} - Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        console.log(`Waiting ${RETRY_DELAY_MS}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
  }
  
  throw lastError;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { jobId, templateType, templateContent, emailSubject } = await req.json();
    console.log(`[DISPATCH] Starting job: ${jobId}, templateType: ${templateType}`);

    // Get job details with retry
    const job = await withRetry(async () => {
      const { data, error } = await supabase
        .from('dispatch_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (error) throw error;
      if (!data) throw new Error('Job not found');
      return data;
    }, 'Fetch job');

    if (job.status !== 'running') {
      console.log(`[DISPATCH] Job ${jobId} is not running, status: ${job.status}`);
      return new Response(JSON.stringify({ message: 'Job is not running' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get email settings
    const { data: emailSettings } = await supabase
      .from('email_settings')
      .select('*')
      .limit(1)
      .single();

    const fromName = emailSettings?.from_name || 'Emilly';
    const fromEmail = emailSettings?.from_email || 'emilly@biteti.com.br';

    // Get leads with retry
    const leads = await withRetry(async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, whatsapp, country_code')
        .eq('sub_origin_id', job.sub_origin_id);
      
      if (error) throw error;
      return data || [];
    }, 'Fetch leads');

    // Filter valid leads
    const validLeads = leads.filter(l => {
      if (job.type === 'email') {
        return l.email && l.email.includes('@');
      } else {
        return l.whatsapp && l.whatsapp.length >= 8;
      }
    });

    console.log(`[DISPATCH] Found ${validLeads.length} valid leads for dispatch`);

    // Update job with valid leads count
    await supabase
      .from('dispatch_jobs')
      .update({ 
        valid_leads: validLeads.length,
        started_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Process in background - this continues even if the client disconnects
    EdgeRuntime.waitUntil((async () => {
      let sentCount = job.sent_count || 0;
      let failedCount = job.failed_count || 0;
      const errorLog: any[] = Array.isArray(job.error_log) ? job.error_log : [];

      // Skip already processed leads
      const leadsToProcess = validLeads.slice(sentCount + failedCount);
      console.log(`[DISPATCH] Processing ${leadsToProcess.length} remaining leads`);

      for (let i = 0; i < leadsToProcess.length; i++) {
        const lead = leadsToProcess[i];
        
        // Check if job is still running (allows pause/cancel)
        const currentStatus = await withRetry(async () => {
          const { data, error } = await supabase
            .from('dispatch_jobs')
            .select('status')
            .eq('id', jobId)
            .single();
          
          if (error) throw error;
          return data?.status;
        }, 'Check job status');

        if (currentStatus !== 'running') {
          console.log(`[DISPATCH] Job ${jobId} status changed to ${currentStatus}, stopping...`);
          break;
        }

        try {
          // Update current lead being processed
          await supabase
            .from('dispatch_jobs')
            .update({ current_lead_name: lead.name })
            .eq('id', jobId);

          if (job.type === 'email') {
            console.log(`[DISPATCH] Sending email to ${lead.name} (${lead.email}) - ${i + 1}/${leadsToProcess.length}`);
            
            // Get the template content
            const rawTemplate = templateContent || job.message_template || 'Olá {{name}}!';
            const isHtmlTemplate = rawTemplate.trim().startsWith('<') || templateType === 'html';
            
            // Replace {{name}} placeholder
            const personalizedContent = rawTemplate.replace(/\{\{name\}\}/g, lead.name);
            
            // Build the final HTML
            let finalHtml: string;
            if (isHtmlTemplate) {
              finalHtml = personalizedContent;
            } else {
              finalHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <p style="font-size: 16px; line-height: 1.6; color: #333;">${personalizedContent.replace(/\n/g, '<br>')}</p>
                </div>
              `;
            }

            // Extract subject from HTML if present, otherwise use provided or default
            const subjectMatch = personalizedContent.match(/<title>(.*?)<\/title>/i);
            const finalSubject = emailSubject || subjectMatch?.[1] || `Mensagem para ${lead.name}`;
            
            // Send email with retry
            const emailResponse = await withRetry(async () => {
              const response = await resend.emails.send({
                from: `${fromName} <${fromEmail}>`,
                to: [lead.email],
                subject: finalSubject,
                html: finalHtml,
              });

              const resendError = (response as any)?.error;
              if (resendError) {
                throw new Error(
                  typeof resendError === "string"
                    ? resendError
                    : resendError?.message || "Erro ao enviar e-mail"
                );
              }
              
              return response;
            }, `Send email to ${lead.email}`);

            console.log(`[DISPATCH] Email sent successfully to ${lead.email}`);

            // Record sent email in database
            await supabase.from("sent_emails").insert({
              lead_id: lead.id,
              lead_name: lead.name,
              lead_email: lead.email,
              subject: finalSubject,
              body_html: finalHtml,
              status: "sent",
              resend_id: (emailResponse as any)?.data?.id ?? null,
              sent_at: new Date().toISOString(),
            });

          } else {
            // WhatsApp sending
            console.log(`[DISPATCH] Sending WhatsApp to ${lead.name} (${lead.country_code}${lead.whatsapp})`);
            // TODO: Integrate with wasender-whatsapp function
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          sentCount++;
          
          // Update progress in real-time
          await withRetry(async () => {
            const { error } = await supabase
              .from('dispatch_jobs')
              .update({ 
                sent_count: sentCount,
                current_lead_name: lead.name,
                updated_at: new Date().toISOString()
              })
              .eq('id', jobId);
            
            if (error) throw error;
          }, 'Update progress');

          console.log(`[DISPATCH] Progress: ${sentCount}/${validLeads.length} (${Math.round((sentCount / validLeads.length) * 100)}%)`);

        } catch (error) {
          failedCount++;
          const errorEntry = {
            leadId: lead.id,
            leadName: lead.name,
            leadEmail: lead.email,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          };
          errorLog.push(errorEntry);
          console.error(`[DISPATCH] Failed to send to ${lead.name}:`, error);

          await supabase
            .from('dispatch_jobs')
            .update({ 
              failed_count: failedCount,
              error_log: errorLog,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);
        }

        // Wait for the interval between sends (except for the last one)
        if (i < leadsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, job.interval_seconds * 1000));
        }
      }

      // Check final status
      const finalStatus = await withRetry(async () => {
        const { data, error } = await supabase
          .from('dispatch_jobs')
          .select('status')
          .eq('id', jobId)
          .single();
        
        if (error) throw error;
        return data?.status;
      }, 'Get final status');

      // Only mark as completed if still running
      if (finalStatus === 'running') {
        await withRetry(async () => {
          const { error } = await supabase
            .from('dispatch_jobs')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString(),
              current_lead_name: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);
          
          if (error) throw error;
        }, 'Mark job completed');
        
        console.log(`[DISPATCH] Job ${jobId} completed! Sent: ${sentCount}, Failed: ${failedCount}`);
      }
    })());

    return new Response(JSON.stringify({ 
      message: 'Dispatch started in background',
      jobId,
      totalLeads: validLeads.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[DISPATCH] Critical error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
