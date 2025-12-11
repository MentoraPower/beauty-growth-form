import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [showSplash, setShowSplash] = useState(true);
  

  useEffect(() => {
    // Prevent scrolling while splash is showing
    document.body.style.overflow = "hidden";
    
    // Total animation time: letters appear (5 * 150ms = 750ms) + hold (500ms) + fade (500ms)
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1750);

    const completeTimer = setTimeout(() => {
      document.body.style.overflow = "";
      onComplete();
    }, 2250);

    return () => {
      clearTimeout(timer);
      clearTimeout(completeTimer);
      document.body.style.overflow = "";
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
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.1,
              ease: "easeOut",
            }}
            className="text-sm md:text-base font-light tracking-wide text-muted-foreground"
          >
            Essa é uma página desenvolvida pela{" "}
            <span className="font-semibold bg-gradient-to-r from-[#F40000] to-[#A10000] bg-clip-text text-transparent">
              SCALE
            </span>
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
