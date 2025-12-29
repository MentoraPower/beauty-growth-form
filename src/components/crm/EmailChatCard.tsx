import React from "react";
import { motion } from "framer-motion";
import { Mail } from "lucide-react";
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
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <span className="text-sm font-medium text-white truncate">
            {subject || "Email Template"}
          </span>
        </div>

        {/* Button */}
        <button
          type="button"
          className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Ver Email
        </button>
      </div>
    </motion.div>
  );
}
