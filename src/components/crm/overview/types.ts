export type CardSize = {
  widthPercent: number; // percentage of container width (0-100)
  height: number; // in pixels
};

export type ChartType = 
  | "pie" 
  | "bar" 
  | "area" 
  | "gauge" 
  | "number" 
  | "list" 
  | "funnel";

export type DataSource = 
  | "leads_by_pipeline" 
  | "leads_by_mql" 
  | "leads_over_time" 
  | "total_leads"
  | "conversion_rate"
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
    title: "Leads por Pipeline",
    description: "Gráfico de pizza com a distribuição de leads por pipeline",
    chartType: "pie",
    dataSource: "leads_by_pipeline",
    defaultSize: { widthPercent: 30, height: 360 },
    icon: "PieChart",
    category: "featured",
  },
  {
    id: "total_leads",
    title: "Total de Leads",
    description: "Mostra o número total de leads no CRM",
    chartType: "number",
    dataSource: "total_leads",
    defaultSize: { widthPercent: 22, height: 180 },
    icon: "Users",
    category: "metrics",
  },
  {
    id: "leads_over_time",
    title: "Leads ao Longo do Tempo",
    description: "Gráfico de área mostrando entrada de leads",
    chartType: "area",
    dataSource: "leads_over_time",
    defaultSize: { widthPercent: 50, height: 320 },
    icon: "TrendingUp",
    category: "featured",
  },
  {
    id: "leads_by_mql",
    title: "MQL vs Não-MQL",
    description: "Proporção de leads qualificados",
    chartType: "pie",
    dataSource: "leads_by_mql",
    defaultSize: { widthPercent: 30, height: 360 },
    icon: "Target",
    category: "charts",
  },
  {
    id: "recent_leads",
    title: "Leads Recentes",
    description: "Lista dos últimos leads adicionados",
    chartType: "list",
    dataSource: "recent_leads",
    defaultSize: { widthPercent: 30, height: 400 },
    icon: "List",
    category: "lists",
  },
  {
    id: "leads_by_tag",
    title: "Leads por Tag",
    description: "Distribuição de leads por tags",
    chartType: "bar",
    dataSource: "leads_by_tag",
    defaultSize: { widthPercent: 40, height: 320 },
    icon: "Tag",
    category: "charts",
  },
  {
    id: "conversion_funnel",
    title: "Funil de Conversão",
    description: "Visualize a progressão dos leads pelos pipelines",
    chartType: "funnel",
    dataSource: "conversion_rate",
    defaultSize: { widthPercent: 40, height: 360 },
    icon: "Filter",
    category: "featured",
  },
];

// Min/max constraints
export const MIN_CARD_WIDTH_PERCENT = 15; // minimum 15% of container
export const MIN_CARD_WIDTH_PX = 280; // minimum width in pixels (ensures readability on smaller screens)
export const MIN_CARD_HEIGHT = 150;
export const MAX_CARD_WIDTH_PERCENT = 100; // can be full width
export const MAX_CARD_HEIGHT = 1200;
