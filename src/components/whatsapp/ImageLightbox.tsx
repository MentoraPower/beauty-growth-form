import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type ImageLightboxProps = {
  images: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export default function ImageLightbox({ images, index, onClose, onPrev, onNext }: ImageLightboxProps) {
  const src = images[index];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (images.length > 1 && e.key === "ArrowLeft") onPrev();
      if (images.length > 1 && e.key === "ArrowRight") onNext();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [images.length, onClose, onNext, onPrev]);

  if (!src) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-foreground/90 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador de imagem"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 p-2 rounded-full bg-background/10 hover:bg-background/20 transition-colors"
        aria-label="Fechar imagem"
        type="button"
      >
        <X className="w-6 h-6 text-background" />
      </button>

      <div className="absolute top-4 left-4 text-background/80 text-sm">
        {index + 1} / {images.length}
      </div>

      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 p-3 rounded-full bg-background/10 hover:bg-background/20 transition-colors"
          aria-label="Imagem anterior"
          type="button"
        >
          <ChevronLeft className="w-8 h-8 text-background" />
        </button>
      )}

      <img
        src={src}
        alt="Imagem ampliada"
        className="max-w-[85vw] max-h-[85vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
        loading="eager"
      />

      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 p-3 rounded-full bg-background/10 hover:bg-background/20 transition-colors"
          aria-label="Próxima imagem"
          type="button"
        >
          <ChevronRight className="w-8 h-8 text-background" />
        </button>
      )}
    </div>,
    document.body
  );
}
