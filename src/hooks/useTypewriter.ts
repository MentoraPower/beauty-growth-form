import { useState, useRef, useCallback, useEffect } from 'react';

interface UseTypewriterOptions {
  /** Characters per tick (default: 8) */
  charsPerTick?: number;
  /** Tick interval in ms (default: 16, roughly 60fps) */
  tickInterval?: number;
  /** Speed multiplier when catching up to buffer (default: 3) */
  catchUpMultiplier?: number;
  /** Threshold to trigger catch-up mode (chars behind) */
  catchUpThreshold?: number;
}

interface UseTypewriterReturn {
  /** The displayed content (what user sees) */
  displayedContent: string;
  /** Whether the typewriter is still animating */
  isTyping: boolean;
  /** Append new content to the buffer */
  appendContent: (chunk: string) => void;
  /** Set complete content (replaces buffer) */
  setFullContent: (content: string) => void;
  /** Mark streaming as complete (typewriter will finish remaining buffer) */
  completeStreaming: () => void;
  /** Reset everything */
  reset: () => void;
  /** Get the raw buffered content (for saving) */
  getRawContent: () => string;
}

/**
 * Hook that creates a smooth typewriter effect independent of network buffering.
 * Content is buffered and displayed at a consistent rate regardless of how
 * chunks arrive from the network.
 */
export function useTypewriter(options: UseTypewriterOptions = {}): UseTypewriterReturn {
  const {
    charsPerTick = 8,
    tickInterval = 16,
    catchUpMultiplier = 4,
    catchUpThreshold = 100,
  } = options;

  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Refs to avoid stale closures in animation frame
  const bufferRef = useRef('');
  const displayIndexRef = useRef(0);
  const isStreamingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef(0);

  // Animation tick function
  const tick = useCallback(() => {
    const now = performance.now();
    const elapsed = now - lastTickTimeRef.current;
    
    if (elapsed < tickInterval) {
      rafIdRef.current = requestAnimationFrame(tick);
      return;
    }
    
    lastTickTimeRef.current = now;
    
    const buffer = bufferRef.current;
    const currentIndex = displayIndexRef.current;
    const remaining = buffer.length - currentIndex;
    
    if (remaining <= 0) {
      // Caught up to buffer
      if (!isStreamingRef.current) {
        // Streaming is done and we've displayed everything
        setIsTyping(false);
        rafIdRef.current = null;
        return;
      }
      // Still streaming, keep the loop alive
      rafIdRef.current = requestAnimationFrame(tick);
      return;
    }
    
    // Calculate how many chars to show this tick
    // Use catch-up mode if we're far behind
    const isCatchingUp = remaining > catchUpThreshold;
    const charsToAdd = isCatchingUp 
      ? Math.min(remaining, charsPerTick * catchUpMultiplier)
      : Math.min(remaining, charsPerTick);
    
    displayIndexRef.current += charsToAdd;
    const newDisplayed = buffer.slice(0, displayIndexRef.current);
    setDisplayedContent(newDisplayed);
    
    rafIdRef.current = requestAnimationFrame(tick);
  }, [charsPerTick, tickInterval, catchUpMultiplier, catchUpThreshold]);

  // Start the animation loop
  const startAnimation = useCallback(() => {
    if (rafIdRef.current !== null) return; // Already running
    setIsTyping(true);
    lastTickTimeRef.current = performance.now();
    rafIdRef.current = requestAnimationFrame(tick);
  }, [tick]);

  // Append content to buffer (called when SSE chunks arrive)
  const appendContent = useCallback((chunk: string) => {
    bufferRef.current += chunk;
    isStreamingRef.current = true;
    startAnimation();
  }, [startAnimation]);

  // Set full content (replaces buffer completely)
  const setFullContent = useCallback((content: string) => {
    bufferRef.current = content;
    isStreamingRef.current = true;
    startAnimation();
  }, [startAnimation]);

  // Mark streaming as complete
  const completeStreaming = useCallback(() => {
    isStreamingRef.current = false;
    // Animation will stop once it catches up
  }, []);

  // Reset everything
  const reset = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    bufferRef.current = '';
    displayIndexRef.current = 0;
    isStreamingRef.current = false;
    setDisplayedContent('');
    setIsTyping(false);
  }, []);

  // Get raw content for saving
  const getRawContent = useCallback(() => {
    return bufferRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    displayedContent,
    isTyping,
    appendContent,
    setFullContent,
    completeStreaming,
    reset,
    getRawContent,
  };
}
