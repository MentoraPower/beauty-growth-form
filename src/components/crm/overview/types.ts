export type CardSize = {
  widthPercent: number; // percentage of container width (0-100)
  height: number; // in pixels
};

export type ChartType = 
  | "pie" 
  | "bar" 
  | "bar_vertical"
  | "area" 
  | "gauge" 
  | "number" 
  | "list"
  | "heatmap";

export type DataSource = 
  | "leads_by_pipeline" 
  | "leads_by_mql" 
  | "leads_over_time" 
  | "total_leads"
  | "recent_leads"
  | "leads_by_tag";

export interface OverviewCard {
  id: string;
  title: string;
  chartType: ChartType;
  dataSource: DataSource | null;
  size: CardSize;
  order: number;
  config?: Record<string, any>;
}

export interface CardTemplate {
  id: string;
  title: string;
  description: string;
  chartType: ChartType;
  dataSource: DataSource;
  defaultSize: CardSize;
  icon: string;
  category: "featured" | "charts" | "metrics" | "lists";
}

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: "leads_by_pipeline",
    title: "Gráfico de Pizza - Leads por Pipeline",
    description: "Distribuição de leads por pipeline",
    chartType: "pie",
    dataSource: "leads_by_pipeline",
    defaultSize: { widthPercent: 30, height: 360 },
    icon: "PieChart",
    category: "featured",
  },
  {
    id: "total_leads",
    title: "Cartão Numérico - Total de Leads",
    description: "Mostra o número total de leads no CRM",
    chartType: "number",
    dataSource: "total_leads",
    defaultSize: { widthPercent: 22, height: 180 },
    icon: "Users",
    category: "metrics",
  },
  {
    id: "leads_over_time",
    title: "Gráfico de Área - Leads ao Longo do Tempo",
    description: "Mostra entrada de leads ao longo do tempo",
    chartType: "area",
    dataSource: "leads_over_time",
    defaultSize: { widthPercent: 50, height: 320 },
    icon: "TrendingUp",
    category: "featured",
  },
  {
    id: "leads_by_mql",
    title: "Gráfico de Pizza - MQL vs Não-MQL",
    description: "Proporção de leads qualificados",
    chartType: "pie",
    dataSource: "leads_by_mql",
    defaultSize: { widthPercent: 30, height: 360 },
    icon: "Target",
    category: "charts",
  },
  {
    id: "recent_leads",
    title: "Lista - Leads Recentes",
    description: "Lista dos últimos leads adicionados",
    chartType: "list",
    dataSource: "recent_leads",
    defaultSize: { widthPercent: 30, height: 400 },
    icon: "List",
    category: "lists",
  },
  {
    id: "leads_by_tag",
    title: "Gráfico de Barras - Leads por Tag",
    description: "Distribuição de leads por tags",
    chartType: "bar",
    dataSource: "leads_by_tag",
    defaultSize: { widthPercent: 40, height: 320 },
    icon: "Tag",
    category: "charts",
  },
  {
    id: "leads_vertical_bar",
    title: "Gráfico de Barras Verticais - Leads por Pipeline",
    description: "Barras verticais modernas por pipeline",
    chartType: "bar_vertical",
    dataSource: "leads_by_pipeline",
    defaultSize: { widthPercent: 45, height: 320 },
    icon: "BarChart3",
    category: "charts",
  },
  {
    id: "leads_heatmap",
    title: "Heatmap de Calendário - Atividade por Dia",
    description: "Visualização de quadrados com atividade diária",
    chartType: "heatmap",
    dataSource: "leads_over_time",
    defaultSize: { widthPercent: 60, height: 240 },
    icon: "Calendar",
    category: "featured",
  },
];

// Min/max constraints
export const MIN_CARD_WIDTH_PERCENT = 15; // minimum 15% of container
export const MIN_CARD_WIDTH_PX = 280; // minimum width in pixels (ensures readability on smaller screens)
export const MIN_CARD_HEIGHT = 150;
export const MAX_CARD_WIDTH_PERCENT = 100; // can be full width
export const MAX_CARD_HEIGHT = 1200;
