import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TrendingUp, Rocket, RefreshCcw } from "lucide-react";

type PainelType = 'marketing' | 'lancamento' | 'perpetuo';

const painelOptions = [
  {
    id: 'marketing' as PainelType,
    title: 'Marketing',
    description: 'Acompanhe métricas e campanhas de marketing',
    icon: TrendingUp,
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'lancamento' as PainelType,
    title: 'Lançamento',
    description: 'Gerencie lançamentos e estratégias',
    icon: Rocket,
    color: 'from-purple-500 to-purple-600',
  },
  {
    id: 'perpetuo' as PainelType,
    title: 'Perpétuo',
    description: 'Monitore vendas e funis perpétuos',
    icon: RefreshCcw,
    color: 'from-emerald-500 to-emerald-600',
  },
];

export default function Paineis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activePainel = searchParams.get('tipo') as PainelType | null;

  const handlePainelSelect = (tipo: PainelType) => {
    setSearchParams({ tipo }, { replace: true });
  };

  if (!activePainel) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-center mb-6">
          <h1 className="text-lg font-semibold text-foreground">Painéis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione um painel para visualizar
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {painelOptions.map((painel) => (
            <button
              key={painel.id}
              onClick={() => handlePainelSelect(painel.id)}
              className="group flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2.5 text-left transition-all duration-200 hover:border-white/20 hover:bg-white/5"
            >
              <painel.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {painel.title}
              </span>
            </button>
          ))}
        </div>
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
          <div className={cn(
            "w-16 h-16 rounded-xl bg-gradient-to-br flex items-center justify-center mx-auto mb-4",
            selectedPainel?.color
          )}>
            {selectedPainel && <selectedPainel.icon className="h-8 w-8 text-white" />}
          </div>
          <p className="text-muted-foreground">
            Painel de {selectedPainel?.title} em desenvolvimento
          </p>
        </div>
      </div>
    </div>
  );
}
