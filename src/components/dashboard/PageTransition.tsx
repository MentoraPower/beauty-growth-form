import { useEffect, useState, useRef, ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  const [currentChildren, setCurrentChildren] = useState(children);
  const previousKeyRef = useRef(location.pathname + location.search);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const currentKey = location.pathname + location.search;
    
    // Skip transition on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousKeyRef.current = currentKey;
      setCurrentChildren(children);
      return;
    }
    
    // Only trigger transition if route actually changed
    if (previousKeyRef.current !== currentKey) {
      previousKeyRef.current = currentKey;
      
      // Fade out
      setIsVisible(false);
      
      // After fade out, update content and fade in
      const timer = setTimeout(() => {
        setCurrentChildren(children);
        setIsVisible(true);
      }, 150);
      
      return () => clearTimeout(timer);
    } else {
      // Same route, just update children immediately
      setCurrentChildren(children);
    }
  }, [location.pathname, location.search, children]);

  // Also listen for custom suborigin-change event for early fade-out
  useEffect(() => {
    const handleSubOriginChange = () => {
      setIsVisible(false);
    };
    
    window.addEventListener('suborigin-change', handleSubOriginChange);
    return () => window.removeEventListener('suborigin-change', handleSubOriginChange);
  }, []);

  return (
    <div
      className={`transition-all duration-200 ease-out ${
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-1'
      }`}
    >
      {currentChildren}
    </div>
  );
}
