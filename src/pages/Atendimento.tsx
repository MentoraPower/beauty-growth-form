import { useSearchParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Smartphone, ChevronDown, Check, RefreshCw, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import WhatsAppIcon from "@/components/icons/WhatsApp";
import WhatsApp from "./WhatsApp";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

type SidebarTab = "conversas" | "grupos";

interface WhatsAppAccount {
  id: string;
  name: string;
  phone_number?: string;
  status: string;
  api_key?: string;
}

export default function Atendimento() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspace();

  // WhatsApp account state
  const [whatsappAccounts, setWhatsappAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [showAddAccountDialog, setShowAddAccountDialog] = useState(false);
  const [accountToConnect, setAccountToConnect] = useState<WhatsAppAccount | null>(null);
  
  // Sidebar tab state - managed here and passed down
  const [sidebarTab, setSidebarTabInternal] = useState<SidebarTab>(() => {
    const tabFromUrl = searchParams.get('tab');
    return tabFromUrl === 'grupos' ? 'grupos' : 'conversas';
  });
  
  const setSidebarTab = useCallback((tab: SidebarTab) => {
    setSidebarTabInternal(tab);
    setSearchParams(currentParams => {
      const newParams = new URLSearchParams(currentParams);
      if (tab === 'grupos') {
        newParams.set('tab', 'grupos');
      } else {
        newParams.delete('tab');
      }
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  // Store selected account per workspace
  const getStorageKey = useCallback(() => {
    return currentWorkspace?.id 
      ? `whatsapp_selected_account_${currentWorkspace.id}` 
      : 'whatsapp_selected_account_id';
  }, [currentWorkspace?.id]);

  // Load saved selection on workspace change
  useEffect(() => {
    if (currentWorkspace?.id) {
      const saved = localStorage.getItem(getStorageKey());
      if (saved) {
        setSelectedAccountId(saved);
      } else {
        setSelectedAccountId(null);
      }
    }
  }, [currentWorkspace?.id, getStorageKey]);

  // Save selection to localStorage
  useEffect(() => {
    if (selectedAccountId && currentWorkspace?.id) {
      localStorage.setItem(getStorageKey(), selectedAccountId);
    }
  }, [selectedAccountId, currentWorkspace?.id, getStorageKey]);

  // Fetch WhatsApp accounts filtered by workspace
  const fetchWhatsAppAccounts = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    
    setIsLoadingAccounts(true);
    try {
      // Get linked accounts for this workspace
      const { data: linkedAccounts } = await supabase
        .from("workspace_whatsapp_accounts")
        .select("session_id, session_name")
        .eq("workspace_id", currentWorkspace.id);

      const linkedSessionIds = new Set(linkedAccounts?.map(a => a.session_id) || []);

      // Get all sessions from WasenderAPI
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "list-sessions" },
      });

      if (error) throw error;

      if (data?.success && Array.isArray(data.data)) {
        // Filter to only show accounts linked to this workspace
        const filteredAccounts = data.data.filter((acc: WhatsAppAccount) => 
          linkedSessionIds.has(acc.api_key || String(acc.id))
        );

        setWhatsappAccounts(filteredAccounts);
        
        // Auto-select first connected account if none selected
        const savedAccountId = localStorage.getItem(getStorageKey());
        const savedAccount = savedAccountId 
          ? filteredAccounts.find((acc: WhatsAppAccount) => String(acc.id) === savedAccountId) 
          : null;
        
        if (savedAccount && savedAccount.status?.toLowerCase() === "connected") {
          if (selectedAccountId !== savedAccount.id) {
            setSelectedAccountId(savedAccount.id);
          }
        } else if (!selectedAccountId && filteredAccounts.length > 0) {
          const connectedAccount = filteredAccounts.find((acc: WhatsAppAccount) => acc.status?.toLowerCase() === "connected");
          if (connectedAccount) {
            setSelectedAccountId(connectedAccount.id);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching WhatsApp accounts:", error);
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [currentWorkspace?.id, selectedAccountId, getStorageKey]);

  useEffect(() => {
    fetchWhatsAppAccounts();
  }, [fetchWhatsAppAccounts]);

  const handleAccountChange = (account: WhatsAppAccount) => {
    const isConnected = account.status?.toLowerCase() === "connected";
    if (isConnected) {
      if (selectedAccountId !== account.id) {
        setSelectedAccountId(account.id);
        localStorage.setItem('whatsapp_selected_account_id', String(account.id));
      }
    } else {
      setAccountToConnect(account);
      setShowAddAccountDialog(true);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Compact Header */}
      <div className="flex-shrink-0 border-b border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-zinc-900">
        <div className="h-11 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <WhatsAppIcon className="h-4 w-4 text-emerald-500" />
              <span>WhatsApp</span>
            </div>
          </div>

          {/* WhatsApp Account Selector - Right side */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 text-sm text-foreground bg-black/10 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/15 px-2.5 py-1.5 rounded-lg transition-all">
              <Smartphone className="w-4 h-4 text-emerald-500" />
              <span className="truncate max-w-[160px] font-medium">
                  {selectedAccountId 
                    ? whatsappAccounts.find(a => a.id === selectedAccountId)?.name || "Conta WhatsApp"
                    : "Selecionar conta"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {isLoadingAccounts ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : whatsappAccounts.length > 0 ? (
                <>
                  {whatsappAccounts.map((account) => {
                    const isConnected = account.status?.toLowerCase() === "connected";
                    return (
                      <DropdownMenuItem
                        key={account.id}
                        className={cn(
                          "cursor-pointer flex items-center gap-2",
                          selectedAccountId === account.id && "bg-muted"
                        )}
                        onClick={() => handleAccountChange(account)}
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          isConnected ? "bg-emerald-500" : "bg-amber-500"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{account.name}</p>
                          {account.phone_number && (
                            <p className="text-xs text-muted-foreground truncate">{account.phone_number}</p>
                          )}
                        </div>
                        {isConnected && selectedAccountId === account.id && (
                          <Check className="w-4 h-4 text-emerald-500" />
                        )}
                        {!isConnected && (
                          <span className="text-xs text-amber-600">Conectar</span>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                </>
              ) : (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                  Nenhuma conta conectada
                </div>
              )}
              <DropdownMenuItem 
                className="cursor-pointer"
                onClick={() => {
                  setAccountToConnect(null);
                  setShowAddAccountDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar conta WhatsApp
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Tabs - Below header, aligned with sidebar */}
        <div className="flex w-[320px]">
          <button
            onClick={() => setSidebarTab("conversas")}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-all",
              sidebarTab === "conversas" 
                ? "text-foreground" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            <span>Conversas</span>
            {sidebarTab === "conversas" && (
              <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-emerald-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setSidebarTab("grupos")}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-all",
              sidebarTab === "grupos" 
                ? "text-foreground" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            <span>Grupos</span>
            {sidebarTab === "grupos" && (
              <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-emerald-500 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Content - Full height and width */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <WhatsApp 
          selectedAccountId={selectedAccountId}
          setSelectedAccountId={setSelectedAccountId}
          whatsappAccounts={whatsappAccounts}
          setWhatsappAccounts={setWhatsappAccounts}
          showAddAccountDialog={showAddAccountDialog}
          setShowAddAccountDialog={setShowAddAccountDialog}
          accountToConnect={accountToConnect}
          setAccountToConnect={setAccountToConnect}
          fetchWhatsAppAccounts={fetchWhatsAppAccounts}
          sidebarTab={sidebarTab}
          setSidebarTab={setSidebarTab}
        />
      </div>
    </div>
  );
}