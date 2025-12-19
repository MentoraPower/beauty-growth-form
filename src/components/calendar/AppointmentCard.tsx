import { useDraggable } from "@dnd-kit/core";
import { format, addMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/pages/CalendarPage";

const HOUR_HEIGHT = 60;
const MINUTE_SNAP = 1;

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
  const endTime = new Date(appointment.end_time);
  
  // Calculate real-time position based on drag delta
  let displayStartTime = startTime;
  let displayEndTime = endTime;
  
  if (isDragging && transform) {
    const deltaMinutes = Math.round((transform.y / HOUR_HEIGHT) * 60 / MINUTE_SNAP) * MINUTE_SNAP;
    displayStartTime = addMinutes(startTime, deltaMinutes);
    displayEndTime = addMinutes(endTime, deltaMinutes);
    
    // Clamp to valid range
    const startHour = displayStartTime.getHours();
    const startMin = displayStartTime.getMinutes();
    if (startHour < 0 || (startHour === 0 && startMin < 0)) {
      displayStartTime = new Date(startTime);
      displayStartTime.setHours(0, 0, 0, 0);
      const duration = endTime.getTime() - startTime.getTime();
      displayEndTime = new Date(displayStartTime.getTime() + duration);
    }
  }
  
  const timeStr = format(displayStartTime, "HH:mm");

  const dragStyle: React.CSSProperties = {
    ...style,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    cursor: isDragging ? "grabbing" : "grab",
    zIndex: isDragging ? 100 : undefined,
    transition: isDragging ? undefined : "none",
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
          "text-xs px-1.5 py-0.5 rounded bg-emerald-700 text-white truncate",
          !isDragging && "hover:bg-emerald-600",
          isDragging && "shadow-xl opacity-90 z-50"
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
        "absolute left-1 right-1 px-2 py-1 rounded-md bg-emerald-700 text-white text-xs overflow-hidden",
        !isDragging && "hover:bg-emerald-600",
        isDragging && "shadow-xl opacity-90 z-50"
      )}
    >
      <div className="font-medium truncate">{appointment.title}</div>
      <div className="opacity-80">{timeStr}</div>
    </div>
  );
}
