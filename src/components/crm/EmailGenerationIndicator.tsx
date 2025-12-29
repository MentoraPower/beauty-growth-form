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
    <div className="w-full max-w-xl">
      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative bg-foreground/95 rounded-2xl overflow-hidden cursor-pointer",
          "hover:bg-foreground transition-all duration-200 shadow-xl"
        )}
        onClick={onTogglePanel}
      >
        {/* Main content area */}
        <div className="flex items-stretch">
          {/* Left section - Real Mini Preview */}
          {previewHtml && (
            <div className="w-36 h-32 bg-white/10 flex items-center justify-center p-2.5 border-r border-white/10">
              <div className="w-full h-full bg-white rounded-xl overflow-hidden shadow-inner relative">
                {/* Real HTML preview - scaled down */}
                <div 
                  className="absolute inset-0 origin-top-left overflow-hidden pointer-events-none"
                  style={{ 
                    transform: 'scale(0.15)', 
                    transformOrigin: 'top left',
                    width: '666%',
                    height: '666%'
                  }}
                >
                  <div 
                    className="p-4"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
                {/* Gradient overlay for polish */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/20 pointer-events-none" />
              </div>
            </div>
          )}

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
