import { useState, useEffect } from "react";
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

export function DisparoSubmenuPanel({ isOpen, onClose }: DisparoSubmenuPanelProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameConvId, setRenameConvId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const currentConversationId = searchParams.get('conversation');

  // Fetch conversations
  const fetchConversations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("dispatch_conversations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConversations();
    }
  }, [isOpen]);

  // Handle new conversation
  const handleNewConversation = () => {
    setSearchParams({});
    navigate('/admin/disparo');
  };

  // Load conversation
  const handleSelectConversation = (id: string) => {
    setSearchParams({ conversation: id });
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
      fetchConversations();
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
      
      // If deleting current conversation, clear params
      if (id === currentConversationId) {
        setSearchParams({});
      }
      
      fetchConversations();
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
          className="flex items-center gap-2 mx-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors mb-3"
        >
          <Plus className="h-4 w-4" />
          Nova conversa
        </button>

        {/* Search */}
        {conversations.length > 0 && (
          <div className="px-2 mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
              <Input 
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
          </div>
        )}

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
                  className="flex-1 text-left px-3 py-2 text-sm truncate"
                >
                  {conv.title}
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
