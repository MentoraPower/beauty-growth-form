import { useState, useEffect } from "react";
import { ChevronDown, Plus, MoreVertical, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  messages: Message[];
}

export function DisparoConversationsMenu({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  messages,
}: DisparoConversationsMenuProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTitle, setCurrentTitle] = useState("Disparo");

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

  // Save current conversation
  const saveConversation = async () => {
    if (messages.length === 0) {
      toast.error("Não há mensagens para salvar");
      return;
    }

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

      if (currentConversationId) {
        // Update existing
        const { error } = await supabase
          .from("dispatch_conversations")
          .update({ 
            messages: messagesJson,
            title,
            updated_at: new Date().toISOString()
          })
          .eq("id", currentConversationId);

        if (error) throw error;
        toast.success("Conversa atualizada");
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
        toast.success("Conversa salva");
        // Refresh conversations list
        fetchConversations();
      }
    } catch (error) {
      console.error("Error saving conversation:", error);
      toast.error("Erro ao salvar conversa");
    }
  };

  // Auto-save on messages change (debounced)
  useEffect(() => {
    if (messages.length > 0 && currentConversationId) {
      const timeout = setTimeout(() => {
        saveConversation();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [messages, currentConversationId]);

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

      onSelectConversation(id, loadedMessages);
    } catch (error) {
      console.error("Error loading conversation:", error);
      toast.error("Erro ao carregar conversa");
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-2 text-foreground font-semibold text-lg hover:bg-muted/50"
        >
          {currentTitle}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-72 bg-popover border border-border shadow-lg z-50"
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
            <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
              Conversas salvas
            </div>
            
            <div className="max-h-[300px] overflow-y-auto">
              {conversations.map((conv) => (
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
                        onClick={(e) => deleteConversation(conv.id, e)}
                        className="text-destructive cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Apagar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
