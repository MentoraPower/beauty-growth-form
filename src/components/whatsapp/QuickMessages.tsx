import { useState, useEffect } from "react";
import { Plus, X, MessageSquare, Trash2, Edit2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface QuickMessagesProps {
  onSelect: (message: string) => void;
}

interface QuickMessage {
  id: string;
  text: string;
}

const STORAGE_KEY = "whatsapp_quick_messages";

export function QuickMessages({ onSelect }: QuickMessagesProps) {
  const [messages, setMessages] = useState<QuickMessage[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isAdding, setIsAdding] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  const handleAdd = () => {
    if (!newMessage.trim()) return;
    
    const msg: QuickMessage = {
      id: `qm-${Date.now()}`,
      text: newMessage.trim(),
    };
    
    setMessages((prev) => [...prev, msg]);
    setNewMessage("");
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const handleStartEdit = (msg: QuickMessage) => {
    setEditingId(msg.id);
    setEditText(msg.text);
  };

  const handleSaveEdit = () => {
    if (!editText.trim() || !editingId) return;
    
    setMessages((prev) =>
      prev.map((m) => (m.id === editingId ? { ...m, text: editText.trim() } : m))
    );
    setEditingId(null);
    setEditText("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  return (
    <div className="w-80 bg-card rounded-lg shadow-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium text-foreground">Mensagens Rápidas</span>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={cn(
            "p-1 rounded transition-colors",
            isAdding ? "bg-destructive/10 text-destructive" : "hover:bg-muted/50 text-muted-foreground"
          )}
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {/* Add new message */}
      {isAdding && (
        <div className="p-2 border-b border-border bg-muted/20">
          <div className="flex gap-2">
            <Input
              placeholder="Digite sua mensagem rápida..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="h-8 text-sm bg-background"
              autoFocus
            />
            <button
              onClick={handleAdd}
              disabled={!newMessage.trim()}
              className="px-3 h-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* Messages list */}
      <ScrollArea className="max-h-64">
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
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="group relative">
                {editingId === msg.id ? (
                  <div className="flex gap-1">
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit();
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                      className="h-8 text-sm bg-background flex-1"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveEdit}
                      className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => onSelect(msg.text)}
                    className="relative bg-emerald-100 dark:bg-emerald-900/30 text-foreground rounded-lg rounded-tl-none px-3 py-2 cursor-pointer hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors group"
                  >
                    {/* Message bubble tail */}
                    <div className="absolute -left-2 top-0 w-0 h-0 border-t-[8px] border-t-emerald-100 dark:border-t-emerald-900/30 border-l-[8px] border-l-transparent group-hover:border-t-emerald-200 dark:group-hover:border-t-emerald-900/50 transition-colors" />
                    
                    <p className="text-sm pr-12 whitespace-pre-wrap">{msg.text}</p>
                    
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
