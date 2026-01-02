import React from "react";
import { motion } from "framer-motion";

/**
 * Modern thinking indicator with two concentric orbiting circles
 * Outer circle rotates clockwise, inner circle rotates counter-clockwise
 */
export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3">
      {/* Orbiting circles container */}
      <div className="relative w-6 h-6">
        {/* Outer orbit - clockwise */}
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary/80" />
        </motion.div>

        {/* Middle orbit - counter-clockwise */}
        <motion.div
          className="absolute inset-1"
          animate={{ rotate: -360 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary/60" />
        </motion.div>

        {/* Center dot - pulsing */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <div className="w-1 h-1 rounded-full bg-primary/40" />
        </motion.div>
      </div>

      {/* Text with subtle animation */}
      <motion.span
        className="text-muted-foreground text-sm"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        Pensando
      </motion.span>
    </div>
  );
}
