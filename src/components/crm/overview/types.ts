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
  | "leads_over_time" 
  | "total_leads"
  | "recent_leads"
  | "leads_by_tag"
  | "leads_by_utm"
  | "leads_by_custom_field"
  | "custom_field_avg"
  | "custom_field_fill_rate";

export interface OverviewCard {
  id: string;
  title: string;
  chartType: ChartType;
  dataSource: DataSource | null;
  size: CardSize;
  order: number;
  config?: {
    customFieldId?: string;
    [key: string]: any;
  };
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
    id: "leads_by_utm",
    title: "Gráfico de Barras - Leads por UTM",
    description: "Distribuição de leads por origem de tráfego (UTM)",
    chartType: "bar_vertical",
    dataSource: "leads_by_utm",
    defaultSize: { widthPercent: 40, height: 320 },
    icon: "Link",
    category: "charts",
  },
  {
    id: "leads_by_custom_field",
    title: "Gráfico de Barras - Campo Personalizado",
    description: "Distribuição de leads por campo personalizado",
    chartType: "bar",
    dataSource: "leads_by_custom_field",
    defaultSize: { widthPercent: 40, height: 320 },
    icon: "Settings2",
    category: "charts",
  },
  {
    id: "custom_field_pie",
    title: "Pizza - Campo Personalizado",
    description: "Distribuição de leads por campo personalizado em pizza",
    chartType: "pie",
    dataSource: "leads_by_custom_field",
    defaultSize: { widthPercent: 40, height: 320 },
    icon: "PieChart",
    category: "charts",
  },
  {
    id: "custom_field_avg",
    title: "Gauge - Média de Campo Numérico",
    description: "Média de um campo numérico para medir lead score",
    chartType: "gauge",
    dataSource: "custom_field_avg",
    defaultSize: { widthPercent: 25, height: 220 },
    icon: "Gauge",
    category: "metrics",
  },
  {
    id: "custom_field_fill_rate",
    title: "Numérico - Taxa de Preenchimento",
    description: "Percentual de leads que preencheram um campo",
    chartType: "number",
    dataSource: "custom_field_fill_rate",
    defaultSize: { widthPercent: 22, height: 180 },
    icon: "CheckCircle",
    category: "metrics",
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
