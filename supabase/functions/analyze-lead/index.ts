import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const grokApiKey = Deno.env.get('GROK_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { revenue, weeklyAppointments, averageTicket } = await req.json();

    if (!grokApiKey) {
      console.error("GROK_API_KEY is not configured");
      return new Response(JSON.stringify({ 
        error: "API key not configured",
        canAfford: false,
        analysis: "Não foi possível analisar os dados."
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Você é um consultor financeiro especializado em negócios de beleza e estética no Brasil.

Analise os seguintes dados de um potencial cliente:
- Faturamento mensal declarado: ${revenue}
- Atendimentos por semana: ${weeklyAppointments}
- Ticket médio por procedimento: R$ ${averageTicket}

Com base nesses dados:
1. Calcule o faturamento mensal estimado (atendimentos semanais × 4 semanas × ticket médio)
2. Compare com o faturamento declarado
3. Determine se essa pessoa tem capacidade de investir R$ 2.800/mês em uma assessoria de marketing

Responda APENAS em formato JSON com a seguinte estrutura:
{
  "estimatedRevenue": número do faturamento estimado,
  "revenueConsistent": true/false se os números batem,
  "canAfford": true/false se pode pagar R$ 2.800/mês,
  "confidenceLevel": "high"/"medium"/"low",
  "analysis": "breve análise em português de no máximo 2 frases"
}`;

    console.log("Calling Grok API for lead analysis...");

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${grokApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        messages: [
          { role: 'system', content: 'Você é um assistente especializado em análise financeira de negócios de beleza. Responda sempre em JSON válido.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Grok API error:", response.status, errorText);
      
      // Fallback to simple calculation if API fails
      const appointments = parseInt(weeklyAppointments) || 0;
      const ticket = parseFloat(averageTicket) || 0;
      const estimated = appointments * 4 * ticket;
      const canAfford = estimated >= 2800;
      
      return new Response(JSON.stringify({
        estimatedRevenue: estimated,
        revenueConsistent: true,
        canAfford: canAfford,
        confidenceLevel: "low",
        analysis: `Análise básica: faturamento estimado de R$ ${estimated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log("Grok API response received");
    
    const content = data.choices[0]?.message?.content;
    
    // Try to parse the JSON response
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      const analysis = JSON.parse(cleanContent);
      
      return new Response(JSON.stringify(analysis), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (parseError) {
      console.error("Error parsing Grok response:", parseError);
      console.log("Raw content:", content);
      
      // Fallback response
      const appointments = parseInt(weeklyAppointments) || 0;
      const ticket = parseFloat(averageTicket) || 0;
      const estimated = appointments * 4 * ticket;
      
      return new Response(JSON.stringify({
        estimatedRevenue: estimated,
        revenueConsistent: true,
        canAfford: estimated >= 2800,
        confidenceLevel: "medium",
        analysis: content || "Análise concluída."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in analyze-lead function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      canAfford: false,
      analysis: "Erro ao analisar dados."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
