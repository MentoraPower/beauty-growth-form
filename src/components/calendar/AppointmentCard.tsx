import { useDraggable } from "@dnd-kit/core";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/pages/CalendarPage";

interface AppointmentCardProps {
  appointment: Appointment;
  compact?: boolean;
  style?: React.CSSProperties;
}

export function AppointmentCard({
  appointment,
  compact = false,
  style,
}: AppointmentCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: appointment.id,
      data: { appointment },
    });

  const startTime = new Date(appointment.start_time);
  const timeStr = format(startTime, "HH:mm");

  const dragStyle: React.CSSProperties = {
    ...style,
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
  };

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        style={dragStyle}
        className={cn(
          "text-xs px-1.5 py-0.5 rounded bg-emerald-700 text-white truncate",
          isDragging && "z-50"
        )}
      >
        {appointment.title}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={dragStyle}
      className={cn(
        "absolute left-1 right-1 px-2 py-1 rounded-md bg-emerald-700 text-white text-xs overflow-hidden",
        isDragging && "z-50 shadow-lg"
      )}
    >
      <div className="font-medium truncate">{appointment.title}</div>
      <div className="opacity-80">{timeStr}</div>
    </div>
  );
}
