import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [showSplash, setShowSplash] = useState(true);
  
  const normalText = "Essa é uma página desenvolvida pela ";
  const scaleText = "SCALE";
  const allChars = (normalText + scaleText).split("");
  const normalLength = normalText.length;

  useEffect(() => {
    // Prevent scrolling while splash is showing
    document.body.style.overflow = "hidden";
    
    // Total animation time: all letters appear + hold + fade
    const totalLetters = allChars.length;
    const letterDelay = 40; // ms per letter
    const animationTime = totalLetters * letterDelay + 800; // letters + hold
    
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, animationTime);

    const completeTimer = setTimeout(() => {
      document.body.style.overflow = "";
      onComplete();
    }, animationTime + 500);

    return () => {
      clearTimeout(timer);
      clearTimeout(completeTimer);
      document.body.style.overflow = "";
    };
  }, [onComplete, allChars.length]);

  return (
    <AnimatePresence>
      {showSplash && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#F3F3F3] px-6"
        >
          <p className="text-sm md:text-base font-light tracking-wide text-muted-foreground">
            {allChars.map((char, index) => {
              const isScale = index >= normalLength;
              return (
                <motion.span
                  key={index}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.15,
                    delay: index * 0.04,
                    ease: "easeOut",
                  }}
                  className={`inline-block ${isScale ? "font-semibold bg-gradient-to-r from-[#F40000] to-[#A10000] bg-clip-text text-transparent" : ""}`}
                  style={{ whiteSpace: "pre" }}
                >
                  {char}
                </motion.span>
              );
            })}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
