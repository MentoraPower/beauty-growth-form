import React, { useState, useRef, useEffect } from "react";
import { ExternalLink, Shield, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SafeLinkProps {
  url: string;
  children: React.ReactNode;
  className?: string;
}

// Check if URL is from a known safe domain
const getSafetyLevel = (url: string): 'safe' | 'warning' | 'unknown' => {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    
    // Known safe domains
    const safeDomains = [
      'google.com', 'www.google.com',
      'youtube.com', 'www.youtube.com',
      'facebook.com', 'www.facebook.com',
      'instagram.com', 'www.instagram.com',
      'whatsapp.com', 'www.whatsapp.com',
      'linkedin.com', 'www.linkedin.com',
      'twitter.com', 'x.com', 'www.twitter.com',
      'github.com', 'www.github.com',
      'microsoft.com', 'www.microsoft.com',
      'apple.com', 'www.apple.com',
      'amazon.com', 'www.amazon.com',
      'netflix.com', 'www.netflix.com',
      'spotify.com', 'www.spotify.com',
      'notion.so', 'www.notion.so',
      'figma.com', 'www.figma.com',
      'canva.com', 'www.canva.com',
      'zoom.us', 'www.zoom.us',
      'meet.google.com',
      'docs.google.com',
      'drive.google.com',
    ];
    
    // Check if domain or subdomain matches
    const isSafe = safeDomains.some(safe => 
      domain === safe || domain.endsWith('.' + safe.replace('www.', ''))
    );
    
    if (isSafe) return 'safe';
    
    // Warning signs
    const warningPatterns = [
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP addresses
      /bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|adf\.ly/, // URL shorteners
      /\.ru$|\.cn$|\.tk$|\.ml$|\.ga$|\.cf$/, // Suspicious TLDs
    ];
    
    const hasWarning = warningPatterns.some(pattern => pattern.test(domain));
    if (hasWarning) return 'warning';
    
    return 'unknown';
  } catch {
    return 'warning';
  }
};

const getDomainFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
};

export const SafeLink: React.FC<SafeLinkProps> = ({ url, children, className }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const linkRef = useRef<HTMLAnchorElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const safetyLevel = getSafetyLevel(url);
  const domain = getDomainFromUrl(url);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (linkRef.current) {
      const rect = linkRef.current.getBoundingClientRect();
      const popupWidth = 288; // w-72 = 18rem = 288px
      const popupHeight = 200; // approximate height
      
      let left = rect.left;
      let top = rect.top - popupHeight - 8;
      
      // Adjust if popup would go off-screen to the right
      if (left + popupWidth > window.innerWidth - 16) {
        left = window.innerWidth - popupWidth - 16;
      }
      
      // Adjust if popup would go off-screen to the left
      if (left < 16) {
        left = 16;
      }
      
      // If popup would go above viewport, show below the link instead
      if (top < 16) {
        top = rect.bottom + 8;
      }
      
      setPosition({ top, left });
    }
    
    setShowPreview(true);
  };

  const handleOpenLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
    setShowPreview(false);
  };

  const handleClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowPreview(false);
  };

  // Close on escape key
  useEffect(() => {
    if (!showPreview) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPreview(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showPreview]);

  return (
    <>
      <a
        ref={linkRef}
        href={url}
        onClick={handleClick}
        className={cn(
          "text-blue-600 dark:text-blue-400 hover:underline break-all cursor-pointer",
          className
        )}
      >
        {children}
      </a>
      
      {showPreview && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => handleClose()}
          />
          
          {/* Preview popup - fixed position */}
          <div 
            ref={popupRef}
            className="fixed z-[9999] w-72 bg-popover border border-border rounded-lg shadow-xl p-3 animate-in fade-in-0 zoom-in-95 duration-200"
            style={{ top: position.top, left: position.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {safetyLevel === 'safe' && (
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                )}
                {safetyLevel === 'warning' && (
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                )}
                {safetyLevel === 'unknown' && (
                  <Shield className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-xs font-medium text-muted-foreground">
                  {safetyLevel === 'safe' && 'Site confiável'}
                  {safetyLevel === 'warning' && 'Atenção'}
                  {safetyLevel === 'unknown' && 'Verificar link'}
                </span>
              </div>
              <button 
                onClick={handleClose}
                className="p-1 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
            
            {/* Domain */}
            <div className="mb-2">
              <div className="text-sm font-medium text-foreground truncate">
                {domain}
              </div>
            </div>
            
            {/* Full URL */}
            <div className="bg-muted/50 rounded-md p-2 mb-3">
              <p className="text-xs text-muted-foreground break-all line-clamp-3">
                {url}
              </p>
            </div>
            
            {/* Warning message */}
            {safetyLevel === 'warning' && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-2 mb-3">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Este link pode ser suspeito. Verifique antes de abrir.
                </p>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleOpenLink}
                className={cn(
                  "flex-1 px-3 py-1.5 text-xs font-medium text-white rounded-md transition-colors flex items-center justify-center gap-1.5",
                  safetyLevel === 'safe' && "bg-emerald-500 hover:bg-emerald-600",
                  safetyLevel === 'warning' && "bg-amber-500 hover:bg-amber-600",
                  safetyLevel === 'unknown' && "bg-primary hover:bg-primary/90"
                )}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};
