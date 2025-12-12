import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

interface RibbonTransitionProps {
  isActive: boolean;
  onComplete: () => void;
}

const RibbonTransition = ({ isActive, onComplete }: RibbonTransitionProps) => {
  // Define ribbons stacked together without gaps
  const ribbons = [
    { id: 1, height: "10vh", top: "0vh", delay: 0, duration: 0.4 },
    { id: 2, height: "12vh", top: "10vh", delay: 0.05, duration: 0.45 },
    { id: 3, height: "8vh", top: "22vh", delay: 0.1, duration: 0.4 },
    { id: 4, height: "10vh", top: "30vh", delay: 0.03, duration: 0.42 },
    // Middle ribbon with SCALE is at 40vh with 14vh height
    { id: 5, height: "10vh", top: "54vh", delay: 0.08, duration: 0.45 },
    { id: 6, height: "12vh", top: "64vh", delay: 0.02, duration: 0.4 },
    { id: 7, height: "14vh", top: "76vh", delay: 0.06, duration: 0.43 },
    { id: 8, height: "14vh", top: "90vh", delay: 0.04, duration: 0.4 },
  ];

  useEffect(() => {
    if (isActive) {
      // Trigger completion after animation finishes (wait for slowest ribbon - the middle one)
      const timer = setTimeout(() => {
        onComplete();
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [isActive, onComplete]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="fixed inset-0 z-[100] pointer-events-none overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Regular ribbons */}
          {ribbons.map((ribbon) => (
            <motion.div
              key={ribbon.id}
              className="absolute left-0 bg-gradient-to-r from-[#F40000] to-[#A10000]"
              style={{
                top: ribbon.top,
                height: ribbon.height,
                width: "100%",
              }}
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{
                duration: ribbon.duration,
                delay: ribbon.delay,
                ease: [0.25, 0.1, 0.25, 1],
              }}
            />
          ))}
          
          {/* Middle ribbon with SCALE text - slower */}
          <motion.div
            className="absolute left-0 bg-gradient-to-r from-[#F40000] to-[#A10000] flex items-center justify-center"
            style={{
              top: "40vh",
              height: "14vh",
              width: "100%",
            }}
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{
              duration: 0.7,
              delay: 0.05,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          >
            <span className="text-white text-xl md:text-2xl font-semibold tracking-[0.4em]">
              SCALE
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RibbonTransition;
