import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, MoreVertical, Trash2, Pencil, Search, ChevronsRight } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface DisparoSubmenuPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Sanitize title - remove internal markers and text-copyright
const sanitizeTitle = (title: string): string => {
  return title
    .replace(/\[(Agente:[^\]]+|CONTEXT:[^\]]+|Search)\]\s*/gi, '')
    .replace(/text-copyright/gi, '')
    .replace(/^[\p{Emoji}\s]+/gu, '')
    .trim() || 'Nova conversa';
};

export function DisparoSubmenuPanel({ isOpen, onClose }: DisparoSubmenuPanelProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameConvId, setRenameConvId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  
  // Ref to track if we've done initial load
  const hasLoadedRef = useRef(false);

  const currentConversationId = searchParams.get('conversation');

  // Fetch conversations - only show loading on first fetch
  const fetchConversations = useCallback(async (showLoading = true) => {
    if (showLoading && !hasLoadedRef.current) {
      setIsLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from("dispatch_conversations")
        .select("id, title, created_at, updated_at")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      
      // Update conversations without flickering
      setConversations(prev => {
        const newData = data || [];
        // Only update if data actually changed
        if (JSON.stringify(prev.map(c => c.id + c.title + c.updated_at)) === 
            JSON.stringify(newData.map(c => c.id + c.title + c.updated_at))) {
          return prev;
        }
        return newData;
      });
      
      hasLoadedRef.current = true;
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchConversations(!hasLoadedRef.current);
    }
  }, [isOpen, fetchConversations]);

  // Realtime subscription for conversation changes
  useEffect(() => {
    if (!isOpen) return;

    const channel = supabase
      .channel('disparo-conversations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dispatch_conversations'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Add new conversation at the top
            const newConv = payload.new as Conversation;
            setConversations(prev => {
              // Avoid duplicates
              if (prev.some(c => c.id === newConv.id)) return prev;
              return [newConv, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            // Update existing conversation and move to top
            const updatedConv = payload.new as Conversation;
            setConversations(prev => {
              const filtered = prev.filter(c => c.id !== updatedConv.id);
              return [updatedConv, ...filtered];
            });
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted conversation
            const deletedId = payload.old?.id;
            if (deletedId) {
              setConversations(prev => prev.filter(c => c.id !== deletedId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen]);

  // Handle new conversation - use explicit ?new=1 signal to trigger reset
  const handleNewConversation = () => {
    navigate('/admin/disparo?new=1', { replace: true });
  };

  // Load conversation - navigate with conversation ID
  const handleSelectConversation = (convId: string) => {
    // Navigate explicitly with the conversation ID to ensure correct routing
    navigate(`/admin/disparo?conversation=${convId}`);
  };

  // Rename conversation
  const openRenameDialog = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameConvId(id);
    setRenameValue(currentTitle);
    setRenameDialogOpen(true);
  };

  const handleRename = async () => {
    if (!renameConvId || !renameValue.trim()) return;

    try {
      const { error } = await supabase
        .from("dispatch_conversations")
        .update({ title: renameValue.trim() })
        .eq("id", renameConvId);

      if (error) throw error;
      
      toast.success("Conversa renomeada");
      // Realtime subscription will update the list automatically
      setRenameDialogOpen(false);
    } catch (error) {
      console.error("Error renaming conversation:", error);
      toast.error("Erro ao renomear conversa");
    }
  };

  // Delete conversation
  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from("dispatch_conversations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Conversa apagada");
      
      // If deleting current conversation, navigate to new
      if (id === currentConversationId) {
        navigate('/admin/disparo?new=1', { replace: true });
      }
      
      // Realtime subscription will update the list automatically
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error("Erro ao apagar conversa");
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="flex flex-col h-full py-4">
        {/* Header */}
        <div className="flex items-center justify-between px-2 mb-4">
          <h2 className="text-lg font-semibold text-white">Disparo</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="url(#gradient-chevrons)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="gradient-chevrons" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" />
                </linearGradient>
              </defs>
              <path d="m6 17 5-5-5-5" />
              <path d="m13 17 5-5-5-5" />
            </svg>
          </button>
        </div>

        {/* New conversation button */}
        <button
          onClick={handleNewConversation}
          className="flex items-center justify-center gap-2 mx-2 mb-3 px-3 py-2.5 rounded-lg text-orange-400 text-sm font-medium transition-all hover:text-orange-300 hover:bg-orange-500/5"
          style={{
            border: '1px dashed',
            borderColor: 'rgba(249, 115, 22, 0.5)',
            backgroundImage: 'none',
          }}
        >
          <Plus className="h-4 w-4" />
          Nova conversa
        </button>

        {/* Search */}
        {conversations.length > 0 && (
          <div className="px-2 mb-2">
            <div className="relative">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
              <Input 
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-6 h-8 text-xs bg-transparent border-0 border-b border-white/20 rounded-none text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:border-white/40"
              />
            </div>
          </div>
        )}

        {/* Label */}
        <div className="px-2 mb-2">
          <span className="text-xs tracking-wide text-white/70 font-medium">Seus chats</span>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm">
              {searchQuery ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div 
                key={conv.id}
                className={cn(
                  "flex items-center justify-between group rounded-lg transition-colors cursor-pointer",
                  currentConversationId === conv.id 
                    ? "bg-white/10 text-white" 
                    : "hover:bg-white/5 text-white/80 hover:text-white"
                )}
              >
                <button
                  onClick={() => handleSelectConversation(conv.id)}
                  className="flex-1 text-left px-3 py-2 text-sm"
                >
                  <span className="block truncate max-w-[140px]">{sanitizeTitle(conv.title)}</span>
                </button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className={cn(
                        "h-7 w-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity mr-1 rounded",
                        currentConversationId === conv.id 
                          ? "hover:bg-white/20" 
                          : "hover:bg-white/20"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background border border-border z-[60]">
                    <DropdownMenuItem 
                      onClick={(e) => openRenameDialog(conv.id, conv.title, e)}
                      className="cursor-pointer"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="text-destructive cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Apagar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear conversa</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Nome da conversa"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRename}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
