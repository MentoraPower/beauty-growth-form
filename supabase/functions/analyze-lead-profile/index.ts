import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const grokApiKey = Deno.env.get('GROK_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Voce e um analista de leads especializado no mercado de beleza e estetica. Sua funcao e analisar dados de potenciais clientes e escrever uma analise concisa sobre o perfil do lead.

REGRAS:
1. Escreva em portugues do Brasil
2. Use *texto* para destacar palavras importantes (negrito)
3. NAO use emojis em hipotese alguma
4. Seja direto e objetivo
5. Escreva entre 3-5 frases curtas
6. Foque em: perfil profissional, capacidade de investimento, potencial de crescimento e observacoes relevantes
7. Se dados estiverem faltando, mencione isso brevemente

FORMATO:
Escreva um paragrafo curto e direto, destacando com *asteriscos* os pontos principais.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const leadData = await req.json();
    
    console.log("Analyzing lead profile:", leadData.name);

    if (!grokApiKey) {
      console.log("No GROK_API_KEY configured");
      return new Response(JSON.stringify({ 
        analysis: "*Analise nao disponivel* - API de IA nao configurada. Configure a chave GROK_API_KEY para habilitar analises automaticas de leads." 
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
Ticket Medio: ${leadData.average_ticket ? `R$ ${leadData.average_ticket.toFixed(2)}` : 'Nao informado'}
Receita Estimada: ${leadData.estimated_revenue ? `R$ ${leadData.estimated_revenue.toFixed(2)}/mes` : 'Nao calculada'}
Pode Investir R$1.800/mes: ${leadData.can_afford === 'yes' ? 'Sim' : leadData.can_afford === 'no' ? 'Nao' : 'Nao respondeu'}
Quer mais informacoes: ${leadData.wants_more_info ? 'Sim' : 'Nao'}

Escreva sua analise:`;

    console.log("Calling Grok API for profile analysis...");

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
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Grok API error:", response.status, errorText);
      return new Response(JSON.stringify({ 
        analysis: "*Erro na analise* - Nao foi possivel gerar a analise automatica. Tente novamente mais tarde." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log("Grok profile analysis received");
    
    const content = data.choices?.[0]?.message?.content || '';
    
    // Clean the response
    let analysis = content
      .replace(/```/g, '')
      .replace(/^\s+|\s+$/g, '')
      .trim();

    if (!analysis) {
      analysis = "*Analise incompleta* - O sistema nao conseguiu gerar uma analise valida para este lead.";
    }

    console.log("Profile analysis result:", analysis.substring(0, 100) + "...");
    
    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-lead-profile:', error);
    
    return new Response(JSON.stringify({ 
      analysis: "*Erro no sistema* - Ocorreu um erro ao processar a analise do lead." 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
