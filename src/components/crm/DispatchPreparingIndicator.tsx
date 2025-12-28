import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, Circle, Sparkles } from "lucide-react";

interface StepItemProps {
  status: 'pending' | 'in_progress' | 'completed';
  label: string;
  delay?: number;
}

function StepItem({ status, label, delay = 0 }: StepItemProps) {
  const [currentStatus, setCurrentStatus] = useState<'pending' | 'in_progress' | 'completed'>(
    delay > 0 ? 'pending' : status
  );

  useEffect(() => {
    if (delay > 0 && status !== 'pending') {
      const timer = setTimeout(() => {
        setCurrentStatus(status);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [delay, status]);

  return (
    <motion.div 
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay / 1000 }}
    >
      {currentStatus === 'completed' ? (
        <CheckCircle2 className="w-4 h-4 text-green-500" />
      ) : currentStatus === 'in_progress' ? (
        <Loader2 className="w-4 h-4 text-primary animate-spin" />
      ) : (
        <Circle className="w-4 h-4 text-muted-foreground/50" />
      )}
      <span className={currentStatus === 'completed' ? 'text-muted-foreground' : currentStatus === 'in_progress' ? 'text-foreground' : 'text-muted-foreground/60'}>
        {label}
      </span>
    </motion.div>
  );
}

interface DispatchPreparingIndicatorProps {
  type?: 'email' | 'whatsapp';
}

export function DispatchPreparingIndicator({ type = 'email' }: DispatchPreparingIndicatorProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Animate through steps
    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 1200),
      setTimeout(() => setStep(3), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const steps = type === 'email' 
    ? [
        { label: 'Validando leads e emails', status: step >= 0 ? (step > 0 ? 'completed' : 'in_progress') : 'pending' },
        { label: 'Verificando duplicatas', status: step >= 1 ? (step > 1 ? 'completed' : 'in_progress') : 'pending' },
        { label: 'Iniciando envio', status: step >= 2 ? (step > 2 ? 'completed' : 'in_progress') : 'pending' },
      ]
    : [
        { label: 'Validando contatos', status: step >= 0 ? (step > 0 ? 'completed' : 'in_progress') : 'pending' },
        { label: 'Preparando mensagens', status: step >= 1 ? (step > 1 ? 'completed' : 'in_progress') : 'pending' },
        { label: 'Iniciando disparo', status: step >= 2 ? (step > 2 ? 'completed' : 'in_progress') : 'pending' },
      ];

  return (
    <motion.div 
      className="bg-card border border-border/50 rounded-xl p-5 my-4 shadow-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <span className="font-medium text-foreground">Preparando disparo...</span>
          <p className="text-xs text-muted-foreground">Isso leva apenas alguns segundos</p>
        </div>
      </div>
      
      {/* Steps */}
      <div className="space-y-3 mb-5">
        {steps.map((s, i) => (
          <StepItem 
            key={i} 
            status={s.status as 'pending' | 'in_progress' | 'completed'} 
            label={s.label}
          />
        ))}
      </div>
      
      {/* Indeterminate progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary/50 via-primary to-primary/50 rounded-full"
          style={{ width: '40%' }}
          animate={{ 
            x: ['0%', '150%'],
          }}
          transition={{ 
            duration: 1.2, 
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      </div>
    </motion.div>
  );
}
