import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_GENERATOR_PROMPT = `Você é um especialista em copywriting e design de emails de marketing. Sua função é criar emails HTML profissionais, bonitos e que convertem.

FORMATO DE RESPOSTA OBRIGATÓRIO:
Você DEVE começar sua resposta com o assunto do email na primeira linha, no formato:
ASSUNTO: [assunto do email aqui]

Depois de uma linha em branco, retorne o código HTML do email.

REGRAS OBRIGATÓRIAS:
1. Comece SEMPRE com "ASSUNTO: " seguido do assunto do email
2. Use {{name}} como placeholder para o nome do destinatário
3. O HTML deve ser responsivo e funcionar em todos os clientes de email
4. Use estilos inline (não use <style> tags separadas)
5. Evite JavaScript - não funciona em emails
6. Use tabelas para layout (compatibilidade com Outlook)
7. Cores e fontes devem ser profissionais e elegantes
8. Inclua call-to-action (CTA) claro e visível com botão
9. O design deve ser limpo, moderno e atraente
10. Limite a largura máxima a 600px para compatibilidade

REGRAS DE DESIGN:
- NÃO inclua logo ou imagem de header - comece direto com o conteúdo
- NÃO adicione imagens placeholder ou URLs de imagens fictícias
- Use {{button_link}} como placeholder para o link do botão principal
- Botões devem ser interativos com efeito hover (inline style)
- Design minimalista e focado na mensagem

ESTRUTURA DO EMAIL:
- Saudação personalizada com {{name}}
- Corpo principal com a mensagem
- CTA (botão) destacado com href="{{button_link}}"
- Footer simples (opcional)

EXEMPLO DE RESPOSTA:
ASSUNTO: {{name}}, sua oferta exclusiva te espera!

<!DOCTYPE html>
<html>...</html>`;

const HTML_ONLY_PROMPT = `Você é um especialista em design de emails HTML. Sua função é transformar textos de email (copy) em HTML profissional e bonito.

FORMATO DE RESPOSTA OBRIGATÓRIO:
Você DEVE começar sua resposta com o assunto do email na primeira linha, no formato:
ASSUNTO: [assunto do email aqui]

Depois de uma linha em branco, retorne o código HTML do email.

REGRAS OBRIGATÓRIAS:
1. Comece SEMPRE com "ASSUNTO: " seguido do assunto do email
2. MANTENHA o texto/copy exatamente como foi fornecido - NÃO modifique o conteúdo textual
3. Preserve todos os placeholders como {{name}} no texto
4. O HTML deve ser responsivo e funcionar em todos os clientes de email
5. Use estilos inline (não use <style> tags separadas)
6. Evite JavaScript - não funciona em emails
7. Use tabelas para layout (compatibilidade com Outlook)
8. Cores e fontes devem ser profissionais e elegantes
9. Destaque CTAs (calls-to-action) se houver no texto
10. O design deve ser limpo, moderno e atraente
11. Limite a largura máxima a 600px para compatibilidade

REGRAS DE DESIGN:
- NÃO inclua logo ou imagem de header - comece direto com o conteúdo
- NÃO adicione imagens placeholder ou URLs de imagens fictícias
- Use {{button_link}} como placeholder para links de botões
- Botões devem ser interativos com efeito hover (inline style)
- Design minimalista e focado na mensagem

ESTRUTURA DO EMAIL:
- Corpo principal com o texto fornecido, formatado de forma atraente
- Botões destacados para links/CTAs com href="{{button_link}}"
- Footer simples (se mencionado no texto)

EXEMPLO DE RESPOSTA:
ASSUNTO: Novidade especial para você, {{name}}!

<!DOCTYPE html>
<html>...</html>`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { hasCopy, copyText, objective, tone, companyName, productService, additionalInfo } = body;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt: string;
    let userPrompt: string;

    if (hasCopy && copyText) {
      // Mode: User has copy, just generate HTML
      console.log("Generating HTML from existing copy");
      systemPrompt = HTML_ONLY_PROMPT;
      userPrompt = `Transforme o texto abaixo em um email HTML profissional e bonito:

📝 TEXTO DO EMAIL:
${copyText}

${companyName ? `🏢 EMPRESA: ${companyName}` : ''}
${productService ? `📦 PRODUTO/SERVIÇO: ${productService}` : ''}

Lembre-se: Mantenha o texto exatamente como está, apenas aplique o design HTML. Retorne APENAS o código HTML.`;
    } else {
      // Mode: Generate copy + HTML
      console.log("Generating email with params:", { objective, tone, companyName, productService });
      systemPrompt = EMAIL_GENERATOR_PROMPT;
      userPrompt = `Crie um email HTML profissional com as seguintes especificações:

📌 OBJETIVO: ${objective}
🎨 TOM/ESTILO: ${tone}
🏢 EMPRESA: ${companyName || 'Não especificado'}
📦 PRODUTO/SERVIÇO: ${productService || 'Não especificado'}
📝 INFORMAÇÕES ADICIONAIS: ${additionalInfo || 'Nenhuma'}

Lembre-se: Use {{name}} para personalização do nome. Retorne APENAS o código HTML.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
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
