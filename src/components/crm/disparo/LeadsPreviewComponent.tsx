import React from 'react';
import { motion } from 'framer-motion';

interface LeadsPreview {
  subOriginId: string;
  originName: string;
  subOriginName: string;
  dispatchType: string;
  totalLeads: number;
  validLeads: number;
  invalidLeads: number;
  intervalSeconds: number;
  estimatedMinutes: number;
  leads: { name: string; contact: string }[];
}

interface LeadsPreviewComponentProps {
  preview: LeadsPreview;
}

export function LeadsPreviewComponent({ preview }: LeadsPreviewComponentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-4 my-4"
    >
      <h3 className="font-medium text-foreground mb-3">
        📊 Leads para Disparo
      </h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{preview.totalLeads}</div>
          <div className="text-xs text-muted-foreground">Total de leads</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-500">{preview.validLeads}</div>
          <div className="text-xs text-muted-foreground">
            {preview.dispatchType === 'email' ? 'Com email válido' : 'Com WhatsApp válido'}
          </div>
        </div>
      </div>

      {preview.invalidLeads > 0 && (
        <div className="text-sm text-yellow-600 mb-3">
          ⚠️ {preview.invalidLeads} leads sem {preview.dispatchType === 'email' ? 'email válido' : 'WhatsApp válido'}
        </div>
      )}

      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Lista:</span>
          <span className="text-foreground font-medium">{preview.originName} → {preview.subOriginName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tipo:</span>
          <span className="text-foreground">{preview.dispatchType === 'email' ? '📧 Email' : '📱 WhatsApp'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Intervalo:</span>
          <span className="text-foreground">{preview.intervalSeconds}s entre envios</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tempo estimado:</span>
          <span className="text-foreground">~{preview.estimatedMinutes} min</span>
        </div>
      </div>

      {/* Sample of first leads */}
      {preview.leads && preview.leads.length > 0 && (
        <div className="border-t border-border pt-3">
          <div className="text-xs text-muted-foreground mb-2">
            Primeiros leads ({Math.min(5, preview.leads.length)} de {preview.validLeads}):
          </div>
          <div className="space-y-1.5">
            {preview.leads.slice(0, 5).map((lead, i) => (
              <div key={i} className="flex items-center justify-between text-sm bg-muted/30 px-2 py-1.5 rounded">
                <span className="font-medium text-foreground truncate max-w-[140px]">{lead.name}</span>
                <span className="text-muted-foreground text-xs truncate max-w-[160px]">{lead.contact}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
