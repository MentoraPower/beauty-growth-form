import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Code2, Eye, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface EmailSidePanelProps {
  isOpen: boolean;
  htmlContent: string;
  onHtmlChange: (html: string) => void;
  isGenerating?: boolean;
  title?: string;
}

// Syntax highlighting for HTML
const highlightHtml = (code: string): React.ReactNode => {
  if (!code) return null;
  
  const parts: React.ReactNode[] = [];
  let remaining = code;
  let keyIndex = 0;

  while (remaining.length > 0) {
    let matched = false;

    // Comments
    const commentMatch = remaining.match(/^(<!--[\s\S]*?-->)/);
    if (commentMatch) {
      parts.push(<span key={keyIndex++} className="text-muted-foreground italic">{commentMatch[1]}</span>);
      remaining = remaining.slice(commentMatch[1].length);
      matched = true;
      continue;
    }

    // Opening/closing tags
    const tagMatch = remaining.match(/^(<\/?)([\w-]+)/);
    if (tagMatch) {
      parts.push(<span key={keyIndex++} className="text-pink-500">{tagMatch[1]}</span>);
      parts.push(<span key={keyIndex++} className="text-blue-500">{tagMatch[2]}</span>);
      remaining = remaining.slice(tagMatch[0].length);
      matched = true;
      continue;
    }

    // Attributes
    const attrMatch = remaining.match(/^(\s+)([\w-]+)(=)("([^"]*)")?/);
    if (attrMatch) {
      parts.push(<span key={keyIndex++}>{attrMatch[1]}</span>);
      parts.push(<span key={keyIndex++} className="text-orange-400">{attrMatch[2]}</span>);
      parts.push(<span key={keyIndex++} className="text-foreground">{attrMatch[3]}</span>);
      if (attrMatch[4]) {
        parts.push(<span key={keyIndex++} className="text-green-500">{attrMatch[4]}</span>);
      }
      remaining = remaining.slice(attrMatch[0].length);
      matched = true;
      continue;
    }

    // Closing bracket
    const closeBracket = remaining.match(/^(\/?>)/);
    if (closeBracket) {
      parts.push(<span key={keyIndex++} className="text-pink-500">{closeBracket[1]}</span>);
      remaining = remaining.slice(closeBracket[1].length);
      matched = true;
      continue;
    }

    // Text content
    const textMatch = remaining.match(/^([^<]+)/);
    if (textMatch) {
      parts.push(<span key={keyIndex++} className="text-foreground">{textMatch[1]}</span>);
      remaining = remaining.slice(textMatch[1].length);
      matched = true;
      continue;
    }

    // Fallback: single character
    if (!matched) {
      parts.push(<span key={keyIndex++}>{remaining[0]}</span>);
      remaining = remaining.slice(1);
    }
  }

  return parts;
};

export function EmailSidePanel({ 
  isOpen, 
  htmlContent, 
  onHtmlChange,
  isGenerating = false,
  title = "Editor de Email"
}: EmailSidePanelProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('preview');
  const [copied, setCopied] = useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const preRef = React.useRef<HTMLPreElement>(null);

  // Switch to preview when content updates
  useEffect(() => {
    if (htmlContent && !isGenerating) {
      setActiveTab('preview');
    }
  }, [htmlContent, isGenerating]);

  const handleCopy = () => {
    navigator.clipboard.writeText(htmlContent);
    setCopied(true);
    toast.success("HTML copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Sync scroll between textarea and pre
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Basic HTML sanitization for preview
  const getSanitizedHtml = () => {
    return htmlContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');
  };

  if (!isOpen) return null;

  return (
    <div className="w-[500px] min-w-[400px] max-w-[50vw] h-full border-l border-border bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Code2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">
              Use <code className="bg-muted px-1 py-0.5 rounded">{"{{name}}"}</code> para personalizar
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('preview')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === 'preview'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === 'code'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Code2 className="w-4 h-4" />
            Código
          </button>
        </div>
        
        <button
          onClick={handleCopy}
          disabled={!htmlContent}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'code' ? (
          <div className="relative h-full">
            {/* Highlighted code display */}
            <pre
              ref={preRef}
              className="absolute inset-0 p-5 font-mono text-sm pointer-events-none overflow-auto whitespace-pre-wrap break-words"
              aria-hidden="true"
            >
              {htmlContent ? highlightHtml(htmlContent) : (
                <span className="text-muted-foreground">
                  {isGenerating ? "Gerando HTML..." : "O HTML do email aparecerá aqui..."}
                </span>
              )}
            </pre>
            
            {/* Actual textarea */}
            <textarea
              ref={textareaRef}
              value={htmlContent}
              onChange={(e) => onHtmlChange(e.target.value)}
              onScroll={handleScroll}
              className="absolute inset-0 w-full h-full p-5 font-mono text-sm bg-transparent text-transparent caret-foreground resize-none focus:outline-none"
              spellCheck={false}
              placeholder=""
            />
            
            {/* Generating indicator */}
            {isGenerating && (
              <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-xs text-primary font-medium">Gerando...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full overflow-auto bg-white">
            {htmlContent ? (
              <div
                className="p-6 min-h-full"
                dangerouslySetInnerHTML={{ __html: getSanitizedHtml() }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <span>Gerando preview...</span>
                  </div>
                ) : (
                  "O preview do email aparecerá aqui"
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-5 py-3 border-t border-border bg-muted/20">
        <p className="text-xs text-muted-foreground text-center">
          Quando quiser enviar, é só falar no chat que vou preparar o envio
        </p>
      </div>
    </div>
  );
}
