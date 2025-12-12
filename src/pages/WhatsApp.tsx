import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Search, MoreVertical, Smile, Paperclip, Mic, Send, Check, CheckCheck } from "lucide-react";
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

const mockChats: Chat[] = [
  { id: "1", name: "Maria Silva", lastMessage: "Olá, gostaria de saber mais sobre os serviços", time: "10:30", unread: 2, avatar: "MS", online: true },
  { id: "2", name: "João Santos", lastMessage: "Perfeito, vou agendar para sexta!", time: "09:45", unread: 0, avatar: "JS", online: false },
  { id: "3", name: "Ana Costa", lastMessage: "Obrigada pelo atendimento 💕", time: "Ontem", unread: 0, avatar: "AC", online: true },
  { id: "4", name: "Carla Oliveira", lastMessage: "Qual o valor do pacote completo?", time: "Ontem", unread: 1, avatar: "CO", online: false },
  { id: "5", name: "Beatriz Lima", lastMessage: "Vou pensar e te retorno", time: "12/12", unread: 0, avatar: "BL", online: false },
];

const mockMessages: Message[] = [
  { id: "1", text: "Olá! Tudo bem?", time: "10:15", sent: false, read: true },
  { id: "2", text: "Oi! Tudo sim, e você?", time: "10:16", sent: true, read: true },
  { id: "3", text: "Estou bem! Gostaria de saber mais sobre os serviços de sobrancelha", time: "10:18", sent: false, read: true },
  { id: "4", text: "Claro! Temos vários pacotes disponíveis. Você tem preferência por algum procedimento específico?", time: "10:20", sent: true, read: true },
  { id: "5", text: "Estou interessada em micropigmentação", time: "10:25", sent: false, read: true },
  { id: "6", text: "Ótima escolha! A micropigmentação dura em média 1 a 2 anos. O valor do procedimento é R$ 450,00 e inclui o retoque após 30 dias.", time: "10:27", sent: true, read: true },
  { id: "7", text: "Olá, gostaria de saber mais sobre os serviços", time: "10:30", sent: false, read: false },
];

const WhatsApp = () => {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(mockChats[0]);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChats = mockChats.filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-6rem)] flex rounded-2xl overflow-hidden border border-border/50 bg-card">
        {/* Left Sidebar - Chat List */}
        <div className="w-[380px] flex flex-col border-r border-border/50 bg-card">
          {/* Header */}
          <div className="h-14 px-4 flex items-center justify-between bg-muted/30 border-b border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-medium text-sm">
                SB
              </div>
            </div>
            <button className="p-2 hover:bg-muted/50 rounded-full transition-colors">
              <MoreVertical className="w-5 h-5 text-muted-foreground" />
            </button>
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
            {filteredChats.map((chat) => (
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
            ))}
          </div>
        </div>

        {/* Right Panel - Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="h-14 px-4 flex items-center justify-between bg-muted/30 border-b border-border/30">
                <div className="flex items-center gap-3">
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
                      {selectedChat.online ? "online" : "visto por último hoje às 09:30"}
                    </p>
                  </div>
                </div>
                <button className="p-2 hover:bg-muted/50 rounded-full transition-colors">
                  <MoreVertical className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Messages Area */}
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-2"
                style={{ 
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  backgroundColor: 'hsl(var(--muted) / 0.15)'
                }}
              >
                {mockMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.sent ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[65%] rounded-lg px-3 py-2 shadow-sm",
                        msg.sent 
                          ? "bg-emerald-100 dark:bg-emerald-900/30 rounded-tr-none" 
                          : "bg-card rounded-tl-none"
                      )}
                    >
                      <p className="text-sm text-foreground">{msg.text}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                        {msg.sent && (
                          msg.read 
                            ? <CheckCheck className="w-4 h-4 text-blue-500" />
                            : <Check className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
                <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
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
