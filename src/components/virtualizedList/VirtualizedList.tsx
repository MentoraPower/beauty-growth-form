/**
 * Virtualized List Component
 * High-performance list rendering for large datasets
 */

import { useRef, memo, ReactNode, useCallback, useMemo } from 'react';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

interface VirtualizedListProps<T> {
  items: T[];
  estimateSize: number | ((index: number) => number);
  renderItem: (item: T, index: number, virtualItem: VirtualItem) => ReactNode;
  keyExtractor: (item: T, index: number) => string;
  className?: string;
  overscan?: number;
  horizontal?: boolean;
  gap?: number;
  paddingStart?: number;
  paddingEnd?: number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

function VirtualizedListInner<T>({
  items,
  estimateSize,
  renderItem,
  keyExtractor,
  className,
  overscan = 5,
  horizontal = false,
  gap = 0,
  paddingStart = 0,
  paddingEnd = 0,
  onEndReached,
  endReachedThreshold = 200,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const endReachedCalledRef = useRef(false);

  const estimateSizeFn = useMemo(() => {
    if (typeof estimateSize === 'function') {
      return estimateSize;
    }
    return () => estimateSize;
  }, [estimateSize]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateSizeFn,
    overscan,
    horizontal,
    paddingStart,
    paddingEnd,
    gap,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Handle end reached callback
  const handleScroll = useCallback(() => {
    if (!onEndReached || !parentRef.current) return;

    const scrollElement = parentRef.current;
    const { scrollTop, scrollHeight, clientHeight } = scrollElement;
    const distanceFromEnd = scrollHeight - scrollTop - clientHeight;

    if (distanceFromEnd <= endReachedThreshold && !endReachedCalledRef.current) {
      endReachedCalledRef.current = true;
      onEndReached();
      // Reset after a short delay to allow for loading
      setTimeout(() => {
        endReachedCalledRef.current = false;
      }, 1000);
    }
  }, [onEndReached, endReachedThreshold]);

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      onScroll={handleScroll}
    >
      <div
        style={{
          [horizontal ? 'width' : 'height']: `${virtualizer.getTotalSize()}px`,
          [horizontal ? 'height' : 'width']: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          const key = keyExtractor(item, virtualItem.index);

          return (
            <div
              key={key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                [horizontal ? 'width' : 'height']: `${virtualItem.size}px`,
                transform: horizontal
                  ? `translateX(${virtualItem.start}px)`
                  : `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index, virtualItem)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const VirtualizedList = memo(VirtualizedListInner) as typeof VirtualizedListInner;

// Specialized version for messages
interface VirtualizedMessagesProps<T> {
  messages: T[];
  renderMessage: (message: T, index: number) => ReactNode;
  keyExtractor: (message: T, index: number) => string;
  className?: string;
  scrollToBottom?: boolean;
}

function VirtualizedMessagesInner<T>({
  messages,
  renderMessage,
  keyExtractor,
  className,
  scrollToBottom = true,
}: VirtualizedMessagesProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated message height
    overscan: 10,
    getItemKey: (index) => keyExtractor(messages[index], index),
  });

  // Scroll to bottom on new messages
  const prevCountRef = useRef(messages.length);
  if (scrollToBottom && messages.length > prevCountRef.current) {
    setTimeout(() => {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
    }, 0);
  }
  prevCountRef.current = messages.length;

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className={cn('overflow-auto', className)}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const message = messages[virtualItem.index];
          const key = keyExtractor(message, virtualItem.index);

          return (
            <div
              key={key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderMessage(message, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const VirtualizedMessages = memo(VirtualizedMessagesInner) as typeof VirtualizedMessagesInner;

export default VirtualizedList;
