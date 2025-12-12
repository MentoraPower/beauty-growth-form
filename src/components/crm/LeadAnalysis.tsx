import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw } from "lucide-react";
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

export function LeadAnalysis({ lead }: LeadAnalysisProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
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
      } else {
        setAnalysis(data.analysis);
      }
    } catch (err) {
      console.error("Error:", err);
      setAnalysis("*Erro ao carregar analise* - Tente novamente mais tarde.");
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  };

  useEffect(() => {
    // Auto-fetch on mount
    fetchAnalysis();
  }, [lead.name]);

  // Function to render text with bold formatting
  const renderFormattedText = (text: string) => {
    // Split by *text* pattern and render with bold
    const parts = text.split(/\*([^*]+)\*/g);
    return parts.map((part, index) => {
      // Odd indices are the content between asterisks (bold)
      if (index % 2 === 1) {
        return <strong key={index} className="font-semibold">{part}</strong>;
      }
      return <span key={index}>{part}</span>;
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
          Analise gerada por IA - Grok
        </p>
      </CardContent>
    </Card>
  );
}
