import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * CRON JOB: Continues running dispatch jobs
 * This function is called periodically by a cron job to ensure
 * dispatch jobs continue processing even after the original request times out.
 * 
 * Schedule: Every 30 seconds
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('[CONTINUE-DISPATCH] Checking for running dispatch jobs...');

    // Find any running jobs
    const { data: runningJobs, error } = await supabase
      .from('dispatch_jobs')
      .select('id, sent_count, failed_count, valid_leads, type, sub_origin_name')
      .eq('status', 'running')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[CONTINUE-DISPATCH] Error fetching jobs:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!runningJobs || runningJobs.length === 0) {
      console.log('[CONTINUE-DISPATCH] No running jobs found');
      return new Response(JSON.stringify({ message: 'No running jobs' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[CONTINUE-DISPATCH] Found ${runningJobs.length} running job(s)`);

    const results = [];

    // Process each running job
    for (const job of runningJobs) {
      const processedCount = (job.sent_count || 0) + (job.failed_count || 0);
      const remaining = (job.valid_leads || 0) - processedCount;

      if (remaining <= 0) {
        // Job should be marked as complete
        console.log(`[CONTINUE-DISPATCH] Job ${job.id} has no remaining leads, marking complete`);
        
        await supabase
          .from('dispatch_jobs')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString(),
            current_lead_name: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        results.push({ 
          jobId: job.id, 
          action: 'completed',
          sent: job.sent_count,
          failed: job.failed_count
        });
        continue;
      }

      console.log(`[CONTINUE-DISPATCH] Job ${job.id}: ${processedCount}/${job.valid_leads} processed, ${remaining} remaining. Calling process-dispatch...`);

      // Call process-dispatch to continue processing
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/process-dispatch`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId: job.id }),
        });

        const result = await response.json();
        console.log(`[CONTINUE-DISPATCH] process-dispatch response for job ${job.id}:`, result);

        results.push({ 
          jobId: job.id, 
          action: 'processed',
          result 
        });
      } catch (callError) {
        console.error(`[CONTINUE-DISPATCH] Error calling process-dispatch for job ${job.id}:`, callError);
        results.push({ 
          jobId: job.id, 
          action: 'error',
          error: callError instanceof Error ? callError.message : 'Unknown error'
        });
      }
    }

    return new Response(JSON.stringify({ 
      message: `Processed ${runningJobs.length} job(s)`,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[CONTINUE-DISPATCH] Critical error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
