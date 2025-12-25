import { useState } from "react";
import { X, Settings2, Database, Eye, Percent, List, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DataSource, OverviewCard } from "./types";
import { Lead, Pipeline } from "@/types/crm";
import { cn } from "@/lib/utils";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar,
  Funnel,
  FunnelChart,
  LabelList
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CardConfigPanelProps {
  card: OverviewCard;
  leads: Lead[];
  pipelines: Pipeline[];
  leadTags: Array<{ lead_id: string; name: string; color: string }>;
  onClose: () => void;
  onUpdateCard: (cardId: string, updates: Partial<OverviewCard>) => void;
}

const DATA_SOURCES: Array<{ id: DataSource; title: string }> = [
  { id: "total_leads", title: "Total de Leads" },
  { id: "leads_by_pipeline", title: "Leads por Pipeline" },
  { id: "leads_over_time", title: "Leads ao Longo do Tempo" },
  { id: "leads_by_mql", title: "MQL vs Não-MQL" },
  { id: "recent_leads", title: "Leads Recentes" },
  { id: "leads_by_tag", title: "Leads por Tag" },
  { id: "conversion_rate", title: "Funil de Conversão" },
];

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
];

export function CardConfigPanel({ 
  card, 
  leads, 
  pipelines, 
  leadTags,
  onClose, 
  onUpdateCard 
}: CardConfigPanelProps) {
  const [showAsDonut, setShowAsDonut] = useState(false);
  const [showPercentages, setShowPercentages] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  const handleDataSourceChange = (dataSource: DataSource) => {
    onUpdateCard(card.id, { dataSource });
  };

  // Calculate chart data
  const getChartData = () => {
    if (!card.dataSource) return null;

    switch (card.dataSource) {
      case "leads_by_pipeline": {
        return pipelines.map((pipeline) => ({
          name: pipeline.nome,
          value: leads.filter((l) => l.pipeline_id === pipeline.id).length,
          color: pipeline.cor,
        }));
      }
      case "leads_by_mql": {
        const mql = leads.filter((l) => l.is_mql).length;
        const nonMql = leads.filter((l) => !l.is_mql).length;
        return [
          { name: "MQL", value: mql, color: "hsl(var(--primary))" },
          { name: "Não-MQL", value: nonMql, color: "hsl(var(--muted))" },
        ];
      }
      case "leads_over_time": {
        const last30Days = eachDayOfInterval({
          start: subDays(new Date(), 29),
          end: new Date(),
        });
        return last30Days.map((day) => {
          const dayStart = startOfDay(day);
          const count = leads.filter((l) => {
            const leadDate = startOfDay(new Date(l.created_at));
            return leadDate.getTime() === dayStart.getTime();
          }).length;
          return {
            date: format(day, "dd/MM", { locale: ptBR }),
            count,
          };
        });
      }
      case "total_leads": {
        return { total: leads.length };
      }
      case "recent_leads": {
        return leads
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 8);
      }
      case "leads_by_tag": {
        const tagCounts: Record<string, { name: string; count: number; color: string }> = {};
        leadTags.forEach((tag) => {
          if (!tagCounts[tag.name]) {
            tagCounts[tag.name] = { name: tag.name, count: 0, color: tag.color };
          }
          tagCounts[tag.name].count++;
        });
        return Object.values(tagCounts).sort((a, b) => b.count - a.count).slice(0, 10);
      }
      case "conversion_rate": {
        return pipelines.map((pipeline, index) => ({
          name: pipeline.nome,
          value: leads.filter((l) => l.pipeline_id === pipeline.id).length,
          fill: COLORS[index % COLORS.length],
        }));
      }
      default:
        return null;
    }
  };

  const chartData = getChartData();

  const renderChart = () => {
    if (!card.dataSource || !chartData) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Selecione uma fonte de dados
        </div>
      );
    }

    switch (card.chartType) {
      case "pie": {
        const pieData = chartData as Array<{ name: string; value: number; color: string }>;
        const total = pieData.reduce((sum, d) => sum + d.value, 0);
        
        return (
          <div className="w-full h-full flex flex-col">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={showAsDonut ? "50%" : 0}
                  outerRadius="80%"
                  paddingAngle={2}
                  dataKey="value"
                  label={showPercentages ? ({ name, value }) => `${name} ${Math.round((value / total) * 100)}%` : ({ name, value }) => `${name} ${value}`}
                  labelLine={true}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                {showLegend && <Tooltip />}
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case "area": {
        const areaData = chartData as Array<{ date: string; count: number }>;
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                fill="url(#colorCount)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      }

      case "bar": {
        const barData = chartData as Array<{ name: string; count: number; color: string }>;
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      }

      case "number": {
        const numberData = chartData as { total: number };
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="text-7xl font-bold text-foreground">{numberData.total}</span>
            <span className="text-muted-foreground mt-2">leads</span>
          </div>
        );
      }

      case "list": {
        const listData = chartData as Lead[];
        return (
          <ScrollArea className="h-full">
            <div className="space-y-2">
              {listData.map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                    {lead.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        );
      }

      case "funnel": {
        const funnelData = chartData as Array<{ name: string; value: number; fill: string }>;
        return (
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip />
              <Funnel
                data={funnelData}
                dataKey="value"
                nameKey="name"
                isAnimationActive
              >
                <LabelList position="center" fill="#fff" stroke="none" dataKey="name" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        );
      }

      default:
        return null;
    }
  };

  return (
    <>
      {/* Backdrop with blur - covers entire page */}
      <div 
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed inset-8 sm:inset-16 z-[101] bg-background flex overflow-hidden rounded-xl border border-border shadow-2xl">
      {/* Left side - Chart Preview */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">{card.title}</h1>
          </div>
        </div>

        {/* Chart Area */}
        <div className="flex-1 p-8">
          <div className="w-full h-full max-w-3xl mx-auto">
            {renderChart()}
          </div>
        </div>
      </div>

      {/* Right side - Config Panel */}
      <div className="w-[380px] border-l border-border bg-background flex flex-col">
        <Tabs defaultValue="config" className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-auto p-0">
            <TabsTrigger 
              value="config" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Configurações
            </TabsTrigger>
            <TabsTrigger 
              value="data"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
            >
              <Database className="h-4 w-4 mr-2" />
              Dados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="flex-1 m-0">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                {/* Fonte de dados */}
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Fonte de dados</label>
                  <Select 
                    value={card.dataSource || ""} 
                    onValueChange={(value) => handleDataSourceChange(value as DataSource)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecionar fonte" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border">
                      {DATA_SOURCES.map((source) => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tela */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Tela</h3>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Exibir como gráfico em anel</span>
                    </div>
                    <Switch checked={showAsDonut} onCheckedChange={setShowAsDonut} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Exibir como porcentagens</span>
                    </div>
                    <Switch checked={showPercentages} onCheckedChange={setShowPercentages} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <List className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Mostrar legenda</span>
                    </div>
                    <Switch checked={showLegend} onCheckedChange={setShowLegend} />
                  </div>
                </div>

                {/* Dados */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Dados</h3>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Medida</label>
                    <Select defaultValue="count">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border">
                        <SelectItem value="count">Número de leads</SelectItem>
                        <SelectItem value="revenue">Receita estimada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Agrupar por</label>
                    <Select defaultValue="pipeline">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border">
                        <SelectItem value="pipeline">Pipeline</SelectItem>
                        <SelectItem value="tag">Tag</SelectItem>
                        <SelectItem value="mql">MQL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Filtros */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Filtros</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="text-xs">
                      <Filter className="h-3 w-3 mr-1" />
                      Filtro
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="data" className="flex-1 m-0">
            <ScrollArea className="h-full">
              <div className="p-6">
                <p className="text-sm text-muted-foreground">
                  Dados do cartão aparecerão aqui.
                </p>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </>
  );
}
