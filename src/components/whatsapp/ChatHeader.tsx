import { memo } from "react";
import { cn } from "@/lib/utils";
import { PanelRightOpen, PanelRightClose, Users } from "lucide-react";
import { Chat, formatPhoneDisplay } from "@/hooks/useWhatsAppChats";
import { DEFAULT_AVATAR, getInitials } from "@/lib/whatsapp-utils";

interface ChatHeaderProps {
  selectedChat: Chat;
  contactPresence: { phone: string; type: string; timestamp: number } | null;
  showLeadPanel: boolean;
  onToggleLeadPanel: () => void;
  photoUrl?: string | null;
}

export const ChatHeader = memo(function ChatHeader({
  selectedChat,
  contactPresence,
  showLeadPanel,
  onToggleLeadPanel,
  photoUrl,
}: ChatHeaderProps) {
  // Use photoUrl prop if provided, otherwise fallback to selectedChat.photo_url
  const displayPhoto = photoUrl || selectedChat.photo_url;
  const isGroup = selectedChat.isGroup;

  return (
    <div className="h-[60px] px-4 flex items-center gap-3 bg-white dark:bg-zinc-950 border-b border-black/[0.08] dark:border-white/[0.08]">
      <div className="relative flex-shrink-0">
        {isGroup ? (
          // Group avatar - show photo if available, otherwise show initials with Users icon badge
          displayPhoto ? (
            <img 
              src={displayPhoto} 
              alt={selectedChat.name} 
              className="w-11 h-11 rounded-full object-cover shadow-sm ring-2 ring-background bg-muted" 
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
          ) : null
        ) : (
          // Contact avatar
          <img 
            src={displayPhoto || DEFAULT_AVATAR} 
            alt={selectedChat.name} 
            className="w-11 h-11 rounded-full object-cover shadow-sm ring-2 ring-background" 
            onError={(e) => {
              e.currentTarget.src = DEFAULT_AVATAR;
            }}
          />
        )}
        {/* Fallback for groups without photo or when photo fails to load */}
        {isGroup && (
          <div className={cn(
            "w-11 h-11 rounded-full flex items-center justify-center bg-emerald-600 text-white shadow-sm ring-2 ring-background font-medium text-sm",
            displayPhoto && "hidden"
          )}>
            {getInitials(selectedChat.name)}
          </div>
        )}
        {/* Group badge indicator */}
        {isGroup && (
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center ring-2 ring-background">
            <Users className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground truncate">{selectedChat.name}</h3>
        {isGroup ? (
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