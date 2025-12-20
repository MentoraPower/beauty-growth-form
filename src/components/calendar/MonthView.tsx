import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
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

interface MonthViewProps {
  date: Date;
  appointments: Appointment[];
  onDayClick: (date: Date, hour?: number, event?: React.MouseEvent) => void;
  onAppointmentDrop: (
    appointmentId: string,
    newStartTime: Date,
    newEndTime: Date
  ) => void;
  onAppointmentClick?: (appointment: Appointment, event: React.MouseEvent) => void;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function DayCell({
  day,
  currentMonth,
  appointments,
  onClick,
  onAppointmentClick,
}: {
  day: Date;
  currentMonth: Date;
  appointments: Appointment[];
  onClick: (e: React.MouseEvent) => void;
  onAppointmentClick?: (appointment: Appointment, event: React.MouseEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `month-${day.toISOString()}`,
    data: { date: day },
  });

  const isCurrentMonth = isSameMonth(day, currentMonth);
  const dayAppointments = appointments.filter((apt) =>
    isSameDay(new Date(apt.start_time), day)
  );

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "min-h-[100px] border-t border-l border-border/50 p-1 cursor-pointer hover:bg-muted/30 transition-colors",
        !isCurrentMonth && "bg-muted/20",
        isOver && "bg-primary/10"
      )}
    >
      <div
        className={cn(
          "text-sm font-medium mb-1",
          !isCurrentMonth && "text-muted-foreground",
          isToday(day) &&
            "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center"
        )}
      >
        {format(day, "d")}
      </div>
      <div className="space-y-0.5 overflow-hidden">
        {dayAppointments.slice(0, 3).map((apt) => {
          const time = format(new Date(apt.start_time), "HH:mm");
          return (
            <div
              key={apt.id}
              data-appointment-card
              onClick={(e) => {
                e.stopPropagation();
                onAppointmentClick?.(apt, e);
              }}
              className="flex items-center gap-1 text-[10px] text-foreground truncate cursor-pointer hover:bg-muted/50 rounded px-0.5"
            >
              <span className="text-primary">•</span>
              <span className="text-muted-foreground">{time}</span>
              <span className="truncate">{apt.title}</span>
            </div>
          );
        })}
        {dayAppointments.length > 3 && (
          <div className="text-[10px] text-muted-foreground pl-2">
            +{dayAppointments.length - 3} mais
          </div>
        )}
      </div>
    </div>
  );
}

export function MonthView({
  date,
  appointments,
  onDayClick,
  onAppointmentDrop,
  onAppointmentClick,
}: MonthViewProps) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Generate all days to display
  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const appointment = active.data.current?.appointment as Appointment;
    if (!appointment) return;

    const dropData = over.data.current as { date: Date } | undefined;
    if (!dropData) return;

    const oldStart = new Date(appointment.start_time);
    const oldEnd = new Date(appointment.end_time);

    // Preserve the time, just change the date
    const newStart = new Date(dropData.date);
    newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);

    const newEnd = new Date(dropData.date);
    newEnd.setHours(oldEnd.getHours(), oldEnd.getMinutes(), 0, 0);

    onAppointmentDrop(appointment.id, newStart, newEnd);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="py-2 text-center text-sm font-medium text-muted-foreground border-l border-border/50 first:border-l-0"
            >
              {weekday}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-auto">
          {days.map((day) => (
            <DayCell
              key={day.toISOString()}
              day={day}
              currentMonth={date}
              appointments={appointments}
              onClick={(e) => onDayClick(day, undefined, e)}
              onAppointmentClick={onAppointmentClick}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
}
