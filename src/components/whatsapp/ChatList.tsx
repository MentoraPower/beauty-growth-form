/**
 * Optimized Chat List Component
 * Uses virtualization and Zustand selectors for maximum performance
 */

import { memo, useCallback, useMemo, useRef } from 'react';
import { VirtualizedList } from '@/components/virtualizedList';
import { useSortedConversations, useRealtimeActions } from '@/hooks/useRealtimeSelectors';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { VirtualItem } from '@tanstack/react-virtual';

interface ChatListProps {
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  className?: string;
}

interface ChatItemData {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
  photoUrl: string | null;
  phone: string;
  lastMessageStatus: string | null;
  lastMessageFromMe: boolean;
}

const DEFAULT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMTIgMjEyIj48cGF0aCBmaWxsPSIjREZFNUU3IiBkPSJNMCAwaDIxMnYyMTJIMHoiLz48cGF0aCBmaWxsPSIjRkZGIiBkPSJNMTA2IDEwNmMtMjUuNCAwLTQ2LTIwLjYtNDYtNDZzMjAuNi00NiA0Ni00NiA0NiAyMC42IDQ2IDQ2LTIwLjYgNDYtNDYgNDZ6bTAgMTNjMzAuNiAwIDkyIDE1LjQgOTIgNDZ2MjNIMTR2LTIzYzAtMzAuNiA2MS40LTQ2IDkyLTQ2eiIvPjwvc3ZnPg==";

const getInitials = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  
  const spOptions = { timeZone: "America/Sao_Paulo" };
  const dateInSP = new Date(date.toLocaleString("en-US", spOptions));
  const nowInSP = new Date(now.toLocaleString("en-US", spOptions));
  
  const diffDays = Math.floor((nowInSP.getTime() - dateInSP.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  } else if (diffDays === 1) {
    return "Ontem";
  } else {
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  }
};

const isViewedStatus = (status: string | null) => status === "READ" || status === "PLAYED";

// Memoized chat item component
const ChatItem = memo(function ChatItem({
  chat,
  isSelected,
  onSelect,
}: {
  chat: ChatItemData;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const renderStatusIcon = useCallback(() => {
    if (!chat.lastMessageFromMe) return null;
    
    const status = chat.lastMessageStatus;
    if (isViewedStatus(status)) {
      return <CheckCheck className="h-4 w-4 text-[#53BDEB] flex-shrink-0" />;
    } else if (status === "DELIVERED") {
      return <CheckCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
    } else if (status === "SENT") {
      return <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
    }
    return null;
  }, [chat.lastMessageFromMe, chat.lastMessageStatus]);

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 p-3 cursor-pointer transition-colors border-b border-border/40",
        isSelected 
          ? "bg-muted" 
          : "hover:bg-muted/50"
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {chat.photoUrl ? (
          <img
            src={chat.photoUrl}
            alt={chat.name}
            className="w-12 h-12 rounded-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={cn(
          "w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground",
          chat.photoUrl && "hidden"
        )}>
          {getInitials(chat.name)}
        </div>
        
        {/* Unread badge */}
        {chat.unreadCount > 0 && (
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">
              {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "font-medium text-sm truncate",
            chat.unreadCount > 0 ? "text-foreground" : "text-foreground/90"
          )}>
            {chat.name}
          </span>
          <span className={cn(
            "text-xs flex-shrink-0",
            chat.unreadCount > 0 ? "text-[#25D366] font-medium" : "text-muted-foreground"
          )}>
            {chat.time}
          </span>
        </div>
        
        <div className="flex items-center gap-1 mt-0.5">
          {renderStatusIcon()}
          <span className={cn(
            "text-xs truncate",
            chat.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
          )}>
            {chat.lastMessage || "Nenhuma mensagem"}
          </span>
        </div>
      </div>
    </div>
  );
});

export const ChatList = memo(function ChatList({
  selectedChatId,
  onSelectChat,
  searchQuery,
  onSearchChange,
  className,
}: ChatListProps) {
  const conversations = useSortedConversations();
  const containerRef = useRef<HTMLDivElement>(null);

  // Transform conversations to chat items
  const chatItems = useMemo(() => {
    return conversations.map((conv): ChatItemData => ({
      id: conv.id,
      name: conv.name || conv.phone,
      lastMessage: conv.last_message || '',
      time: conv.last_message_time ? formatTime(conv.last_message_time) : '',
      unreadCount: conv.unread_count || 0,
      photoUrl: conv.photo_url,
      phone: conv.phone,
      lastMessageStatus: conv.last_message_status || null,
      lastMessageFromMe: conv.last_message_from_me || false,
    }));
  }, [conversations]);

  // Filter by search query
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chatItems;
    
    const query = searchQuery.toLowerCase();
    return chatItems.filter(chat => 
      chat.name.toLowerCase().includes(query) ||
      chat.phone.includes(query) ||
      chat.lastMessage.toLowerCase().includes(query)
    );
  }, [chatItems, searchQuery]);

  const renderItem = useCallback((chat: ChatItemData, index: number, virtualItem: VirtualItem) => (
    <ChatItem
      chat={chat}
      isSelected={chat.id === selectedChatId}
      onSelect={() => onSelectChat(chat.id)}
    />
  ), [selectedChatId, onSelectChat]);

  const keyExtractor = useCallback((chat: ChatItemData) => chat.id, []);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-muted border-0"
          />
        </div>
      </div>

      {/* Virtualized list */}
      <div ref={containerRef} className="flex-1 overflow-hidden">
        {filteredChats.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {searchQuery ? "Nenhuma conversa encontrada" : "Nenhuma conversa"}
          </div>
        ) : (
          <VirtualizedList
            items={filteredChats}
            estimateSize={73}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            className="h-full"
            overscan={10}
          />
        )}
      </div>
    </div>
  );
});

export default ChatList;
