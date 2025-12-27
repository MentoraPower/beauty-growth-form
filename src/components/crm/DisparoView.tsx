import { useState } from "react";
import { Send, Mail, Clock, CheckCircle, XCircle, Eye, MousePointer } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisparoViewProps {
  subOriginId: string | null;
}

export function DisparoView({ subOriginId }: DisparoViewProps) {
  return (
    <div className="flex-1 flex flex-col h-full p-6">

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
