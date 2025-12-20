import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { subDays, startOfDay, endOfDay, format, differenceInDays, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Dot
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, Calendar, Settings, User } from "lucide-react";
import ModernAreaChart from "@/components/dashboard/ModernAreaChart";
import ModernBarChart from "@/components/dashboard/ModernBarChart";
import MiniGaugeChart from "@/components/dashboard/MiniGaugeChart";
import DateFilter, { DateRange } from "@/components/dashboard/DateFilter";

interface Lead {
  id: string;
  name: string;
  email: string;
  service_area: string;
  created_at: string;
  is_mql: boolean | null;
  sub_origin_id: string | null;
}

interface DayData {
  day: string;
  leads: number;
}

interface Origin {
  id: string;
  nome: string;
}

interface SubOrigin {
  id: string;
  origin_id: string;
  nome: string;
}

interface Appointment {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  sdr_name: string | null;
  closer_name: string | null;
  is_paid: boolean | null;
  payment_value: number | null;
  is_noshow: boolean | null;
}

const OriginOverview = () => {
  const { isLoading: authLoading } = useAuth("/auth");
  const [searchParams] = useSearchParams();
  const originId = searchParams.get('origin');
  
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [subOrigins, setSubOrigins] = useState<SubOrigin[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [agendaMode, setAgendaMode] = useState(false);
  
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date())
  });

  // Filter appointments by date range
  const appointments = useMemo(() => {
    return allAppointments.filter(apt => {
      const date = new Date(apt.start_time);
      return date >= dateRange.from && date <= dateRange.to;
    });
  }, [allAppointments, dateRange]);

  // Get sub_origin_ids for this origin
  const subOriginIds = useMemo(() => {
    return subOrigins.filter(s => s.origin_id === originId).map(s => s.id);
  }, [subOrigins, originId]);

  // Filter leads by date range only (sub_origin filtering is done in the query)
  const leads = useMemo(() => {
    return allLeads.filter(lead => {
      const date = new Date(lead.created_at);
      return date >= dateRange.from && date <= dateRange.to;
    });
  }, [allLeads, dateRange]);

  useEffect(() => {
    if (!originId) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch origin
        const originRes = await supabase
          .from("crm_origins")
          .select("*")
          .eq("id", originId)
          .single();

        if (originRes.data) setOrigin(originRes.data);

        // Fetch sub_origins for this origin only
        const subOriginsRes = await supabase
          .from("crm_sub_origins")
          .select("*")
          .eq("origin_id", originId);

        if (subOriginsRes.data) {
          setSubOrigins(subOriginsRes.data);
          
          // Fetch leads for these sub_origins only
          const subOriginIds = subOriginsRes.data.map(s => s.id);
          
          if (subOriginIds.length > 0) {
            const leadsRes = await supabase
              .from("leads")
              .select("id, name, email, service_area, created_at, is_mql, sub_origin_id")
              .in("sub_origin_id", subOriginIds)
              .order("created_at", { ascending: false });

            if (leadsRes.data) setAllLeads(leadsRes.data);
          } else {
            setAllLeads([]);
          }
        }

        // Fetch appointments
        const appointmentsRes = await supabase
          .from("calendar_appointments")
          .select("id, title, start_time, end_time, sdr_name, closer_name, is_paid, payment_value, is_noshow")
          .order("start_time", { ascending: false });

        if (appointmentsRes.data) setAllAppointments(appointmentsRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("origin-overview-leads")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_appointments" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setAllAppointments((prev) => [payload.new as Appointment, ...prev]);
          } else if (payload.eventType === "DELETE") {
            setAllAppointments((prev) => prev.filter((apt) => apt.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            setAllAppointments((prev) =>
              prev.map((apt) =>
                apt.id === payload.new.id ? (payload.new as Appointment) : apt
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [originId]);

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

  const getMQLPercentage = () => {
    const leadsWithMQL = leads.filter(lead => lead.is_mql !== null);
    if (leadsWithMQL.length === 0) return "0";
    const mqlCount = leadsWithMQL.filter(lead => lead.is_mql === true).length;
    return ((mqlCount / leadsWithMQL.length) * 100).toFixed(1);
  };

  const getPeriodLabel = () => {
    const days = differenceInDays(dateRange.to, dateRange.from) + 1;
    if (days === 1) return "Hoje";
    return `Últimos ${days} dias`;
  };

  if (loading || authLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-64" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-white border border-black/5 shadow-none">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-white border border-black/5 shadow-none lg:col-span-2">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-3 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[200px] w-full rounded-lg" />
              </CardContent>
            </Card>
            <Card className="bg-white border border-black/5 shadow-none">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-28 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {origin?.nome || "Overview"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Visão geral da origem
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border border-border">
                <DropdownMenuItem 
                  className="flex items-center justify-between cursor-pointer"
                  onSelect={(e) => e.preventDefault()}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Modo Agenda</span>
                  </div>
                  <Switch 
                    checked={agendaMode} 
                    onCheckedChange={setAgendaMode}
                  />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DateFilter onDateChange={setDateRange} />
          </div>
        </div>

        {agendaMode ? (
          <>
            {/* Agenda Mode - Simplified Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="bg-white border border-black/5 shadow-none">
                <CardContent className="pt-5 pb-4">
                  <p className="text-sm text-muted-foreground font-medium mb-2">Total Leads</p>
                  <p className="text-3xl font-bold text-foreground">{leads.length}</p>
                </CardContent>
              </Card>

              <Card className="bg-white border border-black/5 shadow-none">
                <CardContent className="pt-5 pb-4">
                  <p className="text-sm text-muted-foreground font-medium mb-2">Agendamentos</p>
                  <p className="text-3xl font-bold text-foreground">{appointments.length}</p>
                </CardContent>
              </Card>

              <Card className="bg-white border border-black/5 shadow-none">
                <CardContent className="pt-5 pb-4">
                  <p className="text-sm text-muted-foreground font-medium mb-2">No Show</p>
                  <p className="text-3xl font-bold text-rose-500">
                    {appointments.filter(a => a.is_noshow).length}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white border border-black/5 shadow-none">
                <CardContent className="pt-5 pb-4">
                  <p className="text-sm text-muted-foreground font-medium mb-2">Total Vendas</p>
                  <p className="text-3xl font-bold text-foreground">
                    {appointments.filter(a => a.is_paid && a.payment_value && a.payment_value > 0).length}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white border border-black/5 shadow-none">
                <CardContent className="pt-5 pb-4">
                  <p className="text-sm text-muted-foreground font-medium mb-2">Valor em Vendas</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      appointments
                        .filter(a => a.is_paid && a.payment_value)
                        .reduce((sum, a) => sum + (a.payment_value || 0), 0)
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Grid - SDR and Closer */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* SDR Appointments Chart */}
              <Card className="bg-white border border-black/5 shadow-none">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold text-foreground">
                    Agendamentos por SDR
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(() => {
                      const sdrCounts = appointments.reduce((acc, apt) => {
                        const sdr = apt.sdr_name || "Sem SDR";
                        acc[sdr] = (acc[sdr] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);

                      const maxCount = Math.max(...Object.values(sdrCounts), 1);
                      const sortedSdrs = Object.entries(sdrCounts).sort((a, b) => b[1] - a[1]);

                      if (sortedSdrs.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum agendamento no período
                          </p>
                        );
                      }

                      return sortedSdrs.map(([sdr, count]) => (
                        <div key={sdr} className="space-y-1.5">
                          <span className="text-sm font-medium text-foreground">{sdr}</span>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-10 bg-muted/30 rounded-lg overflow-hidden relative">
                              <div 
                                className="h-full rounded-lg transition-all duration-700 ease-out relative overflow-hidden"
                                style={{ 
                                  width: `${(count / maxCount) * 100}%`,
                                  background: `repeating-linear-gradient(
                                    90deg,
                                    #00000020,
                                    #00000020 12px,
                                    #00000025 12px,
                                    #00000025 24px
                                  )`
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center">
                                <User className="h-5 w-5 text-background" />
                              </div>
                              <span className="text-lg font-bold text-foreground min-w-[24px]">{count}</span>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* Closer Meetings Chart */}
              <Card className="bg-white border border-black/5 shadow-none">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold text-foreground">
                    Reuniões por Closer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(() => {
                      const closerCounts = appointments.reduce((acc, apt) => {
                        const closer = apt.closer_name || "Sem Closer";
                        acc[closer] = (acc[closer] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);

                      const maxCount = Math.max(...Object.values(closerCounts), 1);
                      const sortedClosers = Object.entries(closerCounts).sort((a, b) => b[1] - a[1]);

                      if (sortedClosers.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhuma reunião no período
                          </p>
                        );
                      }

                      return sortedClosers.map(([closer, count]) => (
                        <div key={closer} className="space-y-1.5">
                          <span className="text-sm font-medium text-foreground">{closer}</span>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-10 bg-muted/30 rounded-lg overflow-hidden relative">
                              <div 
                                className="h-full rounded-lg transition-all duration-700 ease-out relative overflow-hidden"
                                style={{ 
                                  width: `${(count / maxCount) * 100}%`,
                                  background: `repeating-linear-gradient(
                                    90deg,
                                    #00000020,
                                    #00000020 12px,
                                    #00000025 12px,
                                    #00000025 24px
                                  )`
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center">
                                <User className="h-5 w-5 text-background" />
                              </div>
                              <span className="text-lg font-bold text-foreground min-w-[24px]">{count}</span>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Meetings by Hour Chart */}
            <Card className="bg-white border border-black/5 shadow-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-foreground">
                  Reuniões e Vendas por Horário
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  // Generate hourly data from 6am to 22pm - DADOS REAIS da agenda
                  const hourlyData = Array.from({ length: 17 }, (_, i) => {
                    const hour = i + 6;
                    const hourStr = `${hour.toString().padStart(2, '0')}h`;
                    
                    const meetingsInHour = appointments.filter(apt => {
                      const aptHour = new Date(apt.start_time).getUTCHours();
                      return aptHour === hour;
                    }).length;
                    
                    const salesInHour = appointments.filter(apt => {
                      const aptHour = new Date(apt.start_time).getUTCHours();
                      return aptHour === hour && apt.is_paid && apt.payment_value && apt.payment_value > 0;
                    }).length;
                    
                    return {
                      hour: hourStr,
                      reunioes: meetingsInHour,
                      vendas: salesInHour
                    };
                  });

                  return (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={hourlyData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="gradientAgendamentos" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6b7280" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="#6b7280" stopOpacity={0.05} />
                            </linearGradient>
                            <linearGradient id="gradientVendas" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#e11d48" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="#e11d48" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                          <XAxis 
                            dataKey="hour" 
                            axisLine={false} 
                            tickLine={false}
                            tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 500 }}
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false}
                            tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 500 }}
                            allowDecimals={false}
                            width={30}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(255,255,255,0.95)', 
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                              padding: '12px 16px'
                            }}
                            labelStyle={{ fontWeight: 600, marginBottom: 8, color: '#374151' }}
                            itemStyle={{ padding: '2px 0' }}
                            cursor={{ stroke: 'rgba(0,0,0,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }}
                          />
                          <Legend 
                            verticalAlign="top" 
                            height={40}
                            iconType="circle"
                            wrapperStyle={{ paddingBottom: '10px' }}
                            formatter={(value) => <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 500 }}>{value}</span>}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="reunioes" 
                            name="Agendamentos"
                            stroke="#6b7280" 
                            strokeWidth={2.5}
                            fill="url(#gradientAgendamentos)"
                            dot={{ fill: '#fff', stroke: '#6b7280', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, strokeWidth: 3, fill: '#fff', stroke: '#6b7280' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="vendas" 
                            name="Vendas"
                            stroke="#e11d48" 
                            strokeWidth={2.5}
                            fill="url(#gradientVendas)"
                            dot={{ fill: '#fff', stroke: '#e11d48', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, strokeWidth: 3, fill: '#fff', stroke: '#e11d48' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Normal Mode - Full Stats */}
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
                    <div className="w-10 h-10 rounded-full border border-rose-400 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-rose-500" />
                    </div>
                    <p className="text-sm text-foreground font-medium">Taxa MQL</p>
                  </div>
                  <p className="text-3xl font-bold text-foreground">{getMQLPercentage()}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{leads.filter(l => l.is_mql === true).length} MQLs</p>
                </CardContent>
              </Card>

              <Card className="bg-white border border-black/5 shadow-none">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full border border-violet-400 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-violet-500" />
                    </div>
                    <p className="text-sm text-foreground font-medium">Sub-origens</p>
                  </div>
                  <p className="text-3xl font-bold text-foreground">{subOriginIds.length}</p>
                </CardContent>
              </Card>

              <Card className="bg-white border border-black/5 shadow-none">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full border border-sky-400 flex items-center justify-center">
                      <Users className="h-5 w-5 text-sky-500" />
                    </div>
                    <p className="text-sm text-foreground font-medium">Média/Dia</p>
                  </div>
                  <p className="text-3xl font-bold text-foreground">
                    {(leads.length / Math.max(differenceInDays(dateRange.to, dateRange.from) + 1, 1)).toFixed(1)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
          </>
        )}
    </div>
  );
};

export default OriginOverview;
