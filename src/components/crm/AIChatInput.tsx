import { useState, useRef, useEffect } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIChatInputProps {
  onSend?: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export function AIChatInput({ 
  onSend, 
  isLoading = false, 
  placeholder = "Digite sua mensagem aqui...",
  className 
}: AIChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
  }, [input]);

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSend?.(input.trim());
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasContent = input.trim() !== "";

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-[#1F2023] p-3 shadow-lg transition-all duration-300",
        isLoading && "border-orange-500/50",
        className
      )}
    >
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        rows={1}
        className={cn(
          "w-full bg-transparent text-white placeholder:text-gray-400",
          "resize-none border-none outline-none focus:ring-0",
          "text-base leading-relaxed min-h-[28px] max-h-[200px]",
          "scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
        )}
      />

      <div className="flex items-center justify-end pt-2">
        <button
          onClick={handleSubmit}
          disabled={!hasContent || isLoading}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200",
            hasContent && !isLoading
              ? "bg-white hover:bg-white/90 text-[#1F2023] cursor-pointer"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
