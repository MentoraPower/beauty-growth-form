import { useSearchParams } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Smartphone, ChevronDown, Check, RefreshCw, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import WhatsAppIcon from "@/components/icons/WhatsApp";
import InstagramIcon from "@/components/icons/Instagram";
import WhatsApp from "./WhatsApp";
import InstagramPage from "./Instagram";
import { supabase } from "@/integrations/supabase/client";

type TabType = 'whatsapp' | 'instagram';

interface WhatsAppAccount {
  id: string;
  name: string;
  phone_number?: string;
  status: string;
  api_key?: string;
}

// Persistent state outside component to survive tab switches
let cachedWhatsappAccounts: WhatsAppAccount[] = [];
let cachedSelectedAccountId: string | null = localStorage.getItem('whatsapp_selected_account_id');
let hasLoadedAccounts = false;

export default function Atendimento() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabType = tabParam === 'instagram' ? 'instagram' : 'whatsapp';

  // WhatsApp account state - use cached values as initial state
  const [whatsappAccounts, setWhatsappAccounts] = useState<WhatsAppAccount[]>(cachedWhatsappAccounts);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(cachedSelectedAccountId);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [showAddAccountDialog, setShowAddAccountDialog] = useState(false);
  const [accountToConnect, setAccountToConnect] = useState<WhatsAppAccount | null>(null);

  // Sync state with cache
  useEffect(() => {
    cachedWhatsappAccounts = whatsappAccounts;
  }, [whatsappAccounts]);

  useEffect(() => {
    cachedSelectedAccountId = selectedAccountId;
    if (selectedAccountId) {
      localStorage.setItem('whatsapp_selected_account_id', selectedAccountId);
    }
  }, [selectedAccountId]);

  // Fetch WhatsApp accounts - only if not already loaded
  const fetchWhatsAppAccounts = useCallback(async () => {
    // Skip if already loaded and have accounts
    if (hasLoadedAccounts && cachedWhatsappAccounts.length > 0) {
      console.log(`[Atendimento] Using cached accounts: ${cachedWhatsappAccounts.length}`);
      return;
    }
    
    setIsLoadingAccounts(true);
    try {
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { action: "list-sessions" },
      });

      if (error) throw error;

      if (data?.success && Array.isArray(data.data)) {
        console.log(`[Atendimento] Fetched ${data.data.length} accounts`);
        setWhatsappAccounts(data.data);
        hasLoadedAccounts = true;
        
        const savedAccountId = localStorage.getItem('whatsapp_selected_account_id');
        const savedAccount = savedAccountId ? data.data.find((acc: WhatsAppAccount) => String(acc.id) === savedAccountId) : null;
        
        if (savedAccount && savedAccount.status?.toLowerCase() === "connected") {
          if (selectedAccountId !== savedAccount.id) {
            setSelectedAccountId(savedAccount.id);
          }
        } else if (!selectedAccountId && data.data.length > 0) {
          const connectedAccount = data.data.find((acc: WhatsAppAccount) => acc.status?.toLowerCase() === "connected");
          if (connectedAccount) {
            setSelectedAccountId(connectedAccount.id);
            localStorage.setItem('whatsapp_selected_account_id', String(connectedAccount.id));
          }
        }
      }
    } catch (error) {
      console.error("Error fetching WhatsApp accounts:", error);
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    fetchWhatsAppAccounts();
  }, []);

  const handleTabChange = (tab: TabType) => {
    setSearchParams({ tab }, { replace: true });
  };

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
    <div className="h-[calc(100vh-1.5rem)] flex flex-col -mt-6 -mr-6 -mb-6 -ml-6 rounded-2xl overflow-hidden bg-background">
      {/* Tabs Header */}
      <div className="flex-shrink-0 border-b border-border px-4 pt-2 pb-0 flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => handleTabChange('whatsapp')}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2 transition-all duration-200 text-sm font-medium rounded-t-lg",
              activeTab === 'whatsapp'
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <WhatsAppIcon className="h-4 w-4" />
            <span>WhatsApp</span>
            {activeTab === 'whatsapp' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/60 to-primary-dark/60" />
            )}
          </button>
          
          <button
            onClick={() => handleTabChange('instagram')}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2 transition-all duration-200 text-sm font-medium rounded-t-lg",
              activeTab === 'instagram'
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <InstagramIcon className="h-4 w-4" />
            <span>Instagram</span>
            {activeTab === 'instagram' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/60 to-primary-dark/60" />
            )}
          </button>
        </div>

        {/* WhatsApp Account Selector - Right side */}
        {activeTab === 'whatsapp' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 text-sm text-foreground hover:bg-muted/50 px-3 py-1.5 rounded-md transition-colors mb-1">
                <Smartphone className="w-4 h-4 text-emerald-500" />
                <span className="truncate max-w-[180px] font-medium">
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
        )}
      </div>

      {/* Tab Content - Full height and width */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div 
          key={activeTab}
          className="h-full animate-in fade-in duration-200"
        >
          {activeTab === 'whatsapp' ? (
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
            />
          ) : (
            <InstagramPage />
          )}
        </div>
      </div>
    </div>
  );
}
