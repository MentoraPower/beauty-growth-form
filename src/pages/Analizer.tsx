import { motion } from "framer-motion";

const Analizer = () => {
  return (
    <div className="min-h-[calc(100vh-6rem)] flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-8">
        {/* Animated Clock */}
        <div className="relative w-32 h-32">
          {/* Clock face */}
          <div className="absolute inset-0 rounded-full border-4 border-white/20 bg-white/5" />
          
          {/* Clock center dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 z-20" />
          
          {/* Hour hand */}
          <motion.div
            className="absolute top-1/2 left-1/2 origin-bottom"
            style={{
              width: 4,
              height: 28,
              marginLeft: -2,
              marginTop: -28,
              borderRadius: 2,
              background: "linear-gradient(to top, #f97316, #fbbf24)",
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 43200, // 12 hours
              repeat: Infinity,
              ease: "linear",
            }}
          />
          
          {/* Minute hand */}
          <motion.div
            className="absolute top-1/2 left-1/2 origin-bottom"
            style={{
              width: 3,
              height: 40,
              marginLeft: -1.5,
              marginTop: -40,
              borderRadius: 2,
              background: "linear-gradient(to top, #f97316, #fbbf24)",
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 10, // Fast for visual effect
              repeat: Infinity,
              ease: "linear",
            }}
          />
          
          {/* Second hand */}
          <motion.div
            className="absolute top-1/2 left-1/2 origin-bottom"
            style={{
              width: 2,
              height: 48,
              marginLeft: -1,
              marginTop: -48,
              borderRadius: 1,
              background: "#fff",
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 2, // Very fast for visual effect
              repeat: Infinity,
              ease: "linear",
            }}
          />
          
          {/* Hour markers */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 w-1 h-3 bg-white/30 rounded-full"
              style={{
                transform: `rotate(${i * 30}deg) translateY(-52px)`,
                marginLeft: -2,
                marginTop: -52,
              }}
            />
          ))}
        </div>
        
        {/* Coming Soon Text */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Analizer</h1>
          <p className="text-xl text-white/60">Em breve</p>
        </div>
        
        {/* Subtle pulsing ring */}
        <motion.div
          className="absolute w-40 h-40 rounded-full border border-orange-500/20"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.1, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    </div>
  );
};

export default Analizer;
