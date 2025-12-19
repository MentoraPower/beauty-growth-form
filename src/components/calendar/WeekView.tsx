import { useEffect, useRef, useState } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  startOfDay,
  differenceInMinutes,
  addMinutes,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { AppointmentCard } from "./AppointmentCard";
import type { Appointment, PendingSlot } from "@/pages/CalendarPage";

interface WeekViewProps {
  date: Date;
  appointments: Appointment[];
  onDayClick: (date: Date, hour: number, event?: React.MouseEvent) => void;
  onAppointmentDrop: (
    appointmentId: string,
    newStartTime: Date,
    newEndTime: Date
  ) => void;
  onAppointmentClick?: (appointment: Appointment, event: React.MouseEvent) => void;
  pendingSlot?: PendingSlot | null;
}

const HOUR_HEIGHT = 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TOTAL_HEIGHT = HOUR_HEIGHT * 24;
const SAO_PAULO_TZ = "America/Sao_Paulo";
const MINUTE_SNAP = 5; // Snap to 5-minute intervals

export function WeekView({
  date,
  appointments,
  onDayClick,
  onAppointmentDrop,
  onAppointmentClick,
  pendingSlot,
}: WeekViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [currentTimeTop, setCurrentTimeTop] = useState(0);
  const [todayInSaoPaulo, setTodayInSaoPaulo] = useState<Date | null>(null);

  const weekStart = startOfWeek(date, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Calculate current time position using São Paulo timezone
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const nowSaoPaulo = toZonedTime(now, SAO_PAULO_TZ);
      const minutesSinceMidnight = nowSaoPaulo.getHours() * 60 + nowSaoPaulo.getMinutes();
      setCurrentTimeTop((minutesSinceMidnight / 60) * HOUR_HEIGHT);
      setTodayInSaoPaulo(nowSaoPaulo);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to current time or 8am on mount
  useEffect(() => {
    if (containerRef.current) {
      const scrollTo = currentTimeTop > 0 
        ? currentTimeTop - 100 
        : 8 * HOUR_HEIGHT;
      containerRef.current.scrollTop = scrollTo;
    }
  }, []);

  const getAppointmentsForDay = (day: Date) =>
    appointments.filter((apt) => isSameDay(new Date(apt.start_time), day));

  const getAppointmentPosition = (apt: Appointment, day: Date) => {
    const start = new Date(apt.start_time);
    const end = new Date(apt.end_time);
    const dayStart = startOfDay(day);

    const top = (differenceInMinutes(start, dayStart) / 60) * HOUR_HEIGHT;
    const height = Math.max(
      (differenceInMinutes(end, start) / 60) * HOUR_HEIGHT,
      20
    );

    return { top, height };
  };

  const getMinutesFromDelta = (deltaY: number, appointment: Appointment): number => {
    const start = new Date(appointment.start_time);
    const dayStart = startOfDay(start);
    const currentMinutes = differenceInMinutes(start, dayStart);
    
    // Convert delta pixels to minutes
    const deltaMinutes = (deltaY / HOUR_HEIGHT) * 60;
    const newMinutes = currentMinutes + deltaMinutes;
    
    // Snap to MINUTE_SNAP intervals
    const snappedMinutes = Math.round(newMinutes / MINUTE_SNAP) * MINUTE_SNAP;
    
    // Clamp between 0 and 23:55
    return Math.max(0, Math.min(snappedMinutes, 24 * 60 - MINUTE_SNAP));
  };

  const getDayIndexFromDelta = (deltaX: number, appointment: Appointment): number => {
    if (!gridRef.current) return 0;
    
    const gridRect = gridRef.current.getBoundingClientRect();
    const columnWidth = (gridRect.width - 64) / 7; // subtract time label width
    
    // Find current day index of the appointment
    const aptDate = new Date(appointment.start_time);
    const currentDayIndex = days.findIndex(d => isSameDay(d, aptDate));
    
    // Calculate day offset from delta
    const dayOffset = Math.round(deltaX / columnWidth);
    const newDayIndex = currentDayIndex + dayOffset;
    
    return Math.max(0, Math.min(newDayIndex, 6));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    const appointment = active.data.current?.appointment as Appointment;
    if (!appointment) return;

    const minutes = getMinutesFromDelta(delta.y, appointment);
    const dayIndex = getDayIndexFromDelta(delta.x, appointment);
    
    const oldStart = new Date(appointment.start_time);
    const oldEnd = new Date(appointment.end_time);
    const duration = differenceInMinutes(oldEnd, oldStart);

    const targetDay = days[dayIndex];
    const newStart = new Date(targetDay);
    newStart.setHours(0, minutes, 0, 0);
    const newEnd = addMinutes(newStart, duration);

    onAppointmentDrop(appointment.id, newStart, newEnd);
  };

  return (
    <DndContext 
      sensors={sensors} 
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex border-b border-border">
          <div className="w-16 flex-shrink-0" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="flex-1 py-2 text-center border-l border-border/50"
            >
              <div className="text-xs text-muted-foreground uppercase">
                {format(day, "EEE", { locale: ptBR })}
              </div>
              <div
                className={cn(
                  "text-lg font-semibold mt-0.5",
                  todayInSaoPaulo && isSameDay(day, todayInSaoPaulo) &&
                    "bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center mx-auto"
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid - simple scroll from 00:00 to 23:00 */}
        <div 
          ref={containerRef} 
          className="flex-1 overflow-y-auto"
        >
          <div ref={gridRef} className="relative flex" style={{ height: TOTAL_HEIGHT }}>
            {/* Time labels */}
            <div className="w-16 flex-shrink-0 pt-2">
              {HOURS.map((hour) => (
                <div
                  key={`label-${hour}`}
                  className="h-[60px] text-xs text-muted-foreground pr-2 text-right flex items-start"
                >
                  {hour.toString().padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Days columns */}
            {days.map((day) => {
              const dayAppointments = getAppointmentsForDay(day);
              const showCurrentTime = todayInSaoPaulo && isSameDay(day, todayInSaoPaulo);

              return (
                <div key={day.toISOString()} className="flex-1 relative border-l border-border/50 pt-2">
                  {/* Hour cells */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      onClick={(e) => onDayClick(day, hour, e)}
                      className="h-[60px] border-t border-l border-border/50 cursor-pointer hover:bg-muted/30"
                    />
                  ))}

                  {/* Current time indicator */}
                  {showCurrentTime && currentTimeTop > 0 && (
                    <div
                      className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
                      style={{ top: currentTimeTop }}
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <div className="flex-1 h-[1px] bg-red-500" />
                    </div>
                  )}

                  {/* Appointments */}
                  {dayAppointments.map((apt) => {
                    const { top, height } = getAppointmentPosition(apt, day);
                    return (
                      <AppointmentCard
                        key={apt.id}
                        appointment={apt}
                        style={{ top, height }}
                        onClick={onAppointmentClick}
                      />
                    );
                  })}

                  {/* Pending slot placeholder (green) */}
                  {pendingSlot && isSameDay(pendingSlot.date, day) && (() => {
                    const [startH, startM] = pendingSlot.startTime.split(":").map(Number);
                    const [endH, endM] = pendingSlot.endTime.split(":").map(Number);
                    const startMinutes = (startH || 0) * 60 + (startM || 0);
                    const endMinutes = (endH || 0) * 60 + (endM || 0);
                    const top = (startMinutes / 60) * HOUR_HEIGHT;
                    const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 20);
                    
                    return (
                      <div
                        className="absolute left-1 right-1 bg-emerald-500/80 rounded-lg border-2 border-emerald-400 shadow-lg z-10 flex items-center justify-center"
                        style={{ top, height }}
                      >
                        <span className="text-white text-xs font-medium">Novo</span>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
