import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const groqApiKey = Deno.env.get('GROK_API_KEY'); // Note: using GROK_API_KEY but it contains Groq key

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Service cost: R$1,800 labor + R$1,000 traffic = R$2,800 total
const SERVICE_COST = 2800;
const MIN_REVENUE_RATIO = 0.55; // Service should be at most 55% of revenue
const MIN_AFFORDABLE_REVENUE = Math.ceil(SERVICE_COST / MIN_REVENUE_RATIO); // ~R$ 5,091

const SYSTEM_PROMPT = `Voce e um analista de leads especializado no mercado de beleza e estetica. Sua funcao e analisar dados de potenciais clientes e escrever uma analise concisa sobre o perfil do lead.

CONTEXTO IMPORTANTE:
- O servico custa R$ ${SERVICE_COST}/mes (R$ 1.800 mao de obra + R$ 1.000 trafego pago)
- Um lead e considerado MQL (Marketing Qualified Lead) se o servico representar no maximo 55% do faturamento dele
- Faturamento minimo para ser MQL: ~R$ ${MIN_AFFORDABLE_REVENUE.toLocaleString('pt-BR')}/mes
- Formula: Faturamento Estimado = atendimentos_semanais × 4 × ticket_medio

REGRAS:
1. Escreva em portugues do Brasil
2. Use *texto* para destacar palavras importantes (negrito)
3. NAO use emojis em hipotese alguma
4. Seja direto e objetivo
5. Escreva entre 3-5 frases curtas
6. SEMPRE indique claramente se o lead e *MQL* ou *Nao e MQL* no inicio da analise
7. Foque em: classificacao MQL, perfil profissional, capacidade de investimento, potencial de crescimento
8. Se dados estiverem faltando, mencione isso brevemente

FORMATO:
Comece com "*MQL*" ou "*Nao e MQL*" seguido de um ponto. Depois escreva um paragrafo curto e direto sobre o perfil.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const leadData = await req.json();
    
    console.log("Analyzing lead profile:", leadData.name);

    // Calculate estimated revenue for MQL determination
    const weeklyAttendance = parseInt(leadData.weekly_attendance) || 0;
    const averageTicket = parseFloat(leadData.average_ticket) || 0;
    const estimatedRevenue = leadData.estimated_revenue || (weeklyAttendance * 4 * averageTicket);
    const isMQL = estimatedRevenue >= MIN_AFFORDABLE_REVENUE;

    if (!groqApiKey) {
      console.log("No GROQ API key configured");
      const mqlStatus = isMQL ? "*MQL*" : "*Nao e MQL*";
      const analysis = `${mqlStatus}. Faturamento estimado de *R$ ${estimatedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*/mes. ${isMQL ? 'Lead tem capacidade financeira para investir no servico.' : 'Faturamento abaixo do minimo recomendado de R$ ' + MIN_AFFORDABLE_REVENUE.toLocaleString('pt-BR') + '/mes para o investimento ser sustentavel.'}`;
      return new Response(JSON.stringify({ 
        analysis,
        isMQL,
        estimatedRevenue
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userPrompt = `Analise este lead:

Nome: ${leadData.name || 'Nao informado'}
Empresa/Clinica: ${leadData.clinic_name || 'Nao informada'}
Area de Atuacao: ${leadData.service_area || 'Nao informada'}
Anos de Experiencia: ${leadData.years_experience || 'Nao informado'}
Tipo de Espaco: ${leadData.workspace_type === 'physical' ? 'Espaco Fisico' : leadData.workspace_type === 'home' ? 'Domicilio/Casa' : 'Nao informado'}
Faturamento Mensal Declarado: ${leadData.monthly_billing || 'Nao informado'}
Atendimentos por Semana: ${leadData.weekly_attendance || 'Nao informado'}
Ticket Medio: ${leadData.average_ticket ? `R$ ${parseFloat(leadData.average_ticket).toFixed(2)}` : 'Nao informado'}
Receita Estimada: R$ ${estimatedRevenue.toFixed(2)}/mes
E MQL (pode pagar R$ 2.800/mes): ${isMQL ? 'SIM' : 'NAO'}
Pode Investir (resposta do formulario): ${leadData.can_afford === 'yes' ? 'Sim' : leadData.can_afford === 'no' ? 'Nao' : 'Nao respondeu'}
Quer mais informacoes: ${leadData.wants_more_info ? 'Sim' : 'Nao'}

Escreva sua analise:`;

    console.log("Calling Groq API for profile analysis...");

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
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", response.status, errorText);
      return new Response(JSON.stringify({ 
        analysis: "*Erro na analise* - Nao foi possivel gerar a analise automatica. Tente novamente mais tarde." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log("Groq profile analysis received");
    
    const content = data.choices?.[0]?.message?.content || '';
    
    // Clean the response
    let analysis = content
      .replace(/```/g, '')
      .replace(/^\s+|\s+$/g, '')
      .trim();

    if (!analysis) {
      analysis = isMQL ? "*MQL* - Analise incompleta." : "*Nao e MQL* - Analise incompleta.";
    }

    console.log("Profile analysis result:", analysis.substring(0, 100) + "...");
    
    return new Response(JSON.stringify({ 
      analysis,
      isMQL,
      estimatedRevenue 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-lead-profile:', error);
    
    return new Response(JSON.stringify({ 
      analysis: "*Erro no sistema* - Ocorreu um erro ao processar a analise do lead.",
      isMQL: false,
      estimatedRevenue: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
