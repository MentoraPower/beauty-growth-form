import React from "react";
import { motion } from "framer-motion";
import { Check, FileCode, ChevronRight, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailGenerationIndicatorProps {
  isGenerating: boolean;
  isComplete: boolean;
  isEditing?: boolean;
  onTogglePanel: () => void;
  isPanelOpen: boolean;
  previewHtml?: string;
}

export function EmailGenerationIndicator({
  isGenerating,
  isComplete,
  isEditing = false,
  onTogglePanel,
  isPanelOpen,
  previewHtml = "",
}: EmailGenerationIndicatorProps) {
  const getStatusText = () => {
    if (isGenerating && isEditing) return "Editing content";
    if (isGenerating) return "Generating...";
    return "Content ready";
  };

  const getStatusDescription = () => {
    if (isGenerating && isEditing) return "Applying your changes to the template";
    if (isGenerating) return "AI is creating personalized content";
    return "Click to view and edit in side panel";
  };

  return (
    <div className="w-full max-w-xl relative">
      {/* Floating preview - extends outside the card */}
      {previewHtml && (
        <div className="absolute -top-6 left-4 z-10">
          <motion.div 
            initial={{ opacity: 0, y: 10, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: -3 }}
            transition={{ delay: 0.1 }}
            className="w-28 h-36 bg-white rounded-xl shadow-2xl overflow-hidden border border-black/10"
            style={{ transform: 'rotate(-3deg)' }}
          >
            {/* Real HTML preview - scaled down */}
            <div 
              className="absolute inset-0 origin-top-left overflow-hidden pointer-events-none"
              style={{ 
                transform: 'scale(0.12)', 
                transformOrigin: 'top left',
                width: '833%',
                height: '833%'
              }}
            >
              <div 
                className="p-4"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </motion.div>
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative rounded-2xl overflow-hidden cursor-pointer mt-8",
          "bg-foreground/95 hover:bg-foreground transition-all duration-200 shadow-xl"
        )}
        onClick={onTogglePanel}
      >
        {/* Main content area */}
        <div className="flex items-stretch">
          {/* Spacer for floating preview */}
          {previewHtml && <div className="w-32" />}

          {/* Right section - Status info */}
          <div className="flex-1 p-4 flex flex-col justify-center">
            {/* Status header */}
            <div className="flex items-center gap-2.5 mb-1">
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center",
                isComplete ? "bg-emerald-500/20" : "bg-white/10"
              )}>
                {isComplete ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : isEditing ? (
                  <Pencil className="w-3 h-3 text-white/80 animate-pulse" />
                ) : (
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                )}
              </div>
              <span className="text-sm font-medium text-white">
                {getStatusText()}
              </span>
            </div>
            
            {/* Description */}
            <p className="text-xs text-white/50 italic ml-7.5 pl-0.5 mb-3">
              {getStatusDescription()}
            </p>

            {/* File indicator */}
            <div className="flex items-center gap-2 ml-7.5 pl-0.5">
              <div className="flex items-center gap-1.5 text-xs text-white/40 bg-white/5 rounded-lg px-2.5 py-1.5">
                <FileCode className="w-3 h-3" />
                <code className="font-mono text-white/60">template.html</code>
                {isGenerating && !isComplete && (
                  <span className="ml-1 w-1 h-1 bg-white/60 rounded-full animate-pulse" />
                )}
              </div>
            </div>

            {/* Action hint */}
            <div className="flex items-center gap-1 mt-3 ml-7.5 pl-0.5">
              <span className="text-[10px] text-white/30">
                {isPanelOpen ? "Panel open" : "Open editor"}
              </span>
              <ChevronRight className={cn(
                "w-3 h-3 text-white/30 transition-transform duration-200",
                isPanelOpen && "rotate-90"
              )} />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
