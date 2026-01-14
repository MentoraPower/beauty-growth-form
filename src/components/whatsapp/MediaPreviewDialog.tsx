import { memo, useState, useRef, useEffect } from "react";
import { X, Send, Image, FileVideo } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

interface MediaPreviewDialogProps {
  file: File | null;
  type: "image" | "video";
  onSend: (caption: string) => void;
  onCancel: () => void;
  isSending: boolean;
}

export const MediaPreviewDialog = memo(function MediaPreviewDialog({
  file,
  type,
  onSend,
  onCancel,
  isSending,
}: MediaPreviewDialogProps) {
  const [caption, setCaption] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  useEffect(() => {
    // Focus textarea when dialog opens
    if (file && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [file]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend(caption);
    }
    if (e.key === "Escape") {
      onCancel();
    }
  };

  if (!file || !previewUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative flex flex-col max-w-2xl w-full max-h-[90vh] mx-4 bg-zinc-900 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-white">
            {type === "image" ? (
              <Image className="w-5 h-5 text-emerald-400" />
            ) : (
              <FileVideo className="w-5 h-5 text-emerald-400" />
            )}
            <span className="font-medium">
              {type === "image" ? "Enviar imagem" : "Enviar vídeo"}
            </span>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            disabled={isSending}
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Preview */}
        <div className="flex-1 flex items-center justify-center p-4 min-h-0 overflow-hidden bg-black/40">
          {type === "image" ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-full max-h-[50vh] object-contain rounded-lg"
            />
          ) : (
            <video
              src={previewUrl}
              controls
              className="max-w-full max-h-[50vh] rounded-lg"
            />
          )}
        </div>

        {/* Caption Input */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-end gap-3">
            <Textarea
              ref={textareaRef}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Adicione uma legenda..."
              className="flex-1 min-h-[44px] max-h-[120px] resize-none bg-white/10 border-0 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-emerald-500/50 rounded-xl px-4 py-3"
              disabled={isSending}
            />
            <button
              onClick={() => onSend(caption)}
              disabled={isSending}
              className={cn(
                "flex items-center justify-center w-11 h-11 rounded-full transition-all",
                isSending
                  ? "bg-emerald-500/50 cursor-not-allowed"
                  : "bg-emerald-500 hover:bg-emerald-600"
              )}
            >
              <Send className={cn("w-5 h-5 text-white", isSending && "animate-pulse")} />
            </button>
          </div>
          <p className="text-xs text-white/40 mt-2 text-center">
            Pressione Enter para enviar • Shift+Enter para nova linha
          </p>
        </div>
      </div>
    </div>
  );
});
