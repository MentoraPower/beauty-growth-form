import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CalendarDropdownProps {
  leadName: string;
  leadEmail: string;
  subOriginId: string | null;
}

export function CalendarDropdown({ leadName, leadEmail, subOriginId }: CalendarDropdownProps) {
  const navigate = useNavigate();
  const [hasCalendar, setHasCalendar] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if origin has calendar (agenda_mode)
  useEffect(() => {
    const checkAgendaMode = async () => {
      if (!subOriginId) {
        setHasCalendar(false);
        return;
      }

      // Get the origin_id from sub_origin
      const { data: subOrigin } = await supabase
        .from("crm_sub_origins")
        .select("origin_id")
        .eq("id", subOriginId)
        .maybeSingle();

      if (!subOrigin?.origin_id) {
        setHasCalendar(false);
        return;
      }

      // Check if origin has agenda_mode enabled
      const { data: settings } = await supabase
        .from("origin_settings")
        .select("agenda_mode")
        .eq("origin_id", subOrigin.origin_id)
        .maybeSingle();

      setHasCalendar(settings?.agenda_mode ?? false);
    };

    checkAgendaMode();
  }, [subOriginId]);

  const handleClick = async () => {
    if (!hasCalendar) {
      toast.error("Esta origem não possui calendário configurado");
      return;
    }

    if (!subOriginId) {
      toast.error("Lead não possui origem definida");
      return;
    }

    setIsLoading(true);

    // Navigate to calendar with origin and pre-fill data
    const params = new URLSearchParams();
    params.set("origin", subOriginId);
    params.set("prefill_name", leadName);
    params.set("prefill_email", leadEmail);
    
    navigate(`/admin/calendario?${params.toString()}`);
    setIsLoading(false);
  };

  // Don't render if we haven't loaded yet or origin doesn't have calendar
  if (hasCalendar === null) {
    return (
      <div className="h-6 w-6 rounded-full bg-muted/50 animate-pulse" />
    );
  }

  if (!hasCalendar) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleClick}
          disabled={isLoading}
          className="h-6 w-6 flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-50"
        >
          <Calendar className="h-4 w-4" style={{ stroke: "url(#calendar-gradient)" }} />
          <svg width="0" height="0" className="absolute">
            <defs>
              <linearGradient id="calendar-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F40000" />
                <stop offset="100%" stopColor="#A10000" />
              </linearGradient>
            </defs>
          </svg>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Agendar no calendário</p>
      </TooltipContent>
    </Tooltip>
  );
}
