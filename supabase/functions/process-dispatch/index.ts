import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Resend
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// BATCH CONFIGURATION - Process in small batches to avoid timeout
const BATCH_SIZE = 25; // Process 25 leads per batch
const MAX_EXECUTION_TIME_MS = 45000; // 45 seconds max per execution (leave buffer for timeout)

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

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

  const startTime = Date.now();

  try {
    let jobId: string;
    let templateType: string | undefined;
    let templateContent: string | undefined;
    let emailSubject: string | undefined;
    let isCronCall = false;

    // Check if this is a cron call (no body) or a direct call
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const body = await req.json();
        jobId = body.jobId;
        templateType = body.templateType;
        templateContent = body.templateContent;
        emailSubject = body.emailSubject;
      } catch {
        // Cron call - find running jobs
        isCronCall = true;
      }
    } else {
      isCronCall = true;
    }

    // If cron call, find any running jobs to continue
    if (isCronCall || !jobId!) {
      console.log('[DISPATCH-BATCH] Cron call - checking for running jobs...');
      
      const { data: runningJobs, error } = await supabase
        .from('dispatch_jobs')
        .select('id')
        .eq('status', 'running')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) {
        console.error('[DISPATCH-BATCH] Error fetching running jobs:', error);
        return new Response(JSON.stringify({ message: 'No jobs to process' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!runningJobs || runningJobs.length === 0) {
        console.log('[DISPATCH-BATCH] No running jobs found');
        return new Response(JSON.stringify({ message: 'No running jobs' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      jobId = runningJobs[0].id;
      console.log(`[DISPATCH-BATCH] Resuming job: ${jobId}`);
    }

    console.log(`[DISPATCH-BATCH] Processing job: ${jobId}`);

    // Get job details
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
      console.log(`[DISPATCH-BATCH] Job ${jobId} is not running, status: ${job.status}`);
      return new Response(JSON.stringify({ message: 'Job is not running', status: job.status }), {
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

    // Get all leads
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

    // Update valid leads count if not set
    if (job.valid_leads !== validLeads.length) {
      await supabase
        .from('dispatch_jobs')
        .update({ 
          valid_leads: validLeads.length,
          started_at: job.started_at || new Date().toISOString()
        })
        .eq('id', jobId);
    }

    const currentSent = job.sent_count || 0;
    const currentFailed = job.failed_count || 0;
    const processedCount = currentSent + currentFailed;

    // Check if job is complete
    if (processedCount >= validLeads.length) {
      console.log(`[DISPATCH-BATCH] Job ${jobId} is complete: ${currentSent} sent, ${currentFailed} failed`);
      
      await supabase
        .from('dispatch_jobs')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          current_lead_name: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      return new Response(JSON.stringify({ 
        message: 'Job completed',
        sent: currentSent,
        failed: currentFailed
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the batch of leads to process
    const leadsToProcess = validLeads.slice(processedCount, processedCount + BATCH_SIZE);
    console.log(`[DISPATCH-BATCH] Processing batch of ${leadsToProcess.length} leads (${processedCount + 1} to ${processedCount + leadsToProcess.length} of ${validLeads.length})`);

    let sentCount = currentSent;
    let failedCount = currentFailed;
    const errorLog: any[] = Array.isArray(job.error_log) ? [...job.error_log] : [];

    // Process the batch
    for (let i = 0; i < leadsToProcess.length; i++) {
      // Check execution time to avoid timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_EXECUTION_TIME_MS) {
        console.log(`[DISPATCH-BATCH] Approaching timeout (${elapsed}ms), stopping batch. Will continue on next cron.`);
        break;
      }

      const lead = leadsToProcess[i];
      
      // Check if job is still running
      const { data: statusCheck } = await supabase
        .from('dispatch_jobs')
        .select('status')
        .eq('id', jobId)
        .single();

      if (statusCheck?.status !== 'running') {
        console.log(`[DISPATCH-BATCH] Job ${jobId} status changed to ${statusCheck?.status}, stopping...`);
        break;
      }

      try {
        // Update current lead being processed
        await supabase
          .from('dispatch_jobs')
          .update({ current_lead_name: lead.name })
          .eq('id', jobId);

        if (job.type === 'email') {
          console.log(`[DISPATCH-BATCH] Sending email to ${lead.name} (${lead.email})`);
          
          const rawTemplate = templateContent || job.message_template || 'Olá {{name}}!';
          const isHtmlTemplate = rawTemplate.trim().startsWith('<') || templateType === 'html';
          const personalizedContent = rawTemplate.replace(/\{\{name\}\}/g, lead.name);
          
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

          const subjectMatch = personalizedContent.match(/<title>(.*?)<\/title>/i);
          const finalSubject = emailSubject || job.message_template?.match(/<title>(.*?)<\/title>/i)?.[1] || subjectMatch?.[1] || `Mensagem para ${lead.name}`;
          
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

          console.log(`[DISPATCH-BATCH] ✅ Email sent to ${lead.email}`);

          // Record sent email
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
          console.log(`[DISPATCH-BATCH] Sending WhatsApp to ${lead.name} (${lead.country_code}${lead.whatsapp})`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        sentCount++;
        
        // Update progress
        await supabase
          .from('dispatch_jobs')
          .update({ 
            sent_count: sentCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);

        console.log(`[DISPATCH-BATCH] Progress: ${sentCount + failedCount}/${validLeads.length} (${Math.round(((sentCount + failedCount) / validLeads.length) * 100)}%)`);

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
        console.error(`[DISPATCH-BATCH] ❌ Failed to send to ${lead.name}:`, error);

        await supabase
          .from('dispatch_jobs')
          .update({ 
            failed_count: failedCount,
            error_log: errorLog,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
      }

      // Small delay between sends (reduced for batch processing)
      if (i < leadsToProcess.length - 1) {
        const delay = Math.min(job.interval_seconds * 1000, 2000); // Max 2 seconds between emails in batch
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Check if job is complete after this batch
    const totalProcessed = sentCount + failedCount;
    const remaining = validLeads.length - totalProcessed;
    const isComplete = remaining === 0;

    if (isComplete) {
      console.log(`[DISPATCH-BATCH] 🎉 Job ${jobId} completed! Sent: ${sentCount}, Failed: ${failedCount}`);
      
      await supabase
        .from('dispatch_jobs')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          current_lead_name: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
    } else {
      console.log(`[DISPATCH-BATCH] Batch complete. Sent: ${sentCount}, Failed: ${failedCount}, Remaining: ${remaining}. Next batch will be processed by cron.`);
    }

    return new Response(JSON.stringify({ 
      message: isComplete ? 'Job completed' : 'Batch processed, continuing...',
      jobId,
      sent: sentCount,
      failed: failedCount,
      remaining,
      totalLeads: validLeads.length,
      isComplete
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[DISPATCH-BATCH] Critical error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
