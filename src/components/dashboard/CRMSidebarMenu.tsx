import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Kanban, ChevronDown, ChevronRight, Folder, FolderOpen, MoreVertical, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Origin {
  id: string;
  nome: string;
  ordem: number;
}

interface SubOrigin {
  id: string;
  origin_id: string;
  nome: string;
  ordem: number;
}

interface LeadCount {
  sub_origin_id: string;
  count: number;
}

interface CRMSidebarMenuProps {
  isExpanded: boolean;
  onNavigate?: () => void;
  onDropdownOpenChange?: (isOpen: boolean) => void;
}

export function CRMSidebarMenu({ isExpanded, onNavigate, onDropdownOpenChange }: CRMSidebarMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [subOrigins, setSubOrigins] = useState<SubOrigin[]>([]);
  const [leadCounts, setLeadCounts] = useState<LeadCount[]>([]);
  
  // Load persisted state from localStorage
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem('crm_menu_open');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [expandedOrigins, setExpandedOrigins] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('crm_expanded_origins');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Persist isOpen to localStorage
  useEffect(() => {
    localStorage.setItem('crm_menu_open', JSON.stringify(isOpen));
  }, [isOpen]);

  // Persist expandedOrigins to localStorage
  useEffect(() => {
    localStorage.setItem('crm_expanded_origins', JSON.stringify([...expandedOrigins]));
  }, [expandedOrigins]);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'origin' | 'suborigin'>('origin');
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<{ id: string; nome: string; origin_id?: string } | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);

  const isCRMActive = location.pathname.startsWith("/admin/crm");

  useEffect(() => {
    fetchData();

    const originsChannel = supabase
      .channel('crm-origins-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_origins' }, fetchData)
      .subscribe();

    const subOriginsChannel = supabase
      .channel('crm-sub-origins-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_sub_origins' }, fetchData)
      .subscribe();

    const leadsChannel = supabase
      .channel('crm-leads-count-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(originsChannel);
      supabase.removeChannel(subOriginsChannel);
      supabase.removeChannel(leadsChannel);
    };
  }, []);

  const fetchData = async () => {
    const [originsRes, subOriginsRes, leadsRes] = await Promise.all([
      supabase.from("crm_origins").select("*").order("ordem"),
      supabase.from("crm_sub_origins").select("*").order("ordem"),
      supabase.from("leads").select("sub_origin_id"),
    ]);

    if (originsRes.data) setOrigins(originsRes.data);
    if (subOriginsRes.data) setSubOrigins(subOriginsRes.data);
    
    // Calculate lead counts per sub-origin
    if (leadsRes.data) {
      const counts: Record<string, number> = {};
      leadsRes.data.forEach((lead) => {
        if (lead.sub_origin_id) {
          counts[lead.sub_origin_id] = (counts[lead.sub_origin_id] || 0) + 1;
        }
      });
      setLeadCounts(
        Object.entries(counts).map(([sub_origin_id, count]) => ({ sub_origin_id, count }))
      );
    }
  };

  const toggleOrigin = (originId: string) => {
    setExpandedOrigins(prev => {
      const newSet = new Set(prev);
      if (newSet.has(originId)) {
        newSet.delete(originId);
      } else {
        newSet.add(originId);
      }
      return newSet;
    });
  };

  const openCreateOriginDialog = () => {
    setDialogType('origin');
    setDialogMode('create');
    setInputValue("");
    setEditingItem(null);
    setDialogOpen(true);
  };

  const openCreateSubOriginDialog = (originId: string) => {
    setDialogType('suborigin');
    setDialogMode('create');
    setInputValue("");
    setSelectedOriginId(originId);
    setEditingItem(null);
    setDialogOpen(true);
  };

  const openEditOriginDialog = (origin: Origin) => {
    setDialogType('origin');
    setDialogMode('edit');
    setInputValue(origin.nome);
    setEditingItem({ id: origin.id, nome: origin.nome });
    setDialogOpen(true);
  };

  const openEditSubOriginDialog = (subOrigin: SubOrigin) => {
    setDialogType('suborigin');
    setDialogMode('edit');
    setInputValue(subOrigin.nome);
    setEditingItem({ id: subOrigin.id, nome: subOrigin.nome, origin_id: subOrigin.origin_id });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!inputValue.trim()) {
      toast.error("Digite um nome");
      return;
    }

    if (dialogType === 'origin') {
      if (dialogMode === 'create') {
        const { error } = await supabase.from("crm_origins").insert({ nome: inputValue.trim() });
        if (error) {
          toast.error("Erro ao criar origem");
          return;
        }
        toast.success("Origem criada");
      } else if (editingItem) {
        const { error } = await supabase.from("crm_origins").update({ nome: inputValue.trim() }).eq("id", editingItem.id);
        if (error) {
          toast.error("Erro ao atualizar origem");
          return;
        }
        toast.success("Origem atualizada");
      }
    } else {
      const originId = dialogMode === 'create' ? selectedOriginId : editingItem?.origin_id;
      if (!originId) return;

      if (dialogMode === 'create') {
        const { error } = await supabase.from("crm_sub_origins").insert({ nome: inputValue.trim(), origin_id: originId });
        if (error) {
          toast.error("Erro ao criar sub-origem");
          return;
        }
        toast.success("Sub-origem criada");
      } else if (editingItem) {
        const { error } = await supabase.from("crm_sub_origins").update({ nome: inputValue.trim() }).eq("id", editingItem.id);
        if (error) {
          toast.error("Erro ao atualizar sub-origem");
          return;
        }
        toast.success("Sub-origem atualizada");
      }
    }

    setDialogOpen(false);
    fetchData();
  };

  const handleDeleteOrigin = async (originId: string) => {
    const { error } = await supabase.from("crm_origins").delete().eq("id", originId);
    if (error) {
      toast.error("Erro ao excluir origem");
      return;
    }
    toast.success("Origem excluída");
    fetchData();
  };

  const handleDeleteSubOrigin = async (subOriginId: string) => {
    const { error } = await supabase.from("crm_sub_origins").delete().eq("id", subOriginId);
    if (error) {
      toast.error("Erro ao excluir sub-origem");
      return;
    }
    toast.success("Sub-origem excluída");
    fetchData();
  };

  const handleSubOriginClick = (subOriginId: string) => {
    // Dispatch event to trigger smooth transition before navigation
    window.dispatchEvent(new CustomEvent('suborigin-change'));
    
    // Navigate immediately for snappier feel
    navigate(`/admin/crm?origin=${subOriginId}`);
    onNavigate?.();
  };

  // Render the origins menu content (reused for both expanded and collapsed states)
  const renderOriginsMenu = (inDropdown: boolean = false) => (
    <div className={cn(
      "space-y-1",
      inDropdown ? "p-2" : "mt-1 ml-4 pl-3 border-l border-white/10"
    )}>
      {origins.map((origin) => {
        const originSubOrigins = subOrigins.filter(s => s.origin_id === origin.id);
        const isOriginExpanded = expandedOrigins.has(origin.id);

        return (
          <div key={origin.id}>
            {/* Origin (Folder) */}
            <div className="flex items-center group">
              <button
                onClick={() => toggleOrigin(origin.id)}
                className={cn(
                  "flex items-center gap-2 flex-1 py-2 px-2 rounded-lg transition-all duration-200 ease-out text-sm",
                  inDropdown 
                    ? "text-foreground/90 hover:text-foreground hover:bg-muted/50"
                    : "text-white/90 hover:text-white hover:bg-white/5"
                )}
              >
                {isOriginExpanded ? (
                  <FolderOpen className={cn("h-4 w-4 flex-shrink-0", inDropdown ? "text-foreground/90" : "text-white/90")} />
                ) : (
                  <Folder className={cn("h-4 w-4 flex-shrink-0", inDropdown ? "text-foreground/90" : "text-white/90")} />
                )}
                <span className="flex-1 text-left truncate font-medium">{origin.nome}</span>
                <ChevronRight 
                  className={cn(
                    "h-3 w-3 transition-transform duration-300 ease-out",
                    inDropdown ? "text-foreground/70" : "text-white/70",
                    isOriginExpanded ? "rotate-90" : ""
                  )} 
                />
              </button>
              
              {/* Origin Actions */}
              <DropdownMenu onOpenChange={onDropdownOpenChange}>
                <DropdownMenuTrigger asChild>
                  <button 
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out",
                      inDropdown ? "hover:bg-muted" : "hover:bg-white/10"
                    )}
                  >
                    <MoreVertical className={cn("h-4 w-4", inDropdown ? "text-foreground/80" : "text-white/80")} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 z-[9999] bg-popover">
                  <DropdownMenuItem onClick={() => openEditOriginDialog(origin)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleDeleteOrigin(origin.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Sub-origins */}
            {isOriginExpanded && (
              <div className={cn(
                "ml-4 pl-2 space-y-0.5",
                inDropdown ? "border-l border-border/50" : "border-l border-white/10"
              )}>
                {originSubOrigins.map((subOrigin) => {
                  const leadCount = leadCounts.find(lc => lc.sub_origin_id === subOrigin.id)?.count || 0;
                  return (
                  <div key={subOrigin.id} className="flex items-center group">
                    <button
                      onClick={() => handleSubOriginClick(subOrigin.id)}
                      className={cn(
                        "flex items-center gap-2 flex-1 py-1.5 px-2 rounded-lg transition-all duration-200 ease-out text-xs",
                        inDropdown
                          ? "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                          : "text-white/80 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <Kanban className={cn("h-3 w-3 flex-shrink-0", inDropdown ? "text-foreground/80" : "text-white/80")} />
                      <span className="truncate">{subOrigin.nome}</span>
                      {leadCount > 0 && (
                        <span className={cn(
                          "ml-auto text-[10px] px-1.5 py-0.5 rounded-full",
                          inDropdown 
                            ? "bg-muted text-muted-foreground"
                            : "bg-white/10 text-white/70"
                        )}>
                          {leadCount}
                        </span>
                      )}
                    </button>
                    
                    {/* Sub-origin Actions */}
                    <DropdownMenu onOpenChange={onDropdownOpenChange}>
                      <DropdownMenuTrigger asChild>
                        <button 
                          onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out",
                          inDropdown ? "hover:bg-muted" : "hover:bg-white/10"
                        )}
                        >
                          <MoreVertical className={cn("h-4 w-4", inDropdown ? "text-foreground/80" : "text-white/80")} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 z-[9999] bg-popover">
                        <DropdownMenuItem onClick={() => openEditSubOriginDialog(subOrigin)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteSubOrigin(subOrigin.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  );
                })}

                {/* Add Sub-origin Button inside folder */}
                <button
                  onClick={() => openCreateSubOriginDialog(origin.id)}
                  className={cn(
                    "flex items-center gap-2 w-full py-1.5 px-2 rounded-lg transition-all duration-200 ease-out text-xs",
                    inDropdown
                      ? "text-foreground/60 hover:text-foreground hover:bg-muted/50"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Plus className="h-3 w-3" />
                  <span>Criar sub origem</span>
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add Origin Button */}
      <button
        onClick={openCreateOriginDialog}
          className={cn(
            "flex items-center gap-2 w-full py-2 px-2 rounded-lg transition-all duration-200 ease-out text-xs",
            inDropdown
              ? "text-foreground/70 hover:text-foreground hover:bg-muted/50"
              : "text-white/70 hover:text-white hover:bg-white/5"
          )}
      >
        <Plus className="h-3 w-3" />
        <span>Nova Origem</span>
      </button>
    </div>
  );

  // Render collapsed icons for origins and sub-origins
  const renderCollapsedIcons = () => (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col items-center gap-1 mt-1">
        {origins.map((origin) => {
          const originSubOrigins = subOrigins.filter(s => s.origin_id === origin.id);
          const isOriginExpanded = expandedOrigins.has(origin.id);

          return (
            <div key={origin.id} className="flex flex-col items-center">
              {/* Origin Icon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => toggleOrigin(origin.id)}
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ease-out",
                      isOriginExpanded 
                        ? "bg-white/15 text-white" 
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {isOriginExpanded ? (
                      <FolderOpen className="h-4 w-4" />
                    ) : (
                      <Folder className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="z-[9999]">
                  {origin.nome}
                </TooltipContent>
              </Tooltip>

              {/* Sub-origin Icons when origin is expanded */}
              {isOriginExpanded && (
                <div className="flex flex-col items-center gap-0.5 mt-0.5 ml-1 pl-1 border-l border-white/20">
                  {originSubOrigins.map((subOrigin) => {
                    const leadCount = leadCounts.find(lc => lc.sub_origin_id === subOrigin.id)?.count || 0;
                    return (
                      <Tooltip key={subOrigin.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleSubOriginClick(subOrigin.id)}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200 ease-out relative"
                          >
                            <Kanban className="h-3 w-3" />
                            {leadCount > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-gradient-to-r from-[#F40000] to-[#A10000] text-white text-[8px] rounded-full flex items-center justify-center">
                                {leadCount > 9 ? '9+' : leadCount}
                              </span>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="z-[9999]">
                          {subOrigin.nome} {leadCount > 0 && `(${leadCount})`}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );

  return (
    <>
      <div className="flex flex-col">
        {/* CRM Main Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "relative flex items-center rounded-xl transition-colors duration-200 px-4 py-3 gap-3",
            isExpanded ? "w-full" : "w-full justify-center",
            isCRMActive
              ? "bg-white/10 text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1 before:rounded-r-full before:bg-gradient-to-b before:from-[#F40000] before:to-[#A10000]"
              : "text-white/60 hover:bg-white/5 hover:text-white"
          )}
        >
          <Kanban className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
          {isExpanded && (
            <>
              <span className="text-sm font-medium whitespace-nowrap flex-1 text-left">
                CRM
              </span>
              <ChevronDown 
                className={cn(
                  "h-4 w-4 transition-transform duration-300 ease-out",
                  isOpen ? "rotate-180" : ""
                )} 
              />
            </>
          )}
        </button>

        {/* Expanded Menu - When sidebar is expanded */}
        {isOpen && isExpanded && renderOriginsMenu(false)}

        {/* Collapsed Icons - When sidebar is collapsed and CRM is open */}
        {isOpen && !isExpanded && renderCollapsedIcons()}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' 
                ? (dialogType === 'origin' ? 'Nova Origem' : 'Nova Sub-origem')
                : (dialogType === 'origin' ? 'Editar Origem' : 'Editar Sub-origem')
              }
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={dialogType === 'origin' ? "Nome da origem" : "Nome da sub-origem"}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-gradient-to-r from-[#F40000] to-[#A10000] text-white">
              {dialogMode === 'create' ? 'Criar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
