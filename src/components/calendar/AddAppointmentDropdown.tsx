import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, Clock, Mail, FileText, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [startHour, setStartHour] = useState("09");
  const [startMinute, setStartMinute] = useState("00");
  const [endHour, setEndHour] = useState("10");
  const [endMinute, setEndMinute] = useState("00");

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
    if (!open) {
      resetForm();
    }
  }, [open]);

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

  const resetForm = () => {
    setTitle("");
    setEmail("");
    setDescription("");
    setCloserName("");
    setSdrName("");
    setStartHour("09");
    setStartMinute("00");
    setEndHour("10");
    setEndMinute("00");
  };

  const hours = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, "0")
  );
  const minutes = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

  if (!open) return null;

  // Calculate position
  const dropdownStyle: React.CSSProperties = anchorPosition
    ? {
        position: "fixed",
        top: Math.min(anchorPosition.y, window.innerHeight - 600),
        left: Math.min(anchorPosition.x, window.innerWidth - 480),
        zIndex: 50,
      }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 50,
      };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={() => onOpenChange(false)}
      />

      {/* Dropdown */}
      <div
        style={dropdownStyle}
        className="w-[460px] bg-background rounded-xl border border-border shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Novo Agendamento
            </h3>
            {selectedDate && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Nome do Agendamento
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Reunião com cliente"
              className="h-11"
              required
            />
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Horário
            </Label>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <span className="text-xs text-muted-foreground font-medium uppercase">Início</span>
                <div className="flex items-center gap-1 ml-auto">
                  <Select value={startHour} onValueChange={setStartHour}>
                    <SelectTrigger className="w-16 h-8 text-sm font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {hours.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground font-bold">:</span>
                  <Select value={startMinute} onValueChange={setStartMinute}>
                    <SelectTrigger className="w-16 h-8 text-sm font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {minutes.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="text-muted-foreground">→</div>

              <div className="flex-1 flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <span className="text-xs text-muted-foreground font-medium uppercase">Fim</span>
                <div className="flex items-center gap-1 ml-auto">
                  <Select value={endHour} onValueChange={setEndHour}>
                    <SelectTrigger className="w-16 h-8 text-sm font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {hours.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground font-bold">:</span>
                  <Select value={endMinute} onValueChange={setEndMinute}>
                    <SelectTrigger className="w-16 h-8 text-sm font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {minutes.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="h-11"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Descrição
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes do agendamento..."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Responsible */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="closer" className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Closer
              </Label>
              <Input
                id="closer"
                value={closerName}
                onChange={(e) => setCloserName(e.target.value)}
                placeholder="Nome do Closer"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sdr" className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                SDR
              </Label>
              <Input
                id="sdr"
                value={sdrName}
                onChange={(e) => setSdrName(e.target.value)}
                placeholder="Nome do SDR"
                className="h-11"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 px-5"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim()}
              className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? "Salvando..." : "Salvar Agendamento"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
