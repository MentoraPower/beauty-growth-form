/**
 * Event Normalizers
 * Transform raw Supabase payloads into normalized events
 */

import type { 
  NormalizedEvent, 
  RealtimeDomain, 
  EventPriority,
  SupabaseRealtimePayload,
  WhatsAppMessage,
  WhatsAppChat,
  Lead,
  CalendarAppointment,
  LeadActivity,
} from './types';

// Table to domain mapping
const TABLE_DOMAIN_MAP: Record<string, RealtimeDomain> = {
  whatsapp_messages: 'messages',
  whatsapp_chats: 'conversations',
  leads: 'leads',
  calendar_appointments: 'calendar',
  lead_activities: 'activities',
  pipelines: 'pipelines',
  lead_tracking: 'activities',
};

// Table to priority mapping
const TABLE_PRIORITY_MAP: Record<string, EventPriority> = {
  whatsapp_messages: 'high',
  whatsapp_chats: 'high',
  leads: 'normal',
  calendar_appointments: 'normal',
  lead_activities: 'normal',
  pipelines: 'low',
};

/**
 * Generate unique event ID
 */
const generateEventId = (table: string, entityId: string, eventType: string): string => {
  return `${table}_${entityId}_${eventType}_${Date.now()}`;
};

/**
 * Extract entity ID from payload
 */
const getEntityId = (payload: SupabaseRealtimePayload): string => {
  const data = payload.new || payload.old;
  return (data as any)?.id || 'unknown';
};

/**
 * Main normalizer function
 */
export const normalizeEvent = <T>(
  payload: SupabaseRealtimePayload<T>
): NormalizedEvent<T> | null => {
  const domain = TABLE_DOMAIN_MAP[payload.table];
  
  if (!domain) {
    console.warn(`[Normalizer] Unknown table: ${payload.table}`);
    return null;
  }

  const entityId = getEntityId(payload as SupabaseRealtimePayload);
  const eventType = payload.eventType.toLowerCase() as 'insert' | 'update' | 'delete';
  
  return {
    id: entityId,
    domain,
    type: eventType,
    priority: TABLE_PRIORITY_MAP[payload.table] || 'normal',
    timestamp: Date.now(),
    data: (payload.new || payload.old) as T,
    oldData: payload.old as T | undefined,
    table: payload.table,
    batchKey: getBatchKey(payload),
  };
};

/**
 * Get batch key for grouping related events
 */
const getBatchKey = (payload: SupabaseRealtimePayload): string | undefined => {
  const data = payload.new || payload.old;
  
  // Group messages by chat_id
  if (payload.table === 'whatsapp_messages') {
    return `chat_${(data as WhatsAppMessage)?.chat_id}`;
  }
  
  // Group activities by lead_id
  if (payload.table === 'lead_activities') {
    return `lead_${(data as LeadActivity)?.lead_id}`;
  }
  
  // Group leads by pipeline_id
  if (payload.table === 'leads') {
    return `pipeline_${(data as Lead)?.pipeline_id}`;
  }
  
  return undefined;
};

/**
 * Validate and type-check message payload
 */
export const normalizeMessage = (data: unknown): WhatsAppMessage | null => {
  if (!data || typeof data !== 'object') return null;
  
  const msg = data as Record<string, unknown>;
  
  if (!msg.id || !msg.phone) return null;
  
  return {
    id: String(msg.id),
    chat_id: msg.chat_id ? String(msg.chat_id) : null,
    phone: String(msg.phone),
    text: msg.text ? String(msg.text) : null,
    from_me: msg.from_me === true,
    status: msg.status ? String(msg.status) : null,
    media_type: msg.media_type ? String(msg.media_type) : null,
    media_url: msg.media_url ? String(msg.media_url) : null,
    created_at: String(msg.created_at || new Date().toISOString()),
    message_id: msg.message_id ? String(msg.message_id) : null,
    quoted_text: msg.quoted_text ? String(msg.quoted_text) : null,
    quoted_from_me: msg.quoted_from_me === true,
    quoted_message_id: msg.quoted_message_id ? String(msg.quoted_message_id) : null,
    reaction: msg.reaction ? String(msg.reaction) : null,
    whatsapp_key_id: msg.whatsapp_key_id ? String(msg.whatsapp_key_id) : null,
  };
};

/**
 * Validate and type-check conversation payload
 */
export const normalizeConversation = (data: unknown): WhatsAppChat | null => {
  if (!data || typeof data !== 'object') return null;
  
  const chat = data as Record<string, unknown>;
  
  if (!chat.id || !chat.phone) return null;
  
  return {
    id: String(chat.id),
    phone: String(chat.phone),
    name: chat.name ? String(chat.name) : null,
    photo_url: chat.photo_url ? String(chat.photo_url) : null,
    last_message: chat.last_message ? String(chat.last_message) : null,
    last_message_time: chat.last_message_time ? String(chat.last_message_time) : null,
    last_message_from_me: chat.last_message_from_me === true,
    last_message_status: chat.last_message_status ? String(chat.last_message_status) : null,
    unread_count: typeof chat.unread_count === 'number' ? chat.unread_count : null,
    created_at: String(chat.created_at || new Date().toISOString()),
    updated_at: String(chat.updated_at || new Date().toISOString()),
  };
};

/**
 * Validate and type-check lead payload
 */
export const normalizeLead = (data: unknown): Lead | null => {
  if (!data || typeof data !== 'object') return null;
  
  const lead = data as Record<string, unknown>;
  
  if (!lead.id || !lead.name || !lead.email) return null;
  
  return {
    id: String(lead.id),
    name: String(lead.name),
    email: String(lead.email),
    whatsapp: String(lead.whatsapp || ''),
    instagram: String(lead.instagram || ''),
    pipeline_id: lead.pipeline_id ? String(lead.pipeline_id) : null,
    sub_origin_id: lead.sub_origin_id ? String(lead.sub_origin_id) : null,
    ordem: typeof lead.ordem === 'number' ? lead.ordem : null,
    created_at: String(lead.created_at || new Date().toISOString()),
  };
};

/**
 * Validate and type-check appointment payload
 */
export const normalizeAppointment = (data: unknown): CalendarAppointment | null => {
  if (!data || typeof data !== 'object') return null;
  
  const apt = data as Record<string, unknown>;
  
  if (!apt.id || !apt.title || !apt.start_time || !apt.end_time) return null;
  
  return {
    id: String(apt.id),
    title: String(apt.title),
    start_time: String(apt.start_time),
    end_time: String(apt.end_time),
    email: apt.email ? String(apt.email) : null,
    description: apt.description ? String(apt.description) : null,
    created_at: String(apt.created_at || new Date().toISOString()),
    updated_at: String(apt.updated_at || new Date().toISOString()),
  };
};

/**
 * Validate and type-check activity payload
 */
export const normalizeActivity = (data: unknown): LeadActivity | null => {
  if (!data || typeof data !== 'object') return null;
  
  const act = data as Record<string, unknown>;
  
  if (!act.id || !act.lead_id || !act.titulo) return null;
  
  return {
    id: String(act.id),
    lead_id: String(act.lead_id),
    titulo: String(act.titulo),
    tipo: String(act.tipo || 'task'),
    data: String(act.data || new Date().toISOString().split('T')[0]),
    hora: String(act.hora || '09:00'),
    concluida: act.concluida === true,
    notas: act.notas ? String(act.notas) : null,
    pipeline_id: act.pipeline_id ? String(act.pipeline_id) : null,
    created_at: String(act.created_at || new Date().toISOString()),
    updated_at: String(act.updated_at || new Date().toISOString()),
  };
};

/**
 * Check if event is obsolete (newer version already processed)
 */
export const isEventObsolete = (
  event: NormalizedEvent,
  existingTimestamp: number | undefined
): boolean => {
  if (!existingTimestamp) return false;
  return event.timestamp < existingTimestamp;
};

/**
 * Merge events for same entity (keep only latest)
 */
export const mergeEvents = (events: NormalizedEvent[]): NormalizedEvent[] => {
  const eventMap = new Map<string, NormalizedEvent>();
  
  events.forEach((event) => {
    const key = `${event.domain}_${event.id}`;
    const existing = eventMap.get(key);
    
    // Keep delete events or newer events
    if (!existing || event.type === 'delete' || event.timestamp > existing.timestamp) {
      eventMap.set(key, event);
    }
  });
  
  return Array.from(eventMap.values());
};
