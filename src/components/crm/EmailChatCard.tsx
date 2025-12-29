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
        "w-full max-w-xs rounded-2xl overflow-visible cursor-pointer relative",
        "bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all duration-200",
        "hover:shadow-lg group flex items-stretch"
      )}
      onClick={onClick}
    >
      {/* Preview on the left side - sticking out from top */}
      {previewHtml && (
        <div className="relative flex-shrink-0 pl-2.5 pb-2 pt-2.5">
          <div className="w-16 h-20 bg-white rounded-lg overflow-hidden shadow-md border border-zinc-200/80 relative -mt-6">
            <div 
              className="absolute inset-0 origin-top-left overflow-hidden pointer-events-none"
              style={{ 
                transform: 'scale(0.07)', 
                transformOrigin: 'top left',
                width: '1428%',
                height: '1428%'
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
      <div className="flex-1 py-2 px-3 flex items-center gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-white truncate block">
            {subject || "Email Template"}
          </span>
          <span className="text-[11px] text-zinc-500 block">
            Clique para editar
          </span>
        </div>

        {/* Button */}
        <button
          type="button"
          className="py-1 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-medium rounded-md transition-colors flex-shrink-0"
        >
          Ver
        </button>
      </div>
    </motion.div>
  );
}
