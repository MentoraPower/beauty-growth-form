import { useState, useRef, useCallback, useEffect } from 'react';
import type { InsightStep } from '@/components/crm/DataIntelligence';

interface UseProgressiveStepsOptions {
  /** Delay between completing one step and starting the next (ms) */
  stepDelay?: number;
  /** Minimum time a step stays in_progress before completing (ms) */
  minStepDuration?: number;
}

interface UseProgressiveStepsReturn {
  /** Current visible steps (progressively revealed) */
  visibleSteps: InsightStep[];
  /** Whether animation is in progress */
  isAnimating: boolean;
  /** Start the progressive animation with steps */
  startAnimation: (steps: InsightStep[]) => void;
  /** Complete current step immediately and move to next */
  completeCurrentStep: () => void;
  /** Complete all steps immediately */
  completeAllSteps: () => void;
  /** Get final completed steps (for persistence) */
  getFinalSteps: () => InsightStep[];
  /** Reset animation */
  reset: () => void;
}

/**
 * Hook that animates steps progressively - one step at a time with loading indicators.
 * Steps appear one by one, each showing "in_progress" before becoming "completed".
 */
export function useProgressiveSteps(options: UseProgressiveStepsOptions = {}): UseProgressiveStepsReturn {
  const {
    stepDelay = 400,
    minStepDuration = 600,
  } = options;

  const [visibleSteps, setVisibleSteps] = useState<InsightStep[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Refs for tracking animation state
  const allStepsRef = useRef<InsightStep[]>([]);
  const currentIndexRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stepStartTimeRef = useRef(0);

  // Clear any pending timeout
  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Process next step in the animation
  const processNextStep = useCallback(() => {
    const allSteps = allStepsRef.current;
    const currentIdx = currentIndexRef.current;

    if (currentIdx >= allSteps.length) {
      // All steps completed
      setIsAnimating(false);
      return;
    }

    // Check if we need to wait for minimum duration
    const elapsed = Date.now() - stepStartTimeRef.current;
    if (currentIdx > 0 && elapsed < minStepDuration) {
      timeoutRef.current = setTimeout(processNextStep, minStepDuration - elapsed);
      return;
    }

    // Complete previous step if exists
    if (currentIdx > 0) {
      setVisibleSteps(prev => 
        prev.map((step, idx) => 
          idx === currentIdx - 1 
            ? { ...step, status: 'completed' as const }
            : step
        )
      );
    }

    // Start delay before showing next step
    timeoutRef.current = setTimeout(() => {
      const nextStep = allSteps[currentIdx];
      if (!nextStep) return;

      // Add new step as in_progress
      const stepWithProgress: InsightStep = {
        ...nextStep,
        status: 'in_progress',
      };

      setVisibleSteps(prev => [...prev, stepWithProgress]);
      stepStartTimeRef.current = Date.now();
      currentIndexRef.current = currentIdx + 1;

      // Check if this is the last step
      if (currentIdx === allSteps.length - 1) {
        // Complete last step after minimum duration
        timeoutRef.current = setTimeout(() => {
          setVisibleSteps(prev =>
            prev.map((step, idx) =>
              idx === prev.length - 1
                ? { ...step, status: 'completed' as const }
                : step
            )
          );
          setIsAnimating(false);
        }, minStepDuration);
      } else {
        // Process next step
        processNextStep();
      }
    }, currentIdx === 0 ? 0 : stepDelay);
  }, [stepDelay, minStepDuration]);

  // Start the progressive animation
  const startAnimation = useCallback((steps: InsightStep[]) => {
    clearPendingTimeout();
    allStepsRef.current = steps;
    currentIndexRef.current = 0;
    stepStartTimeRef.current = 0;
    setVisibleSteps([]);
    setIsAnimating(true);
    
    // Start processing
    processNextStep();
  }, [clearPendingTimeout, processNextStep]);

  // Complete current step immediately and move to next
  const completeCurrentStep = useCallback(() => {
    clearPendingTimeout();
    
    // Mark current step as completed
    setVisibleSteps(prev =>
      prev.map((step, idx) =>
        idx === prev.length - 1 && step.status === 'in_progress'
          ? { ...step, status: 'completed' as const }
          : step
      )
    );
    
    // Reset timing and continue
    stepStartTimeRef.current = 0;
    processNextStep();
  }, [clearPendingTimeout, processNextStep]);

  // Complete all steps immediately
  const completeAllSteps = useCallback(() => {
    clearPendingTimeout();
    
    const allSteps = allStepsRef.current;
    const completedSteps = allSteps.map(step => ({
      ...step,
      status: 'completed' as const,
    }));
    
    setVisibleSteps(completedSteps);
    setIsAnimating(false);
  }, [clearPendingTimeout]);

  // Get final steps for persistence
  const getFinalSteps = useCallback((): InsightStep[] => {
    return allStepsRef.current.map(step => ({
      ...step,
      status: 'completed' as const,
    }));
  }, []);

  // Reset everything
  const reset = useCallback(() => {
    clearPendingTimeout();
    allStepsRef.current = [];
    currentIndexRef.current = 0;
    stepStartTimeRef.current = 0;
    setVisibleSteps([]);
    setIsAnimating(false);
  }, [clearPendingTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPendingTimeout();
    };
  }, [clearPendingTimeout]);

  return {
    visibleSteps,
    isAnimating,
    startAnimation,
    completeCurrentStep,
    completeAllSteps,
    getFinalSteps,
    reset,
  };
}
