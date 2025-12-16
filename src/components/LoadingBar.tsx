import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";

export const LoadingBar = () => {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();
  const previousPath = useRef(`${location.pathname}${location.search}`);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Trigger on route changes (including query params)
    const currentRoute = `${location.pathname}${location.search}`;

    if (previousPath.current !== currentRoute) {
      previousPath.current = currentRoute;

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
  }, [location.pathname, location.search]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-[999999] overflow-hidden bg-foreground/10 pointer-events-none">
      <div 
        className="h-full transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          background: "linear-gradient(90deg, #F40000, #A10000)"
        }}
      />
    </div>
  );
};
