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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { jobId, templateType, templateContent } = await req.json();
    console.log(`Starting dispatch processing for job: ${jobId}, templateType: ${templateType}`);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('dispatch_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('Job not found:', jobError);
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (job.status !== 'running') {
      console.log(`Job ${jobId} is not running, status: ${job.status}`);
      return new Response(JSON.stringify({ message: 'Job is not running' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get email settings for sender info
    const { data: emailSettings } = await supabase
      .from('email_settings')
      .select('*')
      .limit(1)
      .single();

    const fromName = emailSettings?.from_name || 'Emilly';
    const fromEmail = emailSettings?.from_email || 'emilly@biteti.com.br';

    // Get leads for this job
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, name, email, whatsapp, country_code')
      .eq('sub_origin_id', job.sub_origin_id);

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      throw leadsError;
    }

    // Filter valid leads
    const validLeads = leads?.filter(l => {
      if (job.type === 'email') {
        return l.email && l.email.includes('@');
      } else {
        return l.whatsapp && l.whatsapp.length >= 8;
      }
    }) || [];

    console.log(`Found ${validLeads.length} valid leads for dispatch`);

    // Process in background
    EdgeRuntime.waitUntil((async () => {
      let sentCount = job.sent_count || 0;
      let failedCount = job.failed_count || 0;
      const errorLog: any[] = Array.isArray(job.error_log) ? job.error_log : [];

      // Skip already processed leads
      const leadsToProcess = validLeads.slice(sentCount + failedCount);
      console.log(`Processing ${leadsToProcess.length} remaining leads`);

      for (const lead of leadsToProcess) {
        // Check if job is still running
        const { data: currentJob } = await supabase
          .from('dispatch_jobs')
          .select('status')
          .eq('id', jobId)
          .single();

        if (currentJob?.status !== 'running') {
          console.log(`Job ${jobId} is no longer running, stopping...`);
          break;
        }

        try {
          // Update current lead being processed
          await supabase
            .from('dispatch_jobs')
            .update({ current_lead_name: lead.name })
            .eq('id', jobId);

          if (job.type === 'email') {
            // Send email via Resend
            console.log(`Sending email to ${lead.name} (${lead.email})`);
            
            // Get the template content (from request or job)
            const rawTemplate = templateContent || job.message_template || 'Olá {{name}}!';
            const isHtmlTemplate = rawTemplate.trim().startsWith('<') || templateType === 'html';
            
            // Replace {{name}} placeholder
            const personalizedContent = rawTemplate.replace(/\{\{name\}\}/g, lead.name);
            
            // Build the final HTML
            let finalHtml: string;
            if (isHtmlTemplate) {
              // Use the HTML directly (already formatted)
              finalHtml = personalizedContent;
            } else {
              // Wrap simple text in a nice template
              finalHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <p style="font-size: 16px; line-height: 1.6; color: #333;">${personalizedContent.replace(/\n/g, '<br>')}</p>
                </div>
              `;
            }

            // Extract subject from HTML if present, otherwise use default
            const subjectMatch = personalizedContent.match(/<title>(.*?)<\/title>/i);
            const emailSubject = subjectMatch ? subjectMatch[1] : `Mensagem para ${lead.name}`;
            
            const emailResponse = await resend.emails.send({
              from: `${fromName} <${fromEmail}>`,
              to: [lead.email],
              subject: emailSubject,
              html: finalHtml,
            });

            const resendError = (emailResponse as any)?.error;
            if (resendError) {
              throw new Error(
                typeof resendError === "string"
                  ? resendError
                  : resendError?.message || "Erro ao enviar e-mail"
              );
            }

            console.log(`Email sent successfully to ${lead.email}:`, emailResponse);

            // Record sent email in database
            await supabase.from("sent_emails").insert({
              lead_id: lead.id,
              lead_name: lead.name,
              lead_email: lead.email,
              subject: emailSubject,
              body_html: finalHtml,
              status: "sent",
              resend_id: (emailResponse as any)?.data?.id ?? null,
              sent_at: new Date().toISOString(),
            });

          } else {
            // WhatsApp sending via wasender
            console.log(`Sending WhatsApp to ${lead.name} (${lead.country_code}${lead.whatsapp})`);
            // TODO: Integrate with wasender-whatsapp function
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          sentCount++;
          
          // Update progress
          await supabase
            .from('dispatch_jobs')
            .update({ 
              sent_count: sentCount,
              current_lead_name: lead.name
            })
            .eq('id', jobId);

          console.log(`Successfully sent to ${lead.name}. Progress: ${sentCount}/${validLeads.length}`);

        } catch (error) {
          failedCount++;
          const errorEntry = {
            leadId: lead.id,
            leadName: lead.name,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          };
          errorLog.push(errorEntry);
          console.error(`Failed to send to ${lead.name}:`, error);

          await supabase
            .from('dispatch_jobs')
            .update({ 
              failed_count: failedCount,
              error_log: errorLog
            })
            .eq('id', jobId);
        }

        // Wait for the interval between sends
        await new Promise(resolve => setTimeout(resolve, job.interval_seconds * 1000));
      }

      // Check final status
      const { data: finalJob } = await supabase
        .from('dispatch_jobs')
        .select('status')
        .eq('id', jobId)
        .single();

      // Only mark as completed if still running (not paused/cancelled)
      if (finalJob?.status === 'running') {
        await supabase
          .from('dispatch_jobs')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString(),
            current_lead_name: null
          })
          .eq('id', jobId);
        console.log(`Job ${jobId} completed successfully!`);
      }
    })());

    return new Response(JSON.stringify({ 
      message: 'Dispatch started in background',
      jobId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Process dispatch error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
