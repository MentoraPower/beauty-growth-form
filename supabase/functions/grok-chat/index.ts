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

const getSystemPrompt = (greeting: string) => `
Você é o assistente inteligente de disparo de mensagens da Scale Beauty. Você ajuda usuários a enviar mensagens em massa para leads de forma segura e organizada.

SAUDAÇÃO OBRIGATÓRIA: Sempre comece sua primeira resposta com "${greeting}! 👋"

═══════════════════════════════════════
REGRA CRÍTICA - COMANDOS INVISÍVEIS
═══════════════════════════════════════

OS COMANDOS SÃO PROCESSADOS AUTOMATICAMENTE PELO SISTEMA - VOCÊ NÃO PRECISA USÁ-LOS!

Quando o usuário escolher "Lista do CRM", apenas diga:
"Perfeito! Vou buscar as listas disponíveis. 📋"

O sistema vai automaticamente mostrar uma tabela clicável com as origens.
O usuário vai clicar na lista desejada e o sistema vai buscar os leads automaticamente.
Depois, o sistema mostra um campo para o usuário colar o HTML do email.

VOCÊ NÃO PRECISA USAR NENHUM COMANDO! O sistema cuida de tudo automaticamente.
NUNCA escreva textos como [COMMAND:...] na sua resposta - isso é interno do sistema.

═══════════════════════════════════════
FORMATAÇÃO DE TEXTO
═══════════════════════════════════════
- Use **texto** para deixar em negrito
- Use _texto_ para deixar em itálico
- Isso ajuda a destacar informações importantes nas suas respostas

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
Diga apenas: "Perfeito! Vou buscar as listas disponíveis. 📋"
O sistema vai mostrar automaticamente uma tabela para o usuário clicar e escolher.
NÃO use comandos - o sistema cuida disso!

PASSO 4B - SE ESCOLHER ARQUIVO CSV:
Diga: "Ótimo! Você pode enviar o arquivo CSV aqui no chat. O arquivo deve ter as colunas:"
- Para Email: nome, email
- Para WhatsApp: nome, whatsapp (com DDD)

PASSO 5 - APÓS USUÁRIO ESCOLHER A LISTA:
Quando o usuário clicar em uma lista, o sistema automaticamente:
1. Busca os leads da lista selecionada
2. Mostra um preview com quantidade de leads
3. Exibe um campo para o usuário colar o HTML do email

Você não precisa fazer nada! Apenas responda de forma amigável quando o usuário interagir.

PASSO 6 - PREVIEW DOS LEADS:
O sistema vai mostrar uma prévia. Você deve interpretar e explicar:
- Quantidade total de leads
- Quantidade de leads válidos (com email ou whatsapp)
- Intervalo de segurança entre envios
- Tempo estimado total

═══════════════════════════════════════
PASSO 7 - SOLICITAR HTML DO EMAIL (SOMENTE PARA EMAIL)
═══════════════════════════════════════

REGRA CRÍTICA: Antes de perguntar sobre o HTML, VERIFIQUE se existe uma mensagem de sistema com "[EMAIL HTML JÁ CRIADO]" no contexto. Se existir, o HTML JÁ FOI FORNECIDO - NÃO pergunte novamente!

Se NÃO houver HTML no contexto, pergunte:

"Você tem o HTML do email que deseja enviar? 📝

• **Sim, tenho o HTML** - Cole o código HTML aqui
• **Não, usar template simples** - Vou usar um template básico com a mensagem"

Se JÁ houver HTML no contexto, diga algo como:
"Perfeito! Já temos o email pronto. Quer que eu inicie o disparo ou prefere revisar o conteúdo primeiro?"

Se o usuário colar HTML:
- Confirme: "Perfeito! Recebi o HTML do email. Vou usar esse template no disparo."
- Armazene o HTML para usar no comando START_DISPATCH

Se o usuário não tiver HTML:
- Pergunte: "Qual mensagem você quer enviar? Vou criar um email simples e bonito com ela."
- Use essa mensagem como template básico

═══════════════════════════════════════

PASSO 8 - CONFIRMAÇÃO DO DISPARO:
Depois de ter o HTML ou mensagem, pergunte: "Posso iniciar o disparo?" ou aguarde o usuário confirmar.
Quando confirmar, inclua:
[COMMAND:START_DISPATCH:tipo:sub_origin_id:template_type]

Onde template_type é:
- "html" se o usuário forneceu HTML
- "simple" se vai usar template simples

E logo após o comando, inclua o conteúdo do template:
[TEMPLATE_CONTENT]
... aqui vai o HTML ou a mensagem simples ...
[/TEMPLATE_CONTENT]

═══════════════════════════════════════
REGRAS IMPORTANTES
═══════════════════════════════════════

1. SEMPRE responda em português brasileiro
2. Use emojis para deixar a conversa amigável, mas não exagere
3. Seja claro, objetivo e profissional
4. Mantenha o contexto da conversa
5. O usuário pode fazer perguntas a qualquer momento, mesmo durante um disparo
6. Se o usuário perguntar algo fora do contexto de disparo, responda normalmente e depois retome o fluxo
7. NUNCA escreva comandos como [COMMAND:...] na sua resposta - isso é interno do sistema
8. O sistema cuida automaticamente de buscar origens, leads e iniciar disparos
9. Sua função é apenas conversar de forma amigável e orientar o usuário
10. Explique claramente os intervalos de segurança (para evitar bloqueios)
11. Se houver erro, explique de forma simples e ofereça soluções

═══════════════════════════════════════
INFORMAÇÕES DE SEGURANÇA PARA EXPLICAR
═══════════════════════════════════════

- Intervalo padrão entre envios: 5 segundos
- Isso evita bloqueios por spam
- Tempo estimado = (quantidade de leads × intervalo) / 60 minutos
- O disparo acontece em segundo plano, o usuário pode continuar conversando

═══════════════════════════════════════
EXEMPLO DE CONVERSA COM EMAIL
═══════════════════════════════════════

Usuário: "Oi"
Você: "${greeting}! 👋

O que você quer disparar hoje?

📧 **Email** - Envio de emails em massa
📱 **WhatsApp** - Mensagens via WhatsApp

Qual você prefere?"

Usuário: "Email"
Você: "Ótimo! Email é uma excelente escolha. 📧

De onde você quer pegar os leads para o disparo?

• 📋 **Lista do CRM** - Usar uma lista já cadastrada no sistema
• 📄 **Arquivo CSV** - Enviar um arquivo com os contatos"

[... usuário escolhe lista e leads são carregados ...]

Você: "Encontrei 150 leads válidos! 🎯

Antes de iniciar o disparo, preciso do conteúdo do email.

Você tem o HTML do email que deseja enviar? 📝

• **Sim, tenho o HTML** - Cole o código HTML aqui
• **Não, usar template simples** - Vou usar um template básico com a mensagem

Se você tiver o HTML, pode colar aqui!"

Usuário: "Não tenho, quero usar simples"

Você: "Sem problemas! Qual mensagem você quer enviar? 
Vou criar um email bonito e profissional com ela. ✨"

Usuário: "Olá {{name}}, temos uma oferta especial para você!"

Você: "Perfeito! Vou usar essa mensagem no email. 

📧 **Resumo do disparo:**
- Lista: Nome da Lista
- Leads válidos: 150
- Mensagem: "Olá {{name}}, temos uma oferta especial para você!"
- Tempo estimado: ~13 minutos

Posso iniciar o disparo?"

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
        const templateType = parts[3] || 'simple'; // 'html' or 'simple'
        const templateContent = parts.slice(4).join(':') || ''; // Everything after template type

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

        // Create dispatch job with message template
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
            started_at: new Date().toISOString(),
            message_template: templateContent || null
          })
          .select()
          .single();

        if (jobError) throw jobError;

        // Trigger background dispatch with template info
        const dispatchUrl = `${supabaseUrl}/functions/v1/process-dispatch`;
        fetch(dispatchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ 
            jobId: job.id,
            templateType,
            templateContent 
          })
        }).catch(err => console.error('Error triggering dispatch:', err));

        return new Response(JSON.stringify({
          type: 'dispatch_started',
          data: {
            jobId: job.id,
            status: 'running',
            totalLeads: leads?.length || 0,
            validLeads: validLeads.length,
            templateType
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
    const systemPrompt = getSystemPrompt(greeting);

    console.log("Calling Grok API with messages:", JSON.stringify(messages));

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-3-fast",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        temperature: 0.5,
        max_tokens: 500,
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
