import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Calendar, Building2 } from "lucide-react";
import ModernAreaChart from "@/components/dashboard/ModernAreaChart";
import ModernBarChart from "@/components/dashboard/ModernBarChart";
import GaugeChart from "@/components/dashboard/GaugeChart";

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

  // Calculate average years of experience
  const getAverageExperience = () => {
    if (leads.length === 0) return 0;
    const total = leads.reduce((sum, lead) => sum + (parseInt(lead.years_experience) || 0), 0);
    return Math.round(total / leads.length);
  };

  // Count leads with physical space
  const getPhysicalSpaceCount = () => {
    return leads.filter((lead) => lead.workspace_type === "physical").length;
  };

  // Get physical space percentage
  const getPhysicalSpacePercentage = () => {
    if (leads.length === 0) return 0;
    return Math.round((getPhysicalSpaceCount() / leads.length) * 100);
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
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

          <Card className="bg-card border-border/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Experiência Média</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{getAverageExperience()}<span className="text-lg text-muted-foreground ml-1">anos</span></p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Espaço Físico</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{getPhysicalSpaceCount()}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
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

          {/* Gauge Chart */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">
                Taxa de Espaço Físico
              </CardTitle>
              <p className="text-xs text-muted-foreground">Clínicas vs Domicílio</p>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <GaugeChart
                value={getPhysicalSpacePercentage()}
                maxValue={100}
                label="Com Espaço Físico"
                sublabel={`${getPhysicalSpaceCount()} de ${leads.length} leads`}
              />
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
