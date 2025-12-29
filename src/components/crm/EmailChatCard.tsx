import React from "react";
import { motion } from "framer-motion";
import { Mail, ExternalLink } from "lucide-react";
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
  // Extract a text preview from HTML (first 80 chars of visible text)
  const getTextPreview = () => {
    if (!previewHtml) return "";
    const div = document.createElement('div');
    div.innerHTML = previewHtml;
    const text = div.textContent || div.innerText || '';
    return text.slice(0, 80).trim() + (text.length > 80 ? '...' : '');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "w-full max-w-sm rounded-xl overflow-hidden cursor-pointer",
        "bg-muted/50 border border-border hover:border-primary/30 transition-all duration-200",
        "hover:shadow-md group"
      )}
      onClick={onClick}
    >
      <div className="flex items-stretch">
        {/* Mini preview thumbnail */}
        {previewHtml && (
          <div className="w-20 h-24 flex-shrink-0 bg-white border-r border-border overflow-hidden relative">
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
        )}

        {/* Content */}
        <div className="flex-1 p-3 flex flex-col justify-center min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">
              {subject || "Email Template"}
            </span>
          </div>
          
          {/* Preview text */}
          {previewHtml && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {getTextPreview()}
            </p>
          )}

          {/* Action hint */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-primary transition-colors">
            <ExternalLink className="w-3 h-3" />
            <span>Abrir editor</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
