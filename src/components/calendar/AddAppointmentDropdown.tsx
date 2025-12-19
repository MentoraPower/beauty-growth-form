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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = [
  "00",
  "05",
  "10",
  "15",
  "20",
  "25",
  "30",
  "35",
  "40",
  "45",
  "50",
  "55",
];

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

  const [startHour, setStartHour] = useState("09");
  const [startMinute, setStartMinute] = useState("00");
  const [endHour, setEndHour] = useState("10");
  const [endMinute, setEndMinute] = useState("00");

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
    setStartHour("09");
    setStartMinute("00");
    setEndHour("10");
    setEndMinute("00");
  }, []);

  useEffect(() => {
    if (selectedHour !== null) {
      const h = selectedHour.toString().padStart(2, "0");
      setStartHour(h);
      setStartMinute("00");
      const endH = Math.min(selectedHour + 1, 23).toString().padStart(2, "0");
      setEndHour(endH);
      setEndMinute("00");
    }
  }, [selectedHour]);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const computePosition = useCallback(() => {
    const x = anchorPosition?.x ?? window.innerWidth / 2;
    const y = anchorPosition?.y ?? 120;

    const rect = panelRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 380;
    const height = rect?.height ?? 480;
    const margin = 12;

    let left = x - width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

    // prefer below click; fallback to above
    let top = y + 12;
    if (top + height + margin > window.innerHeight) {
      top = y - height - 12;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));

    setPanelPosition({ left, top });
  }, [anchorPosition?.x, anchorPosition?.y]);

  useLayoutEffect(() => {
    if (!open) return;
    // Wait next frame so we can measure the panel
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

      // Keep open when interacting with Radix poppers/portals (Select, etc.).
      const inRadixPortal = !!target.closest?.(
        "[data-radix-popper-content-wrapper], [data-radix-portal]"
      );
      if (inRadixPortal) return;

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

    setLoading(true);

    const startTime = new Date(selectedDate);
    startTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);

    const endTime = new Date(selectedDate);
    endTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

    const { error } = await supabase.from("calendar_appointments").insert({
      title: title.trim(),
      email: email.trim() || null,
      description: description.trim() || null,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
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
        className="pointer-events-auto fixed w-[380px] max-w-[calc(100vw-24px)] max-h-[85vh] bg-popover text-popover-foreground rounded-xl border border-border shadow-2xl overflow-hidden animate-in fade-in"
        style={{ left: panelPosition.left, top: panelPosition.top }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Novo Agendamento</h3>
              {selectedDate && (
                <p className="text-xs text-muted-foreground capitalize">
                  {format(selectedDate, "EEE, d 'de' MMM", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <form
          onSubmit={handleSubmit}
          className="p-4 space-y-4 overflow-y-auto max-h-[calc(85vh-60px)]"
        >
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs font-medium text-foreground">
              Nome *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Reunião com cliente"
              className="h-9 text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Horário
            </Label>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/40 rounded-lg p-2.5 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                  Início
                </span>
                <div className="flex items-center gap-1 mt-1">
                  <Select value={startHour} onValueChange={setStartHour}>
                    <SelectTrigger className="flex-1 h-8 text-sm font-semibold bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-48 z-[110] bg-popover">
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={h} className="text-sm">
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm font-bold text-muted-foreground">:</span>
                  <Select value={startMinute} onValueChange={setStartMinute}>
                    <SelectTrigger className="flex-1 h-8 text-sm font-semibold bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-48 z-[110] bg-popover">
                      {MINUTES.map((m) => (
                        <SelectItem key={m} value={m} className="text-sm">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-muted/40 rounded-lg p-2.5 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                  Término
                </span>
                <div className="flex items-center gap-1 mt-1">
                  <Select value={endHour} onValueChange={setEndHour}>
                    <SelectTrigger className="flex-1 h-8 text-sm font-semibold bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-48 z-[110] bg-popover">
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={h} className="text-sm">
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm font-bold text-muted-foreground">:</span>
                  <Select value={endMinute} onValueChange={setEndMinute}>
                    <SelectTrigger className="flex-1 h-8 text-sm font-semibold bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-48 z-[110] bg-popover">
                      {MINUTES.map((m) => (
                        <SelectItem key={m} value={m} className="text-sm">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
