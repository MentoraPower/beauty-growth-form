import { memo } from "react";
import { cn } from "@/lib/utils";
import { PanelRightOpen, PanelRightClose, Users } from "lucide-react";
import { Chat, formatPhoneDisplay } from "@/hooks/useWhatsAppChats";
import { DEFAULT_AVATAR } from "@/lib/whatsapp-utils";

interface ChatHeaderProps {
  selectedChat: Chat;
  contactPresence: { phone: string; type: string; timestamp: number } | null;
  showLeadPanel: boolean;
  onToggleLeadPanel: () => void;
}

export const ChatHeader = memo(function ChatHeader({
  selectedChat,
  contactPresence,
  showLeadPanel,
  onToggleLeadPanel,
}: ChatHeaderProps) {
  return (
    <div className="h-[60px] px-4 flex items-center gap-3 bg-muted/40 border-b border-border/30">
      <div className="relative flex-shrink-0">
        {selectedChat.isGroup ? (
          <div className="w-11 h-11 rounded-full flex items-center justify-center bg-emerald-600 text-white shadow-sm ring-2 ring-background">
            <Users className="w-5 h-5" />
          </div>
        ) : (
          <img 
            src={selectedChat.photo_url || DEFAULT_AVATAR} 
            alt={selectedChat.name} 
            className="w-11 h-11 rounded-full object-cover shadow-sm ring-2 ring-background" 
            onError={(e) => {
              e.currentTarget.src = DEFAULT_AVATAR;
            }}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground truncate">{selectedChat.name}</h3>
        {selectedChat.isGroup ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" />
            {selectedChat.participantCount && selectedChat.participantCount > 0
              ? `${selectedChat.participantCount} participantes`
              : "Grupo"}
          </p>
        ) : contactPresence && contactPresence.phone === selectedChat.phone.replace(/\D/g, "") ? (
          <p className="text-xs text-emerald-500 font-medium animate-pulse">
            {contactPresence.type === "composing" ? "digitando..." : "gravando áudio..."}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{formatPhoneDisplay(selectedChat.phone)}</p>
        )}
      </div>
      <button
        onClick={onToggleLeadPanel}
        className="p-2.5 hover:bg-background/60 rounded-lg transition-all duration-200"
        title={showLeadPanel ? "Ocultar painel" : "Mostrar painel"}
      >
        {showLeadPanel ? <PanelRightClose className="w-5 h-5 text-muted-foreground" /> : <PanelRightOpen className="w-5 h-5 text-muted-foreground" />}
      </button>
    </div>
  );
});
