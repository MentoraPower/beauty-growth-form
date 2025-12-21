import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { TrendingUp, Rocket, RefreshCcw, Plus, MoreHorizontal, Pencil, Trash2, LayoutDashboard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DashboardCanvas } from "@/components/paineis/DashboardCanvas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type PainelType = 'marketing' | 'lancamento' | 'perpetuo' | 'scratch';

interface Dashboard {
  id: string;
  name: string;
  type: string;
  widgets: unknown;
  created_at: string;
  updated_at: string;
}

const painelOptions = [
  {
    id: 'scratch' as PainelType,
    title: 'Começar do zero',
    description: 'Crie um painel personalizado do zero',
    icon: Plus,
  },
  {
    id: 'marketing' as PainelType,
    title: 'Marketing',
    description: 'Acompanhe métricas e campanhas de marketing',
    icon: TrendingUp,
  },
  {
    id: 'lancamento' as PainelType,
    title: 'Lançamento',
    description: 'Gerencie lançamentos e estratégias',
    icon: Rocket,
  },
  {
    id: 'perpetuo' as PainelType,
    title: 'Perpétuo',
    description: 'Monitore vendas e funis perpétuos',
    icon: RefreshCcw,
  },
];

export default function Paineis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activePainel = searchParams.get('tipo') as PainelType | null;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [painelName, setPainelName] = useState("");
  const [activeDashboard, setActiveDashboard] = useState<Dashboard | null>(null);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");

  // Fetch dashboards from database
  const fetchDashboards = async () => {
    const { data, error } = await supabase
      .from("dashboards")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching dashboards:", error);
      toast.error("Erro ao carregar painéis");
      return;
    }

    setDashboards(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDashboards();
  }, []);

  const handlePainelSelect = (tipo: PainelType) => {
    if (tipo === 'scratch') {
      setIsDialogOpen(true);
      setPainelName("");
    } else {
      toast.info("Este modelo estará disponível em breve");
    }
  };

  const handleCreatePainel = async () => {
    if (!painelName.trim()) return;

    const { data, error } = await supabase
      .from("dashboards")
      .insert({
        name: painelName.trim(),
        type: 'scratch',
        widgets: [],
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar painel");
      console.error(error);
      return;
    }

    toast.success("Painel criado com sucesso!");
    setIsDialogOpen(false);
    setPainelName("");
    setActiveDashboard(data);
    fetchDashboards();
  };

  const handleOpenDashboard = (dashboard: Dashboard) => {
    setActiveDashboard(dashboard);
  };

  const handleBackToPaineis = () => {
    setActiveDashboard(null);
    fetchDashboards(); // Refresh list after editing
  };

  const handleEditDashboard = (dashboard: Dashboard) => {
    setEditingDashboard(dashboard);
    setEditName(dashboard.name);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingDashboard || !editName.trim()) return;

    const { error } = await supabase
      .from("dashboards")
      .update({ name: editName.trim() })
      .eq("id", editingDashboard.id);

    if (error) {
      toast.error("Erro ao renomear painel");
      return;
    }

    toast.success("Painel renomeado!");
    setIsEditDialogOpen(false);
    setEditingDashboard(null);
    fetchDashboards();
  };

  const handleDeleteDashboard = async (dashboard: Dashboard) => {
    const { error } = await supabase
      .from("dashboards")
      .delete()
      .eq("id", dashboard.id);

    if (error) {
      toast.error("Erro ao excluir painel");
      return;
    }

    toast.success("Painel excluído!");
    fetchDashboards();
  };

  // Show the dashboard canvas if a panel is active
  if (activeDashboard) {
    return (
      <DashboardCanvas
        painelName={activeDashboard.name}
        dashboardId={activeDashboard.id}
        onBack={handleBackToPaineis}
      />
    );
  }

  if (!activePainel) {
    return (
      <div className="h-[calc(100vh-1.5rem)] flex flex-col -mt-6 -mr-6 -mb-6 -ml-6 rounded-2xl overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto p-6">
          {/* Panel Templates */}
          <div className="mb-8 flex flex-col items-center">
            <h2 className="text-base font-medium text-foreground mb-1">
              Escolha um modelo de painel
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Comece com um modelo para atender às suas necessidades
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl">
              {painelOptions.map((painel) => (
                <button
                  key={painel.id}
                  onClick={() => handlePainelSelect(painel.id)}
                  className="group bg-card border border-border rounded-xl p-5 text-center transition-all duration-200 hover:bg-muted/50 focus:outline-none"
                >
                  <div className="w-11 h-11 rounded-lg flex items-center justify-center mx-auto mb-3 bg-muted">
                    <painel.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-medium text-foreground">
                    {painel.title}
                  </h3>
                </button>
              ))}
            </div>
          </div>

          {/* Saved Dashboards Table */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Meus Painéis
            </h2>
            
            {isLoading ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <p className="text-sm text-muted-foreground">Carregando...</p>
              </div>
            ) : dashboards.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <LayoutDashboard className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nenhum painel criado ainda. Escolha um modelo acima para começar.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {dashboards.map((dashboard) => (
                  <div
                    key={dashboard.id}
                    onClick={() => handleOpenDashboard(dashboard)}
                    className="group flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 cursor-pointer transition-all duration-200 hover:bg-muted/50 hover:border-border/80"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                        <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="font-medium text-foreground">{dashboard.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                        {dashboard.type === 'scratch' ? 'Personalizado' : dashboard.type}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditDashboard(dashboard);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Renomear
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDashboard(dashboard);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Create Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-center">
                Novo Painel
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Nome do painel
                </label>
                <Input
                  value={painelName}
                  onChange={(e) => setPainelName(e.target.value)}
                  placeholder="Ex: Meu Painel de Vendas"
                  className="h-12 text-base border-border/50 focus:border-foreground/50 transition-colors"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && painelName.trim()) {
                      handleCreatePainel();
                    }
                  }}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1 h-11"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreatePainel}
                  disabled={!painelName.trim()}
                  className="flex-1 h-11 bg-foreground hover:bg-foreground/90 text-background"
                >
                  Criar painel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md border-0 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-center">
                Renomear Painel
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Nome do painel
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome do painel"
                  className="h-12 text-base border-border/50 focus:border-foreground/50 transition-colors"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editName.trim()) {
                      handleSaveEdit();
                    }
                  }}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="flex-1 h-11"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={!editName.trim()}
                  className="flex-1 h-11 bg-foreground hover:bg-foreground/90 text-background"
                >
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const selectedPainel = painelOptions.find(p => p.id === activePainel);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <button
          onClick={() => setSearchParams({}, { replace: true })}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          ← Voltar para painéis
        </button>
        <h1 className="text-xl font-semibold text-foreground">
          {selectedPainel?.title}
        </h1>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 bg-muted">
            {selectedPainel && <selectedPainel.icon className="h-7 w-7 text-muted-foreground" />}
          </div>
          <p className="text-muted-foreground">
            Painel de {selectedPainel?.title} em desenvolvimento
          </p>
        </div>
      </div>
    </div>
  );
}