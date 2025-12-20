import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Kanban, ChevronRight, Folder, FolderOpen, MoreVertical, Plus, Pencil, Trash2, GripVertical, Home, CalendarDays, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  tipo: 'tarefas' | 'calendario';
}

interface LeadCount {
  sub_origin_id: string;
  count: number;
}

interface CRMOriginsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sidebarWidth: number;
  embedded?: boolean;
}


// Add Sub-origin Dropdown Component
function AddSubOriginDropdown({ 
  originId, 
  subOriginsCount,
  hasCalendar,
  onCreated 
}: { 
  originId: string; 
  subOriginsCount: number;
  hasCalendar: boolean;
  onCreated: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'type' | 'name'>('type');
  const [selectedTipo, setSelectedTipo] = useState<'tarefas' | 'calendario'>('tarefas');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelectType = async (tipo: 'tarefas' | 'calendario') => {
    if (tipo === 'calendario') {
      // Create calendar directly with default name
      setIsLoading(true);
      const { error } = await supabase.from("crm_sub_origins").insert({ 
        nome: 'Calendário', 
        origin_id: originId,
        ordem: subOriginsCount,
        tipo: 'calendario'
      });
      
      setIsLoading(false);
      
      if (error) {
        toast.error("Erro ao criar calendário");
        return;
      }
      
      toast.success("Calendário criado");
      setIsOpen(false);
      onCreated();
      window.dispatchEvent(new CustomEvent('crm-data-updated'));
    } else {
      setSelectedTipo(tipo);
      setStep('name');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleCreate = async () => {
    if (!inputValue.trim()) {
      toast.error("Digite um nome");
      return;
    }
    
    setIsLoading(true);
    const { error } = await supabase.from("crm_sub_origins").insert({ 
      nome: inputValue.trim(), 
      origin_id: originId,
      ordem: subOriginsCount,
      tipo: selectedTipo
    });
    
    setIsLoading(false);
    
    if (error) {
      toast.error("Erro ao criar sub-origem");
      return;
    }
    
    toast.success("Sub-origem criada");
    setIsOpen(false);
    setStep('type');
    setInputValue('');
    setSelectedTipo('tarefas');
    onCreated();
    
    // Trigger a refetch
    window.dispatchEvent(new CustomEvent('crm-data-updated'));
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setStep('type');
      setInputValue('');
      setSelectedTipo('tarefas');
    }
  };

  return (
    <li className="relative pl-6 py-0.5">
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 w-full py-1.5 px-2 rounded-lg transition-all duration-200 ease-out text-xs text-foreground/50 hover:text-foreground hover:bg-black/5">
            <Plus className="h-3 w-3" />
            <span>Criar sub origem</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          side="right"
          sideOffset={8}
          className="w-72 p-2 z-[9999] bg-popover"
        >
          {step === 'type' ? (
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider px-2 py-1">Tipo</p>
              <button
                onClick={() => handleSelectType('tarefas')}
                className="flex items-center gap-2.5 w-full py-2 px-2.5 rounded-lg hover:bg-black/[0.03] transition-all group"
              >
                <div className="w-7 h-7 rounded-md bg-black/[0.04] flex items-center justify-center">
                  <ListTodo className="h-3.5 w-3.5 text-foreground/60" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground leading-tight">Tarefas</p>
                  <p className="text-[10px] text-muted-foreground/60 leading-tight">Kanban com atividades</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-foreground/20 group-hover:text-foreground/40 transition-colors" />
              </button>
              <button
                onClick={() => !hasCalendar && handleSelectType('calendario')}
                disabled={hasCalendar}
                className={cn(
                  "flex items-center gap-2.5 w-full py-2 px-2.5 rounded-lg transition-all group",
                  hasCalendar 
                    ? "opacity-40 cursor-not-allowed" 
                    : "hover:bg-black/[0.03]"
                )}
              >
                <div className="w-7 h-7 rounded-md bg-black/[0.04] flex items-center justify-center">
                  <CalendarDays className="h-3.5 w-3.5 text-foreground/60" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground leading-tight">Calendário</p>
                  <p className="text-[10px] text-muted-foreground/60 leading-tight">
                    {hasCalendar ? 'Já existe um calendário' : 'Agendamentos'}
                  </p>
                </div>
                {!hasCalendar && (
                  <ChevronRight className="h-3.5 w-3.5 text-foreground/20 group-hover:text-foreground/40 transition-colors" />
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-2 p-0.5">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setStep('type')}
                  className="p-1 rounded-md hover:bg-black/[0.04] transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5 rotate-180 text-foreground/40" />
                </button>
                <div className="w-5 h-5 rounded bg-black/[0.04] flex items-center justify-center">
                  {selectedTipo === 'tarefas' 
                    ? <ListTodo className="h-3 w-3 text-foreground/60" />
                    : <CalendarDays className="h-3 w-3 text-foreground/60" />
                  }
                </div>
                <span className="text-[13px] font-medium text-foreground">
                  {selectedTipo === 'tarefas' ? 'Nova Tarefa' : 'Novo Calendário'}
                </span>
              </div>
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Nome da sub-origem"
                className="w-full bg-transparent border-0 border-b-2 border-foreground/20 focus:border-foreground/60 outline-none py-2 text-[13px] text-foreground placeholder:text-foreground/30 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <Button 
                onClick={handleCreate} 
                disabled={isLoading || !inputValue.trim()}
                className="w-full h-8 bg-foreground hover:bg-foreground/90 text-background text-[13px]"
              >
                {isLoading ? 'Criando...' : 'Criar'}
              </Button>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

// Sortable Origin Item Component
function SortableOriginItem({ 
  origin, 
  originSubOrigins,
  isOriginExpanded,
  expandedOrigins,
  toggleOrigin,
  openEditOriginDialog,
  handleDeleteOrigin,
  openCreateSubOriginDialog,
  openEditSubOriginDialog,
  handleDeleteSubOrigin,
  handleSubOriginClick,
  handleOverviewClick,
  leadCounts,
  currentSubOriginId,
  currentOverviewOriginId,
  userPermissions,
}: {
  origin: Origin;
  originSubOrigins: SubOrigin[];
  isOriginExpanded: boolean;
  expandedOrigins: Set<string>;
  toggleOrigin: (id: string) => void;
  openEditOriginDialog: (origin: Origin) => void;
  handleDeleteOrigin: (id: string) => void;
  openCreateSubOriginDialog: (originId: string) => void;
  openEditSubOriginDialog: (subOrigin: SubOrigin) => void;
  handleDeleteSubOrigin: (id: string) => void;
  handleSubOriginClick: (id: string, tipo: 'tarefas' | 'calendario') => void;
  handleOverviewClick: (originId: string) => void;
  leadCounts: LeadCount[];
  currentSubOriginId: string | null;
  currentOverviewOriginId: string | null;
  userPermissions: {
    isAdmin: boolean;
    canCreateOrigins: boolean;
    canCreateSubOrigins: boolean;
    allowedOriginIds: string[];
    allowedSubOriginIds: string[];
  };
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: origin.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const LINE_TOP_PX = 20;
  const lastSubOriginRef = useRef<HTMLLIElement | null>(null);
  const [treeLineHeightPx, setTreeLineHeightPx] = useState(0);

  const updateTreeLineHeight = useCallback(() => {
    if (!isOriginExpanded) return;

    if (originSubOrigins.length === 0) {
      setTreeLineHeightPx(0);
      return;
    }

    const lastEl = lastSubOriginRef.current;
    if (!lastEl) return;

    const centerY = lastEl.offsetTop + lastEl.offsetHeight / 2;
    // Para no meio da curva (não no centro do item), subtraindo 4px
    const next = Math.max(0, Math.round(centerY - LINE_TOP_PX - 4));
    setTreeLineHeightPx((prev) => (prev === next ? prev : next));
  }, [isOriginExpanded, originSubOrigins.length]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => updateTreeLineHeight());
    window.addEventListener("resize", updateTreeLineHeight);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateTreeLineHeight);
    };
  }, [updateTreeLineHeight]);

  return (
    <div ref={setNodeRef} style={style} className="animate-in fade-in duration-200">
      {/* Origin (Folder) */}
      <div className="flex items-center group/origin relative">
        {/* Drag Handle - only show for admins */}
        {userPermissions.isAdmin && (
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 transition-all duration-200 ease-out opacity-0 -translate-x-2 group-hover/origin:opacity-100 group-hover/origin:translate-x-0 group-has-[.actions-area:hover]/origin:opacity-0 group-has-[.actions-area:hover]/origin:-translate-x-2">
            <button
              {...attributes}
              {...listeners}
              className="p-1 rounded cursor-grab active:cursor-grabbing hover:bg-black/5"
            >
              <GripVertical className="h-3 w-3 text-foreground/50" />
            </button>
          </div>
        )}
        
        <button
          onClick={() => toggleOrigin(origin.id)}
          className={cn(
            "flex items-center gap-2 flex-1 py-2 px-2 rounded-lg transition-all duration-200 ease-out text-sm text-foreground/80 hover:text-foreground hover:bg-black/5",
            userPermissions.isAdmin && "group-hover/origin:translate-x-4 group-has-[.actions-area:hover]/origin:translate-x-0"
          )}
        >
          {isOriginExpanded ? (
            <FolderOpen className="h-4 w-4 flex-shrink-0 fill-current text-foreground/80" />
          ) : (
            <Folder className="h-4 w-4 flex-shrink-0 fill-current text-foreground/80" />
          )}
          <span className="flex-1 text-left truncate font-bold">{origin.nome}</span>
          <ChevronRight 
            className={cn(
              "h-3 w-3 transition-transform duration-300 text-foreground/60",
              isOriginExpanded ? "rotate-90" : ""
            )} 
          />
        </button>
        
        {/* Origin Actions - only show for admins */}
        {userPermissions.isAdmin && (
          <div className="actions-area transition-all duration-200 ease-out group-hover/origin:translate-x-4 hover:!translate-x-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded opacity-0 group-hover/origin:opacity-100 transition-all duration-200 ease-out hover:bg-black/5"
                >
                  <MoreVertical className="h-4 w-4 text-foreground/70" />
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
        )}
      </div>

      {/* Sub-origins with tree lines - SVG curves approach */}
      <div 
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isOriginExpanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {/* Tree container */}
          <ul className="ml-4 pt-2 pb-1 list-none pl-0 relative">
            
            {/* Linha vertical principal - cor escura, sem transparência, z-index alto */}
            <div 
              className="absolute left-[11px] w-[2px] z-20"
              style={{
                top: `${LINE_TOP_PX}px`,
                height: `${treeLineHeightPx}px`,
                backgroundColor: "hsl(var(--muted-foreground))",
              }}
            />
            
            {/* Overview Item */}
            <li className="relative pl-6 py-1">
              {/* Curva SVG perfeita */}
              <svg 
                className="absolute left-[4px] top-1/2 -translate-y-1/2 z-0" 
                width="18" 
                height="18" 
                viewBox="0 0 18 18"
                fill="none"
              >
                <path 
                  d="M 8 0 L 8 5 Q 8 9 12 9 L 18 9" 
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="2" 
                  fill="none"
                />
              </svg>
              
              <div className="flex items-center group">
                <button
                  onClick={() => handleOverviewClick(origin.id)}
                  className={cn(
                    "flex items-center gap-2 w-full py-1.5 px-2.5 rounded-lg transition-all duration-200 ease-out text-xs border",
                    currentOverviewOriginId === origin.id
                      ? "bg-white border-black/10 text-foreground shadow-sm"
                      : "bg-white/50 border-transparent text-foreground/80 hover:bg-white hover:border-black/5 hover:shadow-sm"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center",
                    currentOverviewOriginId === origin.id
                      ? "bg-black/10"
                      : "bg-black/5"
                  )}>
                    <Home className={cn(
                      "h-3 w-3",
                      currentOverviewOriginId === origin.id ? "text-foreground" : "text-foreground/70"
                    )} />
                  </div>
                  <span className="font-medium">Overview</span>
                </button>
              </div>
            </li>

            {/* Sub-origins */}
            {originSubOrigins.map((subOrigin, index) => {
              const leadCount = leadCounts.find(lc => lc.sub_origin_id === subOrigin.id)?.count || 0;
              const isActive = currentSubOriginId === subOrigin.id;
              const isLast = index === originSubOrigins.length - 1;
              
              return (
                <li 
                  key={subOrigin.id} 
                  className="relative pl-6 py-1"
                  ref={isLast ? (el) => { lastSubOriginRef.current = el; } : undefined}
                >
                  {/* Curva SVG perfeita */}
                  <svg 
                    className="absolute left-[4px] top-1/2 -translate-y-1/2 z-0" 
                    width="18" 
                    height="18" 
                    viewBox="0 0 18 18"
                    fill="none"
                  >
                    <path 
                      d="M 8 0 L 8 5 Q 8 9 12 9 L 18 9" 
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth="2" 
                      fill="none"
                    />
                  </svg>
                  
                  <div className="flex items-center group">
                    <button
                      onClick={() => handleSubOriginClick(subOrigin.id, subOrigin.tipo)}
                      className={cn(
                        "flex items-center gap-2 flex-1 py-1.5 px-2 rounded-lg transition-all duration-200 ease-out text-xs",
                        isActive 
                          ? "bg-black/10 text-foreground font-medium"
                          : "text-foreground/70 hover:text-foreground hover:bg-black/5"
                      )}
                    >
                      {subOrigin.tipo === 'calendario' ? (
                        <CalendarDays className={cn(
                          "h-3 w-3 flex-shrink-0",
                          isActive ? "text-foreground" : "text-foreground/70"
                        )} />
                      ) : (
                        <Kanban className={cn(
                          "h-3 w-3 flex-shrink-0",
                          isActive ? "text-foreground" : "text-foreground/70"
                        )} />
                      )}
                      <span className="truncate">{subOrigin.nome}</span>
                      {leadCount > 0 && (
                        <span className={cn(
                          "ml-auto text-[10px] px-1.5 py-0.5 rounded-full",
                          isActive 
                            ? "bg-black/10 text-foreground"
                            : "bg-black/5 text-foreground/60"
                        )}>
                          {leadCount.toLocaleString('pt-BR')}
                        </span>
                      )}
                    </button>
                    
                    {/* Sub-origin Actions - only show for admins */}
                    {userPermissions.isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button 
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out hover:bg-black/5"
                          >
                            <MoreVertical className="h-4 w-4 text-foreground/70" />
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
                    )}
                  </div>
                </li>
              );
            })}

            {/* Add Sub-origin Button - only show for admins or users with permission */}
            {(userPermissions.isAdmin || userPermissions.canCreateSubOrigins) && (
              <AddSubOriginDropdown 
                originId={origin.id}
                subOriginsCount={originSubOrigins.length}
                hasCalendar={originSubOrigins.some(s => s.tipo === 'calendario')}
                onCreated={() => {}}
              />
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface UserPermissions {
  isAdmin: boolean;
  canCreateOrigins: boolean;
  canCreateSubOrigins: boolean;
  allowedOriginIds: string[];
  allowedSubOriginIds: string[];
}

export function CRMOriginsPanel({ isOpen, onClose, sidebarWidth, embedded = false }: CRMOriginsPanelProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [subOrigins, setSubOrigins] = useState<SubOrigin[]>([]);
  const [leadCounts, setLeadCounts] = useState<LeadCount[]>([]);
  const hasInitialized = useRef(false);
  
  // User permissions state
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({
    isAdmin: false,
    canCreateOrigins: false,
    canCreateSubOrigins: false,
    allowedOriginIds: [],
    allowedSubOriginIds: [],
  });
  
  const [expandedOrigins, setExpandedOrigins] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('crm_expanded_origins');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'origin' | 'suborigin'>('origin');
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<{ id: string; nome: string; origin_id?: string; tipo?: string } | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [selectedTipo, setSelectedTipo] = useState<'tarefas' | 'calendario'>('tarefas');

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Persist expandedOrigins to localStorage
  useEffect(() => {
    localStorage.setItem('crm_expanded_origins', JSON.stringify([...expandedOrigins]));
  }, [expandedOrigins]);

  // Fetch user permissions
  const fetchUserPermissions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const isAdmin = roleData?.role === "admin";

      if (isAdmin) {
        setUserPermissions({
          isAdmin: true,
          canCreateOrigins: true,
          canCreateSubOrigins: true,
          allowedOriginIds: [],
          allowedSubOriginIds: [],
        });
      } else {
        // Fetch user permissions
        const { data: permData } = await supabase
          .from("user_permissions")
          .select("*")
          .eq("user_id", user.id)
          .single();

        setUserPermissions({
          isAdmin: false,
          canCreateOrigins: permData?.can_create_origins ?? false,
          canCreateSubOrigins: permData?.can_create_sub_origins ?? false,
          allowedOriginIds: permData?.allowed_origin_ids ?? [],
          allowedSubOriginIds: permData?.allowed_sub_origin_ids ?? [],
        });
      }
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [originsRes, subOriginsRes] = await Promise.all([
        supabase.from("crm_origins").select("*").order("ordem"),
        supabase.from("crm_sub_origins").select("*").order("ordem"),
      ]);

      if (originsRes.data) {
        setOrigins(originsRes.data);
      }
      if (subOriginsRes.data) {
        setSubOrigins(subOriginsRes.data.map(s => ({
          ...s,
          tipo: (s.tipo === 'calendario' ? 'calendario' : 'tarefas') as 'tarefas' | 'calendario'
        })));
        
        // Fetch exact counts for each sub-origin using head:true (no 1000 limit)
        const countPromises = subOriginsRes.data.map(async (subOrigin) => {
          const { count, error } = await supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("sub_origin_id", subOrigin.id);
          
          return {
            sub_origin_id: subOrigin.id,
            count: error ? 0 : (count || 0),
          };
        });
        
        const counts = await Promise.all(countPromises);
        setLeadCounts(counts);
      }
      
      hasInitialized.current = true;
    } catch (error) {
      console.error('Error fetching CRM data:', error);
    }
  }, []);

  // Fetch data and permissions on first mount
  useEffect(() => {
    fetchUserPermissions();
    if (!hasInitialized.current) {
      fetchData();
    }
  }, [fetchData, fetchUserPermissions]);

  // Filter origins and sub-origins based on user permissions
  const filteredOrigins = userPermissions.isAdmin 
    ? origins 
    : origins.filter(origin => userPermissions.allowedOriginIds.includes(origin.id));
  
  const filteredSubOrigins = userPermissions.isAdmin
    ? subOrigins
    : subOrigins.filter(subOrigin => userPermissions.allowedSubOriginIds.includes(subOrigin.id));

  // Real-time subscriptions - only for structure changes, not navigation
  useEffect(() => {
    const originsChannel = supabase
      .channel('crm-origins-panel-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_origins' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crm_origins' }, fetchData)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'crm_origins' }, fetchData)
      .subscribe();

    const subOriginsChannel = supabase
      .channel('crm-sub-origins-panel-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_sub_origins' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crm_sub_origins' }, fetchData)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'crm_sub_origins' }, fetchData)
      .subscribe();

    // Update lead counts using exact count queries (bypasses 1000 limit)
    const updateLeadCounts = async () => {
      if (subOrigins.length === 0) return;
      
      const countPromises = subOrigins.map(async (subOrigin) => {
        const { count, error } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("sub_origin_id", subOrigin.id);
        
        return {
          sub_origin_id: subOrigin.id,
          count: error ? 0 : (count || 0),
        };
      });
      
      const counts = await Promise.all(countPromises);
      setLeadCounts(counts);
    };

    // Initial count fetch when subOrigins are loaded
    if (subOrigins.length > 0) {
      updateLeadCounts();
    }

    const leadsChannel = supabase
      .channel('crm-leads-panel-count-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, updateLeadCounts)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, updateLeadCounts)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, updateLeadCounts)
      .subscribe();

    // Listen for custom event from dropdown
    const handleCustomUpdate = () => fetchData();
    window.addEventListener('crm-data-updated', handleCustomUpdate);

    return () => {
      supabase.removeChannel(originsChannel);
      supabase.removeChannel(subOriginsChannel);
      supabase.removeChannel(leadsChannel);
      window.removeEventListener('crm-data-updated', handleCustomUpdate);
    };
  }, [fetchData, subOrigins]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = origins.findIndex((o) => o.id === active.id);
      const newIndex = origins.findIndex((o) => o.id === over.id);

      const newOrigins = arrayMove(origins, oldIndex, newIndex);
      
      // Optimistic update
      setOrigins(newOrigins);

      // Update ordem in database
      const updates = newOrigins.map((origin, index) => 
        supabase.from("crm_origins").update({ ordem: index }).eq("id", origin.id)
      );

      try {
        await Promise.all(updates);
      } catch (error) {
        toast.error("Erro ao reordenar origens");
        fetchData(); // Revert on error
      }
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
    setSelectedTipo('tarefas');
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
        const { error } = await supabase.from("crm_origins").insert({ nome: inputValue.trim(), ordem: origins.length });
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
        const originSubOrigins = subOrigins.filter(s => s.origin_id === originId);
        const { error } = await supabase.from("crm_sub_origins").insert({ 
          nome: inputValue.trim(), 
          origin_id: originId,
          ordem: originSubOrigins.length,
          tipo: selectedTipo
        });
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

  const handleSubOriginClick = (subOriginId: string, tipo: 'tarefas' | 'calendario') => {
    const currentOrigin = new URLSearchParams(window.location.search).get('origin');
    
    if (currentOrigin === subOriginId) {
      return;
    }
    
    window.dispatchEvent(new CustomEvent('suborigin-change'));
    
    if (tipo === 'calendario') {
      navigate(`/admin/calendario?origin=${subOriginId}`);
    } else {
      navigate(`/admin/crm?origin=${subOriginId}`);
    }
  };

  const handleOverviewClick = (originId: string) => {
    navigate(`/admin/crm/overview?origin=${originId}`);
  };

  const currentSubOriginId = new URLSearchParams(location.search).get('origin');
  const currentOverviewOriginId = location.pathname === '/admin/crm/overview' 
    ? new URLSearchParams(location.search).get('origin') 
    : null;
  // Embedded content for unified submenu
  const content = (
    <>
      {/* Header */}
      <div className="px-4 pl-0 py-4">
        <h2 className="text-foreground font-semibold text-sm px-2">Origens CRM</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pl-0 pb-3 space-y-1 max-h-[calc(100vh-6rem)]">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredOrigins.map(o => o.id)}
            strategy={verticalListSortingStrategy}
          >
            {filteredOrigins.map((origin) => {
              const originSubOrigins = filteredSubOrigins.filter(s => s.origin_id === origin.id);
              const isOriginExpanded = expandedOrigins.has(origin.id);

              return (
                <SortableOriginItem
                  key={origin.id}
                  origin={origin}
                  originSubOrigins={originSubOrigins}
                  isOriginExpanded={isOriginExpanded}
                  expandedOrigins={expandedOrigins}
                  toggleOrigin={toggleOrigin}
                  openEditOriginDialog={openEditOriginDialog}
                  handleDeleteOrigin={handleDeleteOrigin}
                  openCreateSubOriginDialog={openCreateSubOriginDialog}
                  openEditSubOriginDialog={openEditSubOriginDialog}
                  handleDeleteSubOrigin={handleDeleteSubOrigin}
                  handleSubOriginClick={handleSubOriginClick}
                  handleOverviewClick={handleOverviewClick}
                  leadCounts={leadCounts}
                  currentSubOriginId={currentSubOriginId}
                  currentOverviewOriginId={currentOverviewOriginId}
                  userPermissions={userPermissions}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Add Origin Button - only show for admins or users with permission */}
        {(userPermissions.isAdmin || userPermissions.canCreateOrigins) && (
          <button
            onClick={openCreateOriginDialog}
            className="flex items-center gap-2 w-full py-2 px-2 rounded-lg transition-colors duration-200 text-xs text-foreground/60 hover:text-foreground hover:bg-black/5"
          >
            <Plus className="h-3 w-3" />
            <span>Nova Origem</span>
          </button>
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
          <div className="py-4 space-y-4">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={dialogType === 'origin' ? "Nome da origem" : "Nome da sub-origem"}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            
            {/* Type selector for sub-origin creation */}
            {dialogType === 'suborigin' && dialogMode === 'create' && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Tipo de gestão</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTipo('tarefas')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      selectedTipo === 'tarefas'
                        ? "border-rose-500 bg-rose-50"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                    )}
                  >
                    <ListTodo className={cn(
                      "h-6 w-6",
                      selectedTipo === 'tarefas' ? "text-rose-500" : "text-muted-foreground"
                    )} />
                    <span className={cn(
                      "text-sm font-medium",
                      selectedTipo === 'tarefas' ? "text-rose-600" : "text-muted-foreground"
                    )}>
                      Tarefas
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTipo('calendario')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      selectedTipo === 'calendario'
                        ? "border-rose-500 bg-rose-50"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                    )}
                  >
                    <CalendarDays className={cn(
                      "h-6 w-6",
                      selectedTipo === 'calendario' ? "text-rose-500" : "text-muted-foreground"
                    )} />
                    <span className={cn(
                      "text-sm font-medium",
                      selectedTipo === 'calendario' ? "text-rose-600" : "text-muted-foreground"
                    )}>
                      Calendário
                    </span>
                  </button>
                </div>
              </div>
            )}
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

  // When embedded, just return the content
  if (embedded) {
    return <div className="h-full flex flex-col">{content}</div>;
  }

  // Standalone mode (mobile/fallback)
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel - only shown in standalone mode */}
      <div
        style={{ left: sidebarWidth - 8 }}
        className={cn(
          "hidden lg:block fixed top-2 h-[calc(100vh-1rem)] w-64 rounded-2xl bg-[#f5f5f7] z-50 overflow-hidden pl-4",
          isOpen 
            ? "opacity-100" 
            : "opacity-0 pointer-events-none"
        )}
      >
        {content}
      </div>
    </>
  );
}
