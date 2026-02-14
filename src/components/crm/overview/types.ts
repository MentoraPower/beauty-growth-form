export type CardSize = {
  widthPercent: number; // percentage of container width (0-100)
  height: number; // in pixels
};

export type ChartType = 
  | "pie" 
  | "donut"
  | "bar" 
  | "bar_vertical"
  | "bar_horizontal"
  | "area" 
  | "line"
  | "gauge" 
  | "number" 
  | "list"
  | "heatmap"
  | "progress"
  | "table";

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
  // Metrics
  {
    id: "total_leads",
    title: "Cartão Numérico",
    description: "Número com variação percentual",
    chartType: "number",
    dataSource: "total_leads",
    defaultSize: { widthPercent: 22, height: 180 },
    icon: "Hash",
    category: "metrics",
  },
  {
    id: "custom_field_avg",
    title: "Gauge",
    description: "Média ou score em semicírculo",
    chartType: "gauge",
    dataSource: "custom_field_avg",
    defaultSize: { widthPercent: 25, height: 220 },
    icon: "Gauge",
    category: "metrics",
  },
  {
    id: "custom_field_fill_rate",
    title: "Taxa de Preenchimento",
    description: "Percentual de completude de dados",
    chartType: "number",
    dataSource: "custom_field_fill_rate",
    defaultSize: { widthPercent: 22, height: 180 },
    icon: "CheckCircle2",
    category: "metrics",
  },
  {
    id: "progress_card",
    title: "Barra de Progresso",
    description: "Progresso visual em barra horizontal",
    chartType: "progress",
    dataSource: "total_leads",
    defaultSize: { widthPercent: 25, height: 180 },
    icon: "Percent",
    category: "metrics",
  },
  // Charts
  {
    id: "leads_over_time",
    title: "Gráfico de Área",
    description: "Evolução ao longo do tempo com preenchimento",
    chartType: "area",
    dataSource: "leads_over_time",
    defaultSize: { widthPercent: 50, height: 320 },
    icon: "TrendingUp",
    category: "featured",
  },
  {
    id: "line_chart",
    title: "Gráfico de Linha",
    description: "Tendência ao longo do tempo",
    chartType: "line",
    dataSource: "leads_over_time",
    defaultSize: { widthPercent: 50, height: 320 },
    icon: "Activity",
    category: "charts",
  },
  {
    id: "leads_by_tag",
    title: "Barras Verticais",
    description: "Comparação por categoria em barras",
    chartType: "bar",
    dataSource: "leads_by_tag",
    defaultSize: { widthPercent: 40, height: 320 },
    icon: "BarChart3",
    category: "charts",
  },
  {
    id: "bar_horizontal_chart",
    title: "Barras Horizontais",
    description: "Ranking horizontal por categoria",
    chartType: "bar_horizontal",
    dataSource: "leads_by_tag",
    defaultSize: { widthPercent: 40, height: 320 },
    icon: "BarChartHorizontal",
    category: "charts",
  },
  {
    id: "custom_field_pie",
    title: "Gráfico de Pizza",
    description: "Proporção entre segmentos",
    chartType: "pie",
    dataSource: "leads_by_custom_field",
    defaultSize: { widthPercent: 40, height: 320 },
    icon: "PieChart",
    category: "charts",
  },
  {
    id: "donut_chart",
    title: "Gráfico Donut",
    description: "Pizza com centro aberto e total",
    chartType: "donut",
    dataSource: "leads_by_custom_field",
    defaultSize: { widthPercent: 40, height: 320 },
    icon: "CircleDot",
    category: "charts",
  },
  // Featured
  {
    id: "leads_heatmap",
    title: "Heatmap de Atividade",
    description: "Atividade diária em grade de calendário",
    chartType: "heatmap",
    dataSource: "leads_over_time",
    defaultSize: { widthPercent: 60, height: 240 },
    icon: "CalendarDays",
    category: "featured",
  },
  {
    id: "table_card",
    title: "Tabela de Dados",
    description: "Dados em formato tabular organizado",
    chartType: "table",
    dataSource: "recent_leads",
    defaultSize: { widthPercent: 50, height: 360 },
    icon: "Table2",
    category: "featured",
  },
  // Lists
  {
    id: "recent_leads",
    title: "Lista de Leads",
    description: "Últimos leads com avatar e detalhes",
    chartType: "list",
    dataSource: "recent_leads",
    defaultSize: { widthPercent: 30, height: 400 },
    icon: "List",
    category: "lists",
  },
];

// Min/max constraints
export const MIN_CARD_WIDTH_PERCENT = 15; // minimum 15% of container
export const MIN_CARD_WIDTH_PX = 280; // minimum width in pixels (ensures readability on smaller screens)
export const MIN_CARD_HEIGHT = 150;
export const MAX_CARD_WIDTH_PERCENT = 100; // can be full width
export const MAX_CARD_HEIGHT = 1200;
