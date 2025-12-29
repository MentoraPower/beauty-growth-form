import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface EmailChatCardProps {
  subject?: string;
  previewHtml?: string;
  onClick: () => void;
}

export function EmailChatCard({
  subject = "Email",
  previewHtml = "",
  onClick,
}: EmailChatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "w-full max-w-sm rounded-2xl overflow-visible cursor-pointer relative",
        "bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all duration-200",
        "hover:shadow-lg group mt-4"
      )}
      onClick={onClick}
    >
      {/* Preview sticking out at the top */}
      {previewHtml && (
        <div className="absolute -top-3 left-4 right-4">
          <div className="w-full h-32 bg-white rounded-xl overflow-hidden shadow-lg border border-zinc-200 relative">
            <div 
              className="absolute inset-0 origin-top-left overflow-hidden pointer-events-none p-2"
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
          </div>
        </div>
      )}

      {/* Content - with top padding to account for preview */}
      <div className={cn("p-4", previewHtml ? "pt-36" : "pt-4")}>
        {/* Header and button row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-white truncate block">
              {subject || "Email Template"}
            </span>
            <span className="text-xs text-zinc-400 mt-0.5 block">
              Click to edit
            </span>
          </div>

          {/* Button - smaller and to the side */}
          <button
            type="button"
            className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
          >
            View
          </button>
        </div>
      </div>
    </motion.div>
  );
}
