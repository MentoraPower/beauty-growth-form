import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MQL criteria: estimated revenue * 0.55 >= R$ 2,800
const SERVICE_COST = 2800;
const MIN_REVENUE_RATIO = 0.55;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all leads without is_mql set
    const { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select('id, weekly_attendance, average_ticket, estimated_revenue')
      .is('is_mql', null);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${leads?.length || 0} leads to process`);

    let updated = 0;
    let errors = 0;

    for (const lead of leads || []) {
      try {
        // Calculate estimated revenue if not set
        let estimatedRevenue = lead.estimated_revenue;
        
        if (!estimatedRevenue && lead.weekly_attendance && lead.average_ticket) {
          const appointments = parseInt(lead.weekly_attendance) || 0;
          const ticket = parseFloat(lead.average_ticket) || 0;
          estimatedRevenue = appointments * 4 * ticket;
        }

        // Calculate MQL status
        // MQL = true if estimated revenue allows service to be <= 55% of revenue
        const isMQL = estimatedRevenue ? (estimatedRevenue * MIN_REVENUE_RATIO) >= SERVICE_COST : false;

        // Update the lead
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            is_mql: isMQL,
            estimated_revenue: estimatedRevenue || null,
            analysis_created_at: new Date().toISOString()
          })
          .eq('id', lead.id);

        if (updateError) {
          console.error(`Error updating lead ${lead.id}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      } catch (e) {
        console.error(`Error processing lead ${lead.id}:`, e);
        errors++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: leads?.length || 0,
      updated,
      errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in recalculate-mql:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
