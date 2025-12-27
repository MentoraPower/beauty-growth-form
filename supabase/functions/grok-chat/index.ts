import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get São Paulo greeting based on current time
const getSaoPauloGreeting = (): string => {
  const now = new Date();
  const spTimeStr = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false
  }).format(now);
  
  const hour = parseInt(spTimeStr);
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  if (hour >= 18 && hour < 24) return "Boa noite";
  return "Boa madrugada";
};

// Get day of week in Portuguese
const getDayOfWeek = (): string => {
  const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const now = new Date();
  const spDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return days[spDate.getDay()];
};

const getSystemPrompt = (greeting: string, dayOfWeek: string) => `
Você é o assistente inteligente de disparo de mensagens da Scale Beauty. Você ajuda usuários a enviar mensagens em massa para leads de forma segura e organizada.

SAUDAÇÃO OBRIGATÓRIA: Sempre comece sua primeira resposta com "${greeting}! Hoje é ${dayOfWeek}. 👋"

═══════════════════════════════════════
FLUXO DE CONVERSA PARA DISPARO
═══════════════════════════════════════

PASSO 1 - SAUDAÇÃO E PERGUNTA INICIAL:
Após cumprimentar, pergunte: "O que você quer disparar hoje?"
Ofereça as opções:
• 📧 Email
• 📱 WhatsApp

PASSO 2 - SE ESCOLHER WHATSAPP:
Pergunte: "Qual tipo de WhatsApp você quer usar?"
• 📱 WhatsApp Web - ✅ Disponível
• 💼 WhatsApp Business API (Meta) - ⏳ Em breve! Ainda estamos integrando.

Se escolher Business API, diga gentilmente que ainda não está disponível e pergunte se quer usar o WhatsApp Web.

PASSO 3 - DISPONIBILIDADE DAS PLATAFORMAS:
✅ Email: Totalmente disponível e funcionando!
✅ WhatsApp Web: Disponível e funcionando!
⏳ WhatsApp Business API: Em desenvolvimento, em breve!

PASSO 4 - ESCOLHER FONTE DOS LEADS:
Depois que o usuário escolher a plataforma disponível, pergunte:
"De onde você quer pegar os leads para o disparo?"

Ofereça as opções:
• 📋 **Lista do CRM** - Usar uma lista já cadastrada no sistema
• 📄 **Arquivo CSV** - Enviar um arquivo com os contatos

PASSO 4A - SE ESCOLHER LISTA DO CRM:
Diga: "Perfeito! Vou buscar as listas disponíveis."
IMPORTANTE: Neste momento, você DEVE incluir o comando especial para listar as origens:
[COMMAND:LIST_ORIGINS]

Aguarde o sistema processar e mostrar as listas disponíveis.

PASSO 4B - SE ESCOLHER ARQUIVO CSV:
Diga: "Ótimo! Você pode enviar o arquivo CSV aqui no chat. O arquivo deve ter as colunas:"
- Para Email: nome, email
- Para WhatsApp: nome, whatsapp (com DDD)

Quando o usuário enviar o arquivo, o sistema vai processar automaticamente.

PASSO 5 - APÓS USUÁRIO ESCOLHER A LISTA:
Quando o usuário informar qual origem/sub-origem quer usar, você DEVE:
1. Confirmar a escolha
2. Incluir o comando para buscar os leads:
[COMMAND:FETCH_LEADS:tipo:sub_origin_id]

Onde:
- "tipo" é "email" ou "whatsapp_web"
- "sub_origin_id" é o UUID da sub-origem escolhida

PASSO 6 - PREVIEW DOS LEADS:
O sistema vai mostrar uma prévia. Você deve interpretar e explicar:
- Quantidade total de leads
- Quantidade de leads válidos (com email ou whatsapp)
- Intervalo de segurança entre envios
- Tempo estimado total

PASSO 7 - CONFIRMAÇÃO DO DISPARO:
Pergunte: "Posso iniciar o disparo?" ou aguarde o usuário confirmar.
Quando confirmar, inclua:
[COMMAND:START_DISPATCH:tipo:sub_origin_id]

═══════════════════════════════════════
COMANDOS ESPECIAIS (USE EXATAMENTE ASSIM)
═══════════════════════════════════════

Para listar origens disponíveis:
[COMMAND:LIST_ORIGINS]

Para buscar leads de uma lista:
[COMMAND:FETCH_LEADS:email:uuid-da-sub-origem]
[COMMAND:FETCH_LEADS:whatsapp_web:uuid-da-sub-origem]

Para iniciar o disparo:
[COMMAND:START_DISPATCH:email:uuid-da-sub-origem]
[COMMAND:START_DISPATCH:whatsapp_web:uuid-da-sub-origem]

Para pausar o disparo:
[COMMAND:PAUSE_DISPATCH:job-id]

Para retomar o disparo:
[COMMAND:RESUME_DISPATCH:job-id]

Para cancelar o disparo:
[COMMAND:CANCEL_DISPATCH:job-id]

═══════════════════════════════════════
REGRAS IMPORTANTES
═══════════════════════════════════════

1. SEMPRE responda em português brasileiro
2. Use emojis para deixar a conversa amigável, mas não exagere
3. Seja claro, objetivo e profissional
4. Mantenha o contexto da conversa
5. O usuário pode fazer perguntas a qualquer momento, mesmo durante um disparo
6. Se o usuário perguntar algo fora do contexto de disparo, responda normalmente e depois retome o fluxo
7. Nunca invente dados - sempre use os comandos para buscar informações reais
8. Explique claramente os intervalos de segurança (para evitar bloqueios)
9. Se houver erro, explique de forma simples e ofereça soluções

═══════════════════════════════════════
INFORMAÇÕES DE SEGURANÇA PARA EXPLICAR
═══════════════════════════════════════

- Intervalo padrão entre envios: 5 segundos
- Isso evita bloqueios por spam
- Tempo estimado = (quantidade de leads × intervalo) / 60 minutos
- O disparo acontece em segundo plano, o usuário pode continuar conversando

═══════════════════════════════════════
EXEMPLO DE CONVERSA
═══════════════════════════════════════

Usuário: "Oi"
Você: "${greeting}! Hoje é ${dayOfWeek}. 👋

O que você quer disparar hoje?

📧 **Email** - Envio de emails em massa
📱 **WhatsApp** - Mensagens via WhatsApp

Qual você prefere?"

Usuário: "WhatsApp"
Você: "Ótima escolha! 📱

Qual tipo de WhatsApp você quer usar?

• ✅ **WhatsApp Web** - Disponível e funcionando!
• ⏳ **WhatsApp Business API** - Em breve!

Por enquanto, o WhatsApp Web está totalmente operacional. Quer usar ele?"

[E assim por diante seguindo o fluxo...]
`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, command } = await req.json();
    const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
    
    if (!XAI_API_KEY) {
      throw new Error("XAI_API_KEY is not configured");
    }

    // If it's a command request, process it
    if (command) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      if (command === 'LIST_ORIGINS') {
        const { data: origins, error } = await supabase
          .from('crm_origins')
          .select(`
            id,
            nome,
            crm_sub_origins (
              id,
              nome
            )
          `)
          .order('ordem');

        if (error) throw error;
        return new Response(JSON.stringify({ type: 'origins', data: origins }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (command.startsWith('FETCH_LEADS:')) {
        const parts = command.split(':');
        const type = parts[1]; // email or whatsapp_web
        const subOriginId = parts[2];

        const { data: leads, error } = await supabase
          .from('leads')
          .select('id, name, email, whatsapp, country_code')
          .eq('sub_origin_id', subOriginId);

        if (error) throw error;

        // Get origin/sub-origin names
        const { data: subOrigin } = await supabase
          .from('crm_sub_origins')
          .select('nome, crm_origins(nome)')
          .eq('id', subOriginId)
          .single();

        const validLeads = leads?.filter(l => {
          if (type === 'email') {
            return l.email && l.email.includes('@') && l.email.includes('.');
          } else {
            return l.whatsapp && l.whatsapp.length >= 8;
          }
        }) || [];

        const intervalSeconds = 5;
        const estimatedMinutes = Math.ceil((validLeads.length * intervalSeconds) / 60);

        return new Response(JSON.stringify({
          type: 'leads_preview',
          data: {
            subOriginId,
            originName: (subOrigin as any)?.crm_origins?.nome || 'Desconhecido',
            subOriginName: subOrigin?.nome || 'Desconhecido',
            dispatchType: type,
            totalLeads: leads?.length || 0,
            validLeads: validLeads.length,
            invalidLeads: (leads?.length || 0) - validLeads.length,
            intervalSeconds,
            estimatedMinutes,
            leads: validLeads.slice(0, 5).map(l => ({
              name: l.name,
              contact: type === 'email' ? l.email : `${l.country_code}${l.whatsapp}`
            }))
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (command.startsWith('START_DISPATCH:')) {
        const parts = command.split(':');
        const type = parts[1];
        const subOriginId = parts[2];

        // Get sub-origin info
        const { data: subOrigin } = await supabase
          .from('crm_sub_origins')
          .select('nome, crm_origins(nome)')
          .eq('id', subOriginId)
          .single();

        // Count valid leads
        const { data: leads } = await supabase
          .from('leads')
          .select('id, name, email, whatsapp')
          .eq('sub_origin_id', subOriginId);

        const validLeads = leads?.filter(l => {
          if (type === 'email') {
            return l.email && l.email.includes('@');
          } else {
            return l.whatsapp && l.whatsapp.length >= 8;
          }
        }) || [];

        // Create dispatch job
        const { data: job, error: jobError } = await supabase
          .from('dispatch_jobs')
          .insert({
            type,
            sub_origin_id: subOriginId,
            origin_name: (subOrigin as any)?.crm_origins?.nome,
            sub_origin_name: subOrigin?.nome,
            total_leads: leads?.length || 0,
            valid_leads: validLeads.length,
            status: 'running',
            started_at: new Date().toISOString()
          })
          .select()
          .single();

        if (jobError) throw jobError;

        // Trigger background dispatch
        const dispatchUrl = `${supabaseUrl}/functions/v1/process-dispatch`;
        fetch(dispatchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ jobId: job.id })
        }).catch(err => console.error('Error triggering dispatch:', err));

        return new Response(JSON.stringify({
          type: 'dispatch_started',
          data: {
            jobId: job.id,
            status: 'running',
            totalLeads: leads?.length || 0,
            validLeads: validLeads.length
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (command.startsWith('PAUSE_DISPATCH:') || command.startsWith('RESUME_DISPATCH:') || command.startsWith('CANCEL_DISPATCH:')) {
        const [action, jobId] = command.split(':');
        const newStatus = action === 'PAUSE_DISPATCH' ? 'paused' : 
                         action === 'RESUME_DISPATCH' ? 'running' : 'cancelled';

        const { error } = await supabase
          .from('dispatch_jobs')
          .update({ 
            status: newStatus,
            ...(newStatus === 'cancelled' ? { completed_at: new Date().toISOString() } : {})
          })
          .eq('id', jobId);

        if (error) throw error;

        // If resuming, trigger the process again
        if (newStatus === 'running') {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          fetch(`${supabaseUrl}/functions/v1/process-dispatch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({ jobId })
          }).catch(err => console.error('Error triggering dispatch:', err));
        }

        return new Response(JSON.stringify({
          type: 'dispatch_updated',
          data: { jobId, status: newStatus }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Regular chat request
    const greeting = getSaoPauloGreeting();
    const dayOfWeek = getDayOfWeek();
    const systemPrompt = getSystemPrompt(greeting, dayOfWeek);

    console.log("Calling Grok API with messages:", JSON.stringify(messages));

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-latest",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Grok API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente mais tarde." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes na API do Grok." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Erro ao conectar com o Grok" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return the streaming response
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("grok-chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
