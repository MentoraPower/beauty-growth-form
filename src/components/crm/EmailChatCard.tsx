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
      {/* Preview on the left side */}
      {previewHtml && (
        <div className="relative flex-shrink-0 p-2.5 pr-0">
          <div className="w-20 h-24 bg-white rounded-lg overflow-hidden shadow-md border border-zinc-200/80 relative">
            <div 
              className="absolute inset-0 origin-top-left overflow-hidden pointer-events-none p-0.5"
              style={{ 
                transform: 'scale(0.085)', 
                transformOrigin: 'top left',
                width: '1176%',
                height: '1176%'
              }}
            >
              <div 
                className="p-3"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-3 flex flex-col justify-center gap-1.5 min-w-0">
        <div className="min-w-0">
          <span className="text-sm font-medium text-white truncate block">
            {subject || "Email Template"}
          </span>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">
            Clique para editar
          </span>
        </div>

        {/* Button */}
        <button
          type="button"
          className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg transition-colors w-fit"
        >
          View
        </button>
      </div>
    </motion.div>
  );
}
