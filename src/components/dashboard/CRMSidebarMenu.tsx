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

interface CRMSidebarMenuProps {
  isExpanded: boolean;
  onNavigate?: () => void;
}

export function CRMSidebarMenu({ isExpanded, onNavigate }: CRMSidebarMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [subOrigins, setSubOrigins] = useState<SubOrigin[]>([]);
  const [expandedOrigins, setExpandedOrigins] = useState<Set<string>>(new Set());
  
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

    return () => {
      supabase.removeChannel(originsChannel);
      supabase.removeChannel(subOriginsChannel);
    };
  }, []);

  const fetchData = async () => {
    const [originsRes, subOriginsRes] = await Promise.all([
      supabase.from("crm_origins").select("*").order("ordem"),
      supabase.from("crm_sub_origins").select("*").order("ordem"),
    ]);

    if (originsRes.data) setOrigins(originsRes.data);
    if (subOriginsRes.data) setSubOrigins(subOriginsRes.data);
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
    navigate(`/admin/crm?origin=${subOriginId}`);
    onNavigate?.();
  };

  return (
    <>
      <div className="flex flex-col">
        {/* CRM Main Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "relative flex items-center w-full rounded-xl transition-colors duration-200 px-4 py-3 gap-3",
            isCRMActive
              ? "bg-white/10 text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1 before:rounded-r-full before:bg-gradient-to-b before:from-[#F40000] before:to-[#A10000]"
              : "text-white/60 hover:bg-white/5 hover:text-white"
          )}
        >
          <Kanban className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
          <span
            className={cn(
              "text-sm font-medium whitespace-nowrap transition-opacity duration-200 flex-1 text-left",
              isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
            )}
          >
            CRM
          </span>
          {isExpanded && (
            <ChevronDown 
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isOpen ? "rotate-180" : ""
              )} 
            />
          )}
        </button>

        {/* Expandable Menu */}
        {isOpen && isExpanded && (
          <div className="mt-1 ml-4 pl-3 border-l border-white/10 space-y-1">
            {origins.map((origin) => {
              const originSubOrigins = subOrigins.filter(s => s.origin_id === origin.id);
              const isOriginExpanded = expandedOrigins.has(origin.id);

              return (
                <div key={origin.id}>
                  {/* Origin (Folder) */}
                  <div className="flex items-center group">
                    <button
                      onClick={() => toggleOrigin(origin.id)}
                      className="flex items-center gap-2 flex-1 py-2 px-2 rounded-lg text-white/90 hover:text-white hover:bg-white/5 transition-colors text-sm"
                    >
                      {isOriginExpanded ? (
                        <FolderOpen className="h-4 w-4 flex-shrink-0 text-white/90" />
                      ) : (
                        <Folder className="h-4 w-4 flex-shrink-0 text-white/90" />
                      )}
                      <span className="flex-1 text-left truncate font-medium">{origin.nome}</span>
                      <ChevronRight 
                        className={cn(
                          "h-3 w-3 transition-transform text-white/70",
                          isOriginExpanded ? "rotate-90" : ""
                        )} 
                      />
                    </button>
                    
                    {/* Origin Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                        >
                          <MoreVertical className="h-4 w-4 text-white/80" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 z-[9999] bg-popover">
                        <DropdownMenuItem onClick={() => openCreateSubOriginDialog(origin.id)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Nova Sub-origem
                        </DropdownMenuItem>
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
                    <div className="ml-4 pl-2 border-l border-white/10 space-y-0.5">
                      {originSubOrigins.map((subOrigin) => (
                        <div key={subOrigin.id} className="flex items-center group">
                          <button
                            onClick={() => handleSubOriginClick(subOrigin.id)}
                            className="flex items-center gap-2 flex-1 py-1.5 px-2 rounded-lg text-white/80 hover:text-white hover:bg-white/5 transition-colors text-xs"
                          >
                            <Kanban className="h-3 w-3 flex-shrink-0 text-white/80" />
                            <span className="truncate">{subOrigin.nome}</span>
                          </button>
                          
                          {/* Sub-origin Actions */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button 
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                              >
                                <MoreVertical className="h-4 w-4 text-white/80" />
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
                      ))}

                      {/* Add Sub-origin Button inside folder */}
                      <button
                        onClick={() => openCreateSubOriginDialog(origin.id)}
                        className="flex items-center gap-2 w-full py-1.5 px-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-xs"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Novo CRM</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Origin Button */}
            <button
              onClick={openCreateOriginDialog}
              className="flex items-center gap-2 w-full py-2 px-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors text-xs"
            >
              <Plus className="h-3 w-3" />
              <span>Nova Origem</span>
            </button>
          </div>
        )}
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
