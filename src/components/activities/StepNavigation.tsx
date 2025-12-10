import { memo, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Pipeline } from "@/hooks/use-lead-activities";

interface StepNavigationProps {
  pipelines: Pipeline[];
  viewingPipelineId: string | null;
  currentPipelineId: string | null;
  leadName: string;
  onPipelineClick: (pipelineId: string) => void;
}

export const StepNavigation = memo(function StepNavigation({
  pipelines,
  viewingPipelineId,
  currentPipelineId,
  leadName,
  onPipelineClick,
}: StepNavigationProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToStep = useCallback((index: number) => {
    if (scrollContainerRef.current) {
      const stepWidth = 120;
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

  // Get initials from lead name
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0]?.[0]?.toUpperCase() || '?';
  };

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
    <div className="relative py-2">
      <div
        ref={scrollContainerRef}
        className="flex items-start overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {pipelines.map((pipeline, index) => {
          const isBeforeOrAtCurrent = index <= effectiveIndex;
          const isViewing = pipeline.id === viewingPipelineId;
          const isCurrentLead = pipeline.id === currentPipelineId;
          const isLineBeforeActive = index <= effectiveIndex;
          const isLineAfterActive = index < effectiveIndex;

          return (
            <div key={pipeline.id} className="flex items-start flex-shrink-0">
              {/* Step with integrated lines */}
              <div className="flex flex-col items-center relative">
                {/* Line + Circle + Line container */}
                <div className="flex items-center">
                  {/* Line before */}
                  {index > 0 ? (
                    <div 
                      className="h-[2px] w-10"
                      style={{ 
                        backgroundColor: isLineBeforeActive 
                          ? 'hsl(var(--primary))' 
                          : 'hsl(var(--muted-foreground) / 0.3)'
                      }}
                    />
                  ) : (
                    <div className="w-10" />
                  )}
                  
                  {/* Circle */}
                  <button
                    onClick={() => handleStepClick(pipeline.id, index)}
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 flex-shrink-0",
                      isViewing && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ 
                      backgroundColor: isBeforeOrAtCurrent 
                        ? 'hsl(var(--primary))' 
                        : 'hsl(var(--muted-foreground) / 0.3)',
                      color: isBeforeOrAtCurrent ? '#ffffff' : 'hsl(var(--muted-foreground))'
                    }}
                  >
                    {index + 1}
                  </button>

                  {/* Line after */}
                  {index < pipelines.length - 1 ? (
                    <div 
                      className="h-[2px] w-10"
                      style={{ 
                        backgroundColor: isLineAfterActive 
                          ? 'hsl(var(--primary))' 
                          : 'hsl(var(--muted-foreground) / 0.3)'
                      }}
                    />
                  ) : (
                    <div className="w-10" />
                  )}
                </div>

                {/* Label */}
                <span className={cn(
                  "text-[11px] mt-2 w-[116px] text-center leading-tight",
                  isViewing ? "text-foreground font-medium" : "text-muted-foreground"
                )}>
                  {pipeline.nome}
                </span>

                {/* Lead avatar indicator below step name */}
                {isCurrentLead && (
                  <div className="mt-1.5 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center text-[9px] font-medium text-primary-foreground shadow-sm">
                      {getInitials(leadName)}
                    </div>
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
