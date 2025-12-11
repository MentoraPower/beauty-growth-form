import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import splashLogo from "@/assets/splash-logo.png";

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
    const letterDelay = 55; // ms per letter
    const animationTime = totalLetters * letterDelay + 1000; // letters + hold
    
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
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F3F3F3] px-6"
        >
          <motion.img
            src={splashLogo}
            alt="Scale Beauty"
            className="w-16 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
          <p className="text-base md:text-lg font-light tracking-wide text-muted-foreground">
            {allChars.map((char, index) => {
              const isScale = index >= normalLength;
              return (
                <motion.span
                  key={index}
                  initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{
                    duration: 0.35,
                    delay: index * 0.055,
                    ease: [0.25, 0.4, 0.25, 1],
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
