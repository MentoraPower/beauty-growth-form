import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

interface RibbonTransitionProps {
  isActive: boolean;
  onComplete: () => void;
}

const RibbonTransition = ({ isActive, onComplete }: RibbonTransitionProps) => {
  // Define ribbons with different sizes and positions - thinner now
  const ribbons = [
    { id: 1, height: "6vh", top: "2%", delay: 0, duration: 0.4 },
    { id: 2, height: "8vh", top: "12%", delay: 0.05, duration: 0.45 },
    { id: 3, height: "5vh", top: "24%", delay: 0.1, duration: 0.4 },
    { id: 4, height: "7vh", top: "32%", delay: 0.03, duration: 0.42 },
    { id: 5, height: "6vh", top: "58%", delay: 0.08, duration: 0.45 },
    { id: 6, height: "8vh", top: "68%", delay: 0.02, duration: 0.4 },
    { id: 7, height: "5vh", top: "80%", delay: 0.06, duration: 0.43 },
    { id: 8, height: "7vh", top: "90%", delay: 0.04, duration: 0.4 },
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
              top: "44%",
              height: "12vh",
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
            <span className="text-white text-3xl md:text-5xl font-semibold tracking-[0.4em]">
              SCALE
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RibbonTransition;
