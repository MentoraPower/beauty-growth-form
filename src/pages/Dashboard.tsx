import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, ShoppingCart, DollarSign } from "lucide-react";
import ModernAreaChart from "@/components/dashboard/ModernAreaChart";
import ModernBarChart from "@/components/dashboard/ModernBarChart";
import MiniGaugeChart from "@/components/dashboard/MiniGaugeChart";
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
  service_area: string;
  monthly_billing: string;
  weekly_attendance: string;
  workspace_type: string;
  years_experience: string;
  created_at: string;
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

const Dashboard = () => {
  const { isLoading: authLoading } = useAuth("/auth");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [pageViews, setPageViews] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
            setLeads((prev) => [payload.new as Lead, ...prev]);
          } else if (payload.eventType === "DELETE") {
            setLeads((prev) => prev.filter((lead) => lead.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            setLeads((prev) =>
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
        () => {
          setPageViews((prev) => prev + 1);
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
            setSales((prev) => [payload.new as Sale, ...prev]);
          } else if (payload.eventType === "DELETE") {
            setSales((prev) => prev.filter((sale) => sale.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            setSales((prev) =>
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
      setLeads(data || []);
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
      setSales(data || []);
    } catch (error) {
      console.error("Error fetching sales:", error);
    }
  };

  const fetchPageViews = async () => {
    try {
      const { count, error } = await supabase
        .from("page_views")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      setPageViews(count || 0);
    } catch (error) {
      console.error("Error fetching page views:", error);
    }
  };

  // Calculate leads by day of week
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

  // Calculate leads trend (last 7 days)
  const getLeadsTrend = () => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      last7Days.push({
        date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        count: leads.filter((lead) => {
          const leadDate = new Date(lead.created_at);
          return leadDate.toDateString() === date.toDateString();
        }).length,
      });
    }
    return last7Days;
  };

  // Get leads today
  const getLeadsToday = () => {
    return leads.filter(
      (lead) => new Date(lead.created_at).toDateString() === new Date().toDateString()
    ).length;
  };

  // Calculate conversion rate
  const getConversionRate = () => {
    if (pageViews === 0) return "0";
    return ((leads.length / pageViews) * 100).toFixed(1);
  };

  // Get total sales count
  const getTotalSales = () => sales.length;

  // Get total sales amount
  const getTotalSalesAmount = () => {
    const total = sales.reduce((acc, sale) => acc + Number(sale.amount), 0);
    return total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Show content with skeleton placeholders for loading data instead of full skeleton screen
  const isDataReady = leads.length > 0 || !loading;

  return (
    <DashboardLayout>
      <div className="space-y-6 fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral dos seus leads</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              <p className="text-xs text-muted-foreground mt-1">{pageViews} visitas</p>
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
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Leads Trend - Area Chart */}
          <Card className="bg-white border border-black/5 shadow-none lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">
                Tendência de Leads
              </CardTitle>
              <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
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
                    acc[lead.service_area] = (acc[lead.service_area] || 0) + 1;
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
