import { useState, useRef, useEffect } from "react";
import { Clock, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [hours, minutes] = value.split(":").map((v) => parseInt(v, 10) || 0);

  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);

  // Generate hours and minutes arrays
  const hoursArray = Array.from({ length: 24 }, (_, i) => i);
  const minutesArray = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10, ... 55

  const formatTime = (h: number, m: number) => {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  const handleHourSelect = (h: number) => {
    onChange(formatTime(h, minutes));
  };

  const handleMinuteSelect = (m: number) => {
    onChange(formatTime(hours, m));
  };

  const incrementHour = () => {
    const newHour = (hours + 1) % 24;
    onChange(formatTime(newHour, minutes));
  };

  const decrementHour = () => {
    const newHour = (hours - 1 + 24) % 24;
    onChange(formatTime(newHour, minutes));
  };

  const incrementMinute = () => {
    const newMinute = (minutes + 5) % 60;
    onChange(formatTime(hours, newMinute));
  };

  const decrementMinute = () => {
    const newMinute = (minutes - 5 + 60) % 60;
    onChange(formatTime(hours, newMinute));
  };

  // Scroll to selected values when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const hourElement = hoursRef.current?.querySelector(`[data-hour="${hours}"]`);
        const minuteElement = minutesRef.current?.querySelector(`[data-minute="${minutes}"]`);
        
        hourElement?.scrollIntoView({ block: "center", behavior: "instant" });
        minuteElement?.scrollIntoView({ block: "center", behavior: "instant" });
      }, 50);
    }
  }, [open, hours, minutes]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 h-8 px-3 rounded-md bg-muted/50 hover:bg-muted text-sm font-medium transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-primary/20",
            className
          )}
        >
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="tabular-nums">{value}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-popover border-border shadow-xl"
        align="center"
        sideOffset={4}
      >
        <div className="flex divide-x divide-border">
          {/* Hours column */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={incrementHour}
              className="p-2 hover:bg-muted/80 text-muted-foreground transition-colors"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <ScrollArea className="h-[140px] w-16" ref={hoursRef}>
              <div className="flex flex-col py-1">
                {hoursArray.map((h) => (
                  <button
                    key={h}
                    type="button"
                    data-hour={h}
                    onClick={() => handleHourSelect(h)}
                    className={cn(
                      "h-9 w-full flex items-center justify-center text-sm font-medium tabular-nums transition-colors",
                      hours === h
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted/80 text-foreground"
                    )}
                  >
                    {h.toString().padStart(2, "0")}
                  </button>
                ))}
              </div>
            </ScrollArea>
            <button
              type="button"
              onClick={decrementHour}
              className="p-2 hover:bg-muted/80 text-muted-foreground transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Separator */}
          <div className="flex items-center justify-center w-6 text-lg font-bold text-muted-foreground">
            :
          </div>

          {/* Minutes column */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={incrementMinute}
              className="p-2 hover:bg-muted/80 text-muted-foreground transition-colors"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <ScrollArea className="h-[140px] w-16" ref={minutesRef}>
              <div className="flex flex-col py-1">
                {minutesArray.map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-minute={m}
                    onClick={() => handleMinuteSelect(m)}
                    className={cn(
                      "h-9 w-full flex items-center justify-center text-sm font-medium tabular-nums transition-colors",
                      minutes === m
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted/80 text-foreground"
                    )}
                  >
                    {m.toString().padStart(2, "0")}
                  </button>
                ))}
              </div>
            </ScrollArea>
            <button
              type="button"
              onClick={decrementMinute}
              className="p-2 hover:bg-muted/80 text-muted-foreground transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick presets */}
        <div className="border-t border-border p-2">
          <div className="grid grid-cols-4 gap-1">
            {["09:00", "10:00", "14:00", "15:00"].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  onChange(preset);
                  setOpen(false);
                }}
                className={cn(
                  "h-7 px-2 rounded text-xs font-medium transition-colors",
                  value === preset
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground"
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
