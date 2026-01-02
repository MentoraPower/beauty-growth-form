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
  ];
  return variations[Math.floor(Math.random() * variations.length)];
};

// Detectar se é um pedido de copy/copywriting baseado no conteúdo
const detectCopywritingRequest = (messages: any[]): boolean => {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  
  const content = typeof lastMessage.content === 'string' 
    ? lastMessage.content.toLowerCase() 
    : '';
  
  const copyPatterns = [
    /criar?\s*(uma\s*)?(a\s*)?copy/i,
    /cria\s*(uma\s*)?(a\s*)?copy/i,
    /faz(er)?\s*(uma\s*)?(a\s*)?copy/i,
    /escreve(r)?\s*(uma\s*)?(a\s*)?copy/i,
    /gera(r)?\s*(uma\s*)?(a\s*)?copy/i,
    /monte?\s*(uma\s*)?(a\s*)?copy/i,
    /preciso\s*(de\s*)?(uma\s*)?copy/i,
    /quero\s*(uma\s*)?copy/i,
    /elabor(e|ar)\s*(uma\s*)?copy/i,
    /produz(ir|a)\s*(uma\s*)?copy/i,
    /desenvolv(er|a)\s*(uma\s*)?copy/i,
    /vamos\s*criar\s*(uma\s*)?copy/i,
    /crie\s*(uma\s*)?copy/i,
  ];
  
  return copyPatterns.some(pattern => pattern.test(content));
};

// Detectar agente ativo na mensagem
const detectActiveAgent = (messages: any[]): string | null => {
  // First check for explicit agent tags
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'user' && msg.content) {
      if (msg.content.includes('[Agente:Copywriting]')) return 'copywriting';
      if (msg.content.includes('[Agente:UX/UI]')) return 'uxui';
      if (msg.content.includes('[Agente:Bulk:Email]')) return 'bulk_email';
      if (msg.content.includes('[Agente:Bulk]')) return 'bulk';
    }
  }
  
  // Auto-detect copywriting request even without explicit tag
  if (detectCopywritingRequest(messages)) {
    return 'copywriting';
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

// Check any message in conversation for images
const hasImageInConversation = (messages: any[]): boolean => {
  return messages.some(msg => {
    if (Array.isArray(msg.content)) {
      return msg.content.some((part: any) => 
        part.type === 'image_url' || part.type === 'image'
      );
    }
    return false;
  });
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

// Detectar se há CSV na conversa - detecta quando lista foi enviada
const detectCsvRequest = (messages: any[]): boolean => {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  
  const content = typeof lastMessage.content === 'string' 
    ? lastMessage.content 
    : '';
  
  // Check if this message IS a CSV upload (new format with context)
  if (content.includes('[NOVA LISTA CSV RECEBIDA]')) {
    return true;
  }
  
  // Check if CSV was uploaded in any previous message
  const hasCsvInConversation = messages.some(m => {
    const msgContent = typeof m.content === 'string' ? m.content : '';
    return msgContent.includes('[NOVA LISTA CSV RECEBIDA]') || 
           (msgContent.includes('[Arquivo enviado:') && msgContent.includes('.csv'));
  });
  
  if (!hasCsvInConversation) return false;
  
  // If CSV exists, check if user wants to do something with the list
  const csvPatterns = [
    /lista/i,
    /leads/i,
    /contatos/i,
    /filtrar/i,
    /remover/i,
    /excluir/i,
    /deletar/i,
    /ordenar/i,
    /organizar/i,
    /limpar/i,
    /duplicados/i,
    /duplicatas/i,
    /manter\s*(apenas|só)/i,
    /tirar/i,
    /separar/i,
    /segmentar/i,
    /agrupar/i,
    /editar/i,
    /alterar/i,
    /modificar/i,
    /atualizar/i,
    /planilha/i,
    /csv/i,
    /emails?\s*(com|sem|válidos|inválidos)/i,
    /quantos/i,
    /contar/i,
    /total/i,
    /exportar/i
  ];
  
  return csvPatterns.some(pattern => pattern.test(content.toLowerCase()));
};

// Detectar se é uma pergunta sobre métricas de email
const detectMetricsRequest = (messages: any[]): boolean => {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  
  const content = typeof lastMessage.content === 'string' 
    ? lastMessage.content.toLowerCase() 
    : '';
  
  const metricsPatterns = [
    /taxa\s*(de\s*)?(abertura|aberturas)/i,
    /quantas?\s*(pessoas?)?\s*(abriram|abriu|aberto)/i,
    /quantas?\s*(pessoas?)?\s*(clicaram|clicou|cliques?)/i,
    /métricas?\s*(do|de|dos)?\s*(e-?mails?|disparo|disparos|campanha)/i,
    /estatísticas?\s*(do|de|dos)?\s*(e-?mails?|disparo|disparos)/i,
    /performance\s*(do|de|dos)?\s*(e-?mails?|disparo)/i,
    /resultados?\s*(do|de|dos)?\s*(e-?mails?|disparo|último)/i,
    /open\s*rate/i,
    /click\s*rate/i,
    /aberturas?\s*(do|de|dos)?\s*(e-?mails?)/i,
    /cliques?\s*(no|nos|do|dos)?\s*(e-?mails?|link|links)/i,
    /como\s*(foi|foram|está|estão)\s*(o|os|a|as)?\s*(e-?mails?|disparo|disparos)/i,
    /relatório\s*(de|do|dos)?\s*(e-?mails?|disparo)/i,
    /analytics/i,
    /conversão\s*(do|de|dos)?\s*(e-?mails?|disparo)/i,
    /engajamento/i
  ];
  
  return metricsPatterns.some(pattern => pattern.test(content));
};

// Detectar se é um pedido de CRIAÇÃO de conteúdo (email, copy, texto)
// PRIORIDADE: Se o usuário pede para criar, vai direto criar - sem perguntar lista
const detectContentCreationRequest = (messages: any[]): boolean => {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  
  const content = typeof lastMessage.content === 'string' 
    ? lastMessage.content.toLowerCase() 
    : '';
  
  const creationPatterns = [
    // Verbos de criação + email/copy/texto
    /crie?\s*(um|uma|o|a)?\s*(email|e-mail|copy|texto|mensagem)/i,
    /criar?\s*(um|uma|o|a)?\s*(email|e-mail|copy|texto|mensagem)/i,
    /quero\s*(um|uma)?\s*(email|e-mail|copy|texto)/i,
    /preciso\s*(de)?\s*(um|uma)?\s*(email|e-mail|copy)/i,
    /faça?\s*(um|uma)?\s*(email|e-mail|copy|texto)/i,
    /fazer?\s*(um|uma)?\s*(email|e-mail|copy|texto)/i,
    /escreva?\s*(um|uma)?\s*(email|e-mail|copy|texto)/i,
    /escrever?\s*(um|uma)?\s*(email|e-mail|copy|texto)/i,
    /gere?\s*(um|uma)?\s*(email|e-mail|copy|texto)/i,
    /gerar?\s*(um|uma)?\s*(email|e-mail|copy|texto)/i,
    /monte?\s*(um|uma)?\s*(email|e-mail|copy|texto)/i,
    /elabore?\s*(um|uma)?\s*(email|e-mail|copy|texto)/i,
    /prepare?\s*(um|uma)?\s*(email|e-mail|copy|texto)/i,
    /produza?\s*(um|uma)?\s*(email|e-mail|copy|texto)/i,
    // Pedidos diretos de conteúdo específico
    /email\s*(de)?\s*(aquecimento|boas-vindas|welcome|convite|convocação|lançamento|vendas?|promoção|desconto)/i,
    /copy\s*(de|para)?\s*(venda|lançamento|aquecimento|promoção)/i,
    // Referência a tipo de email específico
    /crie?\s*(um|uma)?\s*(email|e-mail)\s*(de|para|sobre)/i,
    /quero\s*(enviar|mandar|disparar)\s*(um|uma)?\s*(email|e-mail)\s*(de|para|sobre)/i,
  ];
  
  return creationPatterns.some(pattern => pattern.test(content));
};

const getSystemPrompt = (greeting: string, activeAgent: string | null = null, hasImage: boolean = false, isCodeRequest: boolean = false, isCsvRequest: boolean = false, isMetricsRequest: boolean = false, metricsData: any = null, isContentCreation: boolean = false) => {
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
  
  // Modo Criação de Conteúdo - PRIORIDADE SOBRE FLUXO DE DISPARO
  if (isContentCreation) {
    specialMode += `
═══════════════════════════════════════
MODO CRIAÇÃO DE CONTEÚDO ATIVO
═══════════════════════════════════════
O usuário está pedindo para CRIAR um email/copy/texto. Você DEVE:

1. CRIAR IMEDIATAMENTE o conteúdo pedido - NÃO pergunte nada antes
2. NÃO perguntar sobre listas, leads, ou tipo de disparo AGORA
3. NÃO seguir o fluxo de disparo
4. FOCAR 100% na criação do conteúdo

**FORMATO OBRIGATÓRIO PARA EMAILS (copy texto, NÃO HTML):**
Você DEVE retornar a copy do email no formato estruturado abaixo.
O sistema irá automaticamente converter em HTML depois.

---INÍCIO DO EMAIL---
NOME DO EMAIL: [Um nome curto e descritivo para identificar o email, ex: "Aquecimento Aula Power Woman"]

ASSUNTO: [Linha de assunto do email - persuasivo, até 60 caracteres]

PREHEADER: [Texto de pré-visualização - complementa o assunto, até 100 caracteres]

CORPO:
[Aqui você escreve todo o conteúdo do email em texto puro.
Use {{name}} para personalização do nome do destinatário.
Estruture bem com parágrafos, bullet points se necessário.
Inclua uma chamada para ação clara.
NÃO use HTML, apenas texto formatado de forma clara.]
---FIM DO EMAIL---

**REGRAS CRÍTICAS:**
- NUNCA retorne HTML ou código no chat
- NUNCA mostre tags como <html>, <div>, <table>, etc
- Retorne APENAS o formato estruturado acima
- O sistema converte para HTML automaticamente
- Use técnicas de copywriting (AIDA, PAS, etc)
- Seja envolvente e direcionado ao público
- Inclua CTAs claros e persuasivos

**SE FOR COPY/TEXTO (não email):**
- Crie o texto persuasivo completo
- Use técnicas de copywriting (AIDA, PAS, etc)
- NÃO use o formato de email acima, apenas texto livre

**DEPOIS DE CRIAR:**
Somente APÓS mostrar o email/copy criado, você pode perguntar:
"Gostou? Agora, para qual lista você quer disparar esse email?"

IMPORTANTE: A CRIAÇÃO VEM PRIMEIRO. Lista/disparo vem DEPOIS.
`;
  }

  // Modo CSV/Lista - manipulação de dados
  if (isCsvRequest) {
    specialMode += `
═══════════════════════════════════════
MODO LISTA/CSV ATIVO - VOCÊ TEM ACESSO TOTAL AOS DADOS!
═══════════════════════════════════════
O usuário está trabalhando com uma lista CSV. Seja NATURAL e conversacional!

**VOCÊ TEM ACESSO COMPLETO:**
O sistema te passa TODAS as estatísticas do CSV quando recebe uma lista:
- Total REAL de leads (não apenas preview)
- Emails válidos únicos
- Duplicados removidos
- Leads com/sem WhatsApp
- Leads com/sem nome
- Distribuição por domínio de email (gmail, hotmail, etc)

**QUANDO O USUÁRIO PEDIR ANÁLISE:**
Se o usuário pedir "análise maior", "mais detalhes", "estatísticas":
- USE os dados que você recebeu no contexto [NOVA LISTA CSV RECEBIDA]
- Apresente os números REAIS - você tem acesso a TUDO
- Não invente nem estime - use os dados exatos fornecidos

**SEU COMPORTAMENTO:**
1. Confirme a lista recebida mencionando o número REAL de leads
2. Mencione as estatísticas relevantes de forma natural
3. Se o usuário quiser TRATAR/LIMPAR a lista, você PODE e DEVE fazer!
4. Quando tiver tudo pronto (lista + email), confirme e inicie o disparo

**OPERAÇÕES DE TRATAMENTO DE CSV QUE VOCÊ PODE FAZER:**
Quando o usuário pedir para tratar/limpar/modificar a lista, use o comando apropriado:

1. REMOVER DUPLICADOS:
   Se pedir: "remover duplicados", "tirar repetidos", "limpar duplicatas"
   → Responda: "Vou remover os duplicados da lista!"
   → Use: [CSV_OPERATION:REMOVE_DUPLICATES:email] ou [CSV_OPERATION:REMOVE_DUPLICATES:name]

2. REMOVER COLUNAS:
   Se pedir: "apagar coluna X", "remover coluna Y", "tirar a coluna Z"
   → Responda: "Removendo a coluna X da lista!"
   → Use: [CSV_OPERATION:REMOVE_COLUMN:nome_da_coluna]

3. ADICIONAR DDI:
   Se pedir: "adicionar DDI", "colocar +55", "adicionar código do país"
   → Responda: "Adicionando DDI 55 aos números!"
   → Use: [CSV_OPERATION:ADD_DDI:55] (ou outro código de país)

4. REMOVER SOBRENOME:
   Se pedir: "deixar só primeiro nome", "remover sobrenome", "tirar sobrenome"
   → Responda: "Deixando apenas o primeiro nome!"
   → Use: [CSV_OPERATION:FIRST_NAME_ONLY]

5. FILTRAR POR DOMÍNIO:
   Se pedir: "só emails do gmail", "filtrar hotmail", "manter só @empresa.com"
   → Responda: "Filtrando apenas emails com domínio X!"
   → Use: [CSV_OPERATION:FILTER_DOMAIN:gmail.com]

6. REMOVER EMAILS INVÁLIDOS:
   Se pedir: "limpar emails inválidos", "tirar emails errados"
   → Responda: "Removendo emails que parecem inválidos!"
   → Use: [CSV_OPERATION:REMOVE_INVALID_EMAILS]

7. FILTRAR POR VALOR:
   Se pedir: "só leads de SP", "filtrar por cidade X", "manter onde coluna = valor"
   → Responda: "Filtrando leads onde [coluna] = [valor]!"
   → Use: [CSV_OPERATION:FILTER:coluna:valor]

8. REMOVER LINHAS SEM EMAIL:
   Se pedir: "tirar quem não tem email", "remover sem email"
   → Responda: "Removendo leads sem email!"
   → Use: [CSV_OPERATION:REMOVE_EMPTY:email]

9. PADRONIZAR TELEFONES:
   Se pedir: "limpar telefones", "padronizar números", "deixar só números"
   → Responda: "Padronizando os números de telefone!"
   → Use: [CSV_OPERATION:CLEAN_PHONES]

10. EXPORTAR/BAIXAR:
    Se pedir: "exportar", "baixar lista", "download"
    → Responda: "Gerando link de download da lista tratada!"
    → Use: [CSV_OPERATION:EXPORT]

**EXEMPLOS DE RESPOSTAS NATURAIS:**
- "Recebi sua lista com 2096 leads! Após remover duplicados, ficamos com 1850 emails únicos. 92% são gmail/hotmail. Quer que eu prepare algo?"
- "Legal, sua lista tem 500 leads - 480 com email válido e 350 com WhatsApp. Notei que 15% são @empresa.com.br - interessante!"
- "Perfeito, removi 15 duplicados! Agora temos 485 leads únicos. Próximo passo?"

**IMPORTANTE:**
- Você pode encadear operações: "remover duplicados e adicionar DDI" → duas operações
- Sempre confirme o que foi feito e mostre o novo total de leads
- A lista é atualizada automaticamente após cada operação
- O usuário pode pedir tratamentos a qualquer momento antes do disparo
- NUNCA diga que tem acesso limitado ou que só vê preview - você TEM ACESSO TOTAL!
`;
  }

  // Modo Métricas - análise de performance de emails
  if (isMetricsRequest && metricsData) {
    const openRate = metricsData.totalSent > 0 
      ? ((metricsData.uniqueOpens / metricsData.totalSent) * 100).toFixed(1)
      : 0;
    const clickRate = metricsData.totalSent > 0 
      ? ((metricsData.totalClicks / metricsData.totalSent) * 100).toFixed(1)
      : 0;
    
    if (metricsData.conversationSpecific) {
      // Métricas específicas desta conversa/disparo
      specialMode += `
═══════════════════════════════════════
MODO MÉTRICAS DE EMAIL ATIVO (CONVERSA ESPECÍFICA)
═══════════════════════════════════════
O usuário está perguntando sobre métricas DESTE disparo/conversa.

**DADOS DESTA CONVERSA:**
- Emails enviados: ${metricsData.totalSent}
- Aberturas: ${metricsData.uniqueOpens} (${openRate}% de taxa de abertura)
- Cliques: ${metricsData.totalClicks} (${clickRate}% de taxa de cliques)
${metricsData.dispatchJobs?.length > 0 ? `
**DISPAROS DESTA CONVERSA:**
${metricsData.dispatchJobs.map((j: any, i: number) => 
  `${i + 1}. ${j.subOrigin || j.origin || 'Disparo'} - ${j.sent} enviados, ${j.failed} falharam (status: ${j.status})`
).join('\n')}
` : metricsData.message || ''}

**BENCHMARKS DO MERCADO:**
- Taxa de abertura boa: 20-25%
- Taxa de abertura excelente: acima de 30%
- Taxa de cliques boa: 2-5%

**COMO RESPONDER:**
- Apresente os dados de forma clara e natural
- Compare com benchmarks do mercado
- Se a taxa está acima da média, parabenize!
- Se está abaixo, sugira melhorias
- IMPORTANTE: Estes são os dados APENAS desta conversa, não de todos os disparos
`;
    } else {
      // Métricas gerais de todos os disparos
      specialMode += `
═══════════════════════════════════════
MODO MÉTRICAS DE EMAIL ATIVO (VISÃO GERAL)
═══════════════════════════════════════
O usuário está perguntando sobre métricas gerais de todos os emails.

**DADOS GERAIS DO SISTEMA:**
- Total de emails enviados: ${metricsData.totalSent}
- Aberturas: ${metricsData.uniqueOpens} (${openRate}% de taxa de abertura)
- Cliques: ${metricsData.totalClicks} (${clickRate}% de taxa de cliques)
${metricsData.breakdown ? `
**DETALHAMENTO:**
- Automações: ${metricsData.breakdown.automations.sent} emails, ${metricsData.breakdown.automations.opens} aberturas, ${metricsData.breakdown.automations.clicks} cliques
- Disparos manuais: ${metricsData.breakdown.dispatches.sent} emails, ${metricsData.breakdown.dispatches.opens} aberturas, ${metricsData.breakdown.dispatches.clicks} cliques
` : ''}

**BENCHMARKS DO MERCADO:**
- Taxa de abertura boa: 20-25%
- Taxa de abertura excelente: acima de 30%
- Taxa de cliques boa: 2-5%

**COMO RESPONDER:**
- Apresente os dados de forma clara
- Compare com benchmarks do mercado
- Se quiser métricas de um disparo específico, peça para o usuário estar na conversa daquele disparo
`;
    }
  }
  
  let agentPersonality = '';
  
  if (activeAgent === 'copywriting') {
    agentPersonality = `
═══════════════════════════════════════
AGENTE COPYWRITING DE ELITE ATIVO
═══════════════════════════════════════
Você é um COPYWRITER DE NÍVEL MUNDIAL. Você escreve como os melhores do mercado.

REGRAS ABSOLUTAS E INVIOLÁVEIS:
1. NUNCA use emojis - PROIBIDO TOTALMENTE
2. NUNCA faça perguntas ao usuário - crie o que ele pediu IMEDIATAMENTE
3. NUNCA pergunte "qual lista preferir", "qual estilo", "qual tom" - APENAS CRIE
4. Por padrão, entregue copies CURTAS e IMPACTANTES (150-250 palavras)
5. Só faça copies LONGAS (500-800 palavras) se o usuário pedir EXPLICITAMENTE com palavras como: "copy longa", "copy completa", "copy detalhada", "copy grande", "copy extensa", "copy desenvolvida"
6. Use **negrito** para destacar palavras-chave e frases importantes
7. Use _itálico_ para ênfase emocional e termos especiais

SE O USUÁRIO PEDIR UMA COPY, CRIE IMEDIATAMENTE. SEM PERGUNTAS. SEM ENROLAÇÃO.

ESTRUTURA PARA COPY CURTA (PADRÃO - 150-250 palavras):
- **HEADLINE MAGNÉTICA** - impactante, curiosa, para o scroll
- 2-3 parágrafos diretos (gancho + benefício principal + prova rápida)
- **CTA DIRETO** - comando claro para ação

ESTRUTURA PARA COPY LONGA (SÓ QUANDO PEDIR - 500-800 palavras):
1. Headline magnética + Subheadline
2. Gancho emocional (2-3 parágrafos)
3. Agitação do problema
4. Apresentação da solução
5. Benefícios transformacionais
6. Prova social
7. Tratamento de objeções
8. Urgência e escassez
9. CTA irresistível
10. PS/PPS

FORMATAÇÃO:
- **Palavras de poder em negrito**: exclusivo, transformação, resultados, agora, único, comprovado, garantido
- _Itálico_ para ênfase emocional

FORMATO DE ENTREGA:
---
[COPY AQUI - 150-250 palavras por padrão, ou 500-800 se pediu copy longa]
---

IMPORTANTE: Entregue APENAS a copy entre os delimitadores. Sem perguntas, sem "o que achou", sem explicações. CRIE IMEDIATAMENTE o que o usuário pediu.
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
    agentPersonality = `
═══════════════════════════════════════
AGENTE BULK ATIVO - DISPARO DE EMAIL
═══════════════════════════════════════
Você está no modo BULK DIRETO. Seja EXTREMAMENTE objetivo:
- Pule conversas introdutórias longas
- Vá direto ao ponto: qual lista? qual conteúdo?
- Não faça perguntas desnecessárias
- Se o usuário já tem tudo, confirme e execute
- Foco total em eficiência

Fluxo rápido:
1. Pedir lista de leads
2. Pedir conteúdo/template do email
3. Confirmar e disparar

Respostas curtas e diretas. Sem enrolação.
`;
  }

  return `
Você é a assistente virtual de disparo da Scale Beauty. Seu nome é Scale e você é como uma colega de trabalho super prestativa e esperta.

${specialMode}

PERSONALIDADE:
- Você é amigável, direta e eficiente
- Fala de forma natural, como uma pessoa real (não robótica)
- NUNCA use emojis - mantenha comunicação profissional e limpa
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

⚠️ COPY CRIADA ANTERIORMENTE:
- Se você criou uma COPY DE TEXTO nesta conversa (ver COPY CRIADA no contexto), RECONHEÇA ISSO!
- Quando o usuário pedir para "usar essa copy", "transformar em email" ou "preparar o disparo":
  → NÃO pergunte se tem copy pronta - você JÁ criou!
  → Use a copy que você criou para gerar o email HTML
  → Apenas confirme: "Vou usar a copy que criamos e transformar em email!"

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

1. SAUDAÇÃO: Cumprimente e pergunte sobre o disparo de email

2. FONTE DOS LEADS: Pergunte de onde vêm os contatos
   • Lista do CRM
   • Arquivo CSV

3. LISTA DO CRM: O sistema mostra automaticamente, usuário clica e pronto

4. CSV: Peça arquivo com colunas nome + email

5. EMAIL HTML: 
   - Verifique o ESTADO no início da conversa
   - Se já existe HTML: "Já temos o email pronto! Quer revisar ou disparar?"
   - Se não existe: pergunte se tem HTML ou quer que você crie

6. CONFIRMAÇÃO: "Tudo certo! Posso iniciar o disparo?"

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
    const { messages, command, conversationId } = await req.json();
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

      // NEW: Handle CSV dispatch command
      if (command.startsWith('START_DISPATCH_CSV:')) {
        const parts = command.split(':');
        const type = parts[1]; // email
        const csvListId = parts[2]; // CSV list ID
        const templateType = parts[3] || 'html';
        const conversationId = parts[4] || null;
        const encodedSubject = parts[5] || '';
        const encodedHtml = parts.slice(6).join(':') || '';
        
        console.log('[GROK] START_DISPATCH_CSV:', { type, csvListId, conversationId });
        
        // Decode subject and HTML
        let emailSubject = '';
        let templateContent = '';
        
        try {
          if (encodedSubject) {
            emailSubject = decodeURIComponent(atob(encodedSubject));
          }
          if (encodedHtml) {
            templateContent = decodeURIComponent(atob(encodedHtml));
          }
        } catch (e) {
          console.error('[GROK] Error decoding template/subject for CSV dispatch:', e);
        }
        
        // Get CSV list info
        const { data: csvList, error: csvListError } = await supabase
          .from('dispatch_csv_lists')
          .select('id, file_name, total_rows, valid_emails')
          .eq('id', csvListId)
          .single();
        
        if (csvListError || !csvList) {
          console.error('[GROK] CSV list not found:', csvListError);
          return new Response(JSON.stringify({
            type: 'error',
            message: 'Lista CSV não encontrada'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const messageTemplate = templateContent ? JSON.stringify({ 
          html: templateContent, 
          subject: emailSubject 
        }) : null;
        
        console.log('[GROK] Creating CSV dispatch job:', {
          csvListId,
          fileName: csvList.file_name,
          validEmails: csvList.valid_emails,
          hasTemplate: !!templateContent
        });
        
        // Create dispatch job linked to CSV list (NOT sub_origin)
        const { data: job, error: jobError } = await supabase
          .from('dispatch_jobs')
          .insert({
            type,
            csv_list_id: csvListId,
            sub_origin_id: null, // CSV dispatch doesn't use sub_origin
            origin_name: 'CSV',
            sub_origin_name: csvList.file_name,
            total_leads: csvList.total_rows,
            valid_leads: csvList.valid_emails,
            interval_seconds: 5,
            status: 'running',
            started_at: new Date().toISOString(),
            message_template: messageTemplate,
            conversation_id: conversationId || null
          })
          .select()
          .single();
        
        if (jobError) {
          console.error('[GROK] Error creating CSV dispatch job:', jobError);
          throw jobError;
        }
        
        console.log('[GROK] CSV dispatch job created:', job.id);
        
        // Trigger background dispatch
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
            emailSubject
          })
        }).catch(err => console.error('Error triggering CSV dispatch:', err));
        
        return new Response(JSON.stringify({
          type: 'dispatch_started',
          data: {
            jobId: job.id,
            status: 'running',
            totalLeads: csvList.total_rows,
            validLeads: csvList.valid_emails,
            templateType,
            source: 'csv'
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
    const hasImage = detectImageInMessage(messages) || hasImageInConversation(messages);
    const isCodeRequest = detectCodeRequest(messages);
    const isCsvRequest = detectCsvRequest(messages);
    const isMetricsRequest = detectMetricsRequest(messages);
    
    // Use OpenAI API key
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    // Fetch metrics data if user is asking about email metrics
    let metricsData = null;
    if (isMetricsRequest) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // If we have a conversationId, get metrics SPECIFICALLY for this conversation's dispatches
      if (conversationId) {
        console.log('[GROK] Fetching metrics for conversation:', conversationId);
        
        // Get dispatch jobs for this conversation
        const { data: dispatchJobs } = await supabase
          .from('dispatch_jobs')
          .select('id, type, origin_name, sub_origin_name, sent_count, failed_count, status, created_at, completed_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false });

        if (dispatchJobs && dispatchJobs.length > 0) {
          const jobIds = dispatchJobs.map(j => j.id);
          
          // Get sent_emails linked to these dispatch jobs
          const { data: sentEmails } = await supabase
            .from('sent_emails')
            .select('id, subject, status')
            .in('dispatch_job_id', jobIds);

          const sentEmailIds = sentEmails?.map(e => e.id) || [];
          
          // Get tracking events for these emails
          let opens = 0;
          let clicks = 0;
          
          if (sentEmailIds.length > 0) {
            const { data: trackingEvents } = await supabase
              .from('email_tracking_events')
              .select('event_type, sent_email_id')
              .in('sent_email_id', sentEmailIds);

            if (trackingEvents) {
              opens = trackingEvents.filter(e => e.event_type === 'open').length;
              clicks = trackingEvents.filter(e => e.event_type === 'click').length;
            }
          }

          const totalSent = sentEmails?.filter(e => e.status === 'sent').length || 0;
          
          metricsData = {
            conversationSpecific: true,
            totalSent,
            uniqueOpens: opens,
            totalClicks: clicks,
            dispatchJobs: dispatchJobs.map(j => ({
              id: j.id,
              origin: j.origin_name,
              subOrigin: j.sub_origin_name,
              sent: j.sent_count,
              failed: j.failed_count,
              status: j.status,
              createdAt: j.created_at,
              completedAt: j.completed_at
            }))
          };

          console.log('[GROK] Conversation-specific metrics:', metricsData);
        } else {
          // No dispatches found for this conversation yet
          metricsData = {
            conversationSpecific: true,
            totalSent: 0,
            uniqueOpens: 0,
            totalClicks: 0,
            dispatchJobs: [],
            message: 'Nenhum disparo encontrado para esta conversa ainda.'
          };
        }
      } else {
        // No conversationId - get overall metrics from both tables
        // Count from scheduled_emails (automations)
        const { count: scheduledSent } = await supabase
          .from('scheduled_emails')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'sent');

        // Count from sent_emails (dispatches)
        const { count: dispatchSent } = await supabase
          .from('sent_emails')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'sent');

        // Get tracking events counts
        const { count: scheduledOpens } = await supabase
          .from('email_tracking_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'open')
          .not('scheduled_email_id', 'is', null);

        const { count: dispatchOpens } = await supabase
          .from('email_tracking_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'open')
          .not('sent_email_id', 'is', null);

        const { count: scheduledClicks } = await supabase
          .from('email_tracking_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'click')
          .not('scheduled_email_id', 'is', null);

        const { count: dispatchClicks } = await supabase
          .from('email_tracking_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'click')
          .not('sent_email_id', 'is', null);

        metricsData = {
          conversationSpecific: false,
          totalSent: (scheduledSent || 0) + (dispatchSent || 0),
          uniqueOpens: (scheduledOpens || 0) + (dispatchOpens || 0),
          totalClicks: (scheduledClicks || 0) + (dispatchClicks || 0),
          breakdown: {
            automations: {
              sent: scheduledSent || 0,
              opens: scheduledOpens || 0,
              clicks: scheduledClicks || 0
            },
            dispatches: {
              sent: dispatchSent || 0,
              opens: dispatchOpens || 0,
              clicks: dispatchClicks || 0
            }
          }
        };

        console.log('[GROK] Overall metrics:', metricsData);
      }
    }

    const isContentCreation = detectContentCreationRequest(messages);
    const systemPrompt = getSystemPrompt(greeting, activeAgent, hasImage, isCodeRequest, isCsvRequest, isMetricsRequest, metricsData, isContentCreation);

    // Detect model selection from message content
    const lastUserMessage = messages[messages.length - 1];
    const messageContent = typeof lastUserMessage?.content === 'string' ? lastUserMessage.content : '';
    const useGrok = messageContent.includes('[MODEL:grok]');
    const useGpt = messageContent.includes('[MODEL:gpt]') || messageContent.includes('[CONTEXT:copywriting]');
    
    console.log("Chat mode:", { activeAgent, hasImage, isCodeRequest, isCsvRequest, isMetricsRequest, isContentCreation, useGrok, useGpt });

    // Determine max tokens based on mode
    const isCopywritingMode = activeAgent === 'copywriting';
    const maxTokens = hasImage ? 1000 : (isCopywritingMode || isContentCreation ? 2000 : 500);

    // Use Grok API if user selected Grok model
    if (useGrok) {
      const XAI_API_KEY = Deno.env.get('XAI_API_KEY') || Deno.env.get('GROK_API_KEY');
      if (!XAI_API_KEY) {
        console.error("XAI_API_KEY not found");
        return new Response(JSON.stringify({ error: "API key do Grok não configurada" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const grokModel = hasImage ? "grok-2-vision-1212" : "grok-3-fast";
      console.log("Using Grok model:", grokModel);

      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${XAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: grokModel,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
          temperature: isCopywritingMode ? 0.7 : 0.5,
          max_tokens: maxTokens,
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
        
        return new Response(JSON.stringify({ error: "Erro ao conectar com o Grok" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Use Lovable AI Gateway (free tier) with Gemini 2.5 Flash
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not found");
      return new Response(JSON.stringify({ error: "API key do Lovable AI não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiModel = "google/gemini-2.5-flash";
    console.log("Using Lovable AI model:", geminiModel);
    console.log("Calling Lovable AI Gateway with messages count:", messages.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: geminiModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente mais tarde." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Erro ao conectar com o Lovable AI" }), {
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
