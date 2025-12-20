/**
 * Real-time Store Selectors
 * Optimized selectors for consuming real-time data with minimal re-renders
 */

import { useCallback, useMemo } from 'react';
import { useRealtimeStore } from '@/stores/realtimeStore';
import type { 
  WhatsAppMessage, 
  WhatsAppChat, 
  Lead, 
  CalendarAppointment,
  LeadActivity,
  ConnectionState,
} from '@/lib/realtime/types';

// Shallow compare for arrays
const shallowArrayEqual = <T>(a: T[], b: T[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
};

// ============================================
// Connection Selectors
// ============================================

export const useConnectionState = (): ConnectionState => {
  return useRealtimeStore((state) => state.connectionState);
};

export const useIsConnected = (): boolean => {
  return useRealtimeStore((state) => state.connectionState === 'connected');
};

export const useReconnectAttempts = (): number => {
  return useRealtimeStore((state) => state.reconnectAttempts);
};

export const useIsTabActive = (): boolean => {
  return useRealtimeStore((state) => state.isTabActive);
};

// ============================================
// Message Selectors
// ============================================

export const useMessage = (messageId: string): WhatsAppMessage | undefined => {
  return useRealtimeStore((state) => state.messages.byId[messageId]);
};

export const useMessagesByChatId = (chatId: string): WhatsAppMessage[] => {
  return useRealtimeStore(
    useCallback(
      (state) => {
        const messageIds = state.messages.byChatId[chatId] || [];
        return messageIds
          .map((id) => state.messages.byId[id])
          .filter(Boolean)
          .sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
      },
      [chatId]
    )
  );
};

export const useMessageIds = (): string[] => {
  return useRealtimeStore((state) => state.messages.allIds);
};

export const useMessagesCount = (): number => {
  return useRealtimeStore((state) => state.messages.allIds.length);
};

// ============================================
// Conversation Selectors
// ============================================

export const useConversation = (conversationId: string): WhatsAppChat | undefined => {
  return useRealtimeStore((state) => state.conversations.byId[conversationId]);
};

export const useSortedConversations = (): WhatsAppChat[] => {
  return useRealtimeStore(
    useCallback((state) => {
      return state.conversations.sortedIds
        .map((id) => state.conversations.byId[id])
        .filter(Boolean);
    }, [])
  );
};

export const useConversationIds = (): string[] => {
  return useRealtimeStore((state) => state.conversations.sortedIds);
};

export const useConversationsCount = (): number => {
  return useRealtimeStore((state) => state.conversations.allIds.length);
};

export const useUnreadConversationsCount = (): number => {
  return useRealtimeStore(
    useCallback((state) => {
      return Object.values(state.conversations.byId).filter(
        (conv) => (conv.unread_count || 0) > 0
      ).length;
    }, [])
  );
};

// ============================================
// Lead Selectors
// ============================================

export const useLead = (leadId: string): Lead | undefined => {
  return useRealtimeStore((state) => state.leads.byId[leadId]);
};

export const useLeadsByPipelineId = (pipelineId: string): Lead[] => {
  return useRealtimeStore(
    useCallback(
      (state) => {
        const leadIds = state.leads.byPipelineId[pipelineId] || [];
        return leadIds
          .map((id) => state.leads.byId[id])
          .filter(Boolean)
          .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      },
      [pipelineId]
    )
  );
};

export const useAllLeads = (): Lead[] => {
  return useRealtimeStore(
    useCallback((state) => {
      return state.leads.allIds.map((id) => state.leads.byId[id]).filter(Boolean);
    }, [])
  );
};

export const useLeadIds = (): string[] => {
  return useRealtimeStore((state) => state.leads.allIds);
};

export const useLeadsCount = (): number => {
  return useRealtimeStore((state) => state.leads.allIds.length);
};

// ============================================
// Calendar Selectors
// ============================================

export const useAppointment = (appointmentId: string): CalendarAppointment | undefined => {
  return useRealtimeStore((state) => state.calendar.byId[appointmentId]);
};

export const useAppointmentsByDate = (dateKey: string): CalendarAppointment[] => {
  return useRealtimeStore(
    useCallback(
      (state) => {
        const appointmentIds = state.calendar.byDate[dateKey] || [];
        return appointmentIds
          .map((id) => state.calendar.byId[id])
          .filter(Boolean)
          .sort((a, b) => 
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          );
      },
      [dateKey]
    )
  );
};

export const useAllAppointments = (): CalendarAppointment[] => {
  return useRealtimeStore(
    useCallback((state) => {
      return state.calendar.allIds.map((id) => state.calendar.byId[id]).filter(Boolean);
    }, [])
  );
};

export const useAppointmentsCount = (): number => {
  return useRealtimeStore((state) => state.calendar.allIds.length);
};

// ============================================
// Activity Selectors
// ============================================

export const useActivity = (activityId: string): LeadActivity | undefined => {
  return useRealtimeStore((state) => state.activities.byId[activityId]);
};

export const useActivitiesByLeadId = (leadId: string): LeadActivity[] => {
  return useRealtimeStore(
    useCallback(
      (state) => {
        const activityIds = state.activities.byLeadId[leadId] || [];
        return activityIds
          .map((id) => state.activities.byId[id])
          .filter(Boolean)
          .sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      },
      [leadId]
    )
  );
};

export const useAllActivities = (): LeadActivity[] => {
  return useRealtimeStore(
    useCallback((state) => {
      return state.activities.allIds.map((id) => state.activities.byId[id]).filter(Boolean);
    }, [])
  );
};

export const usePendingActivitiesCount = (): number => {
  return useRealtimeStore(
    useCallback((state) => {
      return Object.values(state.activities.byId).filter(
        (activity) => !activity.concluida
      ).length;
    }, [])
  );
};

// ============================================
// Presence Selectors
// ============================================

export const useUserPresence = (userId: string) => {
  return useRealtimeStore((state) => state.presence.users[userId]);
};

export const useOnlineUsers = () => {
  return useRealtimeStore(
    useCallback((state) => {
      return Object.values(state.presence.users).filter(
        (user) => user.status === 'online'
      );
    }, [])
  );
};

export const useOnlineUsersCount = (): number => {
  return useRealtimeStore(
    useCallback((state) => {
      return Object.values(state.presence.users).filter(
        (user) => user.status === 'online'
      ).length;
    }, [])
  );
};

// ============================================
// Store Actions (for components that need to update)
// ============================================

export const useRealtimeActions = () => {
  const setMessages = useRealtimeStore((state) => state.setMessages);
  const upsertMessage = useRealtimeStore((state) => state.upsertMessage);
  const deleteMessage = useRealtimeStore((state) => state.deleteMessage);
  
  const setConversations = useRealtimeStore((state) => state.setConversations);
  const upsertConversation = useRealtimeStore((state) => state.upsertConversation);
  const deleteConversation = useRealtimeStore((state) => state.deleteConversation);
  
  const setLeads = useRealtimeStore((state) => state.setLeads);
  const upsertLead = useRealtimeStore((state) => state.upsertLead);
  const deleteLead = useRealtimeStore((state) => state.deleteLead);
  
  const setAppointments = useRealtimeStore((state) => state.setAppointments);
  const upsertAppointment = useRealtimeStore((state) => state.upsertAppointment);
  const deleteAppointment = useRealtimeStore((state) => state.deleteAppointment);
  
  const setActivities = useRealtimeStore((state) => state.setActivities);
  const upsertActivity = useRealtimeStore((state) => state.upsertActivity);
  const deleteActivity = useRealtimeStore((state) => state.deleteActivity);

  return useMemo(() => ({
    // Messages
    setMessages,
    upsertMessage,
    deleteMessage,
    
    // Conversations
    setConversations,
    upsertConversation,
    deleteConversation,
    
    // Leads
    setLeads,
    upsertLead,
    deleteLead,
    
    // Appointments
    setAppointments,
    upsertAppointment,
    deleteAppointment,
    
    // Activities
    setActivities,
    upsertActivity,
    deleteActivity,
  }), [
    setMessages, upsertMessage, deleteMessage,
    setConversations, upsertConversation, deleteConversation,
    setLeads, upsertLead, deleteLead,
    setAppointments, upsertAppointment, deleteAppointment,
    setActivities, upsertActivity, deleteActivity,
  ]);
};
