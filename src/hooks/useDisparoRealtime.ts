/**
 * Disparo Real-time Hook
 * Optimized selectors for Disparo-specific real-time data
 */

import { useCallback } from 'react';
import { useRealtimeStore } from '@/stores/realtimeStore';
import type { DispatchConversation, DispatchJob } from '@/lib/realtime/types';

// ============================================
// Dispatch Conversation Selectors
// ============================================

export const useDispatchConversation = (conversationId: string): DispatchConversation | undefined => {
  return useRealtimeStore((state) => state.dispatchConversations.byId[conversationId]);
};

export const useSortedDispatchConversations = (): DispatchConversation[] => {
  return useRealtimeStore(
    useCallback((state) => {
      return state.dispatchConversations.sortedIds
        .map((id) => state.dispatchConversations.byId[id])
        .filter(Boolean);
    }, [])
  );
};

export const useDispatchConversationIds = (): string[] => {
  return useRealtimeStore((state) => state.dispatchConversations.sortedIds);
};

export const useDispatchConversationsCount = (): number => {
  return useRealtimeStore((state) => state.dispatchConversations.allIds.length);
};

// ============================================
// Dispatch Job Selectors
// ============================================

export const useDispatchJob = (jobId: string): DispatchJob | undefined => {
  return useRealtimeStore((state) => state.dispatchJobs.byId[jobId]);
};

export const useDispatchJobsByConversation = (conversationId: string): DispatchJob[] => {
  return useRealtimeStore(
    useCallback(
      (state) => {
        const jobIds = state.dispatchJobs.byConversationId[conversationId] || [];
        return jobIds
          .map((id) => state.dispatchJobs.byId[id])
          .filter(Boolean)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      },
      [conversationId]
    )
  );
};

export const useActiveDispatchJobs = (): DispatchJob[] => {
  return useRealtimeStore(
    useCallback((state) => {
      return state.dispatchJobs.activeJobIds
        .map((id) => state.dispatchJobs.byId[id])
        .filter(Boolean);
    }, [])
  );
};

export const useActiveDispatchJobsCount = (): number => {
  return useRealtimeStore((state) => state.dispatchJobs.activeJobIds.length);
};

export const useAllDispatchJobs = (): DispatchJob[] => {
  return useRealtimeStore(
    useCallback((state) => {
      return state.dispatchJobs.allIds
        .map((id) => state.dispatchJobs.byId[id])
        .filter(Boolean)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [])
  );
};

// ============================================
// Dispatch Actions
// ============================================

export const useDisparoActions = () => {
  const setDispatchConversations = useRealtimeStore((state) => state.setDispatchConversations);
  const upsertDispatchConversation = useRealtimeStore((state) => state.upsertDispatchConversation);
  const deleteDispatchConversation = useRealtimeStore((state) => state.deleteDispatchConversation);

  const setDispatchJobs = useRealtimeStore((state) => state.setDispatchJobs);
  const upsertDispatchJob = useRealtimeStore((state) => state.upsertDispatchJob);
  const deleteDispatchJob = useRealtimeStore((state) => state.deleteDispatchJob);

  return {
    // Conversations
    setDispatchConversations,
    upsertDispatchConversation,
    deleteDispatchConversation,

    // Jobs
    setDispatchJobs,
    upsertDispatchJob,
    deleteDispatchJob,
  };
};

// ============================================
// Combined selectors for common use cases
// ============================================

export const useDispatchConversationWithJobs = (conversationId: string) => {
  const conversation = useDispatchConversation(conversationId);
  const jobs = useDispatchJobsByConversation(conversationId);
  
  return { conversation, jobs };
};

export const useLatestActiveJobForConversation = (conversationId: string): DispatchJob | undefined => {
  return useRealtimeStore(
    useCallback(
      (state) => {
        const jobIds = state.dispatchJobs.byConversationId[conversationId] || [];
        const activeJobs = jobIds
          .map((id) => state.dispatchJobs.byId[id])
          .filter((job) => job && (job.status === 'processing' || job.status === 'pending'));
        
        if (activeJobs.length === 0) return undefined;
        
        return activeJobs.sort(
          (a, b) => new Date(b!.created_at).getTime() - new Date(a!.created_at).getTime()
        )[0];
      },
      [conversationId]
    )
  );
};
