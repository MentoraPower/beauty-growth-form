import { useEffect, useRef, useState } from "react";
import { format, isSameDay, startOfDay, addMinutes, differenceInMinutes } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { AppointmentCard } from "./AppointmentCard";
import type { Appointment, PendingSlot } from "@/pages/CalendarPage";

interface DayViewProps {
  date: Date;
  appointments: Appointment[];
  onDayClick: (date: Date, hour: number, event?: React.MouseEvent) => void;
  onAppointmentDrop: (appointmentId: string, newStartTime: Date, newEndTime: Date) => void;
  pendingSlot?: PendingSlot | null;
}

const HOUR_HEIGHT = 60; // pixels per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TOTAL_HEIGHT = HOUR_HEIGHT * 24;
const SAO_PAULO_TZ = "America/Sao_Paulo";

function HourSlot({
  hour,
  date,
  onClick,
}: {
  hour: number;
  date: Date;
  onClick: (e: React.MouseEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `hour-${hour}`,
    data: { hour, date },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "h-[60px] border-t border-border/50 cursor-pointer hover:bg-muted/30 transition-colors relative",
        isOver && "bg-primary/10"
      )}
    />
  );
}

export function DayView({
  date,
  appointments,
  onDayClick,
  onAppointmentDrop,
  pendingSlot,
}: DayViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTimeTop, setCurrentTimeTop] = useState(0);

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
      
      // Check if viewing today in São Paulo time
      const dateSaoPaulo = toZonedTime(date, SAO_PAULO_TZ);
      if (isSameDay(nowSaoPaulo, dateSaoPaulo)) {
        const minutesSinceMidnight = nowSaoPaulo.getHours() * 60 + nowSaoPaulo.getMinutes();
        setCurrentTimeTop((minutesSinceMidnight / 60) * HOUR_HEIGHT);
      } else {
        setCurrentTimeTop(-1);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [date]);

  // Scroll to current time or 8am on mount
  useEffect(() => {
    if (containerRef.current) {
      const scrollTo = currentTimeTop > 0 
        ? currentTimeTop - 100 
        : 8 * HOUR_HEIGHT;
      containerRef.current.scrollTop = scrollTo;
    }
  }, []);

  const dayAppointments = appointments.filter((apt) =>
    isSameDay(new Date(apt.start_time), date)
  );

  const getAppointmentPosition = (apt: Appointment) => {
    const start = new Date(apt.start_time);
    const end = new Date(apt.end_time);
    const dayStart = startOfDay(date);
    
    const top = (differenceInMinutes(start, dayStart) / 60) * HOUR_HEIGHT;
    const height = Math.max((differenceInMinutes(end, start) / 60) * HOUR_HEIGHT, 20);
    
    return { top, height };
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const appointment = active.data.current?.appointment as Appointment;
    if (!appointment) return;

    const dropData = over.data.current as { hour: number; date: Date } | undefined;
    if (!dropData) return;

    const oldStart = new Date(appointment.start_time);
    const oldEnd = new Date(appointment.end_time);
    const duration = differenceInMinutes(oldEnd, oldStart);

    const newStart = new Date(date);
    newStart.setHours(dropData.hour, 0, 0, 0);
    const newEnd = addMinutes(newStart, duration);

    onAppointmentDrop(appointment.id, newStart, newEnd);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex border-b border-border">
          <div className="w-16 flex-shrink-0" />
          <div className="flex-1 py-3 text-center">
            <div className="text-sm text-muted-foreground">
              {format(date, "EEEE", { locale: undefined })}
            </div>
            <div className="text-2xl font-semibold">{format(date, "d")}</div>
          </div>
        </div>

        {/* Time grid - simple scroll from 00:00 to 23:00 */}
        <div 
          ref={containerRef} 
          className="flex-1 overflow-y-auto"
        >
          <div className="relative flex" style={{ height: TOTAL_HEIGHT }}>
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

            {/* Grid */}
            <div className="flex-1 relative border-l border-border pt-2">
              {/* Hour slots */}
              {HOURS.map((hour) => (
                <HourSlot
                  key={`slot-${hour}`}
                  hour={hour}
                  date={date}
                  onClick={(e) => onDayClick(date, hour, e)}
                />
              ))}

              {/* Current time indicator */}
              {currentTimeTop > 0 && (
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
                const { top, height } = getAppointmentPosition(apt);
                return (
                  <AppointmentCard
                    key={apt.id}
                    appointment={apt}
                    style={{ top, height }}
                  />
                );
              })}

              {/* Pending slot placeholder (green) */}
              {pendingSlot && isSameDay(pendingSlot.date, date) && (() => {
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
                    <span className="text-white text-sm font-medium">Novo agendamento</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
}
