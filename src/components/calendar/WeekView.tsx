import { useEffect, useRef, useState } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  startOfDay,
  differenceInMinutes,
  addMinutes,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { AppointmentCard } from "./AppointmentCard";
import type { Appointment } from "@/pages/CalendarPage";

interface WeekViewProps {
  date: Date;
  appointments: Appointment[];
  onDayClick: (date: Date, hour: number) => void;
  onAppointmentDrop: (
    appointmentId: string,
    newStartTime: Date,
    newEndTime: Date
  ) => void;
}

const HOUR_HEIGHT = 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function HourCell({
  hour,
  day,
  onClick,
}: {
  hour: number;
  day: Date;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `week-${day.toISOString()}-${hour}`,
    data: { hour, date: day },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "h-[60px] border-t border-l border-border/50 cursor-pointer hover:bg-muted/30 transition-colors",
        isOver && "bg-primary/10"
      )}
    />
  );
}

export function WeekView({
  date,
  appointments,
  onDayClick,
  onAppointmentDrop,
}: WeekViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTimeTop, setCurrentTimeTop] = useState(0);

  const weekStart = startOfWeek(date, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Calculate current time position
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
      setCurrentTimeTop((minutesSinceMidnight / 60) * HOUR_HEIGHT);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to current time or 8am on mount
  useEffect(() => {
    if (containerRef.current) {
      const scrollTo = currentTimeTop > 0 ? currentTimeTop - 100 : 8 * HOUR_HEIGHT;
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const appointment = active.data.current?.appointment as Appointment;
    if (!appointment) return;

    const dropData = over.data.current as
      | { hour: number; date: Date }
      | undefined;
    if (!dropData) return;

    const oldStart = new Date(appointment.start_time);
    const oldEnd = new Date(appointment.end_time);
    const duration = differenceInMinutes(oldEnd, oldStart);

    const newStart = new Date(dropData.date);
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
                  isToday(day) &&
                    "bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center mx-auto"
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div ref={containerRef} className="flex-1 overflow-y-auto">
          <div className="relative flex">
            {/* Time labels */}
            <div className="w-16 flex-shrink-0">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="h-[60px] text-xs text-muted-foreground pr-2 text-right -mt-2"
                >
                  {hour.toString().padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Days columns */}
            {days.map((day) => {
              const dayAppointments = getAppointmentsForDay(day);
              const showCurrentTime = isToday(day);

              return (
                <div key={day.toISOString()} className="flex-1 relative">
                  {/* Hour cells */}
                  {HOURS.map((hour) => (
                    <HourCell
                      key={hour}
                      hour={hour}
                      day={day}
                      onClick={() => onDayClick(day, hour)}
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
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
