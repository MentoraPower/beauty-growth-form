import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface EmailChatCardProps {
  subject?: string;
  previewHtml?: string;
  chatName?: string;
  createdAt?: Date;
  onClick: () => void;
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s`;
  if (diffMin < 60) return `${diffMin}min`;
  if (diffHour < 24) return `${diffHour}h`;
  return `${diffDay}d`;
}

export function EmailChatCard({
  subject = "Email",
  previewHtml = "",
  chatName = "Nova conversa",
  createdAt,
  onClick,
}: EmailChatCardProps) {
  const timeAgo = createdAt ? getRelativeTime(createdAt) : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "w-full max-w-sm rounded-[5px] overflow-visible cursor-pointer relative",
        "bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all duration-200",
        "hover:shadow-lg group flex items-stretch"
      )}
      onClick={onClick}
    >
      {/* Preview on the left side - sticking out from top */}
      {previewHtml && (
        <div className="relative flex-shrink-0 pl-3 pb-3 pt-3">
          <div className="w-20 h-28 bg-white rounded-[5px] overflow-hidden shadow-md border border-zinc-200/80 relative -mt-8">
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
      <div className="flex-1 py-3 px-3 flex flex-col gap-2.5 min-w-0">
        {/* Header with icon and SCALE EMAIL AGENT */}
        <div className="flex items-center gap-2">
          {/* Custom icon - square with inner square */}
          <div className="w-5 h-5 border-2 border-zinc-400 rounded-[3px] flex items-center justify-center flex-shrink-0">
            <div className="w-2 h-2 bg-zinc-400 rounded-[2px]" />
          </div>
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
            Scale Email Agent
          </span>
        </div>

        {/* Chat name */}
        <div className="min-w-0">
          <span className="text-sm font-medium text-white truncate block">
            {chatName}
          </span>
        </div>

        {/* Time ago */}
        {timeAgo && (
          <span className="text-[11px] text-zinc-500">
            {timeAgo} atrás
          </span>
        )}

        {/* Button */}
        <button
          type="button"
          className="mt-1 py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-[4px] transition-colors self-start"
        >
          Review Email
        </button>
      </div>
    </motion.div>
  );
}
