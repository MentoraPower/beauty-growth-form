import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Kanban, ChevronRight, Folder, FolderOpen, MoreVertical, Plus, Pencil, Trash2, X } from "lucide-react";
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

interface CRMOriginsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sidebarWidth: number;
}

export function CRMOriginsPanel({ isOpen, onClose, sidebarWidth }: CRMOriginsPanelProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [subOrigins, setSubOrigins] = useState<SubOrigin[]>([]);
  const [leadCounts, setLeadCounts] = useState<LeadCount[]>([]);
  
  const [expandedOrigins, setExpandedOrigins] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('crm_expanded_origins');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'origin' | 'suborigin'>('origin');
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<{ id: string; nome: string; origin_id?: string } | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);

  // Persist expandedOrigins to localStorage
  useEffect(() => {
    localStorage.setItem('crm_expanded_origins', JSON.stringify([...expandedOrigins]));
  }, [expandedOrigins]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }

    const originsChannel = supabase
      .channel('crm-origins-panel-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_origins' }, fetchData)
      .subscribe();

    const subOriginsChannel = supabase
      .channel('crm-sub-origins-panel-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_sub_origins' }, fetchData)
      .subscribe();

    const leadsChannel = supabase
      .channel('crm-leads-panel-count-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(originsChannel);
      supabase.removeChannel(subOriginsChannel);
      supabase.removeChannel(leadsChannel);
    };
  }, [isOpen]);

  const fetchData = async () => {
    const [originsRes, subOriginsRes, leadsRes] = await Promise.all([
      supabase.from("crm_origins").select("*").order("ordem"),
      supabase.from("crm_sub_origins").select("*").order("ordem"),
      supabase.from("leads").select("sub_origin_id"),
    ]);

    if (originsRes.data) setOrigins(originsRes.data);
    if (subOriginsRes.data) setSubOrigins(subOriginsRes.data);
    
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
    const currentOrigin = new URLSearchParams(window.location.search).get('origin');
    
    if (currentOrigin === subOriginId) {
      return;
    }
    
    window.dispatchEvent(new CustomEvent('suborigin-change'));
    navigate(`/admin/crm?origin=${subOriginId}`);
  };

  const currentSubOriginId = new URLSearchParams(location.search).get('origin');

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        style={{ left: sidebarWidth + 8 }}
        className={cn(
          "fixed top-2 bottom-2 w-64 bg-card border border-border rounded-2xl z-40 transition-all duration-300 ease-out overflow-hidden shadow-xl",
          isOpen 
            ? "opacity-100 translate-x-0" 
            : "opacity-0 -translate-x-4 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Origens CRM</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 max-h-[calc(100vh-6rem)]">
          {origins.map((origin) => {
            const originSubOrigins = subOrigins.filter(s => s.origin_id === origin.id);
            const isOriginExpanded = expandedOrigins.has(origin.id);

            return (
              <div key={origin.id} className="animate-in fade-in duration-200">
                {/* Origin (Folder) */}
                <div className="flex items-center group">
                  <button
                    onClick={() => toggleOrigin(origin.id)}
                    className="flex items-center gap-2 flex-1 py-2 px-2 rounded-lg transition-all duration-200 ease-out text-sm text-foreground/90 hover:text-foreground hover:bg-muted/50"
                  >
                    {isOriginExpanded ? (
                      <FolderOpen className="h-4 w-4 flex-shrink-0 fill-current text-foreground/90" />
                    ) : (
                      <Folder className="h-4 w-4 flex-shrink-0 fill-current text-foreground/90" />
                    )}
                    <span className="flex-1 text-left truncate font-bold">{origin.nome}</span>
                    <ChevronRight 
                      className={cn(
                        "h-3 w-3 transition-transform duration-300 text-foreground/70",
                        isOriginExpanded ? "rotate-90" : ""
                      )} 
                    />
                  </button>
                  
                  {/* Origin Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out hover:bg-muted"
                      >
                        <MoreVertical className="h-4 w-4 text-foreground/80" />
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
                <div 
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: isOriginExpanded ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <div className="ml-4 pl-2 space-y-0.5 pt-1 pb-1 rounded-lg border-l border-border/50 bg-muted/30">
                      {originSubOrigins.map((subOrigin) => {
                        const leadCount = leadCounts.find(lc => lc.sub_origin_id === subOrigin.id)?.count || 0;
                        const isActive = currentSubOriginId === subOrigin.id;
                        
                        return (
                          <div key={subOrigin.id} className="flex items-center group">
                            <button
                              onClick={() => handleSubOriginClick(subOrigin.id)}
                              className={cn(
                                "flex items-center gap-2 flex-1 py-1.5 px-2 rounded-lg transition-all duration-200 ease-out text-xs",
                                isActive 
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                              )}
                            >
                              <Kanban className={cn(
                                "h-3 w-3 flex-shrink-0",
                                isActive ? "text-primary" : "text-foreground/80"
                              )} />
                              <span className="truncate">{subOrigin.nome}</span>
                              {leadCount > 0 && (
                                <span className={cn(
                                  "ml-auto text-[10px] px-1.5 py-0.5 rounded-full",
                                  isActive 
                                    ? "bg-primary/20 text-primary"
                                    : "bg-muted text-muted-foreground"
                                )}>
                                  {leadCount}
                                </span>
                              )}
                            </button>
                            
                            {/* Sub-origin Actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button 
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out hover:bg-muted"
                                >
                                  <MoreVertical className="h-4 w-4 text-foreground/80" />
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

                      {/* Add Sub-origin Button */}
                      <button
                        onClick={() => openCreateSubOriginDialog(origin.id)}
                        className="flex items-center gap-2 w-full py-1.5 px-2 rounded-lg transition-all duration-200 ease-out text-xs text-foreground/60 hover:text-foreground hover:bg-muted/50"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Criar sub origem</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add Origin Button */}
          <button
            onClick={openCreateOriginDialog}
            className="flex items-center gap-2 w-full py-2 px-2 rounded-lg transition-all duration-200 ease-out text-xs text-foreground/70 hover:text-foreground hover:bg-muted/50"
          >
            <Plus className="h-3 w-3" />
            <span>Nova Origem</span>
          </button>
        </div>
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
