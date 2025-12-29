import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CsvRecipient {
  name: string;
  email: string;
  whatsapp?: string;
}

interface SaveCsvListRequest {
  conversationId: string;
  fileName: string;
  mappedColumns: {
    name?: string;
    email?: string;
    whatsapp?: string;
  };
  recipients: CsvRecipient[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { conversationId, fileName, mappedColumns, recipients }: SaveCsvListRequest = await req.json();

    console.log('[SAVE-CSV] Received request:', { 
      conversationId, 
      fileName, 
      mappedColumns,
      recipientCount: recipients?.length 
    });

    // Validate inputs
    if (!conversationId) {
      throw new Error('conversationId is required');
    }

    if (!recipients || recipients.length === 0) {
      throw new Error('recipients array is required and cannot be empty');
    }

    // Deduplicate recipients by email (keep first occurrence with valid name)
    const emailMap = new Map<string, CsvRecipient>();
    for (const recipient of recipients) {
      if (!recipient.email || !recipient.email.includes('@')) {
        continue; // Skip invalid emails
      }
      
      const emailLower = recipient.email.toLowerCase().trim();
      if (!emailMap.has(emailLower)) {
        emailMap.set(emailLower, {
          name: recipient.name?.trim() || '',
          email: emailLower,
          whatsapp: recipient.whatsapp?.replace(/\D/g, '') || undefined
        });
      } else {
        // If existing entry has no name but this one does, update it
        const existing = emailMap.get(emailLower)!;
        if (!existing.name && recipient.name?.trim()) {
          existing.name = recipient.name.trim();
        }
      }
    }

    const dedupedRecipients = Array.from(emailMap.values());
    const validEmailCount = dedupedRecipients.length;

    console.log('[SAVE-CSV] After dedup:', { 
      original: recipients.length, 
      deduped: validEmailCount 
    });

    // Check if list already exists for this conversation (replace it)
    const { data: existingList } = await supabase
      .from('dispatch_csv_lists')
      .select('id')
      .eq('conversation_id', conversationId)
      .single();

    if (existingList) {
      console.log('[SAVE-CSV] Deleting existing list:', existingList.id);
      // Delete will cascade to recipients due to FK constraint
      await supabase
        .from('dispatch_csv_lists')
        .delete()
        .eq('id', existingList.id);
    }

    // Create the CSV list record
    const { data: csvList, error: listError } = await supabase
      .from('dispatch_csv_lists')
      .insert({
        conversation_id: conversationId,
        file_name: fileName || 'uploaded.csv',
        mapped_columns: mappedColumns || {},
        total_rows: recipients.length,
        valid_emails: validEmailCount
      })
      .select('id')
      .single();

    if (listError || !csvList) {
      console.error('[SAVE-CSV] Error creating list:', listError);
      throw new Error('Failed to create CSV list');
    }

    console.log('[SAVE-CSV] Created list:', csvList.id);

    // Insert recipients in batches of 500
    const BATCH_SIZE = 500;
    for (let i = 0; i < dedupedRecipients.length; i += BATCH_SIZE) {
      const batch = dedupedRecipients.slice(i, i + BATCH_SIZE);
      const recipientsToInsert = batch.map(r => ({
        list_id: csvList.id,
        name: r.name,
        email: r.email,
        whatsapp: r.whatsapp || null
      }));

      const { error: recipientsError } = await supabase
        .from('dispatch_csv_list_recipients')
        .insert(recipientsToInsert);

      if (recipientsError) {
        console.error('[SAVE-CSV] Error inserting recipients batch:', recipientsError);
        throw new Error('Failed to insert recipients');
      }

      console.log(`[SAVE-CSV] Inserted batch ${i / BATCH_SIZE + 1}: ${batch.length} recipients`);
    }

    console.log('[SAVE-CSV] Successfully saved CSV list:', {
      listId: csvList.id,
      totalRows: recipients.length,
      validEmails: validEmailCount
    });

    return new Response(JSON.stringify({
      success: true,
      listId: csvList.id,
      totalRows: recipients.length,
      validEmails: validEmailCount,
      mappedColumns
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SAVE-CSV] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
