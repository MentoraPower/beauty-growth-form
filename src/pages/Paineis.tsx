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
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
  },
  {
    id: 'lancamento' as PainelType,
    title: 'Lançamento',
    description: 'Gerencie lançamentos e estratégias',
    icon: Rocket,
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
  },
  {
    id: 'perpetuo' as PainelType,
    title: 'Perpétuo',
    description: 'Monitore vendas e funis perpétuos',
    icon: RefreshCcw,
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
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
      <div className="h-full flex flex-col items-center justify-center px-4">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-2">Escolha um modelo de painel</h1>
          <p className="text-sm text-muted-foreground">
            Comece com um modelo de painel para atender às suas necessidades
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl w-full">
          {painelOptions.map((painel) => (
            <button
              key={painel.id}
              onClick={() => handlePainelSelect(painel.id)}
              className="group bg-white border border-border rounded-xl p-5 text-left transition-all duration-200 hover:border-primary/20 hover:shadow-md"
            >
              <div className={cn(
                "w-11 h-11 rounded-lg flex items-center justify-center mb-4",
                painel.iconBg
              )}>
                <painel.icon className={cn("h-5 w-5", painel.iconColor)} />
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
            "w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4",
            selectedPainel?.iconBg
          )}>
            {selectedPainel && <selectedPainel.icon className={cn("h-7 w-7", selectedPainel.iconColor)} />}
          </div>
          <p className="text-muted-foreground">
            Painel de {selectedPainel?.title} em desenvolvimento
          </p>
        </div>
      </div>
    </div>
  );
}
