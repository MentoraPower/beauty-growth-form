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
        "w-full max-w-md rounded-2xl overflow-visible cursor-pointer relative",
        "bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all duration-200",
        "hover:shadow-lg group flex items-stretch"
      )}
      onClick={onClick}
    >
      {/* Preview on the left side - sticking out from top */}
      {previewHtml && (
        <div className="relative flex-shrink-0 p-3 pr-0">
          <div className="w-28 h-36 bg-white rounded-xl overflow-hidden shadow-lg border border-zinc-200 relative -mt-5">
            <div 
              className="absolute inset-0 origin-top-left overflow-hidden pointer-events-none p-1"
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
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4 flex items-center justify-between gap-3 min-w-0">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-white truncate block">
            {subject || "Email Template"}
          </span>
          <span className="text-xs text-zinc-400 mt-0.5 block">
            Click to edit
          </span>
        </div>

        {/* Button */}
        <button
          type="button"
          className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
        >
          View
        </button>
      </div>
    </motion.div>
  );
}
