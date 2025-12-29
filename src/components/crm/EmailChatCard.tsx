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
        "w-full max-w-md rounded-2xl overflow-visible cursor-pointer",
        "bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all duration-200",
        "hover:shadow-lg group"
      )}
      onClick={onClick}
    >
      <div className="flex items-stretch">
        {/* Preview sticking out horizontally to the left */}
        {previewHtml && (
          <div className="relative -ml-3 my-3 flex-shrink-0">
            <div className="w-24 h-28 bg-white rounded-xl overflow-hidden shadow-lg border border-zinc-200">
              <div 
                className="absolute inset-0 origin-top-left overflow-hidden pointer-events-none"
                style={{ 
                  transform: 'scale(0.1)', 
                  transformOrigin: 'top left',
                  width: '1000%',
                  height: '1000%'
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
        <div className="flex-1 p-4 flex flex-col justify-center min-w-0">
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
      </div>
    </motion.div>
  );
}
