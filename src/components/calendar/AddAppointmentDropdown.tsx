import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, Clock, Mail, FileText, User, Users, CalendarDays } from "lucide-react";
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100]"
        onClick={() => onOpenChange(false)}
      />

      {/* Dropdown */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-h-[90vh] bg-background rounded-2xl border border-border shadow-2xl overflow-hidden z-[101]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-gradient-to-r from-emerald-600/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Novo Agendamento
              </h3>
              {selectedDate && (
                <p className="text-sm text-muted-foreground capitalize">
                  {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium text-foreground">
              Nome do Agendamento *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Reunião com cliente"
              className="h-12 text-base"
              required
            />
          </div>

          {/* Time Selection - Modern Card Style */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              Horário
            </Label>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Start Time */}
              <div className="bg-muted/40 rounded-xl p-4 border border-border">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                  Início
                </span>
                <div className="flex items-center gap-2 mt-2">
                  <Select value={startHour} onValueChange={setStartHour}>
                    <SelectTrigger className="flex-1 h-11 text-lg font-semibold bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 z-[102]">
                      {hours.map((h) => (
                        <SelectItem key={h} value={h} className="text-base">
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xl font-bold text-muted-foreground">:</span>
                  <Select value={startMinute} onValueChange={setStartMinute}>
                    <SelectTrigger className="flex-1 h-11 text-lg font-semibold bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 z-[102]">
                      {minutes.map((m) => (
                        <SelectItem key={m} value={m} className="text-base">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* End Time */}
              <div className="bg-muted/40 rounded-xl p-4 border border-border">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                  Término
                </span>
                <div className="flex items-center gap-2 mt-2">
                  <Select value={endHour} onValueChange={setEndHour}>
                    <SelectTrigger className="flex-1 h-11 text-lg font-semibold bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 z-[102]">
                      {hours.map((h) => (
                        <SelectItem key={h} value={h} className="text-base">
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xl font-bold text-muted-foreground">:</span>
                  <Select value={endMinute} onValueChange={setEndMinute}>
                    <SelectTrigger className="flex-1 h-11 text-lg font-semibold bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 z-[102]">
                      {minutes.map((m) => (
                        <SelectItem key={m} value={m} className="text-base">
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
            <Label htmlFor="email" className="text-sm font-medium text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-emerald-600" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="h-12 text-base"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              Descrição
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes do agendamento..."
              rows={3}
              className="resize-none text-base"
            />
          </div>

          {/* Responsible - Grid Layout */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="closer" className="text-sm font-medium text-foreground flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600" />
                Closer Responsável
              </Label>
              <Input
                id="closer"
                value={closerName}
                onChange={(e) => setCloserName(e.target.value)}
                placeholder="Nome do Closer"
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sdr" className="text-sm font-medium text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                SDR Responsável
              </Label>
              <Input
                id="sdr"
                value={sdrName}
                onChange={(e) => setSdrName(e.target.value)}
                placeholder="Nome do SDR"
                className="h-12 text-base"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11 px-6"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim()}
              className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {loading ? "Salvando..." : "Criar Agendamento"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
