import { useState } from "react";
import { Send, Mail, Clock, CheckCircle, XCircle, Eye, MousePointer } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisparoViewProps {
  subOriginId: string | null;
}

export function DisparoView({ subOriginId }: DisparoViewProps) {
  return (
    <div className="flex-1 flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <Send className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Disparos</h1>
            <p className="text-sm text-muted-foreground">Gerencie seus emails agendados e enviados</p>
          </div>
        </div>
      </div>

      {/* Content placeholder */}
      <div className="flex-1 flex items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-xl">
        <div className="text-center">
          <Mail className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-muted-foreground mb-2">
            Página de Disparos
          </h2>
          <p className="text-sm text-muted-foreground/60 max-w-md">
            Configure e visualize seus disparos de email aqui.
          </p>
        </div>
      </div>
    </div>
  );
}
