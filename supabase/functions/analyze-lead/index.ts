import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const groqApiKey = Deno.env.get('GROK_API_KEY'); // Note: using GROK_API_KEY but it contains Groq key

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Service cost and threshold
const SERVICE_COST = 2800;
// Minimum revenue to afford: service should be max 50-60% of revenue
// If revenue = 3000, can't afford (would be 93% of income)
// If revenue = 3500, borderline (80% of income)
// If revenue = 5000, can afford (56% of income)
const MIN_REVENUE_RATIO = 0.55; // Service should be at most 55% of revenue
const MIN_AFFORDABLE_REVENUE = Math.ceil(SERVICE_COST / MIN_REVENUE_RATIO); // ~R$ 5,091

const SYSTEM_PROMPT = `Você é um calculador financeiro especializado. Sua ÚNICA função é analisar números e retornar um JSON.

REGRAS ABSOLUTAS:
1. Você APENAS faz cálculos matemáticos
2. Você NUNCA conversa, sugere, aconselha ou faz perguntas
3. Você SEMPRE responde APENAS com JSON válido
4. Você NUNCA inclui texto fora do JSON
5. Você NUNCA usa markdown, código ou formatação

CONTEXTO IMPORTANTE:
- O serviço custa R$ ${SERVICE_COST}/mês
- Uma pessoa NÃO pode pagar se o serviço representar mais de 55% do faturamento dela
- Exemplo: Se fatura R$ 3.000, NÃO pode pagar (R$ 2.800 seria 93% do faturamento - não sobra para viver)
- Exemplo: Se fatura R$ 3.500, NÃO pode pagar (R$ 2.800 seria 80% do faturamento - muito arriscado)
- Exemplo: Se fatura R$ 5.000, PODE pagar (R$ 2.800 seria 56% do faturamento - sustentável)
- Mínimo para poder pagar: ~R$ ${MIN_AFFORDABLE_REVENUE} (onde o serviço representa ~55% do faturamento)

FÓRMULA:
- Faturamento Estimado = atendimentos_semanais × 4 × ticket_medio
- Pode Pagar = Faturamento Estimado >= ${MIN_AFFORDABLE_REVENUE}

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
    
    // CRITICAL: If essential data is missing, return null values - don't calculate
    if (appointments === 0 || ticket === 0) {
      console.log("Missing essential data (appointments or ticket), returning null values");
      return new Response(JSON.stringify({
        estimatedRevenue: null,
        revenueConsistent: true,
        canAfford: true, // Default to true so we don't show affordability question
        confidenceLevel: "none",
        analysis: "Dados insuficientes para análise."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const estimatedMonthly = appointments * 4 * ticket;
    
    // Extract minimum revenue from range
    let minRevenue = 0;
    const revenueStr = String(revenue).replace(/\./g, '').replace(',', '.');
    const match = revenueStr.match(/(\d+)/);
    if (match) {
      minRevenue = parseInt(match[1]);
    }
    
    // Calculate if they can afford based on ratio
    // canAfford = true means we DON'T need to show the affordability question
    const canAffordService = estimatedMonthly >= MIN_AFFORDABLE_REVENUE;
    
    const fallbackResult = {
      estimatedRevenue: estimatedMonthly,
      revenueConsistent: Math.abs(estimatedMonthly - minRevenue) < minRevenue * 0.5 || minRevenue === 0,
      canAfford: canAffordService,
      confidenceLevel: "high",
      analysis: `Faturamento estimado: R$ ${estimatedMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês. ${canAffordService ? 'Investimento sustentável.' : 'Investimento representaria mais de 55% do faturamento.'}`
    };

    if (!groqApiKey) {
      console.log("No Groq API key, using fallback calculation");
      return new Response(JSON.stringify(fallbackResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userPrompt = `DADOS:
- Faturamento declarado: ${revenue}
- Atendimentos por semana: ${appointments}
- Ticket médio: R$ ${ticket.toFixed(2)}

CALCULE E RETORNE APENAS O JSON:`;

    console.log("Calling Groq API...");

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
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
      console.error("Groq API error:", response.status, errorText);
      return new Response(JSON.stringify(fallbackResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log("Groq response received");
    
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
