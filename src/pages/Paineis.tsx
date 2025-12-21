import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TrendingUp, Rocket, RefreshCcw, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PainelType = 'marketing' | 'lancamento' | 'perpetuo' | 'scratch';

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

  const handlePainelSelect = (tipo: PainelType) => {
    if (tipo === 'scratch') {
      setIsDialogOpen(true);
      setPainelName("");
    }
    // TODO: implementar navegação para outros tipos futuramente
  };

  const handleCreatePainel = () => {
    if (painelName.trim()) {
      // TODO: criar o painel com o nome
      console.log("Criar painel:", painelName);
      setIsDialogOpen(false);
      setPainelName("");
    }
  };

  if (!activePainel) {
    return (
      <>
        <div className="h-full flex flex-col items-center justify-start pt-16 px-4">
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold text-foreground mb-2">Escolha um modelo de painel</h1>
            <p className="text-sm text-muted-foreground">
              Comece com um modelo de painel para atender às suas necessidades
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl w-full">
            {painelOptions.map((painel) => (
              <button
                key={painel.id}
                onClick={() => handlePainelSelect(painel.id)}
                className="group bg-white border border-border rounded-xl p-5 text-left transition-all duration-200 hover:shadow-md focus:outline-none"
              >
                <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4 bg-muted">
                  <painel.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-medium text-foreground mb-1">
                  {painel.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {painel.description}
                </p>
              </button>
            ))}
          </div>
        </div>

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
                  className="h-12 text-base border-border/50 focus:border-primary transition-colors"
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
                  className="flex-1 h-11 bg-primary hover:bg-primary/90"
                >
                  Criar painel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
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
