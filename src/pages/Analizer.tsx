import { motion } from "framer-motion";

const Analizer = () => {
  return (
    <div className="min-h-[calc(100vh-6rem)] flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        {/* Animated Clock */}
        <div className="relative w-40 h-40">
          {/* Clock face - modern minimal */}
          <div 
            className="absolute inset-0 rounded-full"
            style={{ 
              border: '3px solid rgba(0, 0, 0, 0.08)',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(0,0,0,0.02))',
            }}
          />
          
          {/* Inner subtle ring */}
          <div 
            className="absolute inset-3 rounded-full"
            style={{ border: '1px solid rgba(0, 0, 0, 0.05)' }}
          />
          
          {/* Clock center dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 z-20 shadow-lg" />
          
          {/* Hour hand */}
          <motion.div
            className="absolute top-1/2 left-1/2 origin-bottom z-10"
            style={{
              width: 4,
              height: 32,
              marginLeft: -2,
              marginTop: -32,
              borderRadius: 4,
              background: "linear-gradient(to top, #f97316, #fbbf24)",
              boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 60,
              repeat: Infinity,
              ease: "linear",
            }}
          />
          
          {/* Minute hand */}
          <motion.div
            className="absolute top-1/2 left-1/2 origin-bottom z-10"
            style={{
              width: 3,
              height: 50,
              marginLeft: -1.5,
              marginTop: -50,
              borderRadius: 3,
              background: "linear-gradient(to top, #f97316, #fbbf24)",
              boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "linear",
            }}
          />
          
          {/* Second hand */}
          <motion.div
            className="absolute top-1/2 left-1/2 origin-bottom z-10"
            style={{
              width: 1.5,
              height: 58,
              marginLeft: -0.75,
              marginTop: -58,
              borderRadius: 2,
              background: "rgba(255,255,255,0.6)",
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
            }}
          />
          
          {/* Hour markers - minimal dots */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2"
              style={{
                width: i % 3 === 0 ? 6 : 3,
                height: i % 3 === 0 ? 6 : 3,
                borderRadius: '50%',
                background: i % 3 === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)',
                transform: `rotate(${i * 30}deg) translateY(-60px)`,
                marginLeft: i % 3 === 0 ? -3 : -1.5,
                marginTop: -60,
              }}
            />
          ))}
        </div>
        
        {/* Coming Soon Text */}
        <div className="text-center mt-4">
          <h1 className="text-2xl font-semibold text-foreground mb-1">Analizer</h1>
          <p className="text-lg text-muted-foreground tracking-wide">Em Breve...</p>
        </div>
      </div>
    </div>
  );
};

export default Analizer;
