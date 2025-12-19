import {
  format,
  startOfYear,
  addMonths,
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
import { cn } from "@/lib/utils";
import type { Appointment } from "@/pages/CalendarPage";

interface YearViewProps {
  date: Date;
  appointments: Appointment[];
  onMonthClick: (date: Date) => void;
}

const WEEKDAYS_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];

function MiniMonth({
  month,
  appointments,
  onClick,
}: {
  month: Date;
  appointments: Appointment[];
  onClick: () => void;
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  // Generate all days to display
  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const hasAppointment = (d: Date) =>
    appointments.some((apt) => isSameDay(new Date(apt.start_time), d));

  return (
    <div
      onClick={onClick}
      className="p-3 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 cursor-pointer transition-colors"
    >
      <div className="text-sm font-semibold mb-2 capitalize">
        {format(month, "MMMM", { locale: ptBR })}
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS_SHORT.map((wd, i) => (
          <div
            key={i}
            className="text-[10px] text-muted-foreground text-center"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          const isCurrentMonth = isSameMonth(d, month);
          const hasApt = hasAppointment(d);

          return (
            <div
              key={i}
              className={cn(
                "text-[10px] h-5 w-5 flex items-center justify-center rounded-sm",
                !isCurrentMonth && "text-muted-foreground/30",
                isToday(d) && "bg-primary text-primary-foreground",
                hasApt && !isToday(d) && "bg-emerald-700/20 text-emerald-700"
              )}
            >
              {format(d, "d")}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function YearView({ date, appointments, onMonthClick }: YearViewProps) {
  const yearStart = startOfYear(date);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));

  return (
    <div className="h-full overflow-auto">
      <div className="grid grid-cols-4 gap-4 p-4">
        {months.map((month) => (
          <MiniMonth
            key={month.toISOString()}
            month={month}
            appointments={appointments}
            onClick={() => onMonthClick(month)}
          />
        ))}
      </div>
    </div>
  );
}
