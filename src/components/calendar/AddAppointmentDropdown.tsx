import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, FileText, Mail, Trash2, User, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Appointment } from "@/pages/CalendarPage";

interface AddAppointmentDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  selectedHour: number | null;
  onSuccess: () => void;
  onCancel?: () => void;
  anchorPosition?: { x: number; y: number };
  onPendingSlotUpdate?: (startTime: string, endTime: string) => void;
  editingAppointment?: Appointment | null;
}

export function AddAppointmentDropdown({
  open,
  onOpenChange,
  selectedDate,
  selectedHour,
  onSuccess,
  onCancel,
  anchorPosition,
  onPendingSlotUpdate,
  editingAppointment,
}: AddAppointmentDropdownProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [closerName, setCloserName] = useState("");
  const [sdrName, setSdrName] = useState("");

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  const isEditing = !!editingAppointment;

  // Time inputs: keep native typing (always shows HH:MM), but still auto-fix on blur.
  const syncPendingSlot = useCallback(
    (nextStart: string, nextEnd: string) => {
      onPendingSlotUpdate?.(nextStart, nextEnd);
    },
    [onPendingSlotUpdate]
  );

  const handleTimeChange = useCallback(
    (
      value: string,
      setter: React.Dispatch<React.SetStateAction<string>>,
      isStart: boolean
    ) => {
      setter(value);
      if (!value || value.length !== 5) return;

      syncPendingSlot(isStart ? value : startTime, isStart ? endTime : value);
    },
    [syncPendingSlot, startTime, endTime]
  );

  const handleTimeBlur = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    isStart: boolean
  ) => {
    const digits = value.replace(/\D/g, "");

    if (digits.length === 0) {
      const defaultTime = isStart ? "09:00" : "10:00";
      setter(defaultTime);
      syncPendingSlot(isStart ? defaultTime : startTime, isStart ? endTime : defaultTime);
      return;
    }

    let hours = 0;
    let minutes = 0;

    if (digits.length <= 2) {
      hours = parseInt(digits, 10) || 0;
    } else if (digits.length === 3) {
      hours = parseInt(digits.slice(0, 1), 10) || 0;
      minutes = parseInt(digits.slice(1, 3), 10) || 0;
    } else {
      hours = parseInt(digits.slice(0, 2), 10) || 0;
      minutes = parseInt(digits.slice(2, 4), 10) || 0;
    }

    hours = Math.min(Math.max(hours, 0), 23);
    minutes = Math.min(Math.max(minutes, 0), 59);

    const formatted = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;

    setter(formatted);
    syncPendingSlot(isStart ? formatted : startTime, isStart ? endTime : formatted);
  };

  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPosition, setPanelPosition] = useState<{ left: number; top: number }>(
    { left: 12, top: 120 }
  );

  const resetForm = useCallback(() => {
    setTitle("");
    setEmail("");
    setDescription("");
    setCloserName("");
    setSdrName("");
    setStartTime("09:00");
    setEndTime("10:00");
  }, []);

  // Load editing appointment data
  useEffect(() => {
    if (editingAppointment && open) {
      setTitle(editingAppointment.title || "");
      setEmail(editingAppointment.email || "");
      setDescription(editingAppointment.description || "");
      setCloserName(editingAppointment.closer_name || "");
      setSdrName(editingAppointment.sdr_name || "");
      
      const start = new Date(editingAppointment.start_time);
      const end = new Date(editingAppointment.end_time);
      const startStr = format(start, "HH:mm");
      const endStr = format(end, "HH:mm");
      setStartTime(startStr);
      setEndTime(endStr);
    }
  }, [editingAppointment, open]);

  useEffect(() => {
    // Only sync initial time + pending slot when the dropdown is actually open.
    // Otherwise, it can re-create the pending card right after you close/cancel.
    if (!open) return;
    if (selectedHour === null || editingAppointment) return;

    const h = selectedHour.toString().padStart(2, "0");
    const newStartTime = `${h}:00`;
    const endH = Math.min(selectedHour + 1, 23).toString().padStart(2, "0");
    const newEndTime = `${endH}:00`;

    setStartTime(newStartTime);
    setEndTime(newEndTime);
    onPendingSlotUpdate?.(newStartTime, newEndTime);
  }, [open, selectedHour, onPendingSlotUpdate, editingAppointment]);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const computePosition = useCallback(() => {
    const x = anchorPosition?.x ?? window.innerWidth / 2;
    const y = anchorPosition?.y ?? window.innerHeight / 2;

    const rect = panelRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 380;
    const height = rect?.height ?? 480;
    const margin = 12;

    // Prefer right side of click, fallback to left
    let left = x + 12;
    if (left + width + margin > window.innerWidth) {
      left = x - width - 12;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

    // Center vertically relative to click
    let top = y - height / 2;
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));

    setPanelPosition({ left, top });
  }, [anchorPosition?.x, anchorPosition?.y]);

  useLayoutEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => computePosition());
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;

    const onResize = () => computePosition();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (panelRef.current && !panelRef.current.contains(target)) {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onOpenChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !title.trim()) return;

    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);

    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
      toast.error("Horário inválido");
      return;
    }

    setLoading(true);

    const start = new Date(selectedDate);
    start.setHours(startH, startM, 0, 0);

    const end = new Date(selectedDate);
    end.setHours(endH, endM, 0, 0);

    const appointmentData = {
      title: title.trim(),
      email: email.trim() || null,
      description: description.trim() || null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      closer_name: closerName.trim() || null,
      sdr_name: sdrName.trim() || null,
    };

    let error;
    if (isEditing) {
      const result = await supabase
        .from("calendar_appointments")
        .update(appointmentData)
        .eq("id", editingAppointment.id);
      error = result.error;
    } else {
      const result = await supabase.from("calendar_appointments").insert(appointmentData);
      error = result.error;
    }

    setLoading(false);

    if (error) {
      toast.error(isEditing ? "Erro ao atualizar agendamento" : "Erro ao criar agendamento");
      return;
    }

    toast.success(isEditing ? "Agendamento atualizado!" : "Agendamento criado!");
    onSuccess();
    onOpenChange(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (!editingAppointment) return;
    
    setDeleting(true);
    const { error } = await supabase
      .from("calendar_appointments")
      .delete()
      .eq("id", editingAppointment.id);
    
    setDeleting(false);
    
    if (error) {
      toast.error("Erro ao excluir agendamento");
      return;
    }
    
    toast.success("Agendamento excluído!");
    onSuccess();
    onOpenChange(false);
    resetForm();
  };

  if (!open) return null;

  const formattedDate = selectedDate 
    ? format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })
    : "";

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      <div
        ref={panelRef}
        role="dialog"
        aria-label={isEditing ? "Editar agendamento" : "Novo agendamento"}
        className="pointer-events-auto fixed w-[400px] max-w-[calc(100vw-24px)] bg-popover text-popover-foreground rounded-lg border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
        style={{ left: panelPosition.left, top: panelPosition.top }}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-end p-2 border-b border-border/50">
          {isEditing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 rounded-full hover:bg-muted/80 text-muted-foreground transition-colors mr-1"
              title="Excluir"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onCancel?.();
              onOpenChange(false);
            }}
            className="p-2 rounded-full hover:bg-muted/80 text-muted-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Title with colored indicator */}
          <div className="flex items-start gap-3">
            <div className="w-4 h-4 rounded bg-primary mt-2 shrink-0" />
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="flex-1 bg-transparent border-0 border-b-2 border-muted focus:border-primary px-0 py-2 text-lg font-medium text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors"
              placeholder="Adicionar título"
            />
          </div>

          {/* Date and Time */}
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground capitalize">{formattedDate}</p>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="time"
                  step={60}
                  value={startTime}
                  onChange={(e) => handleTimeChange(e.target.value, setStartTime, true)}
                  onBlur={() => handleTimeBlur(startTime, setStartTime, true)}
                  className="h-8 w-24 text-sm text-center bg-muted/50 border-0"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="time"
                  step={60}
                  value={endTime}
                  onChange={(e) => handleTimeChange(e.target.value, setEndTime, false)}
                  onBlur={() => handleTimeBlur(endTime, setEndTime, false)}
                  className="h-8 w-24 text-sm text-center bg-muted/50 border-0"
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Adicionar email"
              className="flex-1 h-9 text-sm bg-transparent border-0 border-b border-muted focus:border-primary px-0"
            />
          </div>

          {/* Description */}
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-2" />
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicionar descrição"
              rows={2}
              className="flex-1 resize-none text-sm bg-transparent border-0 border-b border-muted focus:border-primary px-0"
            />
          </div>

          {/* Closer */}
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-muted-foreground shrink-0" />
            <Input
              id="closer"
              value={closerName}
              onChange={(e) => setCloserName(e.target.value)}
              placeholder="Closer"
              className="flex-1 h-9 text-sm bg-transparent border-0 border-b border-muted focus:border-primary px-0"
            />
          </div>

          {/* SDR */}
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground shrink-0" />
            <Input
              id="sdr"
              value={sdrName}
              onChange={(e) => setSdrName(e.target.value)}
              placeholder="SDR"
              className="flex-1 h-9 text-sm bg-transparent border-0 border-b border-muted focus:border-primary px-0"
            />
          </div>

          {/* Submit button */}
          <div className="flex justify-end pt-2">
            <Button 
              type="submit" 
              disabled={loading || !title.trim()}
              className="px-6"
            >
              {loading ? "Salvando..." : isEditing ? "Salvar" : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}