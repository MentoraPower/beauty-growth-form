import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/pages/CalendarPage";

interface AppointmentCardProps {
  appointment: Appointment;
  compact?: boolean;
  style?: React.CSSProperties;
  onClick?: (appointment: Appointment, event: React.MouseEvent) => void;
}

export function AppointmentCard({
  appointment,
  compact = false,
  style,
  onClick,
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
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : 'transform 150ms ease',
    cursor: isDragging ? "grabbing" : "grab",
    zIndex: isDragging ? 100 : undefined,
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    e.stopPropagation();
    onClick?.(appointment, e);
  };

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        style={dragStyle}
        onClick={handleClick}
        className={cn(
          "text-xs px-1.5 py-0.5 rounded bg-emerald-700 text-white truncate hover:bg-emerald-600 transition-colors",
          isDragging && "shadow-xl scale-105"
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
      onClick={handleClick}
      className={cn(
        "absolute left-1 right-1 px-2 py-1 rounded-md bg-emerald-700 text-white text-xs overflow-hidden hover:bg-emerald-600",
        isDragging && "shadow-xl scale-[1.02] ring-2 ring-primary/50"
      )}
    >
      <div className="font-medium truncate">{appointment.title}</div>
      <div className="opacity-80">{timeStr}</div>
    </div>
  );
}
