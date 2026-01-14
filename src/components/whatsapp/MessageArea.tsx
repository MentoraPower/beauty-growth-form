import { memo, RefObject } from "react";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, File, MoreVertical, Pencil, Reply, Trash2 } from "lucide-react";
import { Message, getDateLabel, getMessageDateKey, isViewedStatus } from "@/hooks/useWhatsAppMessages";
import { AudioWaveform } from "./AudioWaveform";
import { formatWhatsAppText } from "@/lib/whatsapp-format";

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
  onScrollToQuoted: (quotedMessageId: string) => void;
  onImageClick: (index: number) => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

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
  onScrollToQuoted,
  onImageClick,
  scrollToBottom,
}: MessageAreaProps) {
  const renderMessageContent = (msg: Message) => {
    // Only hide content for OUR deleted messages
    if (msg.status === "DELETED" && msg.sent) {
      return (
        <p className="text-sm text-muted-foreground italic">
          mensagem apagada
        </p>
      );
    }

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
            onPointerDown={(e) => {
              e.stopPropagation();
              const index = allImages.indexOf(msg.mediaUrl!);
              onImageClick(index >= 0 ? index : 0);
            }}
          />
          {msg.text && <p className="text-sm text-foreground whitespace-pre-wrap">{formatWhatsAppText(msg.text)}</p>}
        </div>
      );
    }
    
    if (msg.mediaType === "audio") {
      return (
        <div className="min-w-[280px] max-w-[320px]">
          <AudioWaveform 
            src={msg.mediaUrl || ""} 
            sent={msg.sent}
            renderFooter={(audioDuration) => (
              <div className="flex items-center justify-between mt-1 px-1">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {audioDuration}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                  {msg.sent && msg.status !== "DELETED" && (
                    msg.status === "READ" || msg.status === "PLAYED" 
                      ? <CheckCheck className="w-4 h-4 text-blue-500" /> 
                      : msg.status === "DELIVERED"
                        ? <CheckCheck className="w-4 h-4 text-muted-foreground" />
                        : msg.status === "SENDING"
                          ? <div className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                          : <Check className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            )}
          />
        </div>
      );
    }

    if ((msg.mediaType === "sticker" || msg.text?.includes("🎨 Sticker")) && msg.mediaUrl) {
      return (
        <img 
          src={msg.mediaUrl} 
          alt="Sticker" 
          className="max-w-[150px] max-h-[150px]"
          loading="lazy"
          onLoad={() => scrollToBottom("auto")}
        />
      );
    }

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
          {msg.text && <p className="text-sm text-foreground whitespace-pre-wrap">{formatWhatsAppText(msg.text)}</p>}
        </div>
      );
    }
    
    if (msg.mediaType && msg.mediaUrl) {
      return (
        <a 
          href={msg.mediaUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <File className="w-8 h-8 text-emerald-500" />
          <span className="text-sm text-foreground">Documento</span>
        </a>
      );
    }

    return <span className="text-sm text-foreground whitespace-pre-wrap">{formatWhatsAppText(msg.text)}</span>;
  };

  return (
    <div
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto p-4 space-y-1.5 min-h-0 min-w-0"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000' fill-opacity='0.02'%3E%3Ccircle cx='10' cy='10' r='1'/%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3Ccircle cx='50' cy='10' r='1'/%3E%3Ccircle cx='70' cy='30' r='1'/%3E%3Ccircle cx='90' cy='10' r='1'/%3E%3Ccircle cx='10' cy='50' r='1'/%3E%3Ccircle cx='30' cy='70' r='1'/%3E%3Ccircle cx='50' cy='50' r='1'/%3E%3Ccircle cx='70' cy='70' r='1'/%3E%3Ccircle cx='90' cy='50' r='1'/%3E%3Ccircle cx='10' cy='90' r='1'/%3E%3Ccircle cx='50' cy='90' r='1'/%3E%3Ccircle cx='90' cy='90' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
        backgroundColor: "hsl(var(--muted) / 0.1)",
      }}
    >
      {isLoadingMessages ? (
        <div className="flex flex-col justify-end h-full gap-2 pb-2">
          <div className="flex justify-start">
            <div className="w-[45%] h-12 bg-card rounded-lg rounded-tl-none animate-pulse border border-border/30" />
          </div>
          <div className="flex justify-end">
            <div className="w-[55%] h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg rounded-tr-none animate-pulse" />
          </div>
          <div className="flex justify-start">
            <div className="w-[40%] h-10 bg-card rounded-lg rounded-tl-none animate-pulse border border-border/30" />
          </div>
          <div className="flex justify-end">
            <div className="w-[50%] h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg rounded-tr-none animate-pulse" />
          </div>
        </div>
      ) : visibleMessages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground">Nenhuma mensagem</p>
        </div>
      ) : (
        (() => {
          let lastDateKey = "";
          return visibleMessages.map((msg) => {
            const currentDateKey = msg.created_at ? getMessageDateKey(msg.created_at) : "";
            const showDateSeparator = currentDateKey && currentDateKey !== lastDateKey;
            if (currentDateKey) lastDateKey = currentDateKey;
            
            return (
              <div key={msg.id}>
                {showDateSeparator && msg.created_at && (
                  <div className="flex items-center justify-center my-4">
                    <div className="flex items-center gap-3 w-full max-w-[280px]">
                      <div className="flex-1 h-px bg-muted-foreground/20" />
                      <span className="text-xs text-muted-foreground bg-muted/40 px-3 py-1 rounded-full font-medium">
                        {getDateLabel(msg.created_at)}
                      </span>
                      <div className="flex-1 h-px bg-muted-foreground/20" />
                    </div>
                  </div>
                )}
                <div className={cn("flex group", msg.sent ? "justify-end" : "justify-start")}>
                  {/* Menu for sent messages */}
                  {msg.sent && msg.status !== "DELETED" && msg.created_at && (Date.now() - new Date(msg.created_at).getTime() < 60 * 60 * 1000) && (
                    <div className="relative flex items-start mr-1">
                      <button
                        data-message-menu-trigger
                        onClick={() => onMessageMenuChange(messageMenuId === msg.id ? null : msg.id)}
                        className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50"
                      >
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </button>
                      {messageMenuId === msg.id && (
                        <div data-message-menu className="absolute right-full top-0 mr-1 bg-card rounded-lg shadow-lg border border-border overflow-hidden z-50 min-w-[120px]">
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
                  )}
                  {/* Reply button for received messages */}
                  {!msg.sent && msg.status !== "DELETED" && (
                    <button
                      onClick={() => onReplyMessage(msg)}
                      className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50 mr-1 self-center"
                    >
                      <Reply className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                  <div
                    data-message-id={msg.message_id}
                    className={cn(
                      "max-w-[65%] rounded-2xl px-3 py-2 relative transition-all duration-300",
                      msg.sent 
                        ? "bg-sky-100 dark:bg-sky-900/40 rounded-tr-sm" 
                        : "bg-black/[0.04] dark:bg-white/[0.08] rounded-tl-sm"
                    )}
                  >
                    {/* Quoted message preview */}
                    {(msg.quotedText || msg.quotedMessageId) && (() => {
                      const quotedMessage = messages.find(m => 
                        m.message_id?.toString() === msg.quotedMessageId?.toString()
                      );
                      const hasQuotedImage = quotedMessage?.mediaType === "image" && quotedMessage?.mediaUrl;
                      
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
                                {quotedMessage?.mediaType === "image" ? "📷 Foto" 
                                  : quotedMessage?.mediaType === "video" ? "🎥 Vídeo"
                                  : quotedMessage?.mediaType === "audio" ? "🎵 Áudio"
                                  : quotedMessage?.mediaType ? "📄 Arquivo"
                                  : msg.quotedText || ""}
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
                    })()}
                    
                    {renderMessageContent(msg)}
                    
                    {/* Client deleted message indicator - show below content */}
                    {msg.status === "DELETED" && !msg.sent && (
                      <p className="text-[10px] text-muted-foreground/70 italic mt-1">
                        Mensagem apagada pelo cliente
                      </p>
                    )}
                    
                    {/* Timestamp and status */}
                    {msg.mediaType !== "audio" && (
                      <div className="flex items-center justify-end gap-1 mt-1">
                        {msg.isEdited && msg.status !== "DELETED" && (
                          <span className="text-[10px] text-muted-foreground/70 italic">Editada</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                        {msg.sent && msg.status !== "DELETED" && (
                          isViewedStatus(msg.status) 
                            ? <CheckCheck className="w-4 h-4 text-blue-500" /> 
                            : msg.status === "DELIVERED"
                              ? <CheckCheck className="w-4 h-4 text-muted-foreground" />
                              : msg.status === "SENDING"
                                ? <div className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                                : <Check className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          });
        })()
      )}
    </div>
  );
});
