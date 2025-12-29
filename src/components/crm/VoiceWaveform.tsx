import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type VoiceState = "idle" | "connecting" | "listening" | "processing" | "speaking";

interface VoiceWaveformProps {
  state: VoiceState;
  className?: string;
}

export function VoiceWaveform({ state, className }: VoiceWaveformProps) {
  const [bars, setBars] = useState<number[]>(Array(12).fill(0.2));
  
  useEffect(() => {
    if (state === "idle" || state === "connecting") {
      setBars(Array(12).fill(0.2));
      return;
    }
    
    // Animate bars based on state
    const interval = setInterval(() => {
      setBars(prev => prev.map(() => {
        if (state === "listening") {
          return 0.2 + Math.random() * 0.4;
        } else if (state === "speaking") {
          return 0.3 + Math.random() * 0.7;
        } else if (state === "processing") {
          return 0.1 + Math.random() * 0.2;
        }
        return 0.2;
      }));
    }, 100);
    
    return () => clearInterval(interval);
  }, [state]);

  const getStateColor = () => {
    switch (state) {
      case "connecting":
        return "bg-amber-500";
      case "listening":
        return "bg-green-500";
      case "processing":
        return "bg-blue-500";
      case "speaking":
        return "bg-primary";
      default:
        return "bg-muted-foreground/30";
    }
  };

  const getStateLabel = () => {
    switch (state) {
      case "connecting":
        return "Conectando...";
      case "listening":
        return "Ouvindo";
      case "processing":
        return "Processando";
      case "speaking":
        return "Falando";
      default:
        return "Pronto";
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "flex items-center gap-3 px-4 py-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/50",
        className
      )}
    >
      {/* State indicator */}
      <div className={cn(
        "w-2 h-2 rounded-full",
        getStateColor(),
        (state === "listening" || state === "speaking") && "animate-pulse"
      )} />
      
      {/* Waveform bars */}
      <div className="flex items-center gap-0.5 h-6">
        {bars.map((height, index) => (
          <motion.div
            key={index}
            className={cn(
              "w-1 rounded-full",
              getStateColor()
            )}
            animate={{ height: `${height * 100}%` }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            style={{ minHeight: 4 }}
          />
        ))}
      </div>
      
      {/* State label */}
      <span className="text-xs font-medium text-muted-foreground min-w-[70px]">
        {getStateLabel()}
      </span>
    </motion.div>
  );
}
