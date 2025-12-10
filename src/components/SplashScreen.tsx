import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [showSplash, setShowSplash] = useState(true);
  const letters = "SCALE".split("");

  useEffect(() => {
    // Total animation time: letters appear (5 * 150ms = 750ms) + hold (500ms) + fade (500ms)
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1750);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, 2250);

    return () => {
      clearTimeout(timer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {showSplash && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#F3F3F3]"
        >
          <div className="flex gap-4 md:gap-6">
            {letters.map((letter, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.15,
                  ease: "easeOut",
                }}
                className="text-5xl md:text-7xl font-bold text-foreground tracking-widest"
              >
                {letter}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
