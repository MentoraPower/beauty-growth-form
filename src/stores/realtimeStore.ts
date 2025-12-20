/**
 * Zustand Real-time Store
 * Single source of truth for all real-time data
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
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

// Helper to get date key from ISO string
const getDateKey = (isoString: string): string => {
  return isoString.split('T')[0];
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

      // Reset
      reset: () => set(initialState, false, 'reset'),
    })),
    { name: 'realtime-store' }
  )
);

// Event appliers
function applyMessageEvent(state: RealtimeStoreState, event: NormalizedEvent): void {
  const message = event.data as WhatsAppMessage;
  if (!message?.id) return;

  if (event.type === 'delete') {
    delete state.messages.byId[message.id];
    state.messages.allIds = state.messages.allIds.filter((id) => id !== message.id);
    if (message.chat_id && state.messages.byChatId[message.chat_id]) {
      state.messages.byChatId[message.chat_id] = state.messages.byChatId[message.chat_id].filter(
        (id) => id !== message.id
      );
    }
  } else {
    state.messages.byId[message.id] = message;
    if (!state.messages.allIds.includes(message.id)) {
      state.messages.allIds.push(message.id);
    }
    if (message.chat_id) {
      if (!state.messages.byChatId[message.chat_id]) {
        state.messages.byChatId[message.chat_id] = [];
      }
      if (!state.messages.byChatId[message.chat_id].includes(message.id)) {
        state.messages.byChatId[message.chat_id].push(message.id);
      }
    }
  }
}

function applyConversationEvent(state: RealtimeStoreState, event: NormalizedEvent): void {
  const conversation = event.data as WhatsAppChat;
  if (!conversation?.id) return;

  if (event.type === 'delete') {
    delete state.conversations.byId[conversation.id];
    state.conversations.allIds = state.conversations.allIds.filter((id) => id !== conversation.id);
    state.conversations.sortedIds = state.conversations.sortedIds.filter((id) => id !== conversation.id);
  } else {
    state.conversations.byId[conversation.id] = conversation;
    if (!state.conversations.allIds.includes(conversation.id)) {
      state.conversations.allIds.push(conversation.id);
    }
    state.conversations.sortedIds = sortConversations(state.conversations.byId);
  }
}

function applyLeadEvent(state: RealtimeStoreState, event: NormalizedEvent): void {
  const lead = event.data as Lead;
  if (!lead?.id) return;

  if (event.type === 'delete') {
    const oldLead = state.leads.byId[lead.id];
    delete state.leads.byId[lead.id];
    state.leads.allIds = state.leads.allIds.filter((id) => id !== lead.id);
    if (oldLead?.pipeline_id && state.leads.byPipelineId[oldLead.pipeline_id]) {
      state.leads.byPipelineId[oldLead.pipeline_id] = state.leads.byPipelineId[oldLead.pipeline_id].filter(
        (id) => id !== lead.id
      );
    }
  } else {
    const oldLead = state.leads.byId[lead.id];
    state.leads.byId[lead.id] = lead;
    if (!state.leads.allIds.includes(lead.id)) {
      state.leads.allIds.push(lead.id);
    }

    // Handle pipeline changes
    if (oldLead?.pipeline_id && oldLead.pipeline_id !== lead.pipeline_id) {
      state.leads.byPipelineId[oldLead.pipeline_id] = (state.leads.byPipelineId[oldLead.pipeline_id] || []).filter(
        (id) => id !== lead.id
      );
    }
    if (lead.pipeline_id) {
      if (!state.leads.byPipelineId[lead.pipeline_id]) {
        state.leads.byPipelineId[lead.pipeline_id] = [];
      }
      if (!state.leads.byPipelineId[lead.pipeline_id].includes(lead.id)) {
        state.leads.byPipelineId[lead.pipeline_id].push(lead.id);
      }
    }
  }
}

function applyCalendarEvent(state: RealtimeStoreState, event: NormalizedEvent): void {
  const appointment = event.data as CalendarAppointment;
  if (!appointment?.id) return;

  const dateKey = getDateKey(appointment.start_time);

  if (event.type === 'delete') {
    delete state.calendar.byId[appointment.id];
    state.calendar.allIds = state.calendar.allIds.filter((id) => id !== appointment.id);
    if (state.calendar.byDate[dateKey]) {
      state.calendar.byDate[dateKey] = state.calendar.byDate[dateKey].filter((id) => id !== appointment.id);
    }
  } else {
    state.calendar.byId[appointment.id] = appointment;
    if (!state.calendar.allIds.includes(appointment.id)) {
      state.calendar.allIds.push(appointment.id);
    }
    if (!state.calendar.byDate[dateKey]) {
      state.calendar.byDate[dateKey] = [];
    }
    if (!state.calendar.byDate[dateKey].includes(appointment.id)) {
      state.calendar.byDate[dateKey].push(appointment.id);
    }
  }
}

function applyActivityEvent(state: RealtimeStoreState, event: NormalizedEvent): void {
  const activity = event.data as LeadActivity;
  if (!activity?.id) return;

  if (event.type === 'delete') {
    delete state.activities.byId[activity.id];
    state.activities.allIds = state.activities.allIds.filter((id) => id !== activity.id);
    if (state.activities.byLeadId[activity.lead_id]) {
      state.activities.byLeadId[activity.lead_id] = state.activities.byLeadId[activity.lead_id].filter(
        (id) => id !== activity.id
      );
    }
  } else {
    state.activities.byId[activity.id] = activity;
    if (!state.activities.allIds.includes(activity.id)) {
      state.activities.allIds.push(activity.id);
    }
    if (!state.activities.byLeadId[activity.lead_id]) {
      state.activities.byLeadId[activity.lead_id] = [];
    }
    if (!state.activities.byLeadId[activity.lead_id].includes(activity.id)) {
      state.activities.byLeadId[activity.lead_id].push(activity.id);
    }
  }
}

function applyPresenceEvent(state: RealtimeStoreState, event: NormalizedEvent): void {
  const presence = event.data as UserPresence;
  if (!presence?.userId) return;

  if (event.type === 'delete') {
    delete state.presence.users[presence.userId];
  } else {
    state.presence.users[presence.userId] = presence;
  }
}
