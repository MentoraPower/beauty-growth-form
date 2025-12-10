import { memo, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Pipeline } from "@/hooks/use-lead-activities";

interface StepNavigationProps {
  pipelines: Pipeline[];
  viewingPipelineId: string | null;
  currentPipelineId: string | null;
  onPipelineClick: (pipelineId: string) => void;
}

const stepSelectedColor = 'hsl(var(--primary))';
const stepInactiveColor = 'hsl(var(--primary) / 0.25)';

export const StepNavigation = memo(function StepNavigation({
  pipelines,
  viewingPipelineId,
  currentPipelineId,
  onPipelineClick,
}: StepNavigationProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToStep = useCallback((index: number) => {
    if (scrollContainerRef.current) {
      const stepWidth = 160;
      const containerWidth = scrollContainerRef.current.clientWidth;
      const scrollPosition = (index * stepWidth) - (containerWidth / 2) + (stepWidth / 2);
      scrollContainerRef.current.scrollTo({ left: Math.max(0, scrollPosition), behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (currentPipelineId) {
      const index = pipelines.findIndex(p => p.id === currentPipelineId);
      if (index >= 0) {
        scrollToStep(index);
      }
    }
  }, [currentPipelineId, pipelines, scrollToStep]);

  const handleStepClick = useCallback((pipelineId: string, index: number) => {
    onPipelineClick(pipelineId);
    scrollToStep(index);
  }, [onPipelineClick, scrollToStep]);

  if (pipelines.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        Carregando etapas...
      </div>
    );
  }

  const currentIndex = pipelines.findIndex(p => p.id === currentPipelineId);
  const clickedIndex = pipelines.findIndex(p => p.id === viewingPipelineId);
  const effectiveIndex = clickedIndex >= 0 ? clickedIndex : currentIndex;

  return (
    <div className="relative">
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-1 overflow-x-auto pb-4 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {pipelines.map((pipeline, index) => {
          const isSelected = index <= effectiveIndex;
          const isTransitionStep = index === effectiveIndex;
          const isCurrentLead = pipeline.id === currentPipelineId;
          const isViewing = pipeline.id === viewingPipelineId;

          const currentColor = isSelected ? stepSelectedColor : stepInactiveColor;
          const lineAfterGradient = isTransitionStep 
            ? `linear-gradient(to right, ${stepSelectedColor}, ${stepInactiveColor})`
            : isSelected ? stepSelectedColor : stepInactiveColor;

          return (
            <div key={pipeline.id} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center relative">
                <div className="flex items-center">
                  {index > 0 && (
                    <div
                      className="w-8 h-0.5 -mr-1"
                      style={{ backgroundColor: isSelected ? stepSelectedColor : stepInactiveColor }}
                    />
                  )}
                  {index === 0 && <div className="w-4" />}

                  <button
                    onClick={() => handleStepClick(pipeline.id, index)}
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 relative overflow-hidden transition-all",
                      isViewing && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: currentColor, color: '#ffffff' }}
                  >
                    <div
                      className="absolute inset-0 rounded-full transition-all duration-300"
                      style={{ backgroundColor: currentColor }}
                    />
                    <span className="relative z-10">{index + 1}</span>
                  </button>

                  {index < pipelines.length - 1 && (
                    <div
                      className="w-8 h-0.5 -ml-1"
                      style={{ background: lineAfterGradient }}
                    />
                  )}
                  {index === pipelines.length - 1 && <div className="w-4" />}
                </div>

                <span className={cn(
                  "text-xs mt-2 max-w-[80px] text-center truncate",
                  isViewing ? "text-foreground font-medium" : "text-muted-foreground"
                )}>
                  {pipeline.nome}
                </span>

                {isCurrentLead && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
