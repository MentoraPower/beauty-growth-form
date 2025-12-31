/**
 * Zustand Real-time Store
 * Single source of truth for all real-time data
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import type {
  RealtimeStore,
  RealtimeStoreState,
  NormalizedEvent,
  WhatsAppMessage,
  WhatsAppChat,
  Lead,
  CalendarAppointment,
  LeadActivity,
  UserPresence,
  DispatchConversation,
  DispatchJob,
} from '@/lib/realtime/types';

// Initial state
const initialState: RealtimeStoreState = {
  connectionState: 'disconnected',
  lastConnectedAt: null,
  reconnectAttempts: 0,
  isTabActive: true,
  pendingUpdates: [],

  messages: {
    byId: {},
    byChatId: {},
    allIds: [],
  },

  conversations: {
    byId: {},
    allIds: [],
    sortedIds: [],
  },

  leads: {
    byId: {},
    byPipelineId: {},
    allIds: [],
  },

  calendar: {
    byId: {},
    byDate: {},
    allIds: [],
  },

  activities: {
    byId: {},
    byLeadId: {},
    allIds: [],
  },

  presence: {
    users: {},
  },

  metrics: {
    lastUpdated: 0,
    data: {},
  },

  dispatchConversations: {
    byId: {},
    allIds: [],
    sortedIds: [],
  },

  dispatchJobs: {
    byId: {},
    byConversationId: {},
    allIds: [],
    activeJobIds: [],
  },
};

// Helper to sort conversations by last message time
const sortConversations = (conversations: Record<string, WhatsAppChat>): string[] => {
  return Object.values(conversations)
    .sort((a, b) => {
      const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
      const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
      return timeB - timeA;
    })
    .map((c) => c.id);
};

// Helper to sort dispatch conversations by updated_at
const sortDispatchConversations = (conversations: Record<string, DispatchConversation>): string[] => {
  return Object.values(conversations)
    .sort((a, b) => {
      const timeA = new Date(a.updated_at).getTime();
      const timeB = new Date(b.updated_at).getTime();
      return timeB - timeA;
    })
    .map((c) => c.id);
};

// Helper to get date key from ISO string
const getDateKey = (isoString: string): string => {
  return isoString.split('T')[0];
};

// Helper to get active job IDs
const getActiveJobIds = (jobs: Record<string, DispatchJob>): string[] => {
  return Object.values(jobs)
    .filter((job) => job.status === 'processing' || job.status === 'pending')
    .map((job) => job.id);
};

// Helper to apply dispatch conversation events
const applyDispatchConversationEvent = (
  state: RealtimeStoreState,
  event: NormalizedEvent
): void => {
  const conv = event.data as DispatchConversation;
  
  if (event.type === 'delete') {
    delete state.dispatchConversations.byId[event.id];
    state.dispatchConversations.allIds = state.dispatchConversations.allIds.filter(
      (id) => id !== event.id
    );
  } else {
    state.dispatchConversations.byId[event.id] = conv;
    if (!state.dispatchConversations.allIds.includes(event.id)) {
      state.dispatchConversations.allIds.push(event.id);
    }
  }
  
  state.dispatchConversations.sortedIds = sortDispatchConversations(
    state.dispatchConversations.byId
  );
};

// Helper to apply dispatch job events
const applyDispatchJobEvent = (
  state: RealtimeStoreState,
  event: NormalizedEvent
): void => {
  const job = event.data as DispatchJob;
  
  if (event.type === 'delete') {
    const oldJob = state.dispatchJobs.byId[event.id];
    delete state.dispatchJobs.byId[event.id];
    state.dispatchJobs.allIds = state.dispatchJobs.allIds.filter((id) => id !== event.id);
    
    // Remove from byConversationId
    if (oldJob?.conversation_id) {
      const convJobs = state.dispatchJobs.byConversationId[oldJob.conversation_id] || [];
      state.dispatchJobs.byConversationId[oldJob.conversation_id] = convJobs.filter(
        (id) => id !== event.id
      );
    }
  } else {
    const oldJob = state.dispatchJobs.byId[event.id];
    state.dispatchJobs.byId[event.id] = job;
    
    if (!state.dispatchJobs.allIds.includes(event.id)) {
      state.dispatchJobs.allIds.push(event.id);
    }
    
    // Update byConversationId
    if (oldJob?.conversation_id && oldJob.conversation_id !== job.conversation_id) {
      const oldConvJobs = state.dispatchJobs.byConversationId[oldJob.conversation_id] || [];
      state.dispatchJobs.byConversationId[oldJob.conversation_id] = oldConvJobs.filter(
        (id) => id !== event.id
      );
    }
    
    if (job.conversation_id) {
      if (!state.dispatchJobs.byConversationId[job.conversation_id]) {
        state.dispatchJobs.byConversationId[job.conversation_id] = [];
      }
      if (!state.dispatchJobs.byConversationId[job.conversation_id].includes(event.id)) {
        state.dispatchJobs.byConversationId[job.conversation_id].push(event.id);
      }
    }
  }
  
  state.dispatchJobs.activeJobIds = getActiveJobIds(state.dispatchJobs.byId);
};

// Event application helpers
const applyMessageEvent = (state: RealtimeStoreState, event: NormalizedEvent): void => {
  const msg = event.data as WhatsAppMessage;
  
  if (event.type === 'delete') {
    delete state.messages.byId[event.id];
    state.messages.allIds = state.messages.allIds.filter((id) => id !== event.id);
    Object.keys(state.messages.byChatId).forEach((chatId) => {
      state.messages.byChatId[chatId] = state.messages.byChatId[chatId].filter(
        (id) => id !== event.id
      );
    });
  } else {
    state.messages.byId[event.id] = msg;
    if (!state.messages.allIds.includes(event.id)) {
      state.messages.allIds.push(event.id);
    }
    if (msg.chat_id) {
      if (!state.messages.byChatId[msg.chat_id]) {
        state.messages.byChatId[msg.chat_id] = [];
      }
      if (!state.messages.byChatId[msg.chat_id].includes(event.id)) {
        state.messages.byChatId[msg.chat_id].push(event.id);
      }
    }
  }
};

const applyConversationEvent = (state: RealtimeStoreState, event: NormalizedEvent): void => {
  const conv = event.data as WhatsAppChat;
  
  if (event.type === 'delete') {
    delete state.conversations.byId[event.id];
    state.conversations.allIds = state.conversations.allIds.filter((id) => id !== event.id);
  } else {
    state.conversations.byId[event.id] = conv;
    if (!state.conversations.allIds.includes(event.id)) {
      state.conversations.allIds.push(event.id);
    }
  }
  state.conversations.sortedIds = sortConversations(state.conversations.byId);
};

const applyLeadEvent = (state: RealtimeStoreState, event: NormalizedEvent): void => {
  const lead = event.data as Lead;
  
  if (event.type === 'delete') {
    const oldLead = state.leads.byId[event.id];
    delete state.leads.byId[event.id];
    state.leads.allIds = state.leads.allIds.filter((id) => id !== event.id);
    if (oldLead?.pipeline_id) {
      state.leads.byPipelineId[oldLead.pipeline_id] = (
        state.leads.byPipelineId[oldLead.pipeline_id] || []
      ).filter((id) => id !== event.id);
    }
  } else {
    const oldLead = state.leads.byId[event.id];
    state.leads.byId[event.id] = lead;
    if (!state.leads.allIds.includes(event.id)) {
      state.leads.allIds.push(event.id);
    }
    if (oldLead?.pipeline_id && oldLead.pipeline_id !== lead.pipeline_id) {
      state.leads.byPipelineId[oldLead.pipeline_id] = (
        state.leads.byPipelineId[oldLead.pipeline_id] || []
      ).filter((id) => id !== event.id);
    }
    if (lead.pipeline_id) {
      if (!state.leads.byPipelineId[lead.pipeline_id]) {
        state.leads.byPipelineId[lead.pipeline_id] = [];
      }
      if (!state.leads.byPipelineId[lead.pipeline_id].includes(event.id)) {
        state.leads.byPipelineId[lead.pipeline_id].push(event.id);
      }
    }
  }
};

const applyCalendarEvent = (state: RealtimeStoreState, event: NormalizedEvent): void => {
  const apt = event.data as CalendarAppointment;
  
  if (event.type === 'delete') {
    delete state.calendar.byId[event.id];
    state.calendar.allIds = state.calendar.allIds.filter((id) => id !== event.id);
    Object.keys(state.calendar.byDate).forEach((dateKey) => {
      state.calendar.byDate[dateKey] = state.calendar.byDate[dateKey].filter(
        (id) => id !== event.id
      );
    });
  } else {
    state.calendar.byId[event.id] = apt;
    if (!state.calendar.allIds.includes(event.id)) {
      state.calendar.allIds.push(event.id);
    }
    const dateKey = getDateKey(apt.start_time);
    if (!state.calendar.byDate[dateKey]) {
      state.calendar.byDate[dateKey] = [];
    }
    if (!state.calendar.byDate[dateKey].includes(event.id)) {
      state.calendar.byDate[dateKey].push(event.id);
    }
  }
};

const applyActivityEvent = (state: RealtimeStoreState, event: NormalizedEvent): void => {
  const activity = event.data as LeadActivity;
  
  if (event.type === 'delete') {
    delete state.activities.byId[event.id];
    state.activities.allIds = state.activities.allIds.filter((id) => id !== event.id);
    Object.keys(state.activities.byLeadId).forEach((leadId) => {
      state.activities.byLeadId[leadId] = state.activities.byLeadId[leadId].filter(
        (id) => id !== event.id
      );
    });
  } else {
    state.activities.byId[event.id] = activity;
    if (!state.activities.allIds.includes(event.id)) {
      state.activities.allIds.push(event.id);
    }
    if (!state.activities.byLeadId[activity.lead_id]) {
      state.activities.byLeadId[activity.lead_id] = [];
    }
    if (!state.activities.byLeadId[activity.lead_id].includes(event.id)) {
      state.activities.byLeadId[activity.lead_id].push(event.id);
    }
  }
};

const applyPresenceEvent = (state: RealtimeStoreState, event: NormalizedEvent): void => {
  const presence = event.data as UserPresence;
  
  if (event.type === 'delete') {
    delete state.presence.users[presence.userId];
  } else {
    state.presence.users[presence.userId] = presence;
  }
};

export const useRealtimeStore = create<RealtimeStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      // Connection actions
      setConnectionState: (state) =>
        set(
          (prev) => ({
            connectionState: state,
            lastConnectedAt: state === 'connected' ? Date.now() : prev.lastConnectedAt,
          }),
          false,
          'setConnectionState'
        ),

      incrementReconnectAttempts: () =>
        set(
          (prev) => ({ reconnectAttempts: prev.reconnectAttempts + 1 }),
          false,
          'incrementReconnectAttempts'
        ),

      resetReconnectAttempts: () =>
        set({ reconnectAttempts: 0 }, false, 'resetReconnectAttempts'),

      // Tab visibility
      setTabActive: (active) =>
        set({ isTabActive: active }, false, 'setTabActive'),

      processPendingUpdates: () => {
        const { pendingUpdates, applyBatch } = get();
        if (pendingUpdates.length > 0) {
          applyBatch(pendingUpdates);
          set({ pendingUpdates: [] }, false, 'processPendingUpdates');
        }
      },

      // Batch update handler
      applyBatch: (events) =>
        set(
          (state) => {
            const newState = { ...state };

            events.forEach((event) => {
              switch (event.domain) {
                case 'messages':
                  applyMessageEvent(newState, event);
                  break;
                case 'conversations':
                  applyConversationEvent(newState, event);
                  break;
                case 'leads':
                  applyLeadEvent(newState, event);
                  break;
                case 'calendar':
                  applyCalendarEvent(newState, event);
                  break;
                case 'activities':
                  applyActivityEvent(newState, event);
                  break;
                case 'presence':
                  applyPresenceEvent(newState, event);
                  break;
                case 'dispatchConversations':
                  applyDispatchConversationEvent(newState, event);
                  break;
                case 'dispatchJobs':
                  applyDispatchJobEvent(newState, event);
                  break;
              }
            });

            return newState;
          },
          false,
          'applyBatch'
        ),

      // Messages actions
      setMessages: (messages) =>
        set(
          (state) => {
            const byId: Record<string, WhatsAppMessage> = {};
            const byChatId: Record<string, string[]> = {};
            const allIds: string[] = [];

            messages.forEach((msg) => {
              byId[msg.id] = msg;
              allIds.push(msg.id);
              if (msg.chat_id) {
                if (!byChatId[msg.chat_id]) {
                  byChatId[msg.chat_id] = [];
                }
                byChatId[msg.chat_id].push(msg.id);
              }
            });

            return {
              messages: { byId, byChatId, allIds },
            };
          },
          false,
          'setMessages'
        ),

      upsertMessage: (message) =>
        set(
          (state) => {
            const byId = { ...state.messages.byId, [message.id]: message };
            const allIds = state.messages.allIds.includes(message.id)
              ? state.messages.allIds
              : [...state.messages.allIds, message.id];

            const byChatId = { ...state.messages.byChatId };
            if (message.chat_id) {
              if (!byChatId[message.chat_id]) {
                byChatId[message.chat_id] = [];
              }
              if (!byChatId[message.chat_id].includes(message.id)) {
                byChatId[message.chat_id] = [...byChatId[message.chat_id], message.id];
              }
            }

            return { messages: { byId, byChatId, allIds } };
          },
          false,
          'upsertMessage'
        ),

      deleteMessage: (id) =>
        set(
          (state) => {
            const { [id]: deleted, ...byId } = state.messages.byId;
            const allIds = state.messages.allIds.filter((mid) => mid !== id);

            const byChatId = { ...state.messages.byChatId };
            Object.keys(byChatId).forEach((chatId) => {
              byChatId[chatId] = byChatId[chatId].filter((mid) => mid !== id);
            });

            return { messages: { byId, byChatId, allIds } };
          },
          false,
          'deleteMessage'
        ),

      // Conversations actions
      setConversations: (conversations) =>
        set(
          (state) => {
            const byId: Record<string, WhatsAppChat> = {};
            const allIds: string[] = [];

            conversations.forEach((conv) => {
              byId[conv.id] = conv;
              allIds.push(conv.id);
            });

            const sortedIds = sortConversations(byId);

            return { conversations: { byId, allIds, sortedIds } };
          },
          false,
          'setConversations'
        ),

      upsertConversation: (conversation) =>
        set(
          (state) => {
            const byId = { ...state.conversations.byId, [conversation.id]: conversation };
            const allIds = state.conversations.allIds.includes(conversation.id)
              ? state.conversations.allIds
              : [...state.conversations.allIds, conversation.id];
            const sortedIds = sortConversations(byId);

            return { conversations: { byId, allIds, sortedIds } };
          },
          false,
          'upsertConversation'
        ),

      deleteConversation: (id) =>
        set(
          (state) => {
            const { [id]: deleted, ...byId } = state.conversations.byId;
            const allIds = state.conversations.allIds.filter((cid) => cid !== id);
            const sortedIds = state.conversations.sortedIds.filter((cid) => cid !== id);

            return { conversations: { byId, allIds, sortedIds } };
          },
          false,
          'deleteConversation'
        ),

      // Leads actions
      setLeads: (leads) =>
        set(
          (state) => {
            const byId: Record<string, Lead> = {};
            const byPipelineId: Record<string, string[]> = {};
            const allIds: string[] = [];

            leads.forEach((lead) => {
              byId[lead.id] = lead;
              allIds.push(lead.id);
              if (lead.pipeline_id) {
                if (!byPipelineId[lead.pipeline_id]) {
                  byPipelineId[lead.pipeline_id] = [];
                }
                byPipelineId[lead.pipeline_id].push(lead.id);
              }
            });

            return { leads: { byId, byPipelineId, allIds } };
          },
          false,
          'setLeads'
        ),

      upsertLead: (lead) =>
        set(
          (state) => {
            const oldLead = state.leads.byId[lead.id];
            const byId = { ...state.leads.byId, [lead.id]: lead };
            const allIds = state.leads.allIds.includes(lead.id)
              ? state.leads.allIds
              : [...state.leads.allIds, lead.id];

            const byPipelineId = { ...state.leads.byPipelineId };

            // Remove from old pipeline if changed
            if (oldLead?.pipeline_id && oldLead.pipeline_id !== lead.pipeline_id) {
              byPipelineId[oldLead.pipeline_id] = (byPipelineId[oldLead.pipeline_id] || []).filter(
                (lid) => lid !== lead.id
              );
            }

            // Add to new pipeline
            if (lead.pipeline_id) {
              if (!byPipelineId[lead.pipeline_id]) {
                byPipelineId[lead.pipeline_id] = [];
              }
              if (!byPipelineId[lead.pipeline_id].includes(lead.id)) {
                byPipelineId[lead.pipeline_id] = [...byPipelineId[lead.pipeline_id], lead.id];
              }
            }

            return { leads: { byId, byPipelineId, allIds } };
          },
          false,
          'upsertLead'
        ),

      deleteLead: (id) =>
        set(
          (state) => {
            const { [id]: deleted, ...byId } = state.leads.byId;
            const allIds = state.leads.allIds.filter((lid) => lid !== id);

            const byPipelineId = { ...state.leads.byPipelineId };
            Object.keys(byPipelineId).forEach((pipelineId) => {
              byPipelineId[pipelineId] = byPipelineId[pipelineId].filter((lid) => lid !== id);
            });

            return { leads: { byId, byPipelineId, allIds } };
          },
          false,
          'deleteLead'
        ),

      // Calendar actions
      setAppointments: (appointments) =>
        set(
          (state) => {
            const byId: Record<string, CalendarAppointment> = {};
            const byDate: Record<string, string[]> = {};
            const allIds: string[] = [];

            appointments.forEach((apt) => {
              byId[apt.id] = apt;
              allIds.push(apt.id);
              const dateKey = getDateKey(apt.start_time);
              if (!byDate[dateKey]) {
                byDate[dateKey] = [];
              }
              byDate[dateKey].push(apt.id);
            });

            return { calendar: { byId, byDate, allIds } };
          },
          false,
          'setAppointments'
        ),

      upsertAppointment: (appointment) =>
        set(
          (state) => {
            const byId = { ...state.calendar.byId, [appointment.id]: appointment };
            const allIds = state.calendar.allIds.includes(appointment.id)
              ? state.calendar.allIds
              : [...state.calendar.allIds, appointment.id];

            const byDate = { ...state.calendar.byDate };
            const dateKey = getDateKey(appointment.start_time);
            if (!byDate[dateKey]) {
              byDate[dateKey] = [];
            }
            if (!byDate[dateKey].includes(appointment.id)) {
              byDate[dateKey] = [...byDate[dateKey], appointment.id];
            }

            return { calendar: { byId, byDate, allIds } };
          },
          false,
          'upsertAppointment'
        ),

      deleteAppointment: (id) =>
        set(
          (state) => {
            const { [id]: deleted, ...byId } = state.calendar.byId;
            const allIds = state.calendar.allIds.filter((aid) => aid !== id);

            const byDate = { ...state.calendar.byDate };
            Object.keys(byDate).forEach((dateKey) => {
              byDate[dateKey] = byDate[dateKey].filter((aid) => aid !== id);
            });

            return { calendar: { byId, byDate, allIds } };
          },
          false,
          'deleteAppointment'
        ),

      // Activities actions
      setActivities: (activities) =>
        set(
          (state) => {
            const byId: Record<string, LeadActivity> = {};
            const byLeadId: Record<string, string[]> = {};
            const allIds: string[] = [];

            activities.forEach((act) => {
              byId[act.id] = act;
              allIds.push(act.id);
              if (!byLeadId[act.lead_id]) {
                byLeadId[act.lead_id] = [];
              }
              byLeadId[act.lead_id].push(act.id);
            });

            return { activities: { byId, byLeadId, allIds } };
          },
          false,
          'setActivities'
        ),

      upsertActivity: (activity) =>
        set(
          (state) => {
            const byId = { ...state.activities.byId, [activity.id]: activity };
            const allIds = state.activities.allIds.includes(activity.id)
              ? state.activities.allIds
              : [...state.activities.allIds, activity.id];

            const byLeadId = { ...state.activities.byLeadId };
            if (!byLeadId[activity.lead_id]) {
              byLeadId[activity.lead_id] = [];
            }
            if (!byLeadId[activity.lead_id].includes(activity.id)) {
              byLeadId[activity.lead_id] = [...byLeadId[activity.lead_id], activity.id];
            }

            return { activities: { byId, byLeadId, allIds } };
          },
          false,
          'upsertActivity'
        ),

      deleteActivity: (id) =>
        set(
          (state) => {
            const { [id]: deleted, ...byId } = state.activities.byId;
            const allIds = state.activities.allIds.filter((aid) => aid !== id);

            const byLeadId = { ...state.activities.byLeadId };
            Object.keys(byLeadId).forEach((leadId) => {
              byLeadId[leadId] = byLeadId[leadId].filter((aid) => aid !== id);
            });

            return { activities: { byId, byLeadId, allIds } };
          },
          false,
          'deleteActivity'
        ),

      // Presence actions
      updatePresence: (presence) =>
        set(
          (state) => ({
            presence: {
              users: { ...state.presence.users, [presence.userId]: presence },
            },
          }),
          false,
          'updatePresence'
        ),

      removePresence: (userId) =>
        set(
          (state) => {
            const { [userId]: removed, ...users } = state.presence.users;
            return { presence: { users } };
          },
          false,
          'removePresence'
        ),

      // Dispatch Conversations actions
      setDispatchConversations: (conversations) =>
        set(
          (state) => {
            const byId: Record<string, DispatchConversation> = {};
            const allIds: string[] = [];

            conversations.forEach((conv) => {
              byId[conv.id] = conv;
              allIds.push(conv.id);
            });

            const sortedIds = sortDispatchConversations(byId);

            return { dispatchConversations: { byId, allIds, sortedIds } };
          },
          false,
          'setDispatchConversations'
        ),

      upsertDispatchConversation: (conversation) =>
        set(
          (state) => {
            const byId = { ...state.dispatchConversations.byId, [conversation.id]: conversation };
            const allIds = state.dispatchConversations.allIds.includes(conversation.id)
              ? state.dispatchConversations.allIds
              : [...state.dispatchConversations.allIds, conversation.id];
            const sortedIds = sortDispatchConversations(byId);

            return { dispatchConversations: { byId, allIds, sortedIds } };
          },
          false,
          'upsertDispatchConversation'
        ),

      deleteDispatchConversation: (id) =>
        set(
          (state) => {
            const { [id]: deleted, ...byId } = state.dispatchConversations.byId;
            const allIds = state.dispatchConversations.allIds.filter((cid) => cid !== id);
            const sortedIds = state.dispatchConversations.sortedIds.filter((cid) => cid !== id);

            return { dispatchConversations: { byId, allIds, sortedIds } };
          },
          false,
          'deleteDispatchConversation'
        ),

      // Dispatch Jobs actions
      setDispatchJobs: (jobs) =>
        set(
          (state) => {
            const byId: Record<string, DispatchJob> = {};
            const byConversationId: Record<string, string[]> = {};
            const allIds: string[] = [];

            jobs.forEach((job) => {
              byId[job.id] = job;
              allIds.push(job.id);
              if (job.conversation_id) {
                if (!byConversationId[job.conversation_id]) {
                  byConversationId[job.conversation_id] = [];
                }
                byConversationId[job.conversation_id].push(job.id);
              }
            });

            const activeJobIds = getActiveJobIds(byId);

            return { dispatchJobs: { byId, byConversationId, allIds, activeJobIds } };
          },
          false,
          'setDispatchJobs'
        ),

      upsertDispatchJob: (job) =>
        set(
          (state) => {
            const oldJob = state.dispatchJobs.byId[job.id];
            const byId = { ...state.dispatchJobs.byId, [job.id]: job };
            const allIds = state.dispatchJobs.allIds.includes(job.id)
              ? state.dispatchJobs.allIds
              : [...state.dispatchJobs.allIds, job.id];

            const byConversationId = { ...state.dispatchJobs.byConversationId };

            // Remove from old conversation if changed
            if (oldJob?.conversation_id && oldJob.conversation_id !== job.conversation_id) {
              byConversationId[oldJob.conversation_id] = (
                byConversationId[oldJob.conversation_id] || []
              ).filter((jid) => jid !== job.id);
            }

            // Add to new conversation
            if (job.conversation_id) {
              if (!byConversationId[job.conversation_id]) {
                byConversationId[job.conversation_id] = [];
              }
              if (!byConversationId[job.conversation_id].includes(job.id)) {
                byConversationId[job.conversation_id] = [
                  ...byConversationId[job.conversation_id],
                  job.id,
                ];
              }
            }

            const activeJobIds = getActiveJobIds(byId);

            return { dispatchJobs: { byId, byConversationId, allIds, activeJobIds } };
          },
          false,
          'upsertDispatchJob'
        ),

      deleteDispatchJob: (id) =>
        set(
          (state) => {
            const oldJob = state.dispatchJobs.byId[id];
            const { [id]: deleted, ...byId } = state.dispatchJobs.byId;
            const allIds = state.dispatchJobs.allIds.filter((jid) => jid !== id);

            const byConversationId = { ...state.dispatchJobs.byConversationId };
            if (oldJob?.conversation_id) {
              byConversationId[oldJob.conversation_id] = (
                byConversationId[oldJob.conversation_id] || []
              ).filter((jid) => jid !== id);
            }

            const activeJobIds = getActiveJobIds(byId);

            return { dispatchJobs: { byId, byConversationId, allIds, activeJobIds } };
          },
          false,
          'deleteDispatchJob'
        ),

      // Reset
      reset: () => set(initialState, false, 'reset'),
    })),
    { name: 'realtime-store' }
  )
);
