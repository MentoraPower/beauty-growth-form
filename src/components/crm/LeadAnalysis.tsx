import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LeadData {
  name: string;
  clinic_name: string | null;
  service_area: string;
  years_experience: string;
  workspace_type: string;
  monthly_billing: string;
  weekly_attendance: string;
  average_ticket: number | null;
  estimated_revenue: number | null;
  can_afford: string | null;
  wants_more_info: boolean | null;
}

interface LeadAnalysisProps {
  lead: LeadData;
}

interface AnalysisResponse {
  analysis: string;
  isMQL?: boolean;
  estimatedRevenue?: number;
}

export function LeadAnalysis({ lead }: LeadAnalysisProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isMQL, setIsMQL] = useState<boolean | null>(null);
  const [estimatedRevenue, setEstimatedRevenue] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchAnalysis = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-lead-profile', {
        body: lead
      });

      if (error) {
        console.error("Error fetching analysis:", error);
        setAnalysis("*Erro ao carregar analise* - Tente novamente mais tarde.");
        setIsMQL(null);
      } else {
        const response = data as AnalysisResponse;
        setAnalysis(response.analysis);
        setIsMQL(response.isMQL ?? null);
        setEstimatedRevenue(response.estimatedRevenue ?? null);
      }
    } catch (err) {
      console.error("Error:", err);
      setAnalysis("*Erro ao carregar analise* - Tente novamente mais tarde.");
      setIsMQL(null);
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [lead.name]);

  // Function to render text with bold formatting
  const renderFormattedText = (text: string) => {
    const parts = text.split(/\*([^*]+)\*/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} className="font-semibold">{part}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 2 
    });
  };

  return (
    <Card className="border-[#00000010] shadow-none bg-gradient-to-br from-muted/20 to-muted/40">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold">Analise do Lead</h3>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchAnalysis}
            disabled={isLoading}
            className="h-8 px-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* MQL Badge */}
        {hasLoaded && isMQL !== null && (
          <div className="flex items-center gap-2 mb-3">
            <Badge 
              variant={isMQL ? "default" : "secondary"}
              className={`${isMQL 
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20' 
                : 'bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/20'
              } flex items-center gap-1`}
            >
              {isMQL ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {isMQL ? 'MQL' : 'Não é MQL'}
            </Badge>
            {estimatedRevenue !== null && estimatedRevenue > 0 && (
              <span className="text-xs text-muted-foreground">
                Faturamento estimado: {formatCurrency(estimatedRevenue)}/mês
              </span>
            )}
          </div>
        )}

        {isLoading && !hasLoaded ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : analysis ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {renderFormattedText(analysis)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Clique no botao para gerar uma analise
          </p>
        )}

        <p className="text-[10px] text-muted-foreground/60 mt-3 pt-2 border-t border-black/5">
          Analise gerada por IA - Groq | Serviço: R$ 2.800/mês (R$ 1.800 + R$ 1.000 tráfego)
        </p>
      </CardContent>
    </Card>
  );
}
