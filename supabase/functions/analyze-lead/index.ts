import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const grokApiKey = Deno.env.get('GROK_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Service cost and threshold
const SERVICE_COST = 2800;
const THRESHOLD = SERVICE_COST * 0.8; // R$ 2,240 - Only show affordability question below this

const SYSTEM_PROMPT = `Você é um calculador financeiro especializado. Sua ÚNICA função é analisar números e retornar um JSON.

REGRAS ABSOLUTAS:
1. Você APENAS faz cálculos matemáticos
2. Você NUNCA conversa, sugere, aconselha ou faz perguntas
3. Você SEMPRE responde APENAS com JSON válido
4. Você NUNCA inclui texto fora do JSON
5. Você NUNCA usa markdown, código ou formatação

FÓRMULA:
- Faturamento Estimado = atendimentos_semanais × 4 × ticket_medio
- Pode Pagar = Faturamento Estimado >= ${THRESHOLD} (80% de R$ ${SERVICE_COST})

FORMATO DE RESPOSTA (APENAS ISSO, NADA MAIS):
{"estimatedRevenue":0,"revenueConsistent":true,"canAfford":true,"confidenceLevel":"high","analysis":"texto"}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { revenue, weeklyAppointments, averageTicket } = await req.json();
    
    console.log("Analyzing lead:", { revenue, weeklyAppointments, averageTicket });

    // Parse values
    const appointments = parseInt(weeklyAppointments) || 0;
    const ticket = parseFloat(averageTicket) || 0;
    const estimatedMonthly = appointments * 4 * ticket;
    
    // Extract minimum revenue from range
    let minRevenue = 0;
    const revenueStr = String(revenue).replace(/\./g, '').replace(',', '.');
    const match = revenueStr.match(/(\d+)/);
    if (match) {
      minRevenue = parseInt(match[1]);
    }
    
    // Simple calculation fallback (always available)
    // canAfford = true means we DON'T need to show the affordability question
    const fallbackResult = {
      estimatedRevenue: estimatedMonthly,
      revenueConsistent: Math.abs(estimatedMonthly - minRevenue) < minRevenue * 0.5 || minRevenue === 0,
      canAfford: estimatedMonthly >= THRESHOLD, // Only false if below 80% of service cost
      confidenceLevel: "high",
      analysis: `Faturamento estimado: R$ ${estimatedMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês.`
    };

    if (!grokApiKey) {
      console.log("No API key, using fallback calculation");
      return new Response(JSON.stringify(fallbackResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userPrompt = `DADOS:
- Faturamento declarado: ${revenue}
- Atendimentos por semana: ${appointments}
- Ticket médio: R$ ${ticket.toFixed(2)}

CALCULE E RETORNE APENAS O JSON:`;

    console.log("Calling Grok API...");

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${grokApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Grok API error:", response.status, errorText);
      return new Response(JSON.stringify(fallbackResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log("Grok response received");
    
    const content = data.choices?.[0]?.message?.content || '';
    
    // Clean and parse JSON
    let cleanContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/^\s+|\s+$/g, '');
    
    // Find JSON in content
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log("No JSON found in response, using fallback");
      return new Response(JSON.stringify(fallbackResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const analysis = JSON.parse(jsonMatch[0]);
      
      // Validate required fields exist
      const result = {
        estimatedRevenue: typeof analysis.estimatedRevenue === 'number' ? analysis.estimatedRevenue : estimatedMonthly,
        revenueConsistent: typeof analysis.revenueConsistent === 'boolean' ? analysis.revenueConsistent : fallbackResult.revenueConsistent,
        canAfford: typeof analysis.canAfford === 'boolean' ? analysis.canAfford : fallbackResult.canAfford,
        confidenceLevel: analysis.confidenceLevel || "high",
        analysis: typeof analysis.analysis === 'string' ? analysis.analysis : fallbackResult.analysis
      };
      
      console.log("Analysis result:", result);
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (parseError) {
      console.error("JSON parse error, using fallback:", parseError);
      return new Response(JSON.stringify(fallbackResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in analyze-lead:', error);
    
    // Always return a valid response
    return new Response(JSON.stringify({
      estimatedRevenue: 0,
      revenueConsistent: true,
      canAfford: false,
      confidenceLevel: "low",
      analysis: "Análise concluída."
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
