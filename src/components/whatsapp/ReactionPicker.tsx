import { memo } from "react";
import { cn } from "@/lib/utils";

const COMMON_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position?: "left" | "right";
}

export const ReactionPicker = memo(function ReactionPicker({
  onSelect,
  onClose,
  position = "right",
}: ReactionPickerProps) {
  return (
    <div
      className={cn(
        "absolute bottom-full mb-2 flex items-center gap-1 bg-card border border-border rounded-full px-2 py-1.5 shadow-lg z-50",
        position === "right" ? "right-0" : "left-0"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {COMMON_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          className="w-8 h-8 flex items-center justify-center text-lg hover:bg-muted rounded-full transition-colors hover:scale-110"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
});
