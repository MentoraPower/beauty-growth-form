import { useState, useEffect, useRef } from "react";
import { ChevronDown, Plus, MoreVertical, Trash2, MessageSquare, Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

interface DisparoConversationsMenuProps {
  currentConversationId: string | null;
  onSelectConversation: (id: string, messages: Message[]) => void;
  onNewConversation: () => void;
  onConversationCreated: (id: string) => void;
  messages: Message[];
}

export function DisparoConversationsMenu({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onConversationCreated,
  messages,
}: DisparoConversationsMenuProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTitle, setCurrentTitle] = useState("Disparo");
  const [searchQuery, setSearchQuery] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameConvId, setRenameConvId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const lastSavedMessagesCount = useRef(0);

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
    fetchConversations();
  }, []);

  // Update current title when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      const conv = conversations.find(c => c.id === currentConversationId);
      if (conv) {
        setCurrentTitle(conv.title);
      }
    } else {
      setCurrentTitle("Disparo");
    }
  }, [currentConversationId, conversations]);

  // Save conversation (create new or update existing)
  const saveConversation = async (forceCreate = false) => {
    if (messages.length === 0) return null;

    try {
      // Generate title from first user message
      const firstUserMessage = messages.find(m => m.role === "user");
      const title = firstUserMessage 
        ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "")
        : "Nova conversa";

      const messagesJson = messages.map(m => ({
        id: m.id,
        content: m.content,
        role: m.role,
        timestamp: m.timestamp.toISOString(),
      }));

      if (currentConversationId && !forceCreate) {
        // Update existing - don't update title if it was manually renamed
        const existingConv = conversations.find(c => c.id === currentConversationId);
        const shouldUpdateTitle = existingConv && existingConv.title === title;
        
        const { error } = await supabase
          .from("dispatch_conversations")
          .update({ 
            messages: messagesJson,
            updated_at: new Date().toISOString()
          })
          .eq("id", currentConversationId);

        if (error) throw error;
        lastSavedMessagesCount.current = messages.length;
        return currentConversationId;
      } else {
        // Create new
        const { data, error } = await supabase
          .from("dispatch_conversations")
          .insert({ 
            messages: messagesJson,
            title 
          })
          .select()
          .single();

        if (error) throw error;
        lastSavedMessagesCount.current = messages.length;
        fetchConversations();
        return data.id;
      }
    } catch (error) {
      console.error("Error saving conversation:", error);
      return null;
    }
  };

  // Auto-save: create new conversation when first message is sent
  useEffect(() => {
    if (messages.length > 0 && !currentConversationId && messages.length > lastSavedMessagesCount.current) {
      // First message - create new conversation
      saveConversation(true).then((newId) => {
        if (newId) {
          onConversationCreated(newId);
        }
      });
    } else if (messages.length > 0 && currentConversationId && messages.length > lastSavedMessagesCount.current) {
      // Subsequent messages - update existing
      const timeout = setTimeout(() => {
        saveConversation();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [messages, currentConversationId]);

  // Reset counter when conversation changes
  useEffect(() => {
    lastSavedMessagesCount.current = messages.length;
  }, [currentConversationId]);

  // Load conversation
  const loadConversation = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("dispatch_conversations")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      const loadedMessages: Message[] = ((data.messages as any[]) || []).map((m: any) => ({
        id: m.id,
        content: m.content,
        role: m.role as "user" | "assistant",
        timestamp: new Date(m.timestamp),
      }));

      lastSavedMessagesCount.current = loadedMessages.length;
      onSelectConversation(id, loadedMessages);
    } catch (error) {
      console.error("Error loading conversation:", error);
      toast.error("Erro ao carregar conversa");
    }
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
      
      // If deleting current conversation, start a new one
      if (id === currentConversationId) {
        onNewConversation();
      }
      
      fetchConversations();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error("Erro ao apagar conversa");
    }
  };

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If inside a conversation, show breadcrumb style
  const isInConversation = currentConversationId && messages.length > 0;

  return (
    <>
      <DropdownMenu onOpenChange={() => setSearchQuery("")}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 text-foreground font-semibold text-lg hover:bg-muted/50 px-2"
          >
            {isInConversation ? (
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground">Scale</span>
                <span className="text-muted-foreground">&gt;</span>
                <span className="max-w-[200px] truncate">{currentTitle}</span>
              </span>
            ) : (
              <>
                Disparo
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          className="w-80 bg-popover border border-border shadow-lg z-50"
        >
          <DropdownMenuItem 
            onClick={onNewConversation}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nova conversa
          </DropdownMenuItem>
          
          {conversations.length > 0 && (
            <>
              <DropdownMenuSeparator />
              
              {/* Search field */}
              <div className="px-2 py-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar conversas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm bg-muted/50"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              
              <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                Conversas salvas ({filteredConversations.length})
              </div>
              
              <div className="max-h-[300px] overflow-y-auto">
                {filteredConversations.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                    Nenhuma conversa encontrada
                  </div>
                ) : (
                  filteredConversations.map((conv) => (
                    <div 
                      key={conv.id}
                      className="flex items-center justify-between group hover:bg-muted/50 rounded-sm"
                    >
                      <DropdownMenuItem 
                        onClick={() => loadConversation(conv.id)}
                        className="flex-1 flex items-center gap-2 cursor-pointer pr-1"
                      >
                        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm">{conv.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(conv.updated_at), "dd MMM, HH:mm", { locale: ptBR })}
                          </div>
                        </div>
                      </DropdownMenuItem>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity mr-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border border-border z-[60]">
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
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
