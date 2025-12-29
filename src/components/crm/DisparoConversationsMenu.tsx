import { useState, useEffect, useRef, useCallback } from "react";
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
  hasActiveDispatch?: boolean;
  activeDispatchProgress?: number;
  activeDispatchStatus?: string;
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

  // Fetch active dispatches for all conversations
  const fetchActiveDispatches = async () => {
    try {
      const { data, error } = await supabase
        .from("dispatch_jobs")
        .select("conversation_id, sent_count, valid_leads, status")
        .in("status", ["pending", "running", "paused"]);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching active dispatches:", error);
      return [];
    }
  };

  // Fetch conversations and enrich with active dispatch info
  const fetchConversations = async () => {
    setIsLoading(true);
    try {
      const [conversationsResult, activeDispatches] = await Promise.all([
        supabase
          .from("dispatch_conversations")
          .select("*")
          .order("updated_at", { ascending: false }),
        fetchActiveDispatches(),
      ]);

      if (conversationsResult.error) throw conversationsResult.error;

      // Enrich conversations with dispatch info
      const enrichedConversations = (conversationsResult.data || []).map((conv) => {
        const activeJob = activeDispatches.find((d) => d.conversation_id === conv.id);
        return {
          ...conv,
          hasActiveDispatch: !!activeJob,
          activeDispatchProgress:
            activeJob && activeJob.valid_leads > 0
              ? Math.round((activeJob.sent_count / activeJob.valid_leads) * 100)
              : 0,
          activeDispatchStatus: activeJob?.status,
        };
      });

      setConversations(enrichedConversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Refresh list when a conversation is selected/created (the view is responsible for saving)
  useEffect(() => {
    if (currentConversationId) {
      fetchConversations();
    }
  }, [currentConversationId]);

  // Check if there are any active dispatches
  const hasActiveDispatches = useCallback(() => {
    return conversations.some((c) => c.hasActiveDispatch);
  }, [conversations]);

  // Polling fallback for active dispatches
  const refreshActiveDispatches = useCallback(async () => {
    console.log('[DisparoMenu] Polling for active dispatches');
    const { data: activeJobs } = await supabase
      .from('dispatch_jobs')
      .select('id, conversation_id, status, sent_count, valid_leads')
      .in('status', ['pending', 'running', 'paused']);

    if (activeJobs && activeJobs.length > 0) {
      setConversations(prev => prev.map(conv => {
        const activeJob = activeJobs.find(j => j.conversation_id === conv.id);
        if (activeJob) {
          const progress = activeJob.valid_leads > 0
            ? Math.round((activeJob.sent_count / activeJob.valid_leads) * 100)
            : 0;
          return {
            ...conv,
            hasActiveDispatch: true,
            activeDispatchProgress: progress,
            activeDispatchStatus: activeJob.status
          };
        }
        return conv;
      }));
    }
  }, []);

  // Resilient realtime subscription with polling fallback
  useEffect(() => {
    console.log('[DisparoMenu] Setting up resilient realtime subscription');

    let isSubscribed = false;
    let reconnectAttempt = 0;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

    const handleUpdate = (payload: any) => {
      const updatedJob = payload.new;
      console.log('[DisparoMenu] Job UPDATE:', updatedJob.id, 'sent:', updatedJob.sent_count, '/', updatedJob.valid_leads);

      setConversations(prev => prev.map(conv => {
        if (conv.id === updatedJob.conversation_id) {
          const isActive = ['pending', 'running', 'paused'].includes(updatedJob.status);
          const progress = updatedJob.valid_leads > 0
            ? Math.round((updatedJob.sent_count / updatedJob.valid_leads) * 100)
            : 0;
          return {
            ...conv,
            hasActiveDispatch: isActive,
            activeDispatchProgress: progress,
            activeDispatchStatus: updatedJob.status
          };
        }
        return conv;
      }));
    };

    const handleInsert = (payload: any) => {
      const newJob = payload.new;
      console.log('[DisparoMenu] Job INSERT:', newJob.id);

      setConversations(prev => prev.map(conv => {
        if (conv.id === newJob.conversation_id) {
          return {
            ...conv,
            hasActiveDispatch: true,
            activeDispatchProgress: 0,
            activeDispatchStatus: newJob.status
          };
        }
        return conv;
      }));
    };

    const subscribe = () => {
      if (channel) {
        supabase.removeChannel(channel);
      }

      channel = supabase
        .channel('dispatch-menu-updates')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dispatch_jobs' }, handleUpdate)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dispatch_jobs' }, handleInsert)
        .subscribe((status) => {
          console.log('[DisparoMenu] Channel status:', status);

          if (status === 'SUBSCRIBED') {
            isSubscribed = true;
            reconnectAttempt = 0;
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            isSubscribed = false;
            scheduleReconnect();
          }
        });
    };

    const scheduleReconnect = () => {
      if (reconnectTimeout) return;

      const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)];
      console.log(`[DisparoMenu] Reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1})`);

      reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        reconnectAttempt++;
        subscribe();
      }, delay);
    };

    // Start polling every 5 seconds as fallback
    pollingInterval = setInterval(() => {
      if (!isSubscribed || hasActiveDispatches()) {
        refreshActiveDispatches();
      }
    }, 5000);

    // Handle visibility change
    const handleVisibility = () => {
      if (!document.hidden) {
        console.log('[DisparoMenu] Tab visible - checking connection');
        if (!isSubscribed) {
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectAttempt = 0;
          subscribe();
        }
        refreshActiveDispatches();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    subscribe();

    return () => {
      console.log('[DisparoMenu] Cleaning up');
      document.removeEventListener('visibilitychange', handleVisibility);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pollingInterval) clearInterval(pollingInterval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [hasActiveDispatches, refreshActiveDispatches]);

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

  // Delete conversation and cancel associated dispatch jobs
  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      // First, cancel any running/paused dispatch jobs linked to this conversation
      const { error: cancelError } = await supabase
        .from("dispatch_jobs")
        .update({ 
          status: 'cancelled', 
          completed_at: new Date().toISOString() 
        })
        .eq("conversation_id", id)
        .in("status", ['pending', 'running', 'paused']);

      if (cancelError) {
        console.error("Error cancelling dispatch jobs:", cancelError);
        // Continue anyway - we still want to delete the conversation
      }

      // Now delete the conversation
      const { error } = await supabase
        .from("dispatch_conversations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Conversa e disparos associados cancelados");
      
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
      <div className="flex flex-col text-background">
        {/* Main trigger button */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 font-semibold text-base hover:bg-background/10 px-2 py-1.5 rounded-lg transition-colors"
        >
          <ChevronRight className={cn(
            "h-4 w-4 transition-transform duration-200",
            isExpanded && "rotate-90"
          )} />
          {isInConversation ? (
            <span className="max-w-[180px] truncate">{currentTitle}</span>
          ) : (
            <span>Disparo</span>
          )}
        </button>

        {/* Collapsible submenu */}
        {isExpanded && (
          <div className="ml-2 mt-1 border-l border-background/30 pl-3">
            {/* New conversation button */}
            <div className="relative p-[1px] rounded-lg bg-gradient-to-r from-orange-500 to-orange-600">
              <button
                onClick={onNewConversation}
                className="flex items-center justify-center gap-2 w-full px-2 py-1.5 text-sm rounded-[7px] transition-colors bg-transparent hover:bg-background/10"
              >
                <Plus className="h-4 w-4" />
                Nova conversa
              </button>
            </div>

            {conversations.length > 0 && (
              <>
                {/* Search field */}
                <div className="px-2 py-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-background/50" />
                    <Input 
                      placeholder="Buscar..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-7 text-xs bg-background/10 border-background/20 text-background placeholder:text-background/50"
                    />
                  </div>
                </div>

                {/* Conversations list */}
                <div className="max-h-[calc(100vh-250px)] overflow-y-auto space-y-0.5">
                  {filteredConversations.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-background/50 text-center">
                      Nenhuma conversa
                    </div>
                  ) : (
                    filteredConversations.map((conv) => (
                      <div 
                        key={conv.id}
                        className={cn(
                          "flex items-center justify-between group rounded-lg transition-colors",
                          currentConversationId === conv.id 
                            ? "bg-background text-foreground" 
                            : "hover:bg-background/10"
                        )}
                      >
                        <button
                          onClick={() => loadConversation(conv.id)}
                          className="flex-1 text-left px-2 py-1.5 text-sm truncate max-w-[130px]"
                        >
                          <span className="block truncate">{conv.title}</span>
                        </button>
                        
                        {/* Active dispatch indicator */}
                        {conv.hasActiveDispatch && (
                          <div className="flex items-center gap-1.5 mr-1">
                            <div className="relative flex items-center justify-center">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                conv.activeDispatchStatus === 'paused' 
                                  ? "bg-yellow-500" 
                                  : "bg-green-500 animate-pulse"
                              )} />
                              {conv.activeDispatchStatus !== 'paused' && (
                                <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping opacity-50" />
                              )}
                            </div>
                            <span className={cn(
                              "text-[10px] font-medium tabular-nums",
                              conv.activeDispatchStatus === 'paused'
                                ? "text-yellow-500"
                                : "text-green-500"
                            )}>
                              {conv.activeDispatchProgress}%
                            </span>
                          </div>
                        )}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={cn(
                                "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity mr-1",
                                currentConversationId === conv.id 
                                  ? "hover:bg-muted" 
                                  : "hover:bg-background/20"
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