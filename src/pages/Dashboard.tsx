import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { subDays, startOfDay, endOfDay, format, differenceInDays, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, ShoppingCart, DollarSign, Target } from "lucide-react";
import ModernAreaChart from "@/components/dashboard/ModernAreaChart";
import ModernBarChart from "@/components/dashboard/ModernBarChart";
import MiniGaugeChart from "@/components/dashboard/MiniGaugeChart";
import DateFilter, { DateRange } from "@/components/dashboard/DateFilter";
import {
  CardSkeleton,
  AreaChartSkeleton,
  ChartSkeleton,
} from "@/components/dashboard/DashboardSkeleton";

interface Lead {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  country_code: string;
  instagram: string;
  clinic_name: string | null;
  service_area: string;
  monthly_billing: string;
  weekly_attendance: string;
  workspace_type: string;
  years_experience: string;
  average_ticket: number | null;
  created_at: string;
  is_mql: boolean | null;
}

interface DayData {
  day: string;
  leads: number;
}

interface Sale {
  id: string;
  amount: number;
  description: string | null;
  customer_name: string | null;
  created_at: string;
}

interface PageView {
  id: string;
  created_at: string;
}

const Dashboard = () => {
  const { isLoading: authLoading } = useAuth("/auth");
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [allPageViews, setAllPageViews] = useState<PageView[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // Default to last 30 days
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date())
  });

  // Filter data by date range
  const leads = useMemo(() => {
    return allLeads.filter(lead => {
      const date = new Date(lead.created_at);
      return date >= dateRange.from && date <= dateRange.to;
    });
  }, [allLeads, dateRange]);

  const sales = useMemo(() => {
    return allSales.filter(sale => {
      const date = new Date(sale.created_at);
      return date >= dateRange.from && date <= dateRange.to;
    });
  }, [allSales, dateRange]);

  const pageViews = useMemo(() => {
    return allPageViews.filter(view => {
      const date = new Date(view.created_at);
      return date >= dateRange.from && date <= dateRange.to;
    });
  }, [allPageViews, dateRange]);

  useEffect(() => {
    fetchLeads();
    fetchPageViews();
    fetchSales();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("dashboard-leads-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setAllLeads((prev) => [payload.new as Lead, ...prev]);
          } else if (payload.eventType === "DELETE") {
            setAllLeads((prev) => prev.filter((lead) => lead.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            setAllLeads((prev) =>
              prev.map((lead) =>
                lead.id === payload.new.id ? (payload.new as Lead) : lead
              )
            );
          }
        }
      )
      .subscribe();

    // Subscribe to page_views updates
    const viewsChannel = supabase
      .channel("dashboard-views-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "page_views",
        },
        (payload) => {
          setAllPageViews((prev) => [payload.new as PageView, ...prev]);
        }
      )
      .subscribe();

    // Subscribe to sales updates
    const salesChannel = supabase
      .channel("dashboard-sales-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setAllSales((prev) => [payload.new as Sale, ...prev]);
          } else if (payload.eventType === "DELETE") {
            setAllSales((prev) => prev.filter((sale) => sale.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            setAllSales((prev) =>
              prev.map((sale) =>
                sale.id === payload.new.id ? (payload.new as Sale) : sale
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(viewsChannel);
      supabase.removeChannel(salesChannel);
    };
  }, []);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAllLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSales = async () => {
    try {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAllSales(data || []);
    } catch (error) {
      console.error("Error fetching sales:", error);
    }
  };

  const fetchPageViews = async () => {
    try {
      const { data, error } = await supabase
        .from("page_views")
        .select("id, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAllPageViews(data || []);
    } catch (error) {
      console.error("Error fetching page views:", error);
    }
  };

  // Calculate leads by day of week (filtered)
  const getLeadsByDayOfWeek = (): DayData[] => {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const dayCount = [0, 0, 0, 0, 0, 0, 0];

    leads.forEach((lead) => {
      const date = new Date(lead.created_at);
      dayCount[date.getDay()]++;
    });

    return days.map((day, index) => ({
      day,
      leads: dayCount[index],
    }));
  };

  // Calculate leads trend based on date range
  const getLeadsTrend = () => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    
    return days.map(day => ({
      date: format(day, "dd/MMM", { locale: ptBR }),
      count: leads.filter((lead) => {
        const leadDate = new Date(lead.created_at);
        return leadDate.toDateString() === day.toDateString();
      }).length,
    }));
  };

  // Calculate conversion rate (filtered)
  const getConversionRate = () => {
    if (pageViews.length === 0) return "0";
    return ((leads.length / pageViews.length) * 100).toFixed(1);
  };

  // Get total sales count (filtered)
  const getTotalSales = () => sales.length;

  // Get total sales amount (filtered)
  const getTotalSalesAmount = () => {
    const total = sales.reduce((acc, sale) => acc + Number(sale.amount), 0);
    return total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Get MQL percentage (filtered)
  const getMQLPercentage = () => {
    const leadsWithMQL = leads.filter(lead => lead.is_mql !== null);
    if (leadsWithMQL.length === 0) return "0";
    const mqlCount = leadsWithMQL.filter(lead => lead.is_mql === true).length;
    return ((mqlCount / leadsWithMQL.length) * 100).toFixed(1);
  };

  // Get period label for charts
  const getPeriodLabel = () => {
    const days = differenceInDays(dateRange.to, dateRange.from) + 1;
    if (days === 1) return "Hoje";
    return `Últimos ${days} dias`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 transition-opacity duration-300 ease-out">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Visão geral dos seus leads</p>
          </div>
          <DateFilter onDateChange={setDateRange} />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-white border border-black/5 shadow-none">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full border border-emerald-400 flex items-center justify-center">
                  <Users className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm text-foreground font-medium">Total Leads</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{leads.length}</p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-black/5 shadow-none">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full border border-violet-400 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-violet-500" />
                </div>
                <p className="text-sm text-foreground font-medium">Taxa de Captação</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{getConversionRate()}%</p>
              <p className="text-xs text-muted-foreground mt-1">{pageViews.length} visitas</p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-black/5 shadow-none">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full border border-orange-400 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-orange-500" />
                </div>
                <p className="text-sm text-foreground font-medium">Vendas</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{getTotalSales()}</p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-black/5 shadow-none">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full border border-sky-400 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-sky-500" />
                </div>
                <p className="text-sm text-foreground font-medium">Valor em Vendas</p>
              </div>
              <p className="text-2xl font-bold text-foreground">R$ {getTotalSalesAmount()}</p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-black/5 shadow-none">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full border border-rose-400 flex items-center justify-center">
                  <Target className="h-5 w-5 text-rose-500" />
                </div>
                <p className="text-sm text-foreground font-medium">Taxa MQL</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{getMQLPercentage()}%</p>
              <p className="text-xs text-muted-foreground mt-1">{leads.filter(l => l.is_mql === true).length} MQLs</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Leads Trend - Area Chart */}
          <Card className="bg-white border border-black/5 shadow-none lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">
                Tendência de Leads
              </CardTitle>
              <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
            </CardHeader>
            <CardContent>
              <ModernAreaChart data={getLeadsTrend()} title="Leads" />
            </CardContent>
          </Card>

          {/* Mini Gauges por Área */}
          <Card className="bg-white border border-black/5 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">
                Leads por Área
              </CardTitle>
              <p className="text-xs text-muted-foreground">Distribuição por serviço</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {(() => {
                  const areas = leads.reduce((acc, lead) => {
                    if (lead.service_area) {
                      acc[lead.service_area] = (acc[lead.service_area] || 0) + 1;
                    }
                    return acc;
                  }, {} as Record<string, number>);
                  
                  const maxLeads = Math.max(...Object.values(areas), 1);
                  
                  return Object.entries(areas)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([area, count]) => (
                      <MiniGaugeChart
                        key={area}
                        value={count}
                        maxValue={maxLeads}
                        label={area}
                      />
                    ));
                })()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bar Chart */}
        <Card className="bg-white border border-black/5 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">
              Leads por Dia da Semana
            </CardTitle>
            <p className="text-xs text-muted-foreground">Distribuição semanal</p>
          </CardHeader>
          <CardContent>
            <ModernBarChart data={getLeadsByDayOfWeek()} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
