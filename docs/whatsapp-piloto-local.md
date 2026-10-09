# WhatsApp integrado à Agenda — prévia local

DOCUMENTATION_IMPACT: UPDATE_REQUIRED. O painel `WhatsAppReminders` usa a API autenticada,
seleção de atendimentos visíveis na Agenda, revisão de mensagem/destinatário e confirmação
explícita antes de enfileirar. Permissão de leitura acompanha; gerenciamento respeita
contexto canônico; registro de autorização de contato exige administrador e ação explícita.
Resultado incerto não oferece retentativa. A troca de clínica fecha o painel e descarta
respostas HTTP pendentes do contexto anterior.

Regras, persistência, segurança e limites têm fonte única no MFBackend:
`docs/arquitetura/whatsapp-piloto-local.md`. A integração Meta permanece bloqueada.

Perfil fechado `MOTRIA_LOCAL_STACK_SLOT=whatsapp-pilot`: Frontend loopback3050,
Backend descartável3056. Execute npm ci nesta worktree e npm run dev com BROWSER=none.
Acesse http://127.0.0.1:3050/agendamentos, autentique-se na conta local fictícia
mauricio.preview@example.test e use Lembretes WhatsApp. Há Ana Costa e Bruno Lima,
com autorizações explícitas fictícias e atendimentos futuros na Clínica Horizonte.
A senha local é definida pelo runner Backend, sem credenciais reais.

Ferramentas técnicas ficam separadas em http://127.0.0.1:3050/whatsapp-cenarios.
Antes de confirmar o envio na Agenda, escolha resultado enviado/falha/incerto; depois
simule entrega, confirmação, indisponibilidade, interrupção ou texto livre. Para resposta
obsoleta, remarque o atendimento na Agenda e responda ao lembrete antigo nessa ferramenta.
A rota e o módulo de cenários não entram no bundle de produção; a API também exige
ambiente local/test, provedor simulado, banco descartável e administrador.
Não há qualquer envio externo. A interface clínica mantém linguagem normal por ajuste
de UX da coordenação; simulação e controles de teste ficam fora do fluxo assistencial.

Validação técnica: 186/186 testes em 10 suítes da Agenda, incluindo revisão obrigatória,
resultado incerto, perfil de leitura e descarte de resposta após troca de clínica;
build de produção e lint focado PASS. Ferramenta técnica ausente no JavaScript produzido.
Warnings preexistentes React act/Browserslist não foram corrigidos nesta sprint.
A validação visual é exclusivamente de Maurício.

O gate final usou --silent --testTimeout=15000. Uma repetição anterior teve dois
timeouts de cinco segundos em casos existentes de cancelamento; os três casos
envolvidos passaram isoladamente no limite original. Após ajustar a guarda ao
contexto real de autorização (sem pressupor clinic_id), o painel passou 4/4.

## Correção do acesso direto da prévia — 09/10/2026

Causa comprovada: connect-history-api-fallback do CRA recusava rotas internas
quando Accept estava ausente/vazio ou preferia application/json. Esses GETs
retornavam 404; com text/html ou */* a entrada React era servida. Além disso,
static/missing.js retornava HTML200 quando o fallback aceitava HTML.

`src/setupProxy.js` registra `scripts/lib/local-preview-routing.cjs` somente
com efeito no slot whatsapp-pilot em development. Raízes canônicas da aplicação
servem index.html para GET/HEAD direto, independentemente de Accept. API não é
reescrita; pedidos de arquivos deixam o handler estático responder e impedem
fallback HTML em recursos ausentes. Outros slots e produção permanecem sem
esse comportamento. Acesso não substitui autorização: as rotas React e API
continuam protegidas. Nenhum processo ou porta das outras sprints foi alterado.

Gates:13/13 PASS em `npm run test:local-development -- tests/local-preview-routing.test.cjs`;
38/38 verificações HTTP no servidor real, incluindo root/login/Agenda/cenários,
quatro Accepts, query, HEAD, bundle existente, API404 autenticada e assets404.
Menu/pacientes/configurações também verificados com Accept vazio:200 com React.
Lint focado e diffcheck PASS. No Chrome, login fictício realizado, navegação direta
à Agenda e refresh confirmados com sessão mantida, Agendamentos e Lembretes WhatsApp
presentes. Verificação técnica de acesso; avaliação visual permanece com Maurício.


## Módulo por prestador (extensão local de 09/10)

O menu WhatsApp e o botão na Agenda dependem do contrato canônico de autorização 9:
permissão individual WhatsApp + Agenda e `available: true`, catálogo de disponibilidade 1.
Não existe flag comercial no navegador. Os contratos 7/8 continuam compatíveis com oito
módulos e não habilitam WhatsApp; versões desconhecidas falham fechados. O editor de
perfis usa o catálogo da API, incluindo WhatsApp view/manage e alcance own/clinic.
A autorização de contato continua explícita e independente da disponibilidade comercial.

`/whatsapp` abre o painel já integrado à Agenda. A entrada direta também exige Agenda;
endpoints do servidor e worker revalidam disponibilidade e interseção de permissões.
O Platform Admin configurará o tenant na aba Módulos; desligar interrompe itens pendentes
e reativar não retoma backlog. `blocked_module` explica o encerramento no histórico.
A disponibilidade não ativa a Meta e não equivale à aprovação final da UX.

Prévia: http://127.0.0.1:3050/whatsapp. Cenários separados em
http://127.0.0.1:3050/whatsapp-cenarios; administração em http://127.0.0.1:3057/clinicas/4.
Somente simulação com dados fictícios, sem credenciais ou chamadas reais.


A rota WhatsApp usa somente o App Shell vigente, sem montar a navbar legada.
O hostname público reconhece essas rotas como internas, sem expor o aplicativo clínico.
Na conferência técnica de 09/10, o módulo desativado não apareceu na Agenda e a API
retornou 403. Reativar não reaplicou a revisão anterior: `blocked_module`, zero tentativas
e confirmação HTTP 403. O módulo do tenant fictício fica desligado ao final; habilitá-lo
na aba Módulos permite revisar a experiência simulada. Nenhuma habilitação comercial
liga o transporte real.


Fechamento técnico: 99/99 testes em sete suítes pertinentes; oito regressões selecionadas
da Agenda, launcher 11/11, build, lint focado e UTF-8 aprovados. Após a reconexão, a
execução integral inicialmente teve 126 aprovados e oito timeouts de 5.000 ms (463,744 s).
O recorte desses oito teve sete aprovados e um timeout; o caso restante também falhou
sozinho e passou em diagnóstico separado com o componente WhatsApp substituído por null.
O painel agora só monta seus estados e efeitos após disponibilidade e permissão válidas.
Sem alterar testes ou timeouts, a nova execução integral aprovou 134/134 (216,03 s),
registrada em `whatsapp-agenda-complete-inert-20261009.log`. O diagnóstico não prova uma
causa exclusiva para todos os timeouts; o resultado aprovado pertence à execução completa
da branch após a correção. Os seis testes do painel também passaram.
Lint do componente alterado, UTF-8, build e diffcheck passaram. Uma invocação adicional
de lint incluindo o teste do painel apontou `no-nested-ternary` preexistente no mock de
`WhatsAppReminders.test.js:15`; esse arquivo e a suíte da Agenda não foram alterados.
`DOCUMENTATION_IMPACT = UPDATE_REQUIRED`: este guia e frontend-module-architecture.md.

A promoção para catálogo 9 também preserva o contrato de histórico de unidades de pacote:
sete casos selecionados de autorização/cancelamento em 8/9 PASS, sem alterar as regras
de pacote ou financeiro.
