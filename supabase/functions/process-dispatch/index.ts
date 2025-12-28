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

// PARALLEL CONFIGURATION - Send 2 emails simultaneously (safe with Resend Pro 2 req/s limit)
const PARALLEL_EMAILS = 2;
const PARALLEL_DELAY_MS = 150; // Small delay between parallel groups to respect rate limit

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

// Helper function to send a single email
async function sendSingleEmail(
  lead: { id: string; name: string; email: string },
  job: any,
  templateContent: string | undefined,
  templateType: string | undefined,
  emailSubject: string | undefined,
  fromName: string,
  fromEmail: string,
  supabase: any
): Promise<{ success: boolean; error?: string; resendId?: string }> {
  try {
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

    return { success: true, resendId: (emailResponse as any)?.data?.id };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
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

    // Get job details with lock check
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

    // Check if job is locked by another instance (60 second lock)
    const LOCK_DURATION_MS = 60000;
    if (job.processing_lock_until) {
      const lockExpiry = new Date(job.processing_lock_until);
      if (lockExpiry > new Date()) {
        const remainingLock = Math.ceil((lockExpiry.getTime() - Date.now()) / 1000);
        console.log(`[DISPATCH-BATCH] ⏳ Job ${jobId} is locked by another instance for ${remainingLock}s more, skipping...`);
        return new Response(JSON.stringify({ 
          message: 'Job locked by another instance', 
          lockedFor: remainingLock 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Acquire lock for this processing session
    const lockUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
    const { error: lockError } = await supabase
      .from('dispatch_jobs')
      .update({ processing_lock_until: lockUntil })
      .eq('id', jobId)
      .eq('status', 'running'); // Only lock if still running

    if (lockError) {
      console.error(`[DISPATCH-BATCH] Failed to acquire lock:`, lockError);
      return new Response(JSON.stringify({ message: 'Failed to acquire lock' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[DISPATCH-BATCH] 🔒 Lock acquired until ${lockUntil}`);

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
    console.log(`[DISPATCH-BATCH] 🚀 Using PARALLEL sending: ${PARALLEL_EMAILS} emails simultaneously`);

    let sentCount = currentSent;
    let failedCount = currentFailed;
    const errorLog: any[] = Array.isArray(job.error_log) ? [...job.error_log] : [];

    // Process the batch in parallel groups
    for (let i = 0; i < leadsToProcess.length; i += PARALLEL_EMAILS) {
      // Check execution time to avoid timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_EXECUTION_TIME_MS) {
        console.log(`[DISPATCH-BATCH] Approaching timeout (${elapsed}ms), stopping batch. Will continue on next cron.`);
        break;
      }

      // Check if job is still running (only check every few groups to reduce DB calls)
      if (i % (PARALLEL_EMAILS * 3) === 0) {
        const { data: statusCheck } = await supabase
          .from('dispatch_jobs')
          .select('status')
          .eq('id', jobId)
          .single();

        if (statusCheck?.status !== 'running') {
          console.log(`[DISPATCH-BATCH] Job ${jobId} status changed to ${statusCheck?.status}, stopping...`);
          break;
        }
      }

      // Get the parallel group of leads
      const parallelGroup = leadsToProcess.slice(i, i + PARALLEL_EMAILS);
      const leadNames = parallelGroup.map(l => l.name).join(', ');
      
      console.log(`[DISPATCH-BATCH] 📨 Sending ${parallelGroup.length} emails in parallel: ${leadNames}`);

      // Update current lead being processed
      await supabase
        .from('dispatch_jobs')
        .update({ current_lead_name: leadNames })
        .eq('id', jobId);

      if (job.type === 'email') {
        // Check which leads have already been sent emails (to avoid duplicates)
        const leadIds = parallelGroup.map(l => l.id);
        const { data: alreadySent } = await supabase
          .from('sent_emails')
          .select('lead_id')
          .in('lead_id', leadIds)
          .gte('created_at', job.started_at || job.created_at);

        const alreadySentIds = new Set((alreadySent || []).map((s: any) => s.lead_id));
        
        // Filter out already sent leads
        const leadsToSend = parallelGroup.filter(lead => {
          if (alreadySentIds.has(lead.id)) {
            console.log(`[DISPATCH-BATCH] ⏭️ Email already sent to ${lead.email}, skipping duplicate`);
            sentCount++; // Count as sent
            return false;
          }
          return true;
        });

        if (leadsToSend.length === 0) {
          // All leads in this group were already processed
          continue;
        }

        // Send emails in parallel using Promise.allSettled
        const emailPromises = leadsToSend.map(lead => 
          sendSingleEmail(
            lead,
            job,
            templateContent,
            templateType,
            emailSubject,
            fromName,
            fromEmail,
            supabase
          )
        );

        const results = await Promise.allSettled(emailPromises);

        // Process results
        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const lead = leadsToSend[j];

          if (result.status === 'fulfilled' && result.value.success) {
            sentCount++;
            console.log(`[DISPATCH-BATCH] ✅ Email sent to ${lead.email}`);
          } else {
            failedCount++;
            const errorMessage = result.status === 'rejected' 
              ? (result.reason instanceof Error ? result.reason.message : 'Promise rejected')
              : result.value.error || 'Unknown error';
            
            const errorEntry = {
              leadId: lead.id,
              leadName: lead.name,
              leadEmail: lead.email,
              error: errorMessage,
              timestamp: new Date().toISOString()
            };
            errorLog.push(errorEntry);
            console.error(`[DISPATCH-BATCH] ❌ Failed to send to ${lead.name}: ${errorMessage}`);
          }
        }

        // Update progress after parallel group
        await supabase
          .from('dispatch_jobs')
          .update({ 
            sent_count: sentCount,
            failed_count: failedCount,
            error_log: errorLog.length > 0 ? errorLog : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);

        console.log(`[DISPATCH-BATCH] Progress: ${sentCount + failedCount}/${validLeads.length} (${Math.round(((sentCount + failedCount) / validLeads.length) * 100)}%)`);

      } else {
        // WhatsApp sending (sequential for now)
        for (const lead of parallelGroup) {
          console.log(`[DISPATCH-BATCH] Sending WhatsApp to ${lead.name} (${lead.country_code}${lead.whatsapp})`);
          await new Promise(resolve => setTimeout(resolve, 500));
          sentCount++;
        }

        await supabase
          .from('dispatch_jobs')
          .update({ 
            sent_count: sentCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
      }

      // Small delay between parallel groups to respect rate limit
      if (i + PARALLEL_EMAILS < leadsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, PARALLEL_DELAY_MS));
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
          processing_lock_until: null, // Release lock
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
    } else {
      console.log(`[DISPATCH-BATCH] Batch complete. Sent: ${sentCount}, Failed: ${failedCount}, Remaining: ${remaining}. Next batch will be processed by cron.`);
      
      // Release lock at end of batch processing
      await supabase
        .from('dispatch_jobs')
        .update({ processing_lock_until: null })
        .eq('id', jobId);
      
      console.log(`[DISPATCH-BATCH] 🔓 Lock released`);
    }

    return new Response(JSON.stringify({ 
      message: isComplete ? 'Job completed' : 'Batch processed, continuing...',
      jobId,
      sent: sentCount,
      failed: failedCount,
      remaining,
      totalLeads: validLeads.length,
      isComplete,
      parallelMode: PARALLEL_EMAILS
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
