import { useState, useRef, useCallback, useEffect } from "react";

interface ResizableWidgetProps {
  children: React.ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  onResize?: (width: number, height: number) => void;
  onResizing?: (isResizing: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function ResizableWidget({
  children,
  initialWidth = 280,
  initialHeight = 180,
  minWidth = 200,
  minHeight = 140,
  maxWidth = 600,
  maxHeight = 500,
  onResize,
  onResizing,
  className = "",
  style = {},
}: ResizableWidgetProps) {
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });

  // Sync with external width changes
  useEffect(() => {
    setSize(prev => ({ ...prev, width: initialWidth, height: initialHeight }));
  }, [initialWidth, initialHeight]);

  const handleMouseDown = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    onResizing?.(true);
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { width: size.width, height: size.height };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startPos.current.x;
      const deltaY = moveEvent.clientY - startPos.current.y;

      let newWidth = startSize.current.width;
      let newHeight = startSize.current.height;

      if (direction.includes('e')) {
        newWidth = Math.min(maxWidth, Math.max(minWidth, startSize.current.width + deltaX));
      }
      if (direction.includes('s')) {
        newHeight = Math.min(maxHeight, Math.max(minHeight, startSize.current.height + deltaY));
      }
      if (direction.includes('w')) {
        newWidth = Math.min(maxWidth, Math.max(minWidth, startSize.current.width - deltaX));
      }
      if (direction.includes('n')) {
        newHeight = Math.min(maxHeight, Math.max(minHeight, startSize.current.height - deltaY));
      }

      setSize({ width: newWidth, height: newHeight });
      onResize?.(newWidth, newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      onResizing?.(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [size, minWidth, minHeight, maxWidth, maxHeight, onResize, onResizing]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className} ${isResizing ? 'select-none' : ''}`}
      style={{ 
        ...style,
        width: size.width, 
        height: size.height,
        flexShrink: 0,
      }}
    >
      {children}

      {/* Resize handles */}
      {/* Right edge */}
      <div
        className="absolute top-2 bottom-2 right-0 w-2 cursor-e-resize group z-20"
        onMouseDown={(e) => handleMouseDown(e, 'e')}
      >
        <div className="absolute top-1/2 right-0.5 -translate-y-1/2 w-1 h-8 rounded-full bg-border opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Bottom edge */}
      <div
        className="absolute left-2 right-2 bottom-0 h-2 cursor-s-resize group z-20"
        onMouseDown={(e) => handleMouseDown(e, 's')}
      >
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full bg-border opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Bottom-right corner */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group z-30"
        onMouseDown={(e) => handleMouseDown(e, 'se')}
      >
        <svg 
          className="absolute bottom-1 right-1 w-2.5 h-2.5 text-border opacity-0 group-hover:opacity-100 transition-opacity"
          viewBox="0 0 10 10"
        >
          <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
