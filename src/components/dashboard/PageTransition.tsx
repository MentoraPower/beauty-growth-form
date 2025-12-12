import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousPathRef = useRef(location.pathname + location.search);

  useEffect(() => {
    const currentPath = location.pathname + location.search;
    
    // Only trigger transition if path actually changed
    if (previousPathRef.current !== currentPath) {
      previousPathRef.current = currentPath;
      setIsTransitioning(true);
      
      // Short delay for fade out, then update content
      const timer = setTimeout(() => {
        setDisplayChildren(children);
        setIsTransitioning(false);
      }, 150);
      
      return () => clearTimeout(timer);
    } else {
      // Same path, just update children without transition
      setDisplayChildren(children);
    }
  }, [location.pathname, location.search, children]);

  return (
    <div
      className={`transition-all duration-200 ease-out ${
        isTransitioning 
          ? 'opacity-0 translate-y-1' 
          : 'opacity-100 translate-y-0'
      }`}
    >
      {displayChildren}
    </div>
  );
}
