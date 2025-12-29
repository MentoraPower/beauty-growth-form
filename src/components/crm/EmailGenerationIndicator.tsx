import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, FileCode, ChevronUp, ChevronDown, Pencil, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailGenerationIndicatorProps {
  isGenerating: boolean;
  isComplete: boolean;
  isEditing?: boolean;
  onTogglePanel: () => void;
  isPanelOpen: boolean;
  previewHtml?: string; // HTML content for mini preview
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

  // Extract plain text preview from HTML
  const getPreviewText = (html: string): string => {
    if (!html) return "";
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || "";
    return text.slice(0, 120).trim() + (text.length > 120 ? "..." : "");
  };

  return (
    <div className="w-full max-w-lg">
      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative bg-foreground/95 border border-foreground/20 rounded-2xl overflow-hidden cursor-pointer",
          "hover:bg-foreground transition-all duration-200 shadow-lg"
        )}
        onClick={onTogglePanel}
      >
        {/* Main content area */}
        <div className="flex items-stretch">
          {/* Left section - Status info */}
          <div className="flex-1 p-4">
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
            <p className="text-xs text-white/50 italic ml-7.5 pl-0.5">
              {getStatusDescription()}
            </p>

            {/* File indicator */}
            <div className="flex items-center gap-2 mt-3 ml-7.5 pl-0.5">
              <div className="flex items-center gap-1.5 text-xs text-white/40 bg-white/5 rounded-lg px-2.5 py-1.5">
                <FileCode className="w-3 h-3" />
                <code className="font-mono text-white/60">template.html</code>
                {isGenerating && !isComplete && (
                  <span className="ml-1 w-1 h-1 bg-white/60 rounded-full animate-pulse" />
                )}
              </div>
            </div>
          </div>

          {/* Right section - Mini Preview */}
          {previewHtml && isComplete && (
            <div className="w-24 h-full bg-white/5 border-l border-white/10 flex items-center justify-center p-2">
              <div className="w-full h-full bg-white/90 rounded-lg overflow-hidden relative">
                {/* Mini preview content */}
                <div 
                  className="w-full h-full p-1.5 text-[4px] leading-tight text-gray-600 overflow-hidden pointer-events-none"
                  style={{ transform: 'scale(1)', transformOrigin: 'top left' }}
                >
                  <div className="w-full h-1.5 bg-gray-200 rounded-sm mb-1" />
                  <div className="w-3/4 h-1 bg-gray-100 rounded-sm mb-0.5" />
                  <div className="w-full h-1 bg-gray-100 rounded-sm mb-0.5" />
                  <div className="w-2/3 h-1 bg-gray-100 rounded-sm mb-1" />
                  <div className="w-1/2 h-2 bg-orange-400/60 rounded-sm" />
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                  <ExternalLink className="w-3 h-3 text-gray-600" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom action hint */}
        <div className="px-4 pb-3 pt-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/30">
              {isPanelOpen ? "Panel open" : "Click to preview"}
            </span>
            <ChevronUp className={cn(
              "w-3 h-3 text-white/30 transition-transform duration-200",
              !isPanelOpen && "rotate-180"
            )} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
