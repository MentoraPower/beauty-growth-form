/**
 * Calendar Real-time Hook
 * Provides optimized access to calendar data through Zustand store
 */

import { useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  useAllAppointments, 
  useAppointmentsByDate,
  useRealtimeActions,
  useConnectionState,
} from '@/hooks/useRealtimeSelectors';

interface UseCalendarRealtimeOptions {
  enabled?: boolean;
}

export function useCalendarRealtime({ enabled = true }: UseCalendarRealtimeOptions = {}) {
  const connectionState = useConnectionState();
  const allAppointments = useAllAppointments();
  const { setAppointments, upsertAppointment, deleteAppointment } = useRealtimeActions();

  // Load initial appointments
  const loadInitialAppointments = useCallback(async () => {
    if (!enabled) return;

    try {
      const { data, error } = await supabase
        .from('calendar_appointments')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) {
        console.error('[Calendar Realtime] Error fetching appointments:', error);
        return;
      }

      if (data) {
        setAppointments(data);
      }
    } catch (error) {
      console.error('[Calendar Realtime] Error in loadInitialAppointments:', error);
    }
  }, [enabled, setAppointments]);

  // Initialize on mount
  useEffect(() => {
    loadInitialAppointments();
  }, [loadInitialAppointments]);

  // Get appointments for a specific date
  const getAppointmentsForDate = useCallback((date: Date) => {
    const dateKey = date.toISOString().split('T')[0];
    return allAppointments.filter(apt => {
      const aptDate = new Date(apt.start_time).toISOString().split('T')[0];
      return aptDate === dateKey;
    });
  }, [allAppointments]);

  // Get appointments for a date range
  const getAppointmentsInRange = useCallback((startDate: Date, endDate: Date) => {
    const start = startDate.getTime();
    const end = endDate.getTime();
    
    return allAppointments.filter(apt => {
      const aptTime = new Date(apt.start_time).getTime();
      return aptTime >= start && aptTime <= end;
    });
  }, [allAppointments]);

  // Group appointments by date
  const appointmentsByDate = useMemo(() => {
    const grouped: Record<string, typeof allAppointments> = {};
    
    allAppointments.forEach(apt => {
      const dateKey = new Date(apt.start_time).toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(apt);
    });

    // Sort by start_time within each date
    Object.values(grouped).forEach(apts => {
      apts.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
    });

    return grouped;
  }, [allAppointments]);

  return {
    appointments: allAppointments,
    appointmentsByDate,
    connectionState,
    isConnected: connectionState === 'connected',
    getAppointmentsForDate,
    getAppointmentsInRange,
    refresh: loadInitialAppointments,
  };
}

export default useCalendarRealtime;
