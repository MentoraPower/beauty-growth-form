import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/disparo/formatting';

interface EmailEditorWithTabsProps {
  html: string;
  isGenerating: boolean;
  onHtmlChange: (html: string) => void;
  onRegenerate?: () => void;
  onUse: () => void;
}

export function EmailEditorWithTabs({
  html,
  isGenerating,
  onHtmlChange,
  onRegenerate,
  onUse
}: EmailEditorWithTabsProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('preview');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-4"
    >
      <div className="rounded-xl border border-border/40 overflow-hidden">
        {/* Header with tabs */}
        <div className="px-4 py-2.5 bg-muted/80 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {isGenerating && (
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2" />
            )}
            <button
              onClick={() => setActiveTab('code')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeTab === 'code'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              Código
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeTab === 'preview'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              Preview
            </button>
          </div>
          {!isGenerating && html && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Gerar novamente
            </button>
          )}
        </div>
        
        {/* Content area */}
        <div className="min-h-[300px] max-h-[400px] overflow-auto">
          {activeTab === 'code' ? (
            <textarea
              value={html}
              onChange={(e) => onHtmlChange(e.target.value)}
              className="w-full h-full min-h-[300px] p-4 bg-background text-sm font-mono text-foreground resize-none focus:outline-none"
              placeholder="HTML do email..."
              disabled={isGenerating}
            />
          ) : (
            <div className="bg-white p-4">
              {html ? (
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
                />
              ) : (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Iniciando geração...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Use email button */}
      {!isGenerating && html && (
        <div className="flex justify-end">
          <button
            onClick={onUse}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
              "bg-foreground text-background hover:bg-foreground/90"
            )}
          >
            Usar este email
          </button>
        </div>
      )}
    </motion.div>
  );
}
