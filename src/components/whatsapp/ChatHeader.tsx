import { memo } from "react";
import { cn } from "@/lib/utils";
import { Phone, PanelRightOpen, PanelRightClose, Users } from "lucide-react";
import { Chat, getInitials, formatPhoneDisplay } from "@/hooks/useWhatsAppChats";

interface ChatHeaderProps {
  selectedChat: Chat;
  contactPresence: { phone: string; type: string; timestamp: number } | null;
  showLeadPanel: boolean;
  onToggleLeadPanel: () => void;
  onOpenCallModal: () => void;
}

export const ChatHeader = memo(function ChatHeader({
  selectedChat,
  contactPresence,
  showLeadPanel,
  onToggleLeadPanel,
  onOpenCallModal,
}: ChatHeaderProps) {
  return (
    <div className="h-14 px-4 flex items-center gap-3 bg-muted/30 border-b border-border/30">
      <div className="relative flex-shrink-0">
        {selectedChat.photo_url ? (
          <img 
            src={selectedChat.photo_url} 
            alt={selectedChat.name} 
            className="w-10 h-10 rounded-full object-cover bg-neutral-200" 
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium",
          selectedChat.isGroup 
            ? "bg-emerald-600 text-white" 
            : "bg-muted text-muted-foreground",
          selectedChat.photo_url && "hidden"
        )}>
          {selectedChat.isGroup ? (
            <Users className="w-5 h-5" />
          ) : (
            getInitials(selectedChat.name)
          )}
        </div>
      </div>
      <div className="flex-1">
        <h3 className="font-medium text-foreground">{selectedChat.name}</h3>
        {selectedChat.isGroup ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" />
            {selectedChat.participantCount && selectedChat.participantCount > 0
              ? `${selectedChat.participantCount} participantes`
              : "Grupo"}
          </p>
        ) : contactPresence && contactPresence.phone === selectedChat.phone.replace(/\D/g, "") ? (
          <p className="text-xs text-emerald-500 animate-pulse">
            {contactPresence.type === "composing" ? "digitando..." : "gravando áudio..."}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{formatPhoneDisplay(selectedChat.phone)}</p>
        )}
      </div>
      {/* Hide call button for groups */}
      {!selectedChat.isGroup && (
        <button
          onClick={onOpenCallModal}
          className="p-2 hover:bg-muted/50 rounded-full transition-colors"
          title="Fazer ligação"
        >
          <Phone className="w-5 h-5 text-emerald-500" />
        </button>
      )}
      <button
        onClick={onToggleLeadPanel}
        className="p-2 hover:bg-muted/50 rounded-full transition-colors"
        title={showLeadPanel ? "Ocultar painel" : "Mostrar painel"}
      >
        {showLeadPanel ? <PanelRightClose className="w-5 h-5 text-muted-foreground" /> : <PanelRightOpen className="w-5 h-5 text-muted-foreground" />}
      </button>
    </div>
  );
});
