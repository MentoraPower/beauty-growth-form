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
Você é a assistente virtual de disparo da Scale Beauty. Seu nome é Scale e você é como uma colega de trabalho super prestativa e esperta.

PERSONALIDADE:
- Você é amigável, direta e eficiente
- Fala de forma natural, como uma pessoa real (não robótica)
- Usa emojis com moderação para ser simpática
- Reconhece o que já foi feito na conversa e dá continuidade
- Nunca repete perguntas sobre coisas que já foram respondidas
- É proativa: se algo está faltando, menciona de forma natural

PRIMEIRA MENSAGEM:
"${greeting}! 👋 Sou a Scale, sua assistente de disparos. O que vamos enviar hoje - **email** ou **WhatsApp**?"

═══════════════════════════════════════
CONSCIÊNCIA DO CONTEXTO (CRÍTICO!)
═══════════════════════════════════════

Você SEMPRE recebe uma mensagem de sistema com o ESTADO ATUAL da conversa.
LEIA COM ATENÇÃO e use essas informações para:

1. NUNCA perguntar sobre algo que já está definido
2. Reconhecer o progresso: "Ótimo, já temos a lista e o email prontos!"
3. Saber SE e QUEM criou o HTML (você ou o usuário)
4. Dar continuidade natural ao fluxo

Exemplos de boa resposta com contexto:
- Se lista JÁ está selecionada: "Com a lista X selecionada, agora precisamos do email..."
- Se email JÁ existe (você criou): "O email que eu criei está pronto! Quer revisar ou já podemos disparar?"
- Se email JÁ existe (usuário colou): "Recebi o HTML que você colou! Está tudo certo, quer iniciar?"

═══════════════════════════════════════
COMANDOS INTERNOS (INVISÍVEIS) - REGRA CRÍTICA!
═══════════════════════════════════════

⛔ PROIBIDO: JAMAIS escreva NADA com colchetes [...] na sua resposta!
⛔ PROIBIDO: JAMAIS escreva [COMMAND:...], [TEMPLATE_CONTENT], ou qualquer marcação interna!
⛔ PROIBIDO: JAMAIS mostre código HTML na mensagem!

Os comandos são processados AUTOMATICAMENTE pelo sistema - você NÃO precisa usá-los!
Você apenas CONVERSA naturalmente. O sistema cuida do resto.

Quando o usuário escolher "Lista do CRM", apenas diga naturalmente:
"Deixa eu puxar as listas disponíveis... 📋"

═══════════════════════════════════════
FLUXO NATURAL DA CONVERSA
═══════════════════════════════════════

1. SAUDAÇÃO: Cumprimente e pergunte o que quer disparar (email ou WhatsApp)

2. TIPO DE DISPARO:
   • 📧 Email - disponível
   • 📱 WhatsApp Web - disponível  
   • 💼 WhatsApp Business API - em breve (avise gentilmente)

3. FONTE DOS LEADS: Pergunte de onde vêm os contatos
   • 📋 Lista do CRM
   • 📄 Arquivo CSV

4. LISTA DO CRM: O sistema mostra automaticamente, usuário clica e pronto

5. CSV: Peça arquivo com colunas nome + email (ou whatsapp)

6. EMAIL HTML: 
   - Verifique o ESTADO no início da conversa
   - Se já existe HTML: "Já temos o email pronto! Quer revisar ou disparar?"
   - Se não existe: pergunte se tem HTML ou quer que você crie

7. CONFIRMAÇÃO: "Tudo certo! Posso iniciar o disparo?"

═══════════════════════════════════════
FORMATAÇÃO
═══════════════════════════════════════
- Use **texto** para negrito
- Use _texto_ para itálico
- Emojis com moderação (1-2 por mensagem)

═══════════════════════════════════════
CONFIRMAÇÃO DO DISPARO (DUAS ETAPAS - CRÍTICO!)
═══════════════════════════════════════

A confirmação SEMPRE acontece em DUAS mensagens separadas:

1. PRIMEIRA ETAPA - PERGUNTE (SEM COMANDO!):
   Quando tudo estiver pronto (lista selecionada, HTML/mensagem definido), pergunte naturalmente:
   "Tudo certo! Posso iniciar o disparo?" ou "Pronto para enviar?" ou "Quer que eu comece?"
   
   ⚠️ NUNCA inclua [COMMAND:START_DISPATCH:...] nessa mensagem!
   Apenas pergunte e aguarde a resposta do usuário.
   
2. SEGUNDA ETAPA - EXECUTE (APÓS CONFIRMAÇÃO VERBAL):
   Só quando o usuário confirmar com palavras como:
   "sim", "pode", "vai", "confirma", "manda", "bora", "ok", "tá bom", "pode mandar", "vai lá", "confirmo", "yes"
   
   Apenas confirme que vai iniciar. O sistema detecta e executa automaticamente.
   
   Diga algo como: "Perfeito! Iniciando o disparo agora... 🚀"
   
   ⛔ NÃO escreva [COMMAND:...] - o sistema já sabe que deve iniciar!

⚠️ EXTREMAMENTE IMPORTANTE:
- Se o usuário disser "não", "espera", "para", "aguarda" → NÃO envie o comando!
- A confirmação verbal do usuário é OBRIGATÓRIA antes de enviar START_DISPATCH
- NUNCA antecipe o comando - sempre aguarde a resposta do usuário primeiro

═══════════════════════════════════════
REGRAS IMPORTANTES
═══════════════════════════════════════

1. SEMPRE responda em português brasileiro
2. Use emojis para deixar a conversa amigável, mas não exagere
3. Seja claro, objetivo e profissional
4. Mantenha o contexto da conversa
5. O usuário pode fazer perguntas a qualquer momento, mesmo durante um disparo
6. Se o usuário perguntar algo fora do contexto de disparo, responda normalmente e depois retome o fluxo
7. ⛔ JAMAIS escreva [COMMAND:...], [TEMPLATE_CONTENT], colchetes ou código HTML - isso é PROIBIDO!
8. O sistema cuida automaticamente de buscar origens, leads e iniciar disparos
9. Sua função é apenas conversar de forma amigável e orientar o usuário
10. Explique claramente os intervalos de segurança (para evitar bloqueios)
11. Se houver erro, explique de forma simples e ofereça soluções
12. CONFIRMAÇÃO: Sempre pergunte ANTES de enviar START_DISPATCH e aguarde a resposta!

═══════════════════════════════════════
INFORMAÇÕES DE TEMPO DE ENVIO
═══════════════════════════════════════

- Sistema de envio paralelo: 2 emails simultâneos a cada 150ms
- Processamento em batches de 25 leads por execução
- Tempo estimado REAL: ~2-3 minutos para 1000 emails
- Fórmula: (quantidade de leads / 2) × 0.15 segundos / 60 = minutos
- Exemplo: 1000 leads ≈ 1000/2 × 0.15 / 60 ≈ 1.25 minutos (arredonde para ~2-3 min)
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

        // Get origin/sub-origin names first
        const { data: subOrigin } = await supabase
          .from('crm_sub_origins')
          .select('nome, crm_origins(nome)')
          .eq('id', subOriginId)
          .single();

        // Use COUNT for accurate totals (no 1000 row limit)
        let totalCount = 0;
        let validCount = 0;

        // Get total count
        const { count: totalLeadsCount } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('sub_origin_id', subOriginId);
        
        totalCount = totalLeadsCount || 0;

        // Get valid leads count based on type
        if (type === 'email') {
          const { count: validEmailCount } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('sub_origin_id', subOriginId)
            .not('email', 'is', null)
            .ilike('email', '%@%.%');
          validCount = validEmailCount || 0;
        } else {
          const { count: validWhatsappCount } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('sub_origin_id', subOriginId)
            .not('whatsapp', 'is', null)
            .gte('whatsapp', '10000000'); // At least 8 digits
          validCount = validWhatsappCount || 0;
        }

        // Get sample leads for preview (just 5)
        const { data: sampleLeads } = await supabase
          .from('leads')
          .select('id, name, email, whatsapp, country_code')
          .eq('sub_origin_id', subOriginId)
          .limit(5);

        const validSamples = sampleLeads?.filter(l => {
          if (type === 'email') {
            return l.email && l.email.includes('@') && l.email.includes('.');
          } else {
            return l.whatsapp && l.whatsapp.length >= 8;
          }
        }) || [];

        // Cálculo real: PARALLEL_EMAILS=2, INTERVAL_SECONDS=5
        // Cada batch de 2 emails leva 5 segundos
        const INTERVAL_SECONDS = 5;
        const PARALLEL_EMAILS = 2;
        const estimatedMinutes = Math.max(Math.ceil((validCount / PARALLEL_EMAILS) * INTERVAL_SECONDS / 60), 1);

        return new Response(JSON.stringify({
          type: 'leads_preview',
          data: {
            subOriginId,
            originName: (subOrigin as any)?.crm_origins?.nome || 'Desconhecido',
            subOriginName: subOrigin?.nome || 'Desconhecido',
            dispatchType: type,
            totalLeads: totalCount,
            validLeads: validCount,
            invalidLeads: totalCount - validCount,
            intervalSeconds: INTERVAL_SECONDS,
            estimatedMinutes,
            leads: validSamples.map(l => ({
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
        const conversationId = parts[4] || null; // Conversation ID to link the dispatch
        const encodedSubject = parts[5] || ''; // Base64 encoded subject
        const encodedHtml = parts.slice(6).join(':') || ''; // Base64 encoded HTML (may contain colons)
        
        // Decode subject and HTML from base64 + URI encoding
        let emailSubject = '';
        let templateContent = '';
        
        try {
          if (encodedSubject) {
            emailSubject = decodeURIComponent(atob(encodedSubject));
            console.log('[GROK] Decoded email subject:', emailSubject);
          }
          if (encodedHtml) {
            templateContent = decodeURIComponent(atob(encodedHtml));
            console.log('[GROK] Decoded HTML template, length:', templateContent.length);
          }
        } catch (e) {
          console.error('[GROK] Error decoding template/subject:', e);
        }

        // Get sub-origin info
        const { data: subOrigin } = await supabase
          .from('crm_sub_origins')
          .select('nome, crm_origins(nome)')
          .eq('id', subOriginId)
          .single();

        // Use COUNT for accurate totals (no 1000 row limit)
        const { count: totalCount } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('sub_origin_id', subOriginId);

        let validCount = 0;
        if (type === 'email') {
          const { count } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('sub_origin_id', subOriginId)
            .not('email', 'is', null)
            .ilike('email', '%@%.%');
          validCount = count || 0;
        } else {
          const { count } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('sub_origin_id', subOriginId)
            .not('whatsapp', 'is', null)
            .gte('whatsapp', '10000000');
          validCount = count || 0;
        }

        // Create dispatch job with message template (JSON with html and subject) and conversation link
        const messageTemplate = templateContent ? JSON.stringify({ 
          html: templateContent, 
          subject: emailSubject 
        }) : null;
        
        console.log('[GROK] Creating dispatch job with template:', { 
          hasHtml: !!templateContent, 
          hasSubject: !!emailSubject,
          subjectPreview: emailSubject?.substring(0, 50)
        });
        
        const { data: job, error: jobError } = await supabase
          .from('dispatch_jobs')
          .insert({
            type,
            sub_origin_id: subOriginId,
            origin_name: (subOrigin as any)?.crm_origins?.nome,
            sub_origin_name: subOrigin?.nome,
            total_leads: totalCount || 0,
            valid_leads: validCount,
            interval_seconds: 5, // Explícito: 5s entre batches de 2 emails
            status: 'running',
            started_at: new Date().toISOString(),
            message_template: messageTemplate,
            conversation_id: conversationId || null
          })
          .select()
          .single();

        if (jobError) throw jobError;

        // Trigger background dispatch with template info including subject
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
            templateContent,
            emailSubject  // Pass subject separately for clarity
          })
        }).catch(err => console.error('Error triggering dispatch:', err));

        return new Response(JSON.stringify({
          type: 'dispatch_started',
          data: {
            jobId: job.id,
            status: 'running',
            totalLeads: totalCount || 0,
            validLeads: validCount,
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
