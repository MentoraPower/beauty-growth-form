import { BarChart3, Rocket, RefreshCcw, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface PanelCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  iconBgColor: string;
  onClick?: () => void;
}

const PanelCard = ({ icon, title, description, iconBgColor, onClick }: PanelCardProps) => (
  <button
    onClick={onClick}
    className={cn(
      "group relative flex flex-col items-start p-6 rounded-2xl border border-white/10 bg-[#1a1a1f] hover:bg-[#222228] transition-all duration-200 text-left",
      "hover:border-white/20 hover:shadow-lg"
    )}
  >
    <div 
      className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
        iconBgColor
      )}
    >
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    <p className="text-sm text-white/50 leading-relaxed">{description}</p>
  </button>
);

const CreateCard = ({ onClick }: { onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "group relative flex flex-col items-start p-6 rounded-2xl border border-dashed border-white/20 bg-transparent hover:bg-white/5 transition-all duration-200 text-left",
      "hover:border-white/30"
    )}
  >
    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-white/10 group-hover:bg-white/15 transition-colors">
      <Plus className="h-6 w-6 text-white/70" />
    </div>
    <h3 className="text-lg font-semibold text-white mb-2">Começar do zero</h3>
    <p className="text-sm text-white/50 leading-relaxed">Crie um painel personalizado do zero</p>
  </button>
);

const Paineis = () => {
  const panels = [
    {
      icon: <BarChart3 className="h-6 w-6 text-emerald-400" />,
      title: "Marketing",
      description: "Acompanhe métricas de campanhas, leads e conversões de marketing",
      iconBgColor: "bg-emerald-500/20",
    },
    {
      icon: <Rocket className="h-6 w-6 text-purple-400" />,
      title: "Lançamento",
      description: "Gerencie lançamentos de produtos e acompanhe o progresso",
      iconBgColor: "bg-purple-500/20",
    },
    {
      icon: <RefreshCcw className="h-6 w-6 text-blue-400" />,
      title: "Perpétuo",
      description: "Visualize métricas de vendas perpétuas e recorrentes",
      iconBgColor: "bg-blue-500/20",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f12] flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-3xl w-full text-center mb-12">
        <h1 className="text-3xl font-semibold text-white mb-4">
          Escolha um modelo de painel
        </h1>
        <p className="text-white/50 text-lg">
          Comece com um modelo de painel ou crie um painel personalizado
          <br />
          para atender às suas necessidades exatas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full">
        {panels.map((panel) => (
          <PanelCard
            key={panel.title}
            icon={panel.icon}
            title={panel.title}
            description={panel.description}
            iconBgColor={panel.iconBgColor}
          />
        ))}
        <CreateCard />
      </div>
    </div>
  );
};

export default Paineis;
