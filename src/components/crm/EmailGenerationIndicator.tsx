import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, FileCode, ChevronUp, ChevronDown, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailGenerationIndicatorProps {
  isGenerating: boolean;
  isComplete: boolean;
  isEditing?: boolean;
  onTogglePanel: () => void;
  isPanelOpen: boolean;
}

export function EmailGenerationIndicator({
  isGenerating,
  isComplete,
  isEditing = false,
  onTogglePanel,
  isPanelOpen,
}: EmailGenerationIndicatorProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  const getStatusText = () => {
    if (isGenerating && isEditing) return "Editando email";
    if (isGenerating) return "Criando email personalizado";
    return "Email pronto";
  };

  const getFileText = () => {
    if (isGenerating && isEditing) return "Editando";
    if (isGenerating) return "Gerando";
    return "Criado";
  };

  return (
    <div className="w-full max-w-md">
      <div 
        className="bg-muted/30 border border-border rounded-xl overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onTogglePanel}
      >
        {/* Main header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center transition-colors",
            isComplete ? "bg-primary/20" : "bg-muted"
          )}>
            {isComplete ? (
              <Check className="w-3 h-3 text-primary" />
            ) : isEditing ? (
              <Pencil className="w-3 h-3 text-primary animate-pulse" />
            ) : (
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          <span className="flex-1 text-sm font-medium text-foreground">
            {getStatusText()}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Expandable content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 pl-12">
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <FileCode className="w-3.5 h-3.5" />
                  <span className={cn(
                    isGenerating && "animate-pulse"
                  )}>
                    {getFileText()} <code className="text-primary/80 font-mono">email_template.html</code>
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hint text */}
      <p className="text-xs text-muted-foreground mt-2 ml-1">
        {isPanelOpen ? "Clique para fechar o editor" : "Clique para abrir o editor"}
      </p>
    </div>
  );
}
