import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, File, MoreVertical, Pencil, Reply, Trash2 } from "lucide-react";
import { Message } from "@/hooks/useWhatsAppMessages";
import { AudioWaveform } from "./AudioWaveform";
import { formatWhatsAppText } from "@/lib/whatsapp-format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MessageBubbleProps {
  msg: Message;
  messages: Message[];
  allImages: string[];
  messageMenuId: string | null;
  onMessageMenuChange: (id: string | null) => void;
  onReplyMessage: (msg: Message) => void;
  onEditMessage: (msg: Message) => void;
  onDeleteMessage: (msg: Message) => void;
  onScrollToQuoted: (quotedMessageId: string) => void;
  onImageClick: (index: number) => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  isGroupChat?: boolean;
  participantPhotos?: Record<string, string>;
}

// Sub-component: Message status icon (smaller for inline)
const MessageStatusIcon = memo(function MessageStatusIcon({ status }: { status?: string }) {
  if (status === "READ" || status === "PLAYED") {
    return <CheckCheck className="w-3 h-3 text-blue-500" />;
  }
  if (status === "DELIVERED") {
    return <CheckCheck className="w-3 h-3 text-muted-foreground/70" />;
  }
  if (status === "SENDING") {
    return <div className="w-2.5 h-2.5 border-[1.5px] border-muted-foreground border-t-transparent rounded-full animate-spin" />;
  }
  return <Check className="w-3 h-3 text-muted-foreground/70" />;
});

// Sub-component: Inline footer for text messages (time + status)
const InlineFooter = memo(function InlineFooter({ msg }: { msg: Message }) {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1.5 align-bottom whitespace-nowrap">
      {msg.isEdited && msg.status !== "DELETED" && (
        <span className="text-[11px] text-muted-foreground/60 italic">Editada</span>
      )}
      <span className="text-[11px] text-muted-foreground/70">{msg.time}</span>
      {msg.sent && msg.status !== "DELETED" && (
        <MessageStatusIcon status={msg.status} />
      )}
    </span>
  );
});

// Sub-component: Block footer for media messages (time + status on new line)
const BlockFooter = memo(function BlockFooter({ msg }: { msg: Message }) {
  if (msg.mediaType === "audio") return null;

  return (
    <div className="mt-1 flex items-center gap-0.5 justify-end">
      {msg.isEdited && msg.status !== "DELETED" && (
        <span className="text-[11px] text-muted-foreground/60 italic">Editada</span>
      )}
      <span className="text-[11px] text-muted-foreground/70">{msg.time}</span>
      {msg.sent && msg.status !== "DELETED" && (
        <MessageStatusIcon status={msg.status} />
      )}
    </div>
  );
});

// Sub-component: Message content renderer
const MessageContent = memo(function MessageContent({
  msg,
  allImages,
  onImageClick,
  scrollToBottom,
}: {
  msg: Message;
  allImages: string[];
  onImageClick: (index: number) => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}) {
  // Our deleted messages - hide content
  if (msg.status === "DELETED" && msg.sent) {
    return (
      <p className="text-sm text-muted-foreground italic">
        mensagem apagada
      </p>
    );
  }

  // Image
  if (msg.mediaType === "image" && msg.mediaUrl) {
    return (
      <div className="space-y-1">
        <img 
          src={msg.mediaUrl} 
          alt="Imagem" 
          className="max-w-[280px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          loading="lazy"
          onLoad={() => scrollToBottom("auto")}
          onError={(e) => {
            e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='280' height='200' viewBox='0 0 280 200'%3E%3Crect fill='%23f0f0f0' width='280' height='200'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='14'%3EImagem indisponível%3C/text%3E%3C/svg%3E";
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const index = allImages.indexOf(msg.mediaUrl!);
            onImageClick(index >= 0 ? index : 0);
          }}
        />
        {msg.text && (
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {formatWhatsAppText(msg.text)}
          </p>
        )}
        <BlockFooter msg={msg} />
      </div>
    );
  }
  
  // Audio
  if (msg.mediaType === "audio") {
    return (
      <div className="min-w-[280px] max-w-[320px]">
        <AudioWaveform 
          src={msg.mediaUrl || ""} 
          sent={msg.sent}
          renderFooter={(audioDuration) => (
            <div className="flex items-center justify-between mt-1 px-1">
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {audioDuration}
              </span>
              <div className="flex items-center gap-0.5">
                <span className="text-[11px] text-muted-foreground/70">{msg.time}</span>
                {msg.sent && msg.status !== "DELETED" && (
                  <MessageStatusIcon status={msg.status} />
                )}
              </div>
            </div>
          )}
        />
      </div>
    );
  }

  // Sticker
  if ((msg.mediaType === "sticker" || msg.text?.includes("🎨 Sticker")) && msg.mediaUrl) {
    return (
      <div>
        <img 
          src={msg.mediaUrl} 
          alt="Sticker" 
          className="max-w-[150px] max-h-[150px]"
          loading="lazy"
          onLoad={() => scrollToBottom("auto")}
        />
        <BlockFooter msg={msg} />
      </div>
    );
  }

  // Video
  if (msg.mediaType === "video" && msg.mediaUrl) {
    return (
      <div className="space-y-1">
        <video 
          src={msg.mediaUrl} 
          controls 
          className="max-w-[280px] rounded-lg"
          preload="metadata"
          onError={(e) => {
            const parent = e.currentTarget.parentElement;
            if (parent) {
              e.currentTarget.style.display = 'none';
              const fallback = document.createElement('div');
              fallback.className = 'flex items-center gap-2 p-3 bg-muted/30 rounded-lg';
              fallback.innerHTML = '<span class="text-sm text-muted-foreground">Vídeo indisponível</span>';
              parent.insertBefore(fallback, e.currentTarget);
            }
          }}
        />
        {msg.text && (
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {formatWhatsAppText(msg.text)}
          </p>
        )}
        <BlockFooter msg={msg} />
      </div>
    );
  }
  
  // File/Document
  if (msg.mediaType && msg.mediaUrl) {
    return (
      <div>
        <a 
          href={msg.mediaUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <File className="w-8 h-8 text-emerald-500" />
          <span className="text-sm text-foreground">Documento</span>
        </a>
        <BlockFooter msg={msg} />
      </div>
    );
  }

  // Text - inline footer floats right, wraps to bottom on long messages
  return (
    <div className="inline">
      <span className="text-sm text-foreground whitespace-pre-wrap break-words">
        {formatWhatsAppText(msg.text)}
      </span>
      <span className="float-right ml-2 mt-1">
        <InlineFooter msg={msg} />
      </span>
    </div>
  );
});

// Sub-component: Quoted message preview
const QuotedMessagePreview = memo(function QuotedMessagePreview({
  msg,
  messages,
  onScrollToQuoted,
}: {
  msg: Message;
  messages: Message[];
  onScrollToQuoted: (quotedMessageId: string) => void;
}) {
  if (!msg.quotedText && !msg.quotedMessageId) return null;

  const quotedMessage = messages.find(m => 
    m.message_id?.toString() === msg.quotedMessageId?.toString()
  );
  const hasQuotedImage = quotedMessage?.mediaType === "image" && quotedMessage?.mediaUrl;

  const getQuotedLabel = () => {
    if (quotedMessage?.mediaType === "image") return "📷 Foto";
    if (quotedMessage?.mediaType === "video") return "🎥 Vídeo";
    if (quotedMessage?.mediaType === "audio") return "🎵 Áudio";
    if (quotedMessage?.mediaType) return "📄 Arquivo";
    return msg.quotedText || "";
  };
  
  return (
    <div 
      onClick={() => msg.quotedMessageId && onScrollToQuoted(msg.quotedMessageId)}
      className={cn(
        "mb-1.5 rounded border-l-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden",
        msg.quotedFromMe ? "border-emerald-500" : "border-blue-400"
      )}
    >
      <div className={cn("flex gap-2", hasQuotedImage ? "items-stretch" : "items-center p-2")}>
        <div className={cn("flex-1 min-w-0", hasQuotedImage && "p-2")}>
          <p className="text-[10px] font-semibold text-muted-foreground">
            {msg.quotedFromMe ? "Você" : "Contato"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {getQuotedLabel()}
          </p>
        </div>
        {hasQuotedImage && (
          <img 
            src={quotedMessage.mediaUrl!} 
            alt="" 
            className="w-12 h-12 object-cover flex-shrink-0"
          />
        )}
      </div>
    </div>
  );
});

// Sub-component: Message action menu (for sent messages)
const MessageActionMenu = memo(function MessageActionMenu({
  msg,
  messageMenuId,
  onMessageMenuChange,
  onReplyMessage,
  onEditMessage,
  onDeleteMessage,
}: {
  msg: Message;
  messageMenuId: string | null;
  onMessageMenuChange: (id: string | null) => void;
  onReplyMessage: (msg: Message) => void;
  onEditMessage: (msg: Message) => void;
  onDeleteMessage: (msg: Message) => void;
}) {
  const isWithinEditWindow = msg.created_at && (Date.now() - new Date(msg.created_at).getTime() < 60 * 60 * 1000);
  
  if (!msg.sent || msg.status === "DELETED" || !isWithinEditWindow) return null;

  return (
    <div className="relative flex items-start mr-1">
      <button
        data-message-menu-trigger
        onClick={() => onMessageMenuChange(messageMenuId === msg.id ? null : msg.id)}
        className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50"
      >
        <MoreVertical className="w-4 h-4 text-muted-foreground" />
      </button>
      
      {messageMenuId === msg.id && (
        <div 
          data-message-menu 
          className="absolute right-full top-0 mr-1 bg-card rounded-lg shadow-lg border border-border overflow-hidden z-50 min-w-[120px]"
        >
          <button
            onClick={() => {
              onReplyMessage(msg);
              onMessageMenuChange(null);
            }}
            className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 w-full text-left text-sm text-foreground"
          >
            <Reply className="w-4 h-4" />
            Responder
          </button>
          
          {!msg.mediaType && msg.text && (
            <button
              onClick={() => {
                onEditMessage(msg);
                onMessageMenuChange(null);
              }}
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 w-full text-left text-sm text-foreground"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </button>
          )}
          
          <button
            onClick={() => onDeleteMessage(msg)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-destructive/10 w-full text-left text-sm text-destructive"
          >
            <Trash2 className="w-4 h-4" />
            Apagar
          </button>
        </div>
      )}
    </div>
  );
});

// Helper: Generate initials from name or phone
const getInitials = (name?: string | null, phone?: string | null): string => {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (phone) {
    return phone.slice(-2);
  }
  return "?";
};

// Helper: Generate consistent color from phone number (returns HSL color)
const getSenderColor = (phone?: string | null): { bg: string; text: string } => {
  const colors = [
    { bg: "hsl(330, 80%, 60%)", text: "hsl(330, 80%, 45%)" }, // pink
    { bg: "hsl(270, 70%, 60%)", text: "hsl(270, 70%, 45%)" }, // purple
    { bg: "hsl(230, 70%, 60%)", text: "hsl(230, 70%, 45%)" }, // indigo
    { bg: "hsl(210, 80%, 55%)", text: "hsl(210, 80%, 40%)" }, // blue
    { bg: "hsl(185, 70%, 50%)", text: "hsl(185, 70%, 35%)" }, // cyan
    { bg: "hsl(160, 60%, 45%)", text: "hsl(160, 60%, 35%)" }, // teal
    { bg: "hsl(140, 60%, 50%)", text: "hsl(140, 60%, 35%)" }, // green
    { bg: "hsl(45, 90%, 55%)", text: "hsl(45, 90%, 40%)" },   // amber
    { bg: "hsl(25, 90%, 55%)", text: "hsl(25, 90%, 40%)" },   // orange
    { bg: "hsl(0, 75%, 55%)", text: "hsl(0, 75%, 40%)" },     // red
  ];
  if (!phone) return colors[0];
  const hash = phone.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Sub-component: Sender info for group messages
const GroupSenderInfo = memo(function GroupSenderInfo({
  msg,
  participantPhotos,
}: {
  msg: Message;
  participantPhotos?: Record<string, string>;
}) {
  const senderPhoto = participantPhotos?.[msg.senderPhone || ""] || null;
  const initials = getInitials(msg.senderName, msg.senderPhone);
  const colors = getSenderColor(msg.senderPhone);
  
  // Get display name - prefer sender name, fallback to formatted phone
  const displayName = msg.senderName || (msg.senderPhone ? `+${msg.senderPhone}` : "Participante");
  
  return (
    <div className="flex items-center gap-2 mb-1">
      <Avatar className="w-5 h-5">
        <AvatarImage src={senderPhoto || undefined} alt={displayName} />
        <AvatarFallback 
          className="text-[10px] text-white"
          style={{ backgroundColor: colors.bg }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <span 
        className="text-xs font-medium"
        style={{ color: colors.text }}
      >
        {displayName}
      </span>
    </div>
  );
});

// Main component: Message bubble
export const MessageBubble = memo(function MessageBubble({
  msg,
  messages,
  allImages,
  messageMenuId,
  onMessageMenuChange,
  onReplyMessage,
  onEditMessage,
  onDeleteMessage,
  onScrollToQuoted,
  onImageClick,
  scrollToBottom,
  isGroupChat,
  participantPhotos,
}: MessageBubbleProps) {
  const isClientDeletedMessage = msg.status === "DELETED" && !msg.sent;
  
  // Show sender info only for received messages in group chats that have sender info
  const showSenderInfo = isGroupChat && !msg.sent && (msg.senderPhone || msg.senderName);

  return (
    <div className={cn("flex w-full group", msg.sent ? "justify-end" : "justify-start")}>
      {/* Menu for sent messages */}
      <MessageActionMenu
        msg={msg}
        messageMenuId={messageMenuId}
        onMessageMenuChange={onMessageMenuChange}
        onReplyMessage={onReplyMessage}
        onEditMessage={onEditMessage}
        onDeleteMessage={onDeleteMessage}
      />
      {/* Reply button (overlay, does not affect alignment) */}
      
      {/* Bubble + (optional) indicator */}
      <div
        className={cn(
          "relative flex flex-col w-fit min-w-0 max-w-[78%] sm:max-w-[65%]",
          msg.sent ? "items-end" : "items-start"
        )}
      >
        {!msg.sent && msg.status !== "DELETED" && (
          <button
            onClick={() => onReplyMessage(msg)}
            aria-label="Responder"
            className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50"
          >
            <Reply className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        <div
          data-message-id={msg.message_id}
          className={cn(
            "w-fit inline-block max-w-full break-words rounded-2xl px-3 py-2 relative transition-all duration-300",
            msg.sent
              ? "bg-sky-100 dark:bg-sky-900/40 rounded-tr-sm"
              : "bg-black/[0.04] dark:bg-white/[0.08] rounded-tl-sm"
          )}
        >
          {/* Show sender name and avatar for group messages */}
          {showSenderInfo && (
            <GroupSenderInfo msg={msg} participantPhotos={participantPhotos} />
          )}

          <QuotedMessagePreview
            msg={msg}
            messages={messages}
            onScrollToQuoted={onScrollToQuoted}
          />

          <MessageContent
            msg={msg}
            allImages={allImages}
            onImageClick={onImageClick}
            scrollToBottom={scrollToBottom}
          />
        </div>

        {isClientDeletedMessage && (
          <span className="mt-0.5 text-[10px] text-muted-foreground/60 italic leading-none">
            Mensagem apagada pelo cliente
          </span>
        )}
      </div>
    </div>
  );
});
