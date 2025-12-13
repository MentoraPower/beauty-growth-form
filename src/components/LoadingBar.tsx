import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export const LoadingBar = () => {
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-[99999] overflow-hidden">
      <div 
        className="h-full w-full animate-loading-bar"
        style={{
          background: "linear-gradient(90deg, transparent, #DD2A7B, transparent)"
        }}
      />
    </div>
  );
};
