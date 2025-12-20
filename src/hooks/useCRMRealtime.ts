/**
 * CRM Real-time Hook
 * Provides optimized access to CRM data through Zustand store
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  useLeadsByPipelineId, 
  useAllLeads, 
  useRealtimeActions,
  useConnectionState,
} from '@/hooks/useRealtimeSelectors';
import { Lead } from '@/lib/realtime/types';

interface UseCRMRealtimeOptions {
  subOriginId: string | null;
  enabled?: boolean;
}

export function useCRMRealtime({ subOriginId, enabled = true }: UseCRMRealtimeOptions) {
  const queryClient = useQueryClient();
  const connectionState = useConnectionState();
  const allLeads = useAllLeads();
  const { setLeads, upsertLead, deleteLead } = useRealtimeActions();

  // Filter leads by sub_origin_id
  const filteredLeads = useMemo(() => {
    if (!subOriginId) return allLeads;
    return allLeads.filter(lead => lead.sub_origin_id === subOriginId);
  }, [allLeads, subOriginId]);

  // Group leads by pipeline_id
  const leadsByPipeline = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    
    filteredLeads.forEach(lead => {
      const pipelineId = lead.pipeline_id || 'unassigned';
      if (!grouped[pipelineId]) {
        grouped[pipelineId] = [];
      }
      grouped[pipelineId].push(lead);
    });

    // Sort by ordem within each pipeline
    Object.values(grouped).forEach(leads => {
      leads.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    });

    return grouped;
  }, [filteredLeads]);

  // Load initial leads data
  const loadInitialLeads = useCallback(async () => {
    if (!enabled) return;

    try {
      let query = supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (subOriginId) {
        query = query.eq('sub_origin_id', subOriginId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[CRM Realtime] Error fetching leads:', error);
        return;
      }

      if (data) {
        setLeads(data);
      }
    } catch (error) {
      console.error('[CRM Realtime] Error in loadInitialLeads:', error);
    }
  }, [subOriginId, enabled, setLeads]);

  // Initialize leads on mount
  useEffect(() => {
    loadInitialLeads();
  }, [loadInitialLeads]);

  // Optimistic update for moving a lead
  const moveLead = useCallback(async (
    leadId: string, 
    newPipelineId: string, 
    newOrder: number
  ) => {
    // Find the lead
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) return;

    // Optimistic update in store
    const updatedLead = {
      ...lead,
      pipeline_id: newPipelineId,
      ordem: newOrder,
    };
    upsertLead(updatedLead);

    // Update in database
    try {
      const { error } = await supabase
        .from('leads')
        .update({ 
          pipeline_id: newPipelineId, 
          ordem: newOrder 
        })
        .eq('id', leadId);

      if (error) {
        // Rollback on error
        upsertLead(lead);
        throw error;
      }
    } catch (error) {
      console.error('[CRM Realtime] Error moving lead:', error);
    }
  }, [allLeads, upsertLead]);

  // Optimistic reorder within pipeline
  const reorderLeads = useCallback(async (
    pipelineId: string, 
    orderedLeadIds: string[]
  ) => {
    const pipelineLeads = leadsByPipeline[pipelineId] || [];
    const updates: { id: string; ordem: number }[] = [];

    // Create optimistic updates
    orderedLeadIds.forEach((leadId, index) => {
      const lead = pipelineLeads.find(l => l.id === leadId);
      if (lead && lead.ordem !== index) {
        updates.push({ id: leadId, ordem: index });
        upsertLead({ ...lead, ordem: index });
      }
    });

    if (updates.length === 0) return;

    // Batch update in database
    try {
      await Promise.all(
        updates.map(({ id, ordem }) =>
          supabase.from('leads').update({ ordem }).eq('id', id)
        )
      );
    } catch (error) {
      console.error('[CRM Realtime] Error reordering leads:', error);
      // Reload to restore correct state
      loadInitialLeads();
    }
  }, [leadsByPipeline, upsertLead, loadInitialLeads]);

  return {
    leads: filteredLeads,
    leadsByPipeline,
    connectionState,
    isConnected: connectionState === 'connected',
    moveLead,
    reorderLeads,
    refresh: loadInitialLeads,
  };
}

export default useCRMRealtime;
