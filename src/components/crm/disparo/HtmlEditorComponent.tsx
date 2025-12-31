import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { highlightHtml, sanitizeHtml } from '@/lib/disparo/formatting';

interface HtmlEditorComponentProps {
  onSubmit: (html: string) => void;
  initialContent?: string;
}

export function HtmlEditorComponent({ onSubmit, initialContent = '' }: HtmlEditorComponentProps) {
  const [html, setHtml] = useState(initialContent);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');

  useEffect(() => {
    if (initialContent) {
      setHtml(initialContent);
    }
  }, [initialContent]);

  const handleSubmit = () => {
    if (html.trim()) {
      onSubmit(html);
    }
  };

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
          {html && (
            <span className="text-xs text-muted-foreground">
              {html.length} caracteres
            </span>
          )}
        </div>
        
        {/* Content area */}
        <div className="min-h-[250px] max-h-[350px] overflow-auto">
          {activeTab === 'code' ? (
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              className="w-full h-full min-h-[250px] p-4 bg-background text-sm font-mono text-foreground resize-none focus:outline-none"
              placeholder="Cole seu HTML aqui..."
            />
          ) : (
            <div className="bg-white p-4 min-h-[250px]">
              {html ? (
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
                />
              ) : (
                <div className="flex items-center justify-center h-[230px] text-muted-foreground text-sm">
                  Cole seu HTML na aba Código para visualizar
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Submit button */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!html.trim()}
          className={cn(
            "px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
            html.trim()
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          Usar este HTML
        </button>
      </div>
    </motion.div>
  );
}
