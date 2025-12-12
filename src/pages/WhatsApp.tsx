import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Search, Smile, Paperclip, Mic, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  avatar: string;
  online: boolean;
}

interface Message {
  id: string;
  text: string;
  time: string;
  sent: boolean;
  read: boolean;
}

const WhatsApp = () => {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [chats] = useState<Chat[]>([]);
  const [messages] = useState<Message[]>([]);

  const filteredChats = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-2rem)] flex rounded-2xl overflow-hidden border border-border/50 bg-card -mt-4">
        {/* Left Sidebar - Chat List */}
        <div className="w-[380px] flex flex-col border-r border-border/50 bg-card">
          {/* Header */}
          <div className="h-14 px-4 flex items-center bg-muted/30 border-b border-border/30">
            <h2 className="font-medium text-foreground">Conversas</h2>
          </div>

          {/* Search */}
          <div className="p-2 border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar ou começar uma nova conversa"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/30 border-0 h-9 text-sm placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {filteredChats.length > 0 ? (
              filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/20",
                    selectedChat?.id === chat.id ? "bg-muted/40" : "hover:bg-muted/20"
                  )}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center text-foreground font-medium">
                      {chat.avatar}
                    </div>
                    {chat.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{chat.name}</span>
                      <span className={cn(
                        "text-xs",
                        chat.unread > 0 ? "text-emerald-500" : "text-muted-foreground"
                      )}>
                        {chat.time}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-sm text-muted-foreground truncate pr-2">
                        {chat.lastMessage}
                      </p>
                      {chat.unread > 0 && (
                        <span className="min-w-[20px] h-5 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center px-1.5">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex-1 flex items-center justify-center h-full py-20">
                <p className="text-sm text-muted-foreground">Nenhuma conversa</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="h-14 px-4 flex items-center gap-3 bg-muted/30 border-b border-border/30">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center text-foreground font-medium">
                    {selectedChat.avatar}
                  </div>
                  {selectedChat.online && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-card" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{selectedChat.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedChat.online ? "online" : "offline"}
                  </p>
                </div>
              </div>

              {/* Messages Area */}
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-2"
                style={{ 
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  backgroundColor: 'hsl(var(--muted) / 0.15)'
                }}
              >
                {messages.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">Nenhuma mensagem</p>
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="h-16 px-4 flex items-center gap-3 bg-muted/30 border-t border-border/30">
                <button className="p-2 hover:bg-muted/50 rounded-full transition-colors">
                  <Smile className="w-6 h-6 text-muted-foreground" />
                </button>
                <button className="p-2 hover:bg-muted/50 rounded-full transition-colors">
                  <Paperclip className="w-6 h-6 text-muted-foreground" />
                </button>
                <Input
                  placeholder="Digite uma mensagem"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-1 bg-card border-0 h-10 text-sm"
                />
                <button className="p-2 hover:bg-muted/50 rounded-full transition-colors">
                  {message ? (
                    <Send className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <Mic className="w-6 h-6 text-muted-foreground" />
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/10">
              <div className="text-center">
                <p className="text-muted-foreground">Selecione uma conversa para começar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WhatsApp;
