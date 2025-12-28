import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_GENERATOR_PROMPT = `Você é um especialista em copywriting e design de emails de marketing. Sua função é criar emails HTML profissionais, bonitos e que convertem.

REGRAS OBRIGATÓRIAS:
1. SEMPRE retorne APENAS o código HTML do email, sem explicações antes ou depois
2. Use {{name}} como placeholder para o nome do destinatário
3. O HTML deve ser responsivo e funcionar em todos os clientes de email
4. Use estilos inline (não use <style> tags separadas)
5. Evite JavaScript - não funciona em emails
6. Use tabelas para layout (compatibilidade com Outlook)
7. Cores e fontes devem ser profissionais e elegantes
8. Inclua call-to-action (CTA) claro e visível
9. O design deve ser limpo, moderno e atraente
10. Limite a largura máxima a 600px para compatibilidade

ESTRUTURA DO EMAIL:
- Header com logo/nome da empresa (opcional)
- Saudação personalizada com {{name}}
- Corpo principal com a mensagem
- CTA (botão) destacado
- Footer com informações de contato

IMPORTANTE: Retorne APENAS o código HTML, começando com <!DOCTYPE html> ou <html>`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { objective, tone, companyName, productService, additionalInfo } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating email with params:", { objective, tone, companyName, productService });

    const userPrompt = `Crie um email HTML profissional com as seguintes especificações:

📌 OBJETIVO: ${objective}
🎨 TOM/ESTILO: ${tone}
🏢 EMPRESA: ${companyName || 'Não especificado'}
📦 PRODUTO/SERVIÇO: ${productService || 'Não especificado'}
📝 INFORMAÇÕES ADICIONAIS: ${additionalInfo || 'Nenhuma'}

Lembre-se: Use {{name}} para personalização do nome. Retorne APENAS o código HTML.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: EMAIL_GENERATOR_PROMPT },
          { role: "user", content: userPrompt }
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    // Return streaming response
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Error in generate-email function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
