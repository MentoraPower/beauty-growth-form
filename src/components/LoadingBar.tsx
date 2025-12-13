import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";

export const LoadingBar = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    // Only trigger on pathname changes, not query params
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      
      // Start loading
      setIsLoading(true);
      setIsVisible(true);
      
      // Finish loading after animation
      const timer = setTimeout(() => {
        setIsLoading(false);
        // Hide after fade out
        setTimeout(() => setIsVisible(false), 300);
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  if (!isVisible) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 h-1 z-[99999] overflow-hidden transition-opacity duration-300"
      style={{ opacity: isLoading ? 1 : 0 }}
    >
      <div 
        className="h-full w-full animate-loading-bar"
        style={{
          background: "linear-gradient(90deg, transparent, #DD2A7B, transparent)"
        }}
      />
    </div>
  );
};
