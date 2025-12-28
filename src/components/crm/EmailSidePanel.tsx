import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Code2, Eye, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface EditOperation {
  type: 'insert' | 'delete' | 'replace';
  startIndex: number;
  endIndex?: number;
  newText?: string;
}

interface EmailSidePanelProps {
  isOpen: boolean;
  htmlContent: string;
  onHtmlChange: (html: string) => void;
  isGenerating?: boolean;
  isEditing?: boolean;
  editOperation?: EditOperation | null;
  subject?: string;
  onSubjectChange?: (subject: string) => void;
}

// Syntax highlighting for HTML with dark purple for strings
const highlightHtml = (code: string, highlightRange?: { start: number; end: number }): React.ReactNode => {
  if (!code) return null;
  
  const parts: React.ReactNode[] = [];
  let remaining = code;
  let keyIndex = 0;
  let currentIndex = 0;

  while (remaining.length > 0) {
    let matched = false;

    // Check if we're in highlight range
    const isInHighlight = highlightRange && 
      currentIndex >= highlightRange.start && 
      currentIndex < highlightRange.end;

    // Comments
    const commentMatch = remaining.match(/^(<!--[\s\S]*?-->)/);
    if (commentMatch) {
      const content = <span key={keyIndex++} className={cn("text-muted-foreground italic", isInHighlight && "bg-primary/20 rounded")}>{commentMatch[1]}</span>;
      parts.push(content);
      currentIndex += commentMatch[1].length;
      remaining = remaining.slice(commentMatch[1].length);
      matched = true;
      continue;
    }

    // Opening/closing tags
    const tagMatch = remaining.match(/^(<\/?)([\w-]+)/);
    if (tagMatch) {
      parts.push(<span key={keyIndex++} className={cn("text-pink-500", isInHighlight && "bg-primary/20 rounded")}>{tagMatch[1]}</span>);
      parts.push(<span key={keyIndex++} className={cn("text-blue-500", isInHighlight && "bg-primary/20 rounded")}>{tagMatch[2]}</span>);
      currentIndex += tagMatch[0].length;
      remaining = remaining.slice(tagMatch[0].length);
      matched = true;
      continue;
    }

    // Attributes
    const attrMatch = remaining.match(/^(\s+)([\w-]+)(=)("([^"]*)")?/);
    if (attrMatch) {
      parts.push(<span key={keyIndex++} className={isInHighlight ? "bg-primary/20 rounded" : ""}>{attrMatch[1]}</span>);
      parts.push(<span key={keyIndex++} className={cn("text-orange-400", isInHighlight && "bg-primary/20 rounded")}>{attrMatch[2]}</span>);
      parts.push(<span key={keyIndex++} className={cn("text-foreground", isInHighlight && "bg-primary/20 rounded")}>{attrMatch[3]}</span>);
      if (attrMatch[4]) {
        parts.push(<span key={keyIndex++} className={cn("text-purple-600 dark:text-purple-400", isInHighlight && "bg-primary/20 rounded")}>{attrMatch[4]}</span>);
      }
      currentIndex += attrMatch[0].length;
      remaining = remaining.slice(attrMatch[0].length);
      matched = true;
      continue;
    }

    // Closing bracket
    const closeBracket = remaining.match(/^(\/?>)/);
    if (closeBracket) {
      parts.push(<span key={keyIndex++} className={cn("text-pink-500", isInHighlight && "bg-primary/20 rounded")}>{closeBracket[1]}</span>);
      currentIndex += closeBracket[1].length;
      remaining = remaining.slice(closeBracket[1].length);
      matched = true;
      continue;
    }

    // Text content
    const textMatch = remaining.match(/^([^<]+)/);
    if (textMatch) {
      parts.push(<span key={keyIndex++} className={cn("text-foreground", isInHighlight && "bg-primary/20 rounded")}>{textMatch[1]}</span>);
      currentIndex += textMatch[1].length;
      remaining = remaining.slice(textMatch[1].length);
      matched = true;
      continue;
    }

    // Fallback: single character
    if (!matched) {
      parts.push(<span key={keyIndex++} className={isInHighlight ? "bg-primary/20 rounded" : ""}>{remaining[0]}</span>);
      currentIndex += 1;
      remaining = remaining.slice(1);
    }
  }

  return parts;
};

// Calculate line number and position from character index
const getLineInfo = (text: string, charIndex: number): { line: number; lineStart: number } => {
  const lines = text.slice(0, charIndex).split('\n');
  const line = lines.length;
  const lineStart = charIndex - (lines[lines.length - 1]?.length || 0);
  return { line, lineStart };
};

export function EmailSidePanel({ 
  isOpen, 
  htmlContent, 
  onHtmlChange,
  isGenerating = false,
  isEditing = false,
  editOperation = null,
  subject = "",
  onSubjectChange
}: EmailSidePanelProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('preview');
  const [copied, setCopied] = useState(false);
  const [displayedContent, setDisplayedContent] = useState("");
  const [highlightRange, setHighlightRange] = useState<{ start: number; end: number } | undefined>();
  const [editingIndicator, setEditingIndicator] = useState<{ line: number; action: string } | null>(null);
  const [showPreviewLoading, setShowPreviewLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const displayedIndexRef = useRef(0);
  const previousContentRef = useRef("");
  const editAnimationRef = useRef<number | null>(null);
  const wasGeneratingRef = useRef(false);

  // Detect content changes and animate edits
  useEffect(() => {
    const prevContent = previousContentRef.current;
    const newContent = htmlContent;
    
    if (!prevContent || !newContent || isGenerating) {
      previousContentRef.current = newContent;
      return;
    }

    // Find the difference between old and new content
    const findDiff = () => {
      let startDiff = 0;
      let endDiffOld = prevContent.length;
      let endDiffNew = newContent.length;

      // Find start of difference
      while (startDiff < prevContent.length && startDiff < newContent.length && prevContent[startDiff] === newContent[startDiff]) {
        startDiff++;
      }

      // Find end of difference (from the back)
      while (endDiffOld > startDiff && endDiffNew > startDiff && prevContent[endDiffOld - 1] === newContent[endDiffNew - 1]) {
        endDiffOld--;
        endDiffNew--;
      }

      return { startDiff, endDiffOld, endDiffNew };
    };

    if (prevContent !== newContent && isEditing) {
      const { startDiff, endDiffOld, endDiffNew } = findDiff();
      const lineInfo = getLineInfo(newContent, startDiff);
      const oldPart = prevContent.slice(startDiff, endDiffOld);
      const newPart = newContent.slice(startDiff, endDiffNew);
      const isDeleting = oldPart.length > newPart.length;
      const isInserting = newPart.length > oldPart.length;
      
      // Determine action text
      let actionText = 'Editando...';
      if (isDeleting && newPart.length === 0) {
        actionText = 'Removendo...';
      } else if (isInserting && oldPart.length === 0) {
        actionText = 'Inserindo...';
      } else {
        actionText = 'Substituindo...';
      }
      
      // Show editing indicator
      setEditingIndicator({
        line: lineInfo.line,
        action: actionText
      });

      // Scroll to the edit position smoothly
      if (preRef.current) {
        const lineHeight = 18;
        const scrollTarget = (lineInfo.line - 5) * lineHeight;
        preRef.current.scrollTo({
          top: Math.max(0, scrollTarget),
          behavior: 'smooth'
        });
      }

      // Cancel any existing animation
      if (editAnimationRef.current) {
        cancelAnimationFrame(editAnimationRef.current);
      }

      const beforePart = prevContent.slice(0, startDiff);
      const afterPart = newContent.slice(endDiffNew);
      
      // Phase 1: If deleting, show deletion animation first
      if (isDeleting || (oldPart.length > 0 && newPart !== oldPart)) {
        let deleteIndex = oldPart.length;
        
        const animateDelete = () => {
          if (deleteIndex > 0) {
            deleteIndex = Math.max(0, deleteIndex - 3); // Delete 3 chars at a time
            const currentOldPart = oldPart.slice(0, deleteIndex);
            setDisplayedContent(beforePart + currentOldPart + afterPart);
            setHighlightRange({ 
              start: startDiff, 
              end: startDiff + deleteIndex 
            });
            editAnimationRef.current = requestAnimationFrame(() => {
              setTimeout(animateDelete, 12);
            });
          } else {
            // Phase 2: Now insert new content
            if (newPart.length > 0) {
              let insertIndex = 0;
              const animateInsert = () => {
                if (insertIndex <= newPart.length) {
                  const currentNewPart = newPart.slice(0, insertIndex);
                  setDisplayedContent(beforePart + currentNewPart + afterPart);
                  setHighlightRange({ 
                    start: startDiff, 
                    end: startDiff + insertIndex 
                  });
                  insertIndex += 2; // Insert 2 chars at a time
                  editAnimationRef.current = requestAnimationFrame(() => {
                    setTimeout(animateInsert, 10);
                  });
                } else {
                  finishAnimation();
                }
              };
              animateInsert();
            } else {
              finishAnimation();
            }
          }
        };
        
        animateDelete();
      } else {
        // Just inserting new content
        let insertIndex = 0;
        const animateInsert = () => {
          if (insertIndex <= newPart.length) {
            const currentNewPart = newPart.slice(0, insertIndex);
            setDisplayedContent(beforePart + currentNewPart + afterPart);
            setHighlightRange({ 
              start: startDiff, 
              end: startDiff + insertIndex 
            });
            insertIndex += 2;
            editAnimationRef.current = requestAnimationFrame(() => {
              setTimeout(animateInsert, 10);
            });
          } else {
            finishAnimation();
          }
        };
        animateInsert();
      }
      
      const finishAnimation = () => {
        setDisplayedContent(newContent);
        displayedIndexRef.current = newContent.length;
        
        // Keep highlight visible briefly then fade out
        setTimeout(() => {
          setHighlightRange(undefined);
          setEditingIndicator(null);
        }, 1000);
      };
    }

    previousContentRef.current = newContent;
  }, [htmlContent, isEditing, isGenerating]);

  // Typewriter effect for initial generation
  useEffect(() => {
    if (!isGenerating && !isEditing) {
      // When not generating/editing, show full content immediately
      setDisplayedContent(htmlContent);
      displayedIndexRef.current = htmlContent.length;
      return;
    }

    if (isGenerating) {
      // Typewriter animation during initial generation
      const targetLength = htmlContent.length;
      
      if (displayedIndexRef.current >= targetLength) return;

      const interval = setInterval(() => {
        const currentIndex = displayedIndexRef.current;
        const charsToAdd = Math.min(3, targetLength - currentIndex);
        
        if (charsToAdd > 0) {
          displayedIndexRef.current = currentIndex + charsToAdd;
          setDisplayedContent(htmlContent.slice(0, displayedIndexRef.current));
        }
        
        if (displayedIndexRef.current >= targetLength) {
          clearInterval(interval);
        }
      }, 10);

      return () => clearInterval(interval);
    }
  }, [htmlContent, isGenerating, isEditing]);

  // Handle tab switching: code during generation, then preview with loading
  useEffect(() => {
    if (isGenerating || isEditing) {
      setActiveTab('code');
      wasGeneratingRef.current = true;
    } else if (wasGeneratingRef.current && htmlContent) {
      // Generation/editing just finished - switch to preview with loading
      wasGeneratingRef.current = false;
      setShowPreviewLoading(true);
      setActiveTab('preview');
      
      // Show loading for a brief moment then reveal
      setTimeout(() => {
        setShowPreviewLoading(false);
      }, 800);
    }
  }, [isGenerating, isEditing, htmlContent]);

  // Auto-scroll during generation
  useEffect(() => {
    if (isGenerating && preRef.current && !isEditing) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [displayedContent, isGenerating, isEditing]);

  const handleCopy = () => {
    navigator.clipboard.writeText(htmlContent);
    setCopied(true);
    toast.success("HTML copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const getSanitizedHtml = () => {
    return htmlContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');
  };

  if (!isOpen) return null;

  return (
    <div className="w-[480px] flex-shrink-0 h-full bg-background flex flex-col my-4 mr-4 rounded-2xl border border-border overflow-hidden">
      {/* Subject Header */}
      <div className="px-5 py-3 border-b border-border bg-muted/30">
        <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Assunto</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => onSubjectChange?.(e.target.value)}
          placeholder={isGenerating ? "Gerando assunto..." : "Digite o assunto do email..."}
          className={cn(
            "w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none",
            isGenerating && "animate-pulse"
          )}
        />
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
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'code' ? (
          <div className="relative h-full w-full overflow-hidden">
            {/* Editing indicator overlay */}
            {editingIndicator && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-primary/90 text-primary-foreground px-4 py-2 rounded-full shadow-lg animate-fade-in">
                <div className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />
                <span className="text-xs font-medium">
                  Linha {editingIndicator.line}: {editingIndicator.action}
                </span>
              </div>
            )}

            {/* Highlighted code display */}
            <pre
              ref={preRef}
              className="absolute inset-0 p-5 font-mono text-xs leading-relaxed pointer-events-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-all"
              aria-hidden="true"
            >
              {displayedContent ? (
                <>
                  {highlightHtml(displayedContent, highlightRange)}
                  {(isGenerating || isEditing) && (
                    <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
                  )}
                </>
              ) : (
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
              className="absolute inset-0 w-full h-full p-5 font-mono text-xs leading-relaxed bg-transparent text-transparent caret-foreground resize-none focus:outline-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-all"
              spellCheck={false}
              placeholder=""
            />
            
          </div>
        ) : (
          <div className="h-full overflow-auto bg-white">
            {showPreviewLoading ? (
              // Skeleton loading state
              <div className="p-6 space-y-4 animate-pulse">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 text-muted-foreground text-sm">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    Carregando preview...
                  </div>
                </div>
                {/* Header skeleton */}
                <div className="h-8 bg-muted rounded-md w-3/4 mx-auto" />
                <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
                {/* Body skeleton */}
                <div className="space-y-3 mt-8">
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                  <div className="h-4 bg-muted rounded w-4/5" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                </div>
                {/* Button skeleton */}
                <div className="flex justify-center mt-8">
                  <div className="h-12 bg-muted rounded-lg w-48" />
                </div>
                {/* Footer skeleton */}
                <div className="mt-8 pt-4 border-t border-muted">
                  <div className="h-3 bg-muted rounded w-1/3 mx-auto" />
                </div>
              </div>
            ) : htmlContent ? (
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
