import { memo } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Search, Check, CheckCheck, RefreshCw, Trash2, MoreVertical, MessageSquare, Users, ShieldBan, ShieldCheck } from "lucide-react";
import { Chat, DEFAULT_AVATAR, getInitials } from "@/hooks/useWhatsAppChats";
import { stripWhatsAppFormatting } from "@/lib/whatsapp-format";
import { GroupsList, WhatsAppGroup } from "./GroupsList";

interface ChatSidebarProps {
  chats: Chat[];
  selectedChat: Chat | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectChat: (chat: Chat) => void;
  isInitialLoad: boolean;
  isSyncing: boolean;
  sidebarTab: "conversas" | "grupos";
  onSidebarTabChange: (tab: "conversas" | "grupos") => void;
  whatsappGroups: WhatsAppGroup[];
  isLoadingGroups: boolean;
  onSelectGroup: (group: WhatsAppGroup) => void;
  onFetchGroups: () => void;
  onMarkChatListInteracting: () => void;
  blockedContacts: Set<string>;
  onDeleteChatMessages: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onBlockContact: (phone: string, chatId: string, name: string) => void;
  onUnblockContact: (phone: string) => void;
}

export const ChatSidebar = memo(function ChatSidebar({
  chats,
  selectedChat,
  searchQuery,
  onSearchChange,
  onSelectChat,
  isInitialLoad,
  isSyncing,
  sidebarTab,
  onSidebarTabChange,
  whatsappGroups,
  isLoadingGroups,
  onSelectGroup,
  onFetchGroups,
  onMarkChatListInteracting,
  blockedContacts,
  onDeleteChatMessages,
  onDeleteChat,
  onBlockContact,
  onUnblockContact,
}: ChatSidebarProps) {
  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.phone.includes(searchQuery)
  );

  return (
    <div className="w-[340px] flex flex-col border-r border-border bg-background">
      {/* Search */}
      <div className="px-3 py-3 border-b border-border/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={sidebarTab === "conversas" ? "Pesquisar conversas..." : "Pesquisar grupos..."}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-muted/30 border border-black/[0.08] h-9 text-sm placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => onSidebarTabChange("conversas")}
          className={cn(
            "relative flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors",
            sidebarTab === "conversas" 
              ? "text-foreground" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>Conversas</span>
          {chats.length > 0 && (
            <span className="text-xs text-muted-foreground">{chats.length}</span>
          )}
          {sidebarTab === "conversas" && (
            <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-foreground" />
          )}
        </button>
        <button
          onClick={() => { 
            onSidebarTabChange("grupos");
            if (whatsappGroups.length === 0 && !isLoadingGroups) {
              onFetchGroups();
            }
          }}
          className={cn(
            "relative flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors",
            sidebarTab === "grupos" 
              ? "text-foreground" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>Grupos</span>
          {whatsappGroups.length > 0 && (
            <span className="text-xs text-muted-foreground">{whatsappGroups.length}</span>
          )}
          {sidebarTab === "grupos" && (
            <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-foreground" />
          )}
        </button>
      </div>

      {/* Conversas Tab Content */}
      {sidebarTab === "conversas" && (
        <ScrollArea
          className="flex-1 overscroll-contain overflow-x-hidden"
          onScrollCapture={onMarkChatListInteracting}
          onWheelCapture={onMarkChatListInteracting}
          onTouchMoveCapture={onMarkChatListInteracting}
          onPointerDownCapture={onMarkChatListInteracting}
        >
          <div className="flex flex-col">
            {isInitialLoad && chats.length === 0 ? (
              <div className="flex items-center justify-center h-full py-20">
                <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
              </div>
            ) : filteredChats.length > 0 ? (
              filteredChats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  isSelected={selectedChat?.id === chat.id}
                  onSelect={onSelectChat}
                  isBlocked={blockedContacts.has(chat.phone)}
                  onDeleteMessages={onDeleteChatMessages}
                  onDeleteChat={onDeleteChat}
                  onBlock={onBlockContact}
                  onUnblock={onUnblockContact}
                />
              ))
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center h-full py-20 gap-3">
                <p className="text-sm text-muted-foreground">
                  {isSyncing ? "Sincronizando conversas..." : "Nenhuma conversa encontrada"}
                </p>
                {isSyncing && <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
      
      {/* Grupos Tab Content */}
      {sidebarTab === "grupos" && (
        <ScrollArea className="flex-1 overscroll-contain overflow-x-hidden">
          {isLoadingGroups ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
          ) : whatsappGroups.length > 0 ? (
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 bg-muted/10">
                <span className="text-xs text-muted-foreground font-medium">
                  {whatsappGroups.length} grupos
                </span>
                <button
                  onClick={onFetchGroups}
                  disabled={isLoadingGroups}
                  className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isLoadingGroups && "animate-spin")} />
                  Atualizar
                </button>
              </div>
              {whatsappGroups
                .filter(group => 
                  !searchQuery || 
                  group.name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center gap-3 px-3 py-3 border-b border-border/20 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => onSelectGroup(group)}
                  >
                    <div className="relative flex-shrink-0">
                      {group.photoUrl ? (
                        <img
                          src={group.photoUrl}
                          alt={group.name}
                          className="w-12 h-12 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={cn(
                        "w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-medium",
                        group.photoUrl && "hidden"
                      )}>
                        {group.name.substring(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground truncate block">{group.name}</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Users className="w-3 h-3" />
                        <span>
                          {group.participantCount >= 0
                            ? `${group.participantCount} participantes`
                            : "— participantes"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Users className="w-10 h-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhum grupo encontrado</p>
              <button 
                onClick={onFetchGroups}
                className="text-sm text-emerald-500 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar grupos
              </button>
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
});

interface ChatListItemProps {
  chat: Chat;
  isSelected: boolean;
  onSelect: (chat: Chat) => void;
  isBlocked: boolean;
  onDeleteMessages: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onBlock: (phone: string, chatId: string, name: string) => void;
  onUnblock: (phone: string) => void;
}

const ChatListItem = memo(function ChatListItem({
  chat,
  isSelected,
  onSelect,
  isBlocked,
  onDeleteMessages,
  onDeleteChat,
  onBlock,
  onUnblock,
}: ChatListItemProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 px-3 py-3 cursor-pointer transition-colors border-b border-border/20 overflow-hidden max-w-full",
        isSelected ? "bg-muted/40" : "hover:bg-muted/20"
      )}
      onClick={() => onSelect(chat)}
    >
      <div className="relative flex-shrink-0">
        <img 
          src={chat.photo_url || DEFAULT_AVATAR} 
          alt={chat.name} 
          className="w-12 h-12 rounded-full object-cover bg-neutral-200" 
        />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-foreground truncate flex-1 min-w-0">{chat.name}</span>
        </div>
        <div className="flex items-center gap-1 min-w-0 mt-0.5">
          {chat.lastMessageFromMe && (
            chat.lastMessageStatus === "READ" || chat.lastMessageStatus === "PLAYED" 
              ? <CheckCheck className="w-4 h-4 text-blue-500 flex-shrink-0" /> 
              : chat.lastMessageStatus === "DELIVERED"
                ? <CheckCheck className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                : <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          <p className="text-sm text-muted-foreground truncate flex-1 min-w-0">
            {chat.lastMessage?.trim() ? stripWhatsAppFormatting(chat.lastMessage) : "Sem mensagens"}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={cn("text-xs whitespace-nowrap", chat.unread > 0 ? "text-emerald-500" : "text-muted-foreground")}>
          {chat.time}
        </span>
        <div className="flex items-center gap-1">
          {chat.unread > 0 && (
            <span className="bg-emerald-500 text-white text-xs min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5">
              {chat.unread}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="p-1 hover:bg-muted/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteMessages(chat.id);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Apagar mensagens
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isBlocked ? (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnblock(chat.phone);
                  }}
                >
                  <ShieldCheck className="w-4 h-4 mr-2 text-emerald-500" />
                  Desbloquear
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onBlock(chat.phone, chat.id, chat.name);
                  }}
                  className="text-amber-600"
                >
                  <ShieldBan className="w-4 h-4 mr-2" />
                  Bloquear
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Apagar contato
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
});
