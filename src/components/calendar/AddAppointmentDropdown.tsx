import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock, FileText, Mail, User, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

interface AddAppointmentDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  selectedHour: number | null;
  onSuccess: () => void;
  anchorPosition?: { x: number; y: number };
}

export function AddAppointmentDropdown({
  open,
  onOpenChange,
  selectedDate,
  selectedHour,
  onSuccess,
  anchorPosition,
}: AddAppointmentDropdownProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [closerName, setCloserName] = useState("");
  const [sdrName, setSdrName] = useState("");

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  // Format time input as user types (auto-add colon, limit to valid time)
  const formatTimeInput = (value: string): string => {
    // Remove non-digits
    const digits = value.replace(/\D/g, "");
    
    if (digits.length === 0) return "";
    if (digits.length <= 2) {
      const h = Math.min(parseInt(digits) || 0, 23);
      return digits.length === 2 ? h.toString().padStart(2, "0") : digits;
    }
    
    // Format as HH:MM
    let hours = parseInt(digits.slice(0, 2)) || 0;
    let minutes = parseInt(digits.slice(2, 4)) || 0;
    
    hours = Math.min(hours, 23);
    minutes = Math.min(minutes, 59);
    
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

  const handleTimeChange = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const formatted = formatTimeInput(value);
    setter(formatted);
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

  useEffect(() => {
    if (selectedHour !== null) {
      const h = selectedHour.toString().padStart(2, "0");
      setStartTime(`${h}:00`);
      const endH = Math.min(selectedHour + 1, 23).toString().padStart(2, "0");
      setEndTime(`${endH}:00`);
    }
  }, [selectedHour]);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const computePosition = useCallback(() => {
    const x = anchorPosition?.x ?? window.innerWidth / 2;
    const y = anchorPosition?.y ?? window.innerHeight / 2;

    const rect = panelRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 340;
    const height = rect?.height ?? 420;
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

    const { error } = await supabase.from("calendar_appointments").insert({
      title: title.trim(),
      email: email.trim() || null,
      description: description.trim() || null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      closer_name: closerName.trim() || null,
      sdr_name: sdrName.trim() || null,
    });

    setLoading(false);

    if (error) {
      toast.error("Erro ao criar agendamento");
      return;
    }

    onSuccess();
    onOpenChange(false);
    resetForm();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Novo agendamento"
        className="pointer-events-auto fixed w-[480px] max-w-[calc(100vw-24px)] max-h-[85vh] bg-popover text-popover-foreground rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in"
        style={{ left: panelPosition.left, top: panelPosition.top }}
      >

        <form
          onSubmit={handleSubmit}
          className="p-4 space-y-4 overflow-y-auto max-h-[85vh]"
        >
          {/* Floating Label Input for Name */}
          <div className="relative pt-4">
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="peer w-full border-0 border-b-2 border-muted bg-transparent px-0 py-2 text-sm text-foreground placeholder-transparent focus:border-primary focus:outline-none transition-colors"
              placeholder="Adicione nome"
            />
            <label
              htmlFor="title"
              className="absolute left-0 top-4 text-sm text-muted-foreground transition-all duration-200 peer-placeholder-shown:top-6 peer-placeholder-shown:text-base peer-focus:top-0 peer-focus:text-xs peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-xs"
            >
              Adicione nome
            </label>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Horário
            </Label>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                  Início
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={startTime}
                  onChange={(e) => handleTimeChange(e.target.value, setStartTime)}
                  placeholder="00:00"
                  maxLength={5}
                  className="h-9 text-sm font-medium text-center"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                  Término
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={endTime}
                  onChange={(e) => handleTimeChange(e.target.value, setEndTime)}
                  placeholder="00:00"
                  maxLength={5}
                  className="h-9 text-sm font-medium text-center"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs font-medium text-foreground flex items-center gap-1.5"
            >
              <Mail className="h-3.5 w-3.5 text-primary" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="description"
              className="text-xs font-medium text-foreground flex items-center gap-1.5"
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              Descrição
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes..."
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="closer"
                className="text-xs font-medium text-foreground flex items-center gap-1.5"
              >
                <User className="h-3.5 w-3.5 text-primary" />
                Closer
              </Label>
              <Input
                id="closer"
                value={closerName}
                onChange={(e) => setCloserName(e.target.value)}
                placeholder="Nome"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="sdr"
                className="text-xs font-medium text-foreground flex items-center gap-1.5"
              >
                <Users className="h-3.5 w-3.5 text-primary" />
                SDR
              </Label>
              <Input
                id="sdr"
                value={sdrName}
                onChange={(e) => setSdrName(e.target.value)}
                placeholder="Nome"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={loading || !title.trim()}>
              {loading ? "Salvando..." : "Criar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
