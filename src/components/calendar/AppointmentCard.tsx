import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { format, addMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentValue, setPaymentValue] = useState(
    appointment.payment_value?.toString() || ""
  );
  const [saving, setSaving] = useState(false);

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

  const handlePaymentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleSavePayment = async () => {
    setSaving(true);
    const value = parseFloat(paymentValue.replace(",", ".")) || 0;
    
    await supabase
      .from("calendar_appointments")
      .update({ 
        is_paid: value > 0, 
        payment_value: value 
      })
      .eq("id", appointment.id);
    
    setSaving(false);
    setPaymentOpen(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const isPaid = appointment.is_paid && appointment.payment_value && appointment.payment_value > 0;

  const PaymentBadge = () => {
    if (!isPaid) return null;
    
    return (
      <Popover open={paymentOpen} onOpenChange={setPaymentOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={handlePaymentClick}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors bg-emerald-400/30 text-emerald-100"
          >
            <DollarSign className="h-3 w-3" />
            <span>Pago</span>
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-48 p-3 bg-card border border-border" 
          onClick={handlePaymentClick}
          align="start"
        >
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Valor da venda</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <Input
                type="text"
                placeholder="0,00"
                value={paymentValue}
                onChange={(e) => setPaymentValue(e.target.value)}
                className="h-8"
              />
            </div>
            <Button 
              size="sm" 
              className="w-full" 
              onClick={handleSavePayment}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
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
          "text-xs px-1.5 py-0.5 rounded text-white truncate flex items-center justify-between gap-1",
          appointment.is_noshow ? "bg-rose-700 hover:bg-rose-600" : "bg-emerald-700 hover:bg-emerald-600",
          isDragging && "shadow-xl opacity-90 z-50"
        )}
      >
        <span className="truncate">{appointment.title}</span>
        {isPaid && <PaymentBadge />}
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
        "absolute left-1 right-1 px-2 py-1 rounded-md text-white text-xs overflow-hidden",
        appointment.is_noshow ? "bg-rose-700 hover:bg-rose-600" : "bg-emerald-700 hover:bg-emerald-600",
        isDragging && "shadow-xl opacity-90 z-50"
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="font-medium truncate">{appointment.title}</div>
        {isPaid && <PaymentBadge />}
      </div>
      <div className="opacity-80">{timeStr}</div>
    </div>
  );
}