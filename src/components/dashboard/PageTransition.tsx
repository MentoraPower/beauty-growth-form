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
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      
      // Clear any pending transition
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      
      // Update content immediately (no fade out) - let the content handle its own loading
      setCurrentChildren(children);
      setIsVisible(true);
    } else {
      // Same route, just update children immediately
      setCurrentChildren(children);
    }
  }, [location.pathname, location.search, children]);

  // Listen for custom suborigin-change event - but don't fade out, let loading handle it
  useEffect(() => {
    const handleSubOriginChange = () => {
      // Don't fade out - the loading skeletons will handle the transition
    };
    
    window.addEventListener('suborigin-change', handleSubOriginChange);
    return () => window.removeEventListener('suborigin-change', handleSubOriginChange);
  }, []);

  return (
    <div className="transition-opacity duration-150 ease-out opacity-100">
      {currentChildren}
    </div>
  );
}
