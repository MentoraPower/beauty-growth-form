/**
 * Real-time Module Exports
 * Central export point for the real-time architecture
 */

// Types
export type {
  RealtimeDomain,
  EventPriority,
  SupabaseRealtimePayload,
  NormalizedEvent,
  ConnectionState,
  BufferConfig,
  WhatsAppMessage,
  WhatsAppChat,
  Lead,
  CalendarAppointment,
  LeadActivity,
  UserPresence,
  MessagesSlice,
  ConversationsSlice,
  LeadsSlice,
  CalendarSlice,
  ActivitiesSlice,
  PresenceSlice,
  MetricsSlice,
  RealtimeStoreState,
  RealtimeStoreActions,
  RealtimeStore,
} from './types';

// Event Buffer
export { EventBuffer, getEventBuffer, resetEventBuffer } from './eventBuffer';

// Event Normalizers
export {
  normalizeEvent,
  normalizeMessage,
  normalizeConversation,
  normalizeLead,
  normalizeAppointment,
  normalizeActivity,
  isEventObsolete,
  mergeEvents,
} from './eventNormalizers';

// WebSocket Manager
export {
  WebSocketManager,
  getWebSocketManager,
  resetWebSocketManager,
} from './websocketManager';

// Real-time Service
export {
  getRealtimeService,
  initializeRealtime,
  destroyRealtime,
  reconnectRealtime,
} from './realtimeService';
