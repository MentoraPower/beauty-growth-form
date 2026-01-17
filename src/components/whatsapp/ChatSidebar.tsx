import { memo } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Search, Check, CheckCheck, RefreshCw, Trash2, MoreVertical, ShieldBan, ShieldCheck } from "lucide-react";
import { Chat } from "@/hooks/useWhatsAppChats";
import { DEFAULT_AVATAR } from "@/lib/whatsapp-utils";
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
  onFetchGroups: (forceRefresh?: boolean) => void;
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
  // Filter out groups from conversas tab - groups should only appear in grupos tab
  const nonGroupChats = chats.filter((chat) => !chat.phone?.includes("@g.us") && !chat.isGroup);
  
  const filteredChats = nonGroupChats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.phone.includes(searchQuery)
  );

  return (
    <div className="w-[320px] flex flex-col border-r border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-zinc-950">

      {/* Search */}
      <div className="px-3 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={sidebarTab === "conversas" ? "Pesquisar conversas..." : "Pesquisar grupos..."}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-muted/40 border-0 h-9 text-sm placeholder:text-muted-foreground/60 rounded-lg focus-visible:ring-1 focus-visible:ring-emerald-500/50"
          />
        </div>
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
          <div className="flex flex-col px-2 divide-y divide-black/[0.04] dark:divide-white/[0.06]">
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
        <GroupsList
          groups={whatsappGroups.filter(group => 
            !searchQuery || 
            group.name.toLowerCase().includes(searchQuery.toLowerCase())
          )}
          isLoading={isLoadingGroups}
          onRefresh={() => onFetchGroups(true)}
          onSelectGroup={onSelectGroup}
          selectedGroupId={selectedChat?.phone || selectedChat?.id}
        />
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
        "group flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all overflow-hidden rounded-lg",
        isSelected 
          ? "bg-black/5 dark:bg-white/5" 
          : "hover:bg-black/[0.03] dark:hover:bg-white/5"
      )}
      onClick={() => onSelect(chat)}
    >
      <div className="relative flex-shrink-0">
        <img 
          src={chat.photo_url || DEFAULT_AVATAR} 
          alt={chat.name} 
          className="w-11 h-11 rounded-full object-cover bg-neutral-200 shadow-sm"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = DEFAULT_AVATAR;
          }}
        />
        {chat.unread > 0 && (
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
        )}
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
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <span className={cn(
          "text-[11px] font-medium whitespace-nowrap", 
          chat.unread > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
        )}>
          {chat.time}
        </span>
        <div className="flex items-center gap-1.5 h-5">
          {chat.unread > 0 && (
            <span className="bg-emerald-500 text-white text-[10px] font-semibold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
              {chat.unread}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="p-0.5 hover:bg-muted/50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
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
