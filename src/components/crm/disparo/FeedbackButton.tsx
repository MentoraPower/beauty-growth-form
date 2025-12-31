import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface FeedbackButtonProps {
  icon: 'copy' | 'like' | 'dislike';
  onClick?: () => void;
  active?: boolean;
}

export function FeedbackButton({ icon, onClick, active = false }: FeedbackButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    if (icon === 'copy') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    onClick?.();
  };

  const iconMap = {
    copy: copied ? (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ) : (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    ),
    like: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
      </svg>
    ),
    dislike: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
      </svg>
    )
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "p-1 rounded transition-colors",
        copied ? "text-green-500" : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50"
      )}
    >
      {iconMap[icon]}
    </button>
  );
}
