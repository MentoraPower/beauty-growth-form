import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar } from "lucide-react";
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

const Dashboard = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLeads();

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

    return () => {
      supabase.removeChannel(channel);
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <div className="h-7 w-32 bg-muted rounded-lg animate-pulse" />
            <div className="h-4 w-48 bg-muted rounded-lg animate-pulse mt-2" />
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>

          {/* Charts Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <AreaChartSkeleton />
            <ChartSkeleton height="200px" />
          </div>

          {/* Bar Chart Skeleton */}
          <ChartSkeleton height="300px" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral dos seus leads</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-card border-border/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Leads</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{leads.length}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Leads Hoje</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{getLeadsToday()}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leads Trend - Area Chart */}
          <Card className="bg-card border-border/50 lg:col-span-2">
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
          <Card className="bg-card border-border/50">
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
        <Card className="bg-card border-border/50">
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
