import { useState, useEffect } from "react";
import { Plus, X, MessageSquare, Trash2, Edit2, Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface QuickMessagesProps {
  onSelect: (message: string) => void;
}

interface QuickMessage {
  id: string;
  name: string;
  text: string;
}

const STORAGE_KEY = "whatsapp_quick_messages";

export function QuickMessages({ onSelect }: QuickMessagesProps) {
  const [messages, setMessages] = useState<QuickMessage[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      // Migrate old format (without name) to new format
      return parsed.map((m: any) => ({
        ...m,
        name: m.name || m.text?.slice(0, 30) || "Mensagem",
      }));
    } catch {
      return [];
    }
  });
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editText, setEditText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  const handleAdd = () => {
    if (!newMessage.trim()) return;
    
    const msg: QuickMessage = {
      id: `qm-${Date.now()}`,
      name: newName.trim() || newMessage.slice(0, 30),
      text: newMessage.trim(),
    };
    
    setMessages((prev) => [...prev, msg]);
    setNewName("");
    setNewMessage("");
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const handleStartEdit = (msg: QuickMessage) => {
    setEditingId(msg.id);
    setEditName(msg.name);
    setEditText(msg.text);
  };

  const handleSaveEdit = () => {
    if (!editText.trim() || !editingId) return;
    
    setMessages((prev) =>
      prev.map((m) => (m.id === editingId ? { 
        ...m, 
        name: editName.trim() || editText.slice(0, 30),
        text: editText.trim() 
      } : m))
    );
    setEditingId(null);
    setEditName("");
    setEditText("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditText("");
  };

  const filteredMessages = messages.filter((msg) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      msg.name.toLowerCase().includes(query) ||
      msg.text.toLowerCase().includes(query)
    );
  });

  return (
    <div className="w-80 bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium text-foreground">Mensagens Rápidas</span>
        </div>
        <button
          onClick={() => {
            setIsAdding(!isAdding);
            if (isAdding) {
              setNewName("");
              setNewMessage("");
            }
          }}
          className={cn(
            "p-1 rounded transition-colors",
            isAdding ? "bg-destructive/10 text-destructive" : "hover:bg-muted/50 text-muted-foreground"
          )}
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {/* Search */}
      {messages.length > 0 && !isAdding && (
        <div className="px-3 py-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar mensagens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-sm bg-background pl-8"
            />
          </div>
        </div>
      )}

      {/* Add new message */}
      {isAdding && (
        <div className="p-3 border-b border-border bg-muted/20 space-y-2">
          <Input
            placeholder="Nome da mensagem (ex: Saudação)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-9 text-sm bg-background"
            autoFocus
          />
          <Textarea
            placeholder="Digite o conteúdo da mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="text-sm bg-background min-h-[80px] resize-none"
          />
          <button
            onClick={handleAdd}
            disabled={!newMessage.trim()}
            className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Salvar Mensagem
          </button>
        </div>
      )}

      {/* Messages list */}
      <ScrollArea className="max-h-72">
        <div className="p-2 space-y-2">
          {messages.length === 0 ? (
            <div className="py-8 text-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                Nenhuma mensagem rápida salva
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Clique em + para adicionar
              </p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="py-6 text-center">
              <Search className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                Nenhuma mensagem encontrada
              </p>
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <div key={msg.id} className="group relative">
                {editingId === msg.id ? (
                  <div className="space-y-2 p-2 bg-muted/30 rounded-lg">
                    <Input
                      placeholder="Nome"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-sm bg-background"
                      autoFocus
                    />
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                      className="text-sm bg-background min-h-[60px] resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm transition-colors flex items-center justify-center gap-1"
                      >
                        <Check className="w-4 h-4" />
                        Salvar
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded-md text-sm transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => onSelect(msg.text)}
                    className="relative bg-emerald-100 dark:bg-emerald-900/30 text-foreground rounded-lg rounded-tl-none px-3 py-2 cursor-pointer hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors group"
                  >
                    {/* Message bubble tail */}
                    <div className="absolute -left-2 top-0 w-0 h-0 border-t-[8px] border-t-emerald-100 dark:border-t-emerald-900/30 border-l-[8px] border-l-transparent group-hover:border-t-emerald-200 dark:group-hover:border-t-emerald-900/50 transition-colors" />
                    
                    {/* Name label */}
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">{msg.name}</p>
                    
                    <p className="text-sm pr-12 whitespace-pre-wrap line-clamp-2">{msg.text}</p>
                    
                    {/* Action buttons */}
                    <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(msg);
                        }}
                        className="p-1 hover:bg-black/10 rounded transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(msg.id);
                        }}
                        className="p-1 hover:bg-destructive/20 rounded transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
