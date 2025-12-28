import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, Plus, MoreVertical, Trash2, Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MessageComponentData {
  type: 'leads_preview' | 'html_editor' | 'origins_list' | 'dispatch_progress' | 'csv_preview' | 'email_choice' | 'email_generator' | 'copy_choice' | 'copy_input' | 'email_generator_streaming';
  data?: any;
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  component?: React.ReactNode;
  componentData?: MessageComponentData;
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
  const [isExpanded, setIsExpanded] = useState(false);
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

      const messagesJson = messages.map(m => {
        const msg: Record<string, any> = {
          id: m.id,
          content: m.content,
          role: m.role,
          timestamp: m.timestamp.toISOString(),
        };
        if (m.componentData) {
          msg.componentData = m.componentData;
        }
        return msg;
      });

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
        componentData: m.componentData || undefined,
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
      <div className="flex flex-col">
        {/* Main trigger button */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-foreground font-semibold text-lg hover:bg-muted/50 px-2 py-1.5 rounded-lg transition-colors"
        >
          <ChevronRight className={cn(
            "h-4 w-4 transition-transform duration-200",
            isExpanded && "rotate-90"
          )} />
          {isInConversation ? (
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground">Scale</span>
              <span className="text-muted-foreground">&gt;</span>
              <span className="max-w-[200px] truncate">{currentTitle}</span>
            </span>
          ) : (
            <span>Disparo</span>
          )}
        </button>

        {/* Collapsible submenu */}
        {isExpanded && (
          <div className="ml-2 mt-1 border-l-2 border-foreground/20 pl-3">
            {/* New conversation button */}
            <button
              onClick={onNewConversation}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-foreground hover:bg-muted/50 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nova conversa
            </button>

            {conversations.length > 0 && (
              <>
                {/* Search field */}
                <div className="px-2 py-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-7 text-xs bg-muted/50 border-border/40"
                    />
                  </div>
                </div>

                {/* Conversations list */}
                <div className="max-h-[250px] overflow-y-auto space-y-0.5">
                  {filteredConversations.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground text-center">
                      Nenhuma conversa
                    </div>
                  ) : (
                    filteredConversations.map((conv) => (
                      <div 
                        key={conv.id}
                        className={cn(
                          "flex items-center justify-between group rounded-lg transition-colors",
                          currentConversationId === conv.id 
                            ? "bg-foreground text-background" 
                            : "hover:bg-muted/50"
                        )}
                      >
                        <button
                          onClick={() => loadConversation(conv.id)}
                          className="flex-1 text-left px-2 py-1.5 text-sm truncate"
                        >
                          {conv.title}
                        </button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={cn(
                                "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity mr-1",
                                currentConversationId === conv.id && "hover:bg-background/20"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
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
              </>
            )}
          </div>
        )}
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