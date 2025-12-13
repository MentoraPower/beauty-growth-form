import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";

export const LoadingBar = () => {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Only trigger on pathname changes, not query params
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      
      // Reset and start
      setProgress(0);
      setIsVisible(true);
      
      // Animate progress
      let currentProgress = 0;
      const animate = () => {
        currentProgress += (100 - currentProgress) * 0.1;
        setProgress(Math.min(currentProgress, 90));
        
        if (currentProgress < 90) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };
      animationRef.current = requestAnimationFrame(animate);
      
      // Complete after delay
      const timer = setTimeout(() => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        setProgress(100);
        setTimeout(() => {
          setIsVisible(false);
          setProgress(0);
        }, 200);
      }, 400);
      
      return () => {
        clearTimeout(timer);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [location.pathname]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-0.5 z-[99999] overflow-hidden bg-black/5">
      <div 
        className="h-full transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          background: "linear-gradient(90deg, #DD2A7B, #F56040)"
        }}
      />
    </div>
  );
};
