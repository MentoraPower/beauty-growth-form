import { motion, AnimatePresence } from "framer-motion";

interface RibbonTransitionProps {
  isActive: boolean;
  onComplete: () => void;
}

const RibbonTransition = ({ isActive, onComplete }: RibbonTransitionProps) => {
  // Define ribbons with different sizes and positions
  const ribbons = [
    { id: 1, height: "15vh", top: "0%", delay: 0, duration: 0.4 },
    { id: 2, height: "25vh", top: "12%", delay: 0.05, duration: 0.45 },
    { id: 3, height: "18vh", top: "30%", delay: 0.1, duration: 0.4 },
    { id: 4, height: "30vh", top: "42%", delay: 0.03, duration: 0.5 },
    { id: 5, height: "20vh", top: "65%", delay: 0.08, duration: 0.45 },
    { id: 6, height: "22vh", top: "80%", delay: 0.02, duration: 0.4 },
  ];

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="fixed inset-0 z-[100] pointer-events-none overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, delay: 0.5 }}
          onAnimationComplete={() => {
            // Trigger completion after all ribbons have passed
            setTimeout(onComplete, 100);
          }}
        >
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
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RibbonTransition;
