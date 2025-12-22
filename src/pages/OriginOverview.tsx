import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { subDays, startOfDay, endOfDay } from "date-fns";
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
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import DateFilter, { DateRange } from "@/components/dashboard/DateFilter";
import { AnimatedNumber, AnimatedCurrency } from "@/components/dashboard/AnimatedNumber";

interface Origin {
  id: string;
  nome: string;
}

interface SubOrigin {
  id: string;
  origin_id: string;
  nome: string;
  tipo?: string;
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
  sub_origin_id: string | null;
}

const OriginOverview = () => {
  const { isLoading: authLoading } = useAuth("/auth");
  const [searchParams] = useSearchParams();
  const originId = searchParams.get('origin');
  
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [subOrigins, setSubOrigins] = useState<SubOrigin[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  
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
          .select("*, tipo")
          .eq("origin_id", originId);

        if (subOriginsRes.data) {
          setSubOrigins(subOriginsRes.data);
          
          const subOriginIds = subOriginsRes.data.map(s => s.id);
          
          if (subOriginIds.length > 0) {
            // Fetch appointments for these sub_origins only
            const appointmentsRes = await supabase
              .from("calendar_appointments")
              .select("id, title, start_time, end_time, sdr_name, closer_name, is_paid, payment_value, is_noshow, sub_origin_id")
              .in("sub_origin_id", subOriginIds)
              .order("start_time", { ascending: false });

            if (appointmentsRes.data) setAllAppointments(appointmentsRes.data);
          } else {
            setAllAppointments([]);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("origin-overview-appointments")
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
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 flex-1 min-w-[140px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
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
            Dashboard comercial
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateFilter onDateChange={setDateRange} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="flex flex-wrap gap-3">
        <Card className="bg-white border border-black/5 shadow-none flex-1 min-w-[140px]">
          <CardContent className="px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground font-medium whitespace-nowrap">Agendamentos</p>
            <p className="text-2xl font-bold text-foreground">
              <AnimatedNumber value={appointments.length} />
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-black/5 shadow-none flex-1 min-w-[120px]">
          <CardContent className="px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground font-medium whitespace-nowrap">No Show</p>
            <p className="text-2xl font-bold text-rose-500">
              <AnimatedNumber value={appointments.filter(a => a.is_noshow).length} />
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-black/5 shadow-none flex-1 min-w-[140px]">
          <CardContent className="px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground font-medium whitespace-nowrap">Total Vendas</p>
            <p className="text-2xl font-bold text-foreground">
              <AnimatedNumber value={appointments.filter(a => a.is_paid && a.payment_value && a.payment_value > 0).length} />
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-black/5 shadow-none flex-none w-auto">
          <CardContent className="px-4 py-3 flex items-center gap-3">
            <p className="text-sm text-muted-foreground font-medium whitespace-nowrap">Valor em Vendas</p>
            <p className="text-2xl font-bold text-emerald-600 whitespace-nowrap">
              <AnimatedCurrency 
                value={appointments
                  .filter(a => a.is_paid && a.payment_value)
                  .reduce((sum, a) => sum + (a.payment_value || 0), 0)} 
              />
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

                if (Object.keys(sdrCounts).length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum agendamento no período
                    </p>
                  );
                }

                return Object.entries(sdrCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([sdr, count]) => (
                    <div key={sdr} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-foreground">{sdr}</span>
                        <span className="text-sm font-bold text-foreground">{count}</span>
                      </div>
                      <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400 rounded-full transition-all duration-500"
                          style={{ width: `${(count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ));
              })()}
            </div>
          </CardContent>
        </Card>

        {/* SDR Sales Chart */}
        <Card className="bg-white border-0 shadow-none animated-dashed-border rounded-xl">
          <svg className="rounded-xl">
            <defs>
              <linearGradient id="orangeGradientSDR" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ea580c" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
            </defs>
            <rect x="1" y="1" rx="11" ry="11" style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)', stroke: 'url(#orangeGradientSDR)' }} />
          </svg>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-foreground">
              Reuniões e Vendas por SDR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(() => {
                const sdrStats = appointments.reduce((acc, apt) => {
                  const sdr = apt.sdr_name || "Sem SDR";
                  if (!acc[sdr]) acc[sdr] = { meetings: 0, sales: 0 };
                  acc[sdr].meetings++;
                  if (apt.is_paid && apt.payment_value && apt.payment_value > 0) {
                    acc[sdr].sales++;
                  }
                  return acc;
                }, {} as Record<string, { meetings: number; sales: number }>);

                const sortedSdrs = Object.entries(sdrStats).sort((a, b) => b[1].sales - a[1].sales);

                if (sortedSdrs.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum dado disponível
                    </p>
                  );
                }

                const maxSales = Math.max(...sortedSdrs.map(([, stats]) => stats.sales), 1);

                return sortedSdrs.map(([sdr, stats]) => {
                  const conversionRate = stats.meetings > 0 
                    ? ((stats.sales / stats.meetings) * 100).toFixed(0) 
                    : "0";
                  
                  return (
                    <div key={sdr} className="space-y-1.5">
                      <span className="text-sm font-medium text-foreground">{sdr}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-10 bg-orange-100/50 rounded-lg overflow-hidden relative">
                          <div 
                            className="h-full rounded-lg relative overflow-hidden animate-bar-fill bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400"
                            style={{ 
                              width: `${(stats.sales / maxSales) * 100}%`
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-600 to-amber-500 flex items-center justify-center">
                            <span className="text-xs font-bold text-white">{conversionRate}%</span>
                          </div>
                          <span className="text-lg font-bold text-orange-600 min-w-[24px]">{stats.sales}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Closer Appointments Chart */}
        <Card className="bg-white border border-black/5 shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-foreground">
              Reuniões realizadas por Closer
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

                if (Object.keys(closerCounts).length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum agendamento no período
                    </p>
                  );
                }

                return Object.entries(closerCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([closer, count]) => (
                    <div key={closer} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-foreground">{closer}</span>
                        <span className="text-sm font-bold text-foreground">{count}</span>
                      </div>
                      <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400 rounded-full transition-all duration-500"
                          style={{ width: `${(count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ));
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Closer Sales Chart */}
        <Card className="bg-white border-0 shadow-none animated-dashed-border rounded-xl">
          <svg className="rounded-xl">
            <defs>
              <linearGradient id="orangeGradientCloser" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ea580c" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
            </defs>
            <rect x="1" y="1" rx="11" ry="11" style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)', stroke: 'url(#orangeGradientCloser)' }} />
          </svg>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-foreground">
              Reuniões e Vendas por Closer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(() => {
                const closerStats = appointments.reduce((acc, apt) => {
                  const closer = apt.closer_name || "Sem Closer";
                  if (!acc[closer]) acc[closer] = { meetings: 0, sales: 0 };
                  acc[closer].meetings++;
                  if (apt.is_paid && apt.payment_value && apt.payment_value > 0) {
                    acc[closer].sales++;
                  }
                  return acc;
                }, {} as Record<string, { meetings: number; sales: number }>);

                const sortedClosers = Object.entries(closerStats).sort((a, b) => b[1].sales - a[1].sales);

                if (sortedClosers.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum dado disponível
                    </p>
                  );
                }

                const maxSales = Math.max(...sortedClosers.map(([, stats]) => stats.sales), 1);

                return sortedClosers.map(([closer, stats]) => {
                  const conversionRate = stats.meetings > 0 
                    ? ((stats.sales / stats.meetings) * 100).toFixed(0) 
                    : "0";
                  
                  return (
                    <div key={closer} className="space-y-1.5">
                      <span className="text-sm font-medium text-foreground">{closer}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-10 bg-orange-100/50 rounded-lg overflow-hidden relative">
                        <div 
                          className="h-full rounded-lg relative overflow-hidden animate-bar-fill bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400"
                            style={{ 
                              width: `${(stats.sales / maxSales) * 100}%`
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-600 to-amber-500 flex items-center justify-center">
                            <span className="text-xs font-bold text-white">{conversionRate}%</span>
                          </div>
                          <span className="text-lg font-bold text-orange-600 min-w-[24px]">{stats.sales}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
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
            // Generate hourly data from 6am to 22pm
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
                hourNum: hour,
                reunioes: meetingsInHour,
                vendas: salesInHour
              };
            });

            // Get top 3 champion hours
            const topHours = [...hourlyData]
              .filter(h => h.vendas > 0)
              .sort((a, b) => b.vendas - a.vendas)
              .slice(0, 3);

            const CustomTooltipHourly = ({ active, payload, label }: any) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 shadow-xl">
                    <p className="text-neutral-400 text-xs mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                      <p key={index} className="text-white font-semibold text-sm">
                        {entry.name}: <span style={{ color: entry.color }}>{entry.value}</span>
                      </p>
                    ))}
                  </div>
                );
              }
              return null;
            };

            return (
              <div className="flex gap-4">
                {/* Chart */}
                <div className="flex-1 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradientAgendamentos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6b7280" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#6b7280" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradientVendas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ea580c" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#ea580c" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="lineGradientAgendamentos" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6b7280" />
                        <stop offset="100%" stopColor="#9ca3af" />
                      </linearGradient>
                      <linearGradient id="lineGradientVendas" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#ea580c" />
                        <stop offset="100%" stopColor="#f59e0b" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      vertical={true}
                      horizontal={true}
                    />
                    <XAxis 
                      dataKey="hour" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      dx={-10}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltipHourly />} />
                    <Legend 
                      verticalAlign="top" 
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: '8px' }}
                      formatter={(value) => <span className="text-muted-foreground text-xs font-medium">{value}</span>}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="reunioes" 
                      name="Agendamentos"
                      stroke="url(#lineGradientAgendamentos)"
                      strokeWidth={2.5}
                      fill="url(#gradientAgendamentos)"
                      dot={false}
                      activeDot={{
                        r: 6,
                        fill: "#6b7280",
                        stroke: "white",
                        strokeWidth: 2,
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="vendas" 
                      name="Vendas"
                      stroke="url(#lineGradientVendas)"
                      strokeWidth={2.5}
                      fill="url(#gradientVendas)"
                      dot={false}
                      activeDot={{
                        r: 6,
                        fill: "#e11d48",
                        stroke: "white",
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                </div>
                
                {/* Top Hours Sidebar - Right side */}
                {topHours.length > 0 && (
                  <div className="flex flex-col gap-2 w-[100px] animate-fade-in">
                    <span className="text-xs text-muted-foreground font-medium mb-1">Top vendas</span>
                    {topHours.map((h, idx) => (
                      <div 
                        key={h.hourNum} 
                        className="flex flex-col px-3 py-2 rounded-lg bg-muted/30 border border-black/5"
                      >
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          {h.hour}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-rose-500' : 'bg-muted-foreground/50'}`} />
                          <span className="text-lg font-bold text-foreground">
                            {h.vendas}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

export default OriginOverview;
