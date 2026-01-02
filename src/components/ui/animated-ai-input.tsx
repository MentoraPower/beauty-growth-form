"use client";

import { ArrowRight, Check, ChevronDown, Paperclip } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;

      const newHeight = Math.max(
        minHeight,
        Math.min(
          textarea.scrollHeight,
          maxHeight ?? Number.POSITIVE_INFINITY
        )
      );

      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

// OpenAI Icon
const OPENAI_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="openai-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10a37f" />
        <stop offset="100%" stopColor="#1a7f64" />
      </linearGradient>
    </defs>
    <path
      d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4066-.6813zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.5056-2.6099-1.5056z"
      fill="url(#openai-gradient)"
    />
  </svg>
);

// Grok/xAI Icon
const GROK_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export type AIModel = "ChatGPT" | "Grok" | "Copywriting";

interface AnimatedAIInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string, model: AIModel) => void;
  onFileSelect?: (file: File) => void;
  placeholder?: string;
  isLoading?: boolean;
  disabled?: boolean;
  selectedModel?: AIModel;
  onModelChange?: (model: AIModel) => void;
  showHeader?: boolean;
  headerText?: string;
  className?: string;
}

const AI_MODELS: AIModel[] = ["ChatGPT", "Grok", "Copywriting"];

const MODEL_ICONS: Record<AIModel, React.ReactNode> = {
  "ChatGPT": OPENAI_ICON,
  "Grok": GROK_ICON,
  "Copywriting": OPENAI_ICON,
};

export function AnimatedAIInput({
  value: controlledValue,
  onChange,
  onSubmit,
  onFileSelect,
  placeholder = "Digite sua mensagem aqui...",
  isLoading = false,
  disabled = false,
  selectedModel: controlledModel,
  onModelChange,
  showHeader = true,
  headerText = "Ask Scale to create",
  className,
}: AnimatedAIInputProps) {
  const [internalValue, setInternalValue] = useState("");
  const value = controlledValue ?? internalValue;
  
  const [internalModel, setInternalModel] = useState<AIModel>(() => {
    const saved = localStorage.getItem('disparo-selected-model');
    if (saved === 'grok') return 'Grok';
    if (saved === 'copywriting') return 'Copywriting';
    return 'ChatGPT';
  });
  const selectedModel = controlledModel ?? internalModel;

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 72,
    maxHeight: 300,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleValueChange = (newValue: string) => {
    if (onChange) {
      onChange(newValue);
    } else {
      setInternalValue(newValue);
    }
  };

  const handleModelChange = (model: AIModel) => {
    // Persist to localStorage
    const storageValue = model === 'Grok' ? 'grok' : model === 'Copywriting' ? 'copywriting' : 'gpt';
    localStorage.setItem('disparo-selected-model', storageValue);
    
    if (onModelChange) {
      onModelChange(model);
    } else {
      setInternalModel(model);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && value.trim() && !isLoading && !disabled) {
      e.preventDefault();
      onSubmit?.(value.trim(), selectedModel);
      handleValueChange("");
      adjustHeight(true);
    }
  };

  const handleSubmit = () => {
    if (!value.trim() || isLoading || disabled) return;
    onSubmit?.(value.trim(), selectedModel);
    handleValueChange("");
    adjustHeight(true);
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect?.(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="w-full">
        <div className="relative rounded-xl overflow-hidden bg-zinc-900" style={{ border: '1px solid #ffffff10' }}>
          {/* Header */}
          {showHeader && (
            <div 
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800"
              style={{ borderBottom: '1px solid #ffffff10' }}
            >
              <span className="text-sm text-zinc-400">{headerText}</span>
            </div>
          )}

          {/* Textarea Area */}
          <div className="relative bg-zinc-900">
            <textarea
              ref={textareaRef}
              value={value}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              className={cn(
                "w-full bg-transparent text-white placeholder:text-zinc-500",
                "resize-none border-none outline-none focus:ring-0",
                "text-base leading-relaxed px-4 py-3",
                "min-h-[72px] max-h-[300px]",
                "scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-transparent"
              )}
              onKeyDown={handleKeyDown}
              onChange={(e) => {
                handleValueChange(e.target.value);
                adjustHeight();
              }}
            />
          </div>

          {/* Bottom Actions Bar */}
          <div 
            className="h-14 bg-zinc-800 flex items-center px-3"
            style={{ borderTop: '1px solid #ffffff10' }}
          >
            <div className="flex items-center justify-between w-full">
              {/* Left side - Model selector and file upload */}
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-1 h-8 pl-1.5 pr-2 text-xs rounded-md text-zinc-300 hover:bg-zinc-700/50 focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-zinc-500"
                    >
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={selectedModel}
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center gap-1.5"
                        >
                          {MODEL_ICONS[selectedModel]}
                          <span>{selectedModel}</span>
                          <ChevronDown className="w-3 h-3 opacity-50" />
                        </motion.div>
                      </AnimatePresence>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className={cn(
                      "min-w-[10rem]",
                      "border-zinc-200",
                      "bg-white"
                    )}
                  >
                    {AI_MODELS.map((model) => (
                      <DropdownMenuItem
                        key={model}
                        onSelect={() => handleModelChange(model)}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          {MODEL_ICONS[model]}
                          <span>{model}</span>
                        </div>
                        {selectedModel === model && (
                          <Check className="w-4 h-4 text-emerald-500" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="h-4 w-px bg-zinc-600 mx-0.5" />

                <button
                  type="button"
                  onClick={handleFileClick}
                  className={cn(
                    "rounded-lg p-2 bg-zinc-700 cursor-pointer",
                    "hover:bg-zinc-600 transition-colors",
                    "text-zinc-400 hover:text-zinc-200"
                  )}
                  aria-label="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".csv,image/*"
                  onChange={handleFileChange}
                />
              </div>

              {/* Right side - Send button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!value.trim() || isLoading || disabled}
                className={cn(
                  "rounded-lg p-2 transition-all",
                  value.trim() && !isLoading && !disabled
                    ? "bg-white hover:bg-zinc-100 text-zinc-900 cursor-pointer"
                    : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                )}
                aria-label="Send message"
              >
                <ArrowRight
                  className={cn(
                    "w-4 h-4 transition-opacity duration-200",
                    value.trim() ? "opacity-100" : "opacity-50"
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
