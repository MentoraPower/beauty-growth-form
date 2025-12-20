/**
 * Optimized Message List Component
 * Uses virtualization for high-performance message rendering
 */

import { memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { VirtualizedMessages } from '@/components/virtualizedList';
import { useMessagesByChatId } from '@/hooks/useRealtimeSelectors';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock } from 'lucide-react';
import { AudioWaveform } from './AudioWaveform';
import { formatWhatsAppText } from '@/lib/whatsapp-format';

interface MessageListProps {
  chatId: string;
  onQuoteMessage?: (messageId: string, text: string, fromMe: boolean) => void;
  onImageClick?: (imageUrl: string) => void;
  className?: string;
}

interface MessageData {
  id: string;
  text: string;
  time: string;
  fromMe: boolean;
  status: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  createdAt: string;
  messageId: string | null;
  quotedMessageId: string | null;
  quotedText: string | null;
  quotedFromMe: boolean | null;
}

const isViewedStatus = (status: string | null) => status === "READ" || status === "PLAYED";
const isOutgoingStatus = (status: string | null) =>
  status === "SENDING" || status === "SENT" || status === "DELIVERED" || isViewedStatus(status);

const formatMessageTime = (dateString: string): string => {
  return new Date(dateString).toLocaleTimeString("pt-BR", { 
    hour: "2-digit", 
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  });
};

const getDateLabel = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  
  const spOptions = { timeZone: "America/Sao_Paulo" };
  const dateInSP = new Date(date.toLocaleString("en-US", spOptions));
  const nowInSP = new Date(now.toLocaleString("en-US", spOptions));
  
  const dateOnly = new Date(dateInSP.getFullYear(), dateInSP.getMonth(), dateInSP.getDate());
  const nowOnly = new Date(nowInSP.getFullYear(), nowInSP.getMonth(), nowInSP.getDate());
  
  const diffDays = Math.floor((nowOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) {
    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    return dayNames[dateInSP.getDay()];
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
};

const getMessageDateKey = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" });
};

// Status icon component
const StatusIcon = memo(function StatusIcon({ status }: { status: string | null }) {
  if (status === "SENDING") {
    return <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />;
  }
  if (isViewedStatus(status)) {
    return <CheckCheck className="h-3.5 w-3.5 text-[#53BDEB]" />;
  }
  if (status === "DELIVERED") {
    return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground/70" />;
  }
  if (status === "SENT") {
    return <Check className="h-3.5 w-3.5 text-muted-foreground/70" />;
  }
  return null;
});

// Single message component
const MessageBubble = memo(function MessageBubble({
  message,
  onQuote,
  onImageClick,
}: {
  message: MessageData;
  onQuote?: () => void;
  onImageClick?: () => void;
}) {
  const isMedia = message.mediaUrl && message.mediaType;
  const isImage = message.mediaType?.startsWith('image');
  const isVideo = message.mediaType?.startsWith('video');
  const isAudio = message.mediaType?.includes('audio') || message.mediaType?.includes('ptt');

  return (
    <div
      data-message-id={message.messageId}
      className={cn(
        "flex w-full mb-1",
        message.fromMe ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3 py-2 relative group",
          message.fromMe
            ? "bg-[#005C4B] text-white rounded-tr-sm"
            : "bg-[#202C33] text-white rounded-tl-sm"
        )}
      >
        {/* Quoted message */}
        {message.quotedText && (
          <div className={cn(
            "mb-2 p-2 rounded-lg border-l-4 text-sm",
            message.quotedFromMe
              ? "bg-[#004D40] border-[#25D366]"
              : "bg-[#1A2328] border-[#8696A0]"
          )}>
            <p className="text-xs text-[#8696A0] mb-0.5">
              {message.quotedFromMe ? "Você" : "Contato"}
            </p>
            <p className="text-white/80 line-clamp-2">{message.quotedText}</p>
          </div>
        )}

        {/* Media content */}
        {isMedia && (
          <div className="mb-1">
            {isImage && (
              <img
                src={message.mediaUrl!}
                alt="Image"
                className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={onImageClick}
                loading="lazy"
              />
            )}
            {isVideo && (
              <video
                src={message.mediaUrl!}
                controls
                className="max-w-full rounded-lg"
                preload="metadata"
              />
            )}
            {isAudio && (
              <AudioWaveform
                src={message.mediaUrl!}
                sent={message.fromMe}
              />
            )}
          </div>
        )}

        {/* Text content */}
        {message.text && (
          <div 
            className="text-sm whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: formatWhatsAppText(message.text) }}
          />
        )}

        {/* Time and status */}
        <div className={cn(
          "flex items-center gap-1 mt-1",
          message.fromMe ? "justify-end" : "justify-start"
        )}>
          <span className="text-[10px] text-white/60">{message.time}</span>
          {message.fromMe && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
});

// Date separator component
const DateSeparator = memo(function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-3">
      <span className="px-3 py-1 text-xs text-white/70 bg-[#1F2C33] rounded-lg">
        {label}
      </span>
    </div>
  );
});

export const MessageList = memo(function MessageList({
  chatId,
  onQuoteMessage,
  onImageClick,
  className,
}: MessageListProps) {
  const messages = useMessagesByChatId(chatId);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMessagesCountRef = useRef(0);

  // Transform store messages to display format
  const messageItems = useMemo(() => {
    return messages.map((msg): MessageData => ({
      id: msg.id,
      text: msg.text || '',
      time: msg.created_at ? formatMessageTime(msg.created_at) : '',
      fromMe: msg.from_me || false,
      status: msg.status,
      mediaUrl: msg.media_url,
      mediaType: msg.media_type,
      createdAt: msg.created_at,
      messageId: msg.message_id,
      quotedMessageId: msg.quoted_message_id,
      quotedText: msg.quoted_text,
      quotedFromMe: msg.quoted_from_me,
    }));
  }, [messages]);

  // Group messages by date
  const messagesWithDates = useMemo(() => {
    const result: Array<{ type: 'date'; label: string; key: string } | { type: 'message'; data: MessageData }> = [];
    let lastDateKey = '';

    messageItems.forEach((msg) => {
      if (msg.createdAt) {
        const dateKey = getMessageDateKey(msg.createdAt);
        if (dateKey !== lastDateKey) {
          result.push({ type: 'date', label: getDateLabel(msg.createdAt), key: dateKey });
          lastDateKey = dateKey;
        }
      }
      result.push({ type: 'message', data: msg });
    });

    return result;
  }, [messageItems]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesWithDates.length > prevMessagesCountRef.current) {
      const container = containerRef.current;
      if (container) {
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
        }, 50);
      }
    }
    prevMessagesCountRef.current = messagesWithDates.length;
  }, [messagesWithDates.length]);

  const renderMessage = useCallback((item: typeof messagesWithDates[0], index: number) => {
    if (item.type === 'date') {
      return <DateSeparator label={item.label} />;
    }
    
    const msg = item.data;
    return (
      <MessageBubble
        message={msg}
        onQuote={onQuoteMessage ? () => onQuoteMessage(msg.messageId || msg.id, msg.text, msg.fromMe) : undefined}
        onImageClick={onImageClick && msg.mediaUrl ? () => onImageClick(msg.mediaUrl!) : undefined}
      />
    );
  }, [onQuoteMessage, onImageClick]);

  const keyExtractor = useCallback((item: typeof messagesWithDates[0], index: number) => {
    if (item.type === 'date') return `date-${item.key}`;
    return item.data.id;
  }, []);

  if (messagesWithDates.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full text-muted-foreground text-sm", className)}>
        Nenhuma mensagem
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex-1 overflow-y-auto px-4 py-2",
        "bg-[#0B141A] bg-[url('/whatsapp-bg.png')] bg-repeat",
        className
      )}
    >
      <VirtualizedMessages
        messages={messagesWithDates}
        renderMessage={renderMessage}
        keyExtractor={keyExtractor}
        className="h-full"
        scrollToBottom={true}
      />
    </div>
  );
});

export default MessageList;
