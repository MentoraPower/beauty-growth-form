import { useState, useEffect, useRef } from "react";
import { format, addDays, startOfWeek, addMonths, subMonths, addWeeks, subWeeks, addYears, subYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DayView } from "@/components/calendar/DayView";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { YearView } from "@/components/calendar/YearView";
import { AddAppointmentDropdown } from "@/components/calendar/AddAppointmentDropdown";
import { cn } from "@/lib/utils";

export type ViewType = "day" | "week" | "month" | "year";

export interface Appointment {
  id: string;
  title: string;
  email?: string;
  description?: string;
  start_time: string;
  end_time: string;
  closer_name?: string;
  sdr_name?: string;
}

export interface PendingSlot {
  date: Date;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>("month");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [anchorPosition, setAnchorPosition] = useState<{ x: number; y: number } | undefined>();
  const [pendingSlot, setPendingSlot] = useState<PendingSlot | null>(null);
  const justClosedRef = useRef(false);

  // Fetch appointments
  const fetchAppointments = async () => {
    const { data, error } = await supabase
      .from("calendar_appointments")
      .select("*")
      .order("start_time", { ascending: true });

    if (!error && data) {
      setAppointments(data);
    }
  };

  useEffect(() => {
    fetchAppointments();

    // Real-time subscription
    const channel = supabase
      .channel("calendar-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_appointments" },
        () => fetchAppointments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handlePrev = () => {
    switch (view) {
      case "day":
        setCurrentDate((d) => addDays(d, -1));
        break;
      case "week":
        setCurrentDate((d) => subWeeks(d, 1));
        break;
      case "month":
        setCurrentDate((d) => subMonths(d, 1));
        break;
      case "year":
        setCurrentDate((d) => subYears(d, 1));
        break;
    }
  };

  const handleNext = () => {
    switch (view) {
      case "day":
        setCurrentDate((d) => addDays(d, 1));
        break;
      case "week":
        setCurrentDate((d) => addWeeks(d, 1));
        break;
      case "month":
        setCurrentDate((d) => addMonths(d, 1));
        break;
      case "year":
        setCurrentDate((d) => addYears(d, 1));
        break;
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date: Date, hour?: number, event?: React.MouseEvent) => {
    // Prevent reopening immediately after closing
    if (justClosedRef.current) {
      justClosedRef.current = false;
      return;
    }
    
    const h = hour ?? 9;
    setSelectedDate(date);
    setSelectedHour(h);
    const startTimeStr = `${h.toString().padStart(2, "0")}:00`;
    const endTimeStr = `${Math.min(h + 1, 23).toString().padStart(2, "0")}:00`;
    setPendingSlot({ date, startTime: startTimeStr, endTime: endTimeStr });
    
    if (event) {
      setAnchorPosition({ x: event.clientX, y: event.clientY });
    } else {
      setAnchorPosition(undefined);
    }
    
    setDialogOpen(true);
  };

  const handlePendingSlotUpdate = (startTime: string, endTime: string) => {
    if (pendingSlot) {
      setPendingSlot({ ...pendingSlot, startTime, endTime });
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setPendingSlot(null);
      justClosedRef.current = true;
      // Reset after a short delay to allow new clicks
      setTimeout(() => {
        justClosedRef.current = false;
      }, 100);
    }
  };

  const handleSuccess = () => {
    setPendingSlot(null);
    fetchAppointments();
  };

  const getHeaderTitle = () => {
    switch (view) {
      case "day":
        return format(currentDate, "d 'de' MMMM", { locale: ptBR });
      case "week":
        return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
      case "month":
        return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
      case "year":
        return format(currentDate, "yyyy");
    }
  };

  const handleAppointmentDrop = async (appointmentId: string, newStartTime: Date, newEndTime: Date) => {
    const { error } = await supabase
      .from("calendar_appointments")
      .update({
        start_time: newStartTime.toISOString(),
        end_time: newEndTime.toISOString(),
      })
      .eq("id", appointmentId);

    if (!error) {
      fetchAppointments();
    }
  };

  const viewButtons: { id: ViewType; label: string }[] = [
    { id: "year", label: "Ano" },
    { id: "month", label: "Mês" },
    { id: "week", label: "Semana" },
    { id: "day", label: "Dia" },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-foreground capitalize">
            {getHeaderTitle()}
          </h1>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="ml-2 h-8"
            >
              Hoje
            </Button>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-muted rounded-lg p-1">
          {viewButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => setView(btn.id)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                view === btn.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Views */}
      <div className="flex-1 overflow-hidden">
        {view === "day" && (
          <DayView
            date={currentDate}
            appointments={appointments}
            onDayClick={handleDayClick}
            onAppointmentDrop={handleAppointmentDrop}
            pendingSlot={pendingSlot}
          />
        )}
        {view === "week" && (
          <WeekView
            date={currentDate}
            appointments={appointments}
            onDayClick={handleDayClick}
            onAppointmentDrop={handleAppointmentDrop}
            pendingSlot={pendingSlot}
          />
        )}
        {view === "month" && (
          <MonthView
            date={currentDate}
            appointments={appointments}
            onDayClick={handleDayClick}
            onAppointmentDrop={handleAppointmentDrop}
          />
        )}
        {view === "year" && (
          <YearView
            date={currentDate}
            appointments={appointments}
            onMonthClick={(date) => {
              setCurrentDate(date);
              setView("month");
            }}
          />
        )}
      </div>

      {/* Add Appointment Dropdown */}
      <AddAppointmentDropdown
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        selectedDate={selectedDate}
        selectedHour={selectedHour}
        onSuccess={handleSuccess}
        anchorPosition={anchorPosition}
        onPendingSlotUpdate={handlePendingSlotUpdate}
      />
    </div>
  );
}
