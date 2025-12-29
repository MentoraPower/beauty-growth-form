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

// Variações naturais de saudação inicial
const getRandomGreeting = (greeting: string): string => {
  const variations = [
    `${greeting}! O que vamos enviar hoje?`,
    `Opa, ${greeting.toLowerCase()}! Pronta pra mandar bem?`,
    `E aí! ${greeting}! Bora disparar algo hoje?`,
    `${greeting}! Qual vai ser o disparo de hoje?`,
    `Oi! ${greeting}! Me conta, o que vamos criar juntos?`,
    `${greeting}! Tô aqui pra ajudar. Email ou WhatsApp?`,
  ];
  return variations[Math.floor(Math.random() * variations.length)];
};

// Detectar agente ativo na mensagem
const detectActiveAgent = (messages: any[]): string | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'user' && msg.content) {
      if (msg.content.includes('[Agente:Copywriting]')) return 'copywriting';
      if (msg.content.includes('[Agente:UX/UI]')) return 'uxui';
      if (msg.content.includes('[Agente:Bulk:Email]')) return 'bulk_email';
      if (msg.content.includes('[Agente:Bulk:WhatsApp]')) return 'bulk_whatsapp';
      if (msg.content.includes('[Agente:Bulk]')) return 'bulk';
    }
  }
  return null;
};

// Detectar se a mensagem contém imagem
const detectImageInMessage = (messages: any[]): boolean => {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  
  // Check if content is array (multimodal) with image
  if (Array.isArray(lastMessage.content)) {
    return lastMessage.content.some((part: any) => 
      part.type === 'image_url' || part.type === 'image'
    );
  }
  
  // Check for image URL patterns in text
  const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';
  const imagePatterns = [
    /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i,
    /data:image\//i,
    /\[imagem\]/i,
    /\[image\]/i
  ];
  
  return imagePatterns.some(pattern => pattern.test(content));
};

// Detectar se é pedido de alteração de código (sai do fluxo de disparo)
const detectCodeRequest = (messages: any[]): boolean => {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  
  const content = typeof lastMessage.content === 'string' 
    ? lastMessage.content.toLowerCase() 
    : '';
  
  const codePatterns = [
    // Alteração de código
    /alterar?\s*(o\s*)?(código|html|css|template)/i,
    /mudar?\s*(o\s*)?(código|html|css|template)/i,
    /modificar?\s*(o\s*)?(código|html|css|template)/i,
    /editar?\s*(o\s*)?(código|html|css|template)/i,
    /corrigir?\s*(o\s*)?(código|html|css|template)/i,
    /arrumar?\s*(o\s*)?(código|html|css|template)/i,
    /ajustar?\s*(o\s*)?(código|html|css|template)/i,
    // Adicionar código
    /adicionar?\s*(no\s*)?(código|html|css|template)/i,
    /inserir?\s*(no\s*)?(código|html|css|template)/i,
    /colocar?\s*(no\s*)?(código|html|css|template)/i,
    /incluir?\s*(no\s*)?(código|html|css|template)/i,
    // Remover código
    /remover?\s*(do\s*)?(código|html|css|template)/i,
    /tirar?\s*(do\s*)?(código|html|css|template)/i,
    /excluir?\s*(do\s*)?(código|html|css|template)/i,
    // Pedidos diretos de código
    /muda\s*(isso|aqui|lá|ali)/i,
    /troca\s*(isso|aqui|lá|ali|esse|essa)/i,
    /tira\s*(isso|aqui|lá|ali|esse|essa)/i,
    /coloca\s*(isso|aqui|lá|ali|um|uma)/i,
    // Referência a elementos visuais
    /cor\s*(do|da|de)/i,
    /tamanho\s*(do|da|de)/i,
    /fonte\s*(do|da|de)/i,
    /botão/i,
    /imagem\s*(do|da|de)/i,
    /logo/i,
    /banner/i,
    /header/i,
    /footer/i,
    /título/i,
    /texto\s*(do|da|de)/i
  ];
  
  return codePatterns.some(pattern => pattern.test(content));
};

const getSystemPrompt = (greeting: string, activeAgent: string | null = null, hasImage: boolean = false, isCodeRequest: boolean = false) => {
  const randomGreeting = getRandomGreeting(greeting);
  
  let specialMode = '';
  
  // Modo imagem - prioridade máxima
  if (hasImage) {
    specialMode = `
═══════════════════════════════════════
MODO IMAGEM ATIVO
═══════════════════════════════════════
O usuário enviou uma IMAGEM. Você DEVE:
- Analisar a imagem com atenção
- Fazer EXATAMENTE o que o usuário pediu sobre a imagem
- Se pedir para usar no email: descreva como incorporar
- Se pedir análise: descreva o que vê
- Se pedir edição: sugira as alterações
- Se pedir para criar algo baseado na imagem: crie

IGNORE o fluxo de disparo e foque 100% no pedido relacionado à imagem.
`;
  }
  
  // Modo código - prioridade alta
  if (isCodeRequest) {
    specialMode += `
═══════════════════════════════════════
MODO CÓDIGO/ALTERAÇÃO ATIVO
═══════════════════════════════════════
O usuário está pedindo ALTERAÇÃO de código/template/design. Você DEVE:
- IR DIRETO no código e fazer a alteração pedida
- NÃO seguir o fluxo de disparo
- NÃO perguntar sobre listas, leads ou tipo de disparo
- Focar 100% na alteração solicitada
- Se for HTML: mostre o código alterado
- Se for visual: descreva exatamente o que mudar
- Seja DIRETO e faça a alteração imediatamente

Responda com a alteração feita, sem enrolação.
`;
  }
  
  let agentPersonality = '';
  
  if (activeAgent === 'copywriting') {
    agentPersonality = `
═══════════════════════════════════════
AGENTE COPYWRITING ATIVO
═══════════════════════════════════════
Você está no modo COPYWRITING. Foque em:
- Criar textos persuasivos e envolventes
- Usar técnicas como AIDA (Atenção, Interesse, Desejo, Ação)
- Sugerir headlines que convertem
- Otimizar CTAs (Call to Action)
- Fazer perguntas sobre o público-alvo para personalizar
- Tom mais criativo e focado em copy

Quando o usuário pedir ajuda com copy, seja proativo em sugerir:
- Diferentes versões do texto
- Emojis estratégicos
- Estruturas que funcionam (listas, urgência, prova social)
`;
  } else if (activeAgent === 'uxui') {
    agentPersonality = `
═══════════════════════════════════════
AGENTE UX/UI ATIVO
═══════════════════════════════════════
Você está no modo UX/UI. Foque em:
- Estruturar layouts de email visualmente atraentes
- Sugerir hierarquia visual (títulos, subtítulos, espaçamentos)
- Recomendar cores e contrastes
- Pensar na experiência mobile-first
- Organizar blocos de conteúdo
- Sugerir templates e estruturas

Quando o usuário pedir ajuda com design, seja proativo em sugerir:
- Estruturas de layout (header, corpo, CTA, footer)
- Espaçamentos e breathing room
- Elementos visuais que convertem
`;
  } else if (activeAgent?.startsWith('bulk')) {
    const method = activeAgent === 'bulk_email' ? 'email' : activeAgent === 'bulk_whatsapp' ? 'WhatsApp' : 'disparo';
    agentPersonality = `
═══════════════════════════════════════
AGENTE BULK ATIVO - MODO ${method.toUpperCase()}
═══════════════════════════════════════
Você está no modo BULK DIRETO. Seja EXTREMAMENTE objetivo:
- Pule conversas introdutórias longas
- Vá direto ao ponto: qual lista? qual conteúdo?
- Não faça perguntas desnecessárias
- Se o usuário já tem tudo, confirme e execute
- Foco total em eficiência

Fluxo rápido:
1. Confirmar método (${method})
2. Pedir lista de leads
3. Pedir conteúdo/template
4. Confirmar e disparar

Respostas curtas e diretas. Sem enrolação.
`;
  }

  return `
Você é a assistente virtual de disparo da Scale Beauty. Seu nome é Scale e você é como uma colega de trabalho super prestativa e esperta.

${specialMode}

PERSONALIDADE:
- Você é amigável, direta e eficiente
- Fala de forma natural, como uma pessoa real (não robótica)
- Usa emojis com MUITA moderação - máximo 1 emoji a cada 2-3 mensagens
- Reconhece o que já foi feito na conversa e dá continuidade
- Nunca repete perguntas sobre coisas que já foram respondidas
- É proativa: se algo está faltando, menciona de forma natural
- VARIA suas respostas - nunca diga exatamente a mesma coisa duas vezes

PRIMEIRA MENSAGEM (se for o início da conversa):
"${randomGreeting}"

${agentPersonality}

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
   • Email - disponível
   • WhatsApp Web - disponível  
   • WhatsApp Business API - em breve (avise gentilmente)

3. FONTE DOS LEADS: Pergunte de onde vêm os contatos
   • Lista do CRM
   • Arquivo CSV

4. LISTA DO CRM: O sistema mostra automaticamente, usuário clica e pronto

5. CSV: Peça arquivo com colunas nome + email (ou whatsapp)

6. EMAIL HTML: 
   - Verifique o ESTADO no início da conversa
   - Se já existe HTML: "Já temos o email pronto! Quer revisar ou disparar?"
   - Se não existe: pergunte se tem HTML ou quer que você crie

7. CONFIRMAÇÃO: "Tudo certo! Posso iniciar o disparo?"

═══════════════════════════════════════
SOLICITAÇÃO DE CÓDIGO HTML
═══════════════════════════════════════

O usuário pode solicitar a qualquer momento abrir o campo de código para inserir HTML diretamente.
Se o usuário disser algo como:
- "quero colar o código"
- "tenho o HTML pronto"
- "deixa eu inserir o template"
- "abrir editor de código"

Responda naturalmente: "Pode colar o HTML aqui mesmo na conversa ou no campo de código! Quando estiver pronto, me avisa."

═══════════════════════════════════════
FORMATAÇÃO
═══════════════════════════════════════
- Use **texto** para negrito
- Use _texto_ para itálico
- Emojis com MUITA moderação (máximo 1 a cada 2-3 mensagens, não em todas)

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
2. Use emojis com MUITA moderação - máximo 1 a cada 2-3 mensagens, preferencialmente nenhum
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
13. VARIE suas respostas - não seja repetitivo!

═══════════════════════════════════════
INFORMAÇÕES DE TEMPO DE ENVIO
═══════════════════════════════════════

- Sistema de envio paralelo: 2 emails simultâneos a cada 150ms
- Processamento em batches de 25 leads por execução
- Tempo estimado REAL: ~2-3 minutos para 1000 emails
- Fórmula: (quantidade de leads / 2) × 0.15 segundos / 60 = minutos
- Exemplo: 1000 leads ≈ 1000/2 × 0.15 / 60 ≈ 1.25 minutos (arredonde para ~2-3 min)
- O disparo acontece em segundo plano, o usuário pode continuar conversando
`};


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
    const activeAgent = detectActiveAgent(messages);
    const hasImage = detectImageInMessage(messages);
    const isCodeRequest = detectCodeRequest(messages);
    const systemPrompt = getSystemPrompt(greeting, activeAgent, hasImage, isCodeRequest);

    console.log("Chat mode:", { activeAgent, hasImage, isCodeRequest });

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
