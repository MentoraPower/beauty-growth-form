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
        "w-full max-w-xs rounded-2xl overflow-visible cursor-pointer",
        "bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all duration-200",
        "hover:shadow-lg group"
      )}
      onClick={onClick}
    >
      {/* Preview sticking out at top */}
      {previewHtml && (
        <div className="relative -mt-3 mx-3">
          <div className="w-full h-28 bg-white rounded-xl overflow-hidden shadow-lg border border-zinc-200">
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
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4 pt-3">
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
          className="w-full py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Ver Email
        </button>
      </div>
    </motion.div>
  );
}
