import { memo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { 
  Smile, Mic, Send, X, ArrowUp, File, FileImage, FileVideo, Zap, Reply 
} from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import { QuickMessages } from "./QuickMessages";
import { RecordingWaveform } from "./RecordingWaveform";
import { Message } from "@/hooks/useWhatsAppMessages";

interface ChatInputAreaProps {
  message: string;
  onMessageChange: (value: string) => void;
  onSendMessage: () => void;
  isSending: boolean;
  isRecording: boolean;
  recordingTime: number;
  recordingStream: MediaStream | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  formatRecordingTime: (seconds: number) => string;
  onFileUpload: (file: File, type: "image" | "file" | "video") => void;
  onSendAudioFromQuickMessage: (audioBase64: string) => Promise<void>;
  sessionId?: string;
  replyToMessage: Message | null;
  onCancelReply: () => void;
  onSendPresence: (type: "composing" | "recording") => void;
}

export const ChatInputArea = memo(function ChatInputArea({
  message,
  onMessageChange,
  onSendMessage,
  isSending,
  isRecording,
  recordingTime,
  recordingStream,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  formatRecordingTime,
  onFileUpload,
  onSendAudioFromQuickMessage,
  sessionId,
  replyToMessage,
  onCancelReply,
  onSendPresence,
}: ChatInputAreaProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const quickMsgButtonRef = useRef<HTMLButtonElement>(null);
  const quickMsgPickerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (message.trim()) {
        onSendMessage();
      }
    }
  };

  return (
    <>
      {/* Reply Preview */}
      {replyToMessage && (
        <div className="px-4 py-2 bg-muted/50 border-t border-border/30 flex items-center gap-2">
          <Reply className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <div className="flex-1 min-w-0 pl-2 border-l-2 border-emerald-500">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {replyToMessage.sent ? "Você" : "Contato"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyToMessage.mediaType 
                ? replyToMessage.mediaType === "image" ? "📷 Imagem"
                  : replyToMessage.mediaType === "video" ? "🎥 Vídeo"
                  : replyToMessage.mediaType === "audio" ? "🎵 Áudio"
                  : "📄 Arquivo"
                : replyToMessage.text}
            </p>
          </div>
          <button 
            onClick={onCancelReply}
            className="p-1 hover:bg-muted/50 rounded-full"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Message Input */}
      <div className="px-4 py-3 bg-muted/30 border-t border-border/30 flex-shrink-0 mt-auto">
        {isRecording ? (
          // Recording UI
          <div className="flex items-center gap-2">
            <button 
              onClick={onCancelRecording}
              className="p-2 hover:bg-muted/50 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-red-500" />
            </button>
            
            <div className="flex-1 flex items-center gap-3 px-4">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-foreground min-w-[40px]">
                {formatRecordingTime(recordingTime)}
              </span>
              <RecordingWaveform stream={recordingStream} isRecording={isRecording} />
            </div>
            
            <button 
              onClick={onStopRecording}
              disabled={isSending}
              className="p-2 bg-emerald-500 hover:bg-emerald-600 rounded-full transition-colors disabled:opacity-50"
            >
              {isSending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-6 h-6 text-white" />
              )}
            </button>
          </div>
        ) : (
          // Normal input UI
          <div className="space-y-2">
            {/* Main Input Row */}
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <Textarea
                  placeholder="Digite uma mensagem"
                  value={message}
                  onChange={(e) => {
                    onMessageChange(e.target.value);
                    if (e.target.value.trim()) {
                      onSendPresence("composing");
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isSending}
                  className="bg-card border-border/50 text-sm rounded-xl min-h-[48px] max-h-[120px] resize-none pr-12 w-full"
                  rows={1}
                />
                {/* Send Button inside input */}
                <button
                  onClick={onSendMessage}
                  disabled={isSending || !message.trim()}
                  className={cn(
                    "absolute right-2 bottom-2 p-1.5 rounded-full transition-all",
                    message.trim() 
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {isSending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowUp className="w-5 h-5" />
                  )}
                </button>
              </div>
              
              {/* Mic Button */}
              <button
                onClick={onStartRecording}
                disabled={isSending}
                className="p-3 bg-muted hover:bg-muted/80 rounded-full transition-colors disabled:opacity-50 shrink-0"
              >
                <Mic className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Hidden file inputs */}
            <input
              type="file"
              ref={imageInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFileUpload(e.target.files[0], "image")}
            />
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFileUpload(e.target.files[0], "file")}
            />
            <input
              type="file"
              ref={videoInputRef}
              accept="video/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFileUpload(e.target.files[0], "video")}
            />

            {/* Bottom Toolbar with Icons */}
            <div className="flex items-center gap-1 relative">
              {/* Emoji */}
              <div className="relative">
                <button 
                  ref={emojiButtonRef}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={cn(
                    "p-2 hover:bg-muted/50 rounded-full transition-all duration-200",
                    showEmojiPicker && "bg-emerald-500/10"
                  )}
                  title="Emojis"
                >
                  <Smile className={cn("w-5 h-5 transition-colors", showEmojiPicker ? "text-emerald-500" : "text-muted-foreground")} />
                </button>
                
                {showEmojiPicker && (
                  <div ref={emojiPickerRef} className="absolute bottom-full left-0 mb-2 z-50">
                    <EmojiPicker 
                      onSelect={(emoji) => {
                        onMessageChange(message + emoji);
                        setShowEmojiPicker(false);
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Images */}
                <button 
                  onClick={() => imageInputRef.current?.click()}
                  className="p-2 hover:bg-muted/50 rounded-full transition-colors"
                  title="Enviar imagem"
                >
                  <FileImage className="w-5 h-5 text-muted-foreground" />
                </button>

                {/* Video */}
                <button 
                  onClick={() => videoInputRef.current?.click()}
                  className="p-2 hover:bg-muted/50 rounded-full transition-colors"
                  title="Enviar vídeo"
                >
                  <FileVideo className="w-5 h-5 text-muted-foreground" />
                </button>

                {/* Files */}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 hover:bg-muted/50 rounded-full transition-colors"
                  title="Enviar documento"
                >
                  <File className="w-5 h-5 text-muted-foreground" />
                </button>

                {/* Quick Messages */}
                <div className="relative">
                  <button 
                    ref={quickMsgButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowQuickMessages(!showQuickMessages);
                    }}
                    className={cn(
                      "p-2 hover:bg-muted/50 rounded-full transition-all duration-200",
                      showQuickMessages && "bg-amber-500/10"
                    )}
                    title="Mensagens rápidas"
                  >
                    <Zap className={cn("w-5 h-5 transition-colors", showQuickMessages ? "text-amber-500" : "text-muted-foreground")} />
                  </button>
                  
                  {showQuickMessages && (
                    <div 
                      ref={quickMsgPickerRef}
                      className="absolute bottom-full right-0 mb-2 z-50"
                    >
                      <QuickMessages 
                        onSelect={(text) => {
                          onMessageChange(text);
                          setShowQuickMessages(false);
                        }}
                        onSelectAudio={async (audioBase64) => {
                          setShowQuickMessages(false);
                          await onSendAudioFromQuickMessage(audioBase64);
                        }}
                        sessionId={sessionId}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
});
