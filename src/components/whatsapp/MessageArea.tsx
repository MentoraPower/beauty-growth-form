import { memo, RefObject } from "react";
import { Message, getDateLabel, getMessageDateKey } from "@/hooks/useWhatsAppMessages";
import { MessageBubble } from "./MessageBubble";

interface MessageAreaProps {
  messages: Message[];
  visibleMessages: Message[];
  allImages: string[];
  isLoadingMessages: boolean;
  messagesContainerRef: RefObject<HTMLDivElement>;
  messageMenuId: string | null;
  onMessageMenuChange: (id: string | null) => void;
  onReplyMessage: (msg: Message) => void;
  onEditMessage: (msg: Message) => void;
  onDeleteMessage: (msg: Message) => void;
  onReactMessage?: (msg: Message, emoji: string) => void;
  onScrollToQuoted: (quotedMessageId: string) => void;
  onImageClick: (index: number) => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  isGroupChat?: boolean;
  participantPhotos?: Record<string, string>;
}

// Loading skeleton
const MessagesSkeleton = memo(function MessagesSkeleton() {
  return (
    <div className="flex flex-col justify-end h-full gap-2 pb-2">
      <div className="flex justify-start">
        <div className="w-[45%] h-12 bg-black/[0.04] dark:bg-white/[0.08] rounded-lg rounded-tl-none animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="w-[55%] h-16 bg-sky-100 dark:bg-sky-900/40 rounded-lg rounded-tr-none animate-pulse" />
      </div>
      <div className="flex justify-start">
        <div className="w-[40%] h-10 bg-black/[0.04] dark:bg-white/[0.08] rounded-lg rounded-tl-none animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="w-[50%] h-14 bg-sky-100 dark:bg-sky-900/40 rounded-lg rounded-tr-none animate-pulse" />
      </div>
    </div>
  );
});

// Date separator
const DateSeparator = memo(function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <div className="flex items-center gap-3 w-full max-w-[280px]">
        <div className="flex-1 h-px bg-muted-foreground/20" />
        <span className="text-xs text-muted-foreground bg-muted/40 px-3 py-1 rounded-full font-medium">
          {getDateLabel(date)}
        </span>
        <div className="flex-1 h-px bg-muted-foreground/20" />
      </div>
    </div>
  );
});

// System message (join/leave notifications) - WhatsApp style
const SystemMessage = memo(function SystemMessage({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center my-1">
      <span className="text-[11px] text-muted-foreground/50 text-center leading-relaxed">
        {text}
      </span>
    </div>
  );
});

// Empty state
const EmptyMessages = memo(function EmptyMessages() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">Nenhuma mensagem</p>
    </div>
  );
});

// Background pattern style
const BACKGROUND_STYLE = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000' fill-opacity='0.02'%3E%3Ccircle cx='10' cy='10' r='1'/%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3Ccircle cx='50' cy='10' r='1'/%3E%3Ccircle cx='70' cy='30' r='1'/%3E%3Ccircle cx='90' cy='10' r='1'/%3E%3Ccircle cx='10' cy='50' r='1'/%3E%3Ccircle cx='30' cy='70' r='1'/%3E%3Ccircle cx='50' cy='50' r='1'/%3E%3Ccircle cx='70' cy='70' r='1'/%3E%3Ccircle cx='90' cy='50' r='1'/%3E%3Ccircle cx='10' cy='90' r='1'/%3E%3Ccircle cx='50' cy='90' r='1'/%3E%3Ccircle cx='90' cy='90' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
  backgroundColor: "hsl(var(--muted) / 0.1)",
};

export const MessageArea = memo(function MessageArea({
  messages,
  visibleMessages,
  allImages,
  isLoadingMessages,
  messagesContainerRef,
  messageMenuId,
  onMessageMenuChange,
  onReplyMessage,
  onEditMessage,
  onDeleteMessage,
  onReactMessage,
  onScrollToQuoted,
  onImageClick,
  scrollToBottom,
  isGroupChat,
  participantPhotos,
}: MessageAreaProps) {
  // Render messages with date separators
  const renderMessages = () => {
    let lastDateKey = "";
    
    return visibleMessages.map((msg) => {
      const currentDateKey = msg.created_at ? getMessageDateKey(msg.created_at) : "";
      const showDateSeparator = currentDateKey && currentDateKey !== lastDateKey;
      if (currentDateKey) lastDateKey = currentDateKey;
      
      // System messages (join/leave) - render as centered small text
      if (msg.mediaType === "system") {
        return (
          <div key={msg.id}>
            {showDateSeparator && msg.created_at && (
              <DateSeparator date={msg.created_at} />
            )}
            <SystemMessage text={msg.text} />
          </div>
        );
      }
      
      return (
        <div key={msg.id}>
          {showDateSeparator && msg.created_at && (
            <DateSeparator date={msg.created_at} />
          )}
          <MessageBubble
            msg={msg}
            messages={messages}
            allImages={allImages}
            messageMenuId={messageMenuId}
            onMessageMenuChange={onMessageMenuChange}
            onReplyMessage={onReplyMessage}
            onEditMessage={onEditMessage}
            onDeleteMessage={onDeleteMessage}
            onReactMessage={onReactMessage}
            onScrollToQuoted={onScrollToQuoted}
            onImageClick={onImageClick}
            scrollToBottom={scrollToBottom}
            isGroupChat={isGroupChat}
            participantPhotos={participantPhotos}
          />
        </div>
      );
    });
  };

  return (
    <div
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto px-2 py-3 space-y-1.5 min-h-0 min-w-0 bg-muted/10 dark:bg-zinc-950"
      style={{ backgroundImage: BACKGROUND_STYLE.backgroundImage }}
    >
      {isLoadingMessages ? (
        <MessagesSkeleton />
      ) : visibleMessages.length === 0 ? (
        <EmptyMessages />
      ) : (
        renderMessages()
      )}
    </div>
  );
});
